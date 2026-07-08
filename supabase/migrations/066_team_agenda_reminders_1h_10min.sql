-- 066: La Lista de Acción funciona como AGENDA con recordatorios por Telegram
--       (1 hora antes + 10 minutos antes), para toda org conectada a Telegram.
--
-- Contexto (pedido de Iván, 08-jul-2026):
--   "que se pueda llevar como una agenda y la lista de acción... el seguimiento
--    incluso a esas acciones una hora antes, diez minutos antes por Telegram."
--
-- Estado previo:
--   • fn_proactive_scan_team_actions avisaba de tareas de equipo a 1 DÍA y 3 H antes
--     (orgs sin evidencia como Duke/Sales) — ventanas hardcodeadas.
--   • El coach STRATOS_TeamActions_Coach solo escaneaba la org de Duke; Stratos Sales
--     nunca recibía recordatorios de su Lista de Acción.
--   • El comando "agenda" del bot, para orgs sin evidencia, mostraba solo próximas
--     acciones de LEADS (bot_proximas_acciones), no la Lista de Acción.
--
-- Este cambio:
--   a. proactive_config.team_reminder_offsets int[] — minutos-antes configurables por org
--      (white-label). Default {60,10} = 1 h + 10 min. Vega conserva {180,60} = 3 h + 1 h
--      para no romper su lógica de evidencia/insistencia.
--   b. fn_proactive_scan_team_actions: usa esos offsets + lookahead corto (encola cada
--      fase ~15 min antes de que toque, no 25 h antes → menos recordatorios obsoletos si
--      la tarea se completa o se reprograma). Mete tz y fase_min en el payload.
--   c. fn_proactive_scan_team_actions_all / fn_proactive_get_pending_team: wrappers que
--      recorren TODAS las orgs sin evidencia (Duke + Stratos Sales + futuras), para que
--      un solo coach las cubra. Vega (con evidencia) sigue con su propio coach.
--   d. bot_proximas_acciones (el que usa "agenda"/"que tengo hoy" en orgs sin evidencia):
--      ahora muestra la Lista de Acción del usuario + el seguimiento de clientes, juntos.
--
-- Aislamiento: cada query es org-scoped; Vega no se toca (offsets {180,60}, su coach aparte).

-- ── a. Columna de ventanas configurables ──────────────────────────────────────
ALTER TABLE public.proactive_config
  ADD COLUMN IF NOT EXISTS team_reminder_offsets int[] DEFAULT ARRAY[60, 10];

-- Backfill: evidencia (Vega) conserva 3 h + 1 h; el resto pasa a 1 h + 10 min.
UPDATE public.proactive_config
   SET team_reminder_offsets = CASE WHEN coalesce(team_requires_evidence, false)
                                    THEN ARRAY[180, 60] ELSE ARRAY[60, 10] END
 WHERE team_reminder_offsets IS NULL
    OR team_reminder_offsets = ARRAY[60, 10];  -- normaliza filas viejas al criterio por tipo

-- ── b. Scan con offsets configurables + lookahead corto ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_proactive_scan_team_actions(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE;
  v_enqueued int := 0;
  v_req_ev boolean := false;
  v_offsets int[];
  v_tz text;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled');
  END IF;
  v_req_ev := coalesce(v_cfg.team_requires_evidence, false);
  v_tz     := coalesce(v_cfg.timezone, 'America/Cancun');
  -- Offsets (minutos antes del vencimiento). Si la fila no tiene, cae al criterio por tipo:
  -- evidencia = 3 h + 1 h (compat Vega + insistencia); resto = 1 h + 10 min (agenda).
  v_offsets := coalesce(v_cfg.team_reminder_offsets,
                        CASE WHEN v_req_ev THEN ARRAY[180, 60] ELSE ARRAY[60, 10] END);

  WITH candidates AS (
    SELECT a.id, p.id AS member_id, a.asesor_name AS member_name, a.text, a.due_at, ''::text AS scope
    FROM public.team_actions a
    JOIN public.profiles p ON p.id = a.asesor_id AND p.telegram_chat_id IS NOT NULL
    WHERE a.organization_id = v_org_id AND a.done = false AND a.last_response_at IS NULL AND a.evidence_at IS NULL AND a.due_at IS NOT NULL
      AND lower(coalesce(a.asesor_name,'')) <> 'todos'
      AND a.due_at > now() AND a.due_at <= now() + interval '25 hours'
      AND (NOT v_cfg.shadow_mode OR a.asesor_name = ANY (v_cfg.test_asesor_names))
    UNION ALL
    SELECT a.id, p.id AS member_id, p.name AS member_name, a.text, a.due_at, 'all'::text AS scope
    FROM public.team_actions a
    JOIN public.profiles p ON p.organization_id = v_org_id AND p.telegram_chat_id IS NOT NULL AND coalesce(p.active,true) = true
    WHERE a.organization_id = v_org_id AND a.done = false AND a.last_response_at IS NULL AND a.evidence_at IS NULL AND a.due_at IS NOT NULL
      AND lower(coalesce(a.asesor_name,'')) = 'todos'
      AND a.due_at > now() AND a.due_at <= now() + interval '25 hours'
      AND (NOT v_cfg.shadow_mode OR p.name = ANY (v_cfg.test_asesor_names))
  ),
  fires AS (
    SELECT c.id, c.member_id, c.member_name, c.text, c.due_at, c.scope,
           m AS fase_min,
           c.due_at - (m * interval '1 minute') AS fire_at
    FROM candidates c
    CROSS JOIN LATERAL unnest(v_offsets) AS m
    -- Lookahead corto: encolar la fase solo cuando está por dispararse (dentro de 15 min,
    -- con 30 min de gracia hacia atrás por si un scan se saltó). El scan corre cada 10 min.
    WHERE (c.due_at - (m * interval '1 minute')) >  now() - interval '30 minutes'
      AND (c.due_at - (m * interval '1 minute')) <= now() + interval '15 minutes'
  ),
  ins AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, payload)
    SELECT v_org_id, NULL, f.member_id, f.member_name, 'team_action', GREATEST(f.fire_at, now()),
           'team_action:' || f.id::text || ':' || f.fase_min::text || ':' || to_char(f.due_at,'YYYYMMDDHH24MI')
             || CASE WHEN f.scope = 'all' THEN ':all:' || f.member_id::text ELSE '' END,
           jsonb_build_object('action_id', f.id, 'text', f.text, 'due_at', f.due_at,
                              'fase', f.fase_min::text, 'fase_min', f.fase_min, 'tz', v_tz, 'scope', f.scope)
    FROM fires f
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_enqueued FROM ins;
  RETURN jsonb_build_object('ok', true, 'enqueued', v_enqueued, 'organization_id', v_org_id);
END;
$function$;

-- ── c. Wrappers multi-org (todas las orgs SIN evidencia: Duke + Stratos Sales + futuras) ──
-- Vega tiene evidencia y su propio coach → queda excluida acá (no doble consumo).
CREATE OR REPLACE FUNCTION public.fn_proactive_scan_team_actions_all(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_org uuid; v_total int := 0; v_orgs int := 0; v_res jsonb;
BEGIN
  FOR v_org IN
    SELECT pc.organization_id FROM public.proactive_config pc
    WHERE pc.enabled = true AND coalesce(pc.team_requires_evidence, false) = false
  LOOP
    v_res  := public.fn_proactive_scan_team_actions(jsonb_build_object('organization_id', v_org));
    v_total := v_total + coalesce((v_res->>'enqueued')::int, 0);
    v_orgs  := v_orgs + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'orgs', v_orgs, 'enqueued', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_proactive_get_pending_team(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid;
  v_limit int := coalesce(nullif(payload->>'limit','')::int, 10);
  v_all jsonb := '[]'::jsonb;
  v_res jsonb;
BEGIN
  FOR v_org IN
    SELECT pc.organization_id FROM public.proactive_config pc
    WHERE pc.enabled = true AND coalesce(pc.team_requires_evidence, false) = false
  LOOP
    v_res := public.fn_proactive_get_pending(jsonb_build_object(
               'organization_id', v_org,
               'tipo_in', jsonb_build_array('team_action'),
               'limit', v_limit));
    IF coalesce((v_res->>'count')::int, 0) > 0 THEN
      v_all := v_all || coalesce(v_res->'reminders', '[]'::jsonb);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_all), 'reminders', v_all);
END;
$function$;

-- ── d. La "agenda" del bot (orgs sin evidencia) muestra Lista de Acción + clientes ──
-- Único caller: bot_nlu_dispatch_gvintell_inner (tool 'agenda'/'pendientes'/'proximas').
CREATE OR REPLACE FUNCTION public.bot_proximas_acciones(p_telegram_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid; v_pid uuid; v_view_all boolean; v_tz text; v_name text;
  v_tasks text; v_leads text; v_msg text;
begin
  select organization_id, id, coalesce(view_all_leads,false), name
    into v_org, v_pid, v_view_all, v_name
  from public.profiles where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true
  order by updated_at desc nulls last limit 1;
  if not found then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No estas conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;
  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);

  -- Lista de Acción (team_actions) asignadas a mí o a "Todos" (broadcast).
  select string_agg(line, E'\n') into v_tasks from (
    select
      '• '||
      case when ta.due_at < now() then '⚠️ '
           when ta.due_at < now() + interval '2 hours' then '🔥 ' else '' end ||
      to_char(ta.due_at at time zone v_tz,'DD/MM HH24:MI')||' — '||ta.text||
      case when lower(coalesce(ta.asesor_name,'')) = 'todos' then ' 👥' else '' end as line,
      ta.due_at
    from public.team_actions ta
    where ta.organization_id = v_org
      and coalesce(ta.done,false) = false
      and ta.due_at is not null
      and ( ta.asesor_id = v_pid
            or lower(coalesce(ta.asesor_name,'')) = lower(coalesce(v_name,''))
            or lower(coalesce(ta.asesor_name,'')) = 'todos' )
      and ta.due_at >= now() - interval '2 days'
      and ta.due_at <= now() + interval '14 days'
    order by ta.due_at asc
    limit 12
  ) s;

  -- Seguimiento de clientes (leads con próxima acción).
  select string_agg(line, E'\n') into v_leads from (
    select '• '||coalesce(l.name,'Sin nombre')||' — '||coalesce(l.next_action,'(sin acción)')||
           ' — '||to_char(l.next_action_at at time zone v_tz,'DD/MM HH24:MI')||
           case when l.next_action_at < now() then ' ⚠️ vencida'
                when l.next_action_at < now() + interval '2 hours' then ' 🔥 pronto' else '' end as line
    from public.leads l
    where l.organization_id=v_org and l.deleted_at is null and (v_view_all or l.asesor_id=v_pid)
      and l.next_action_at is not null and l.next_action_at >= now() - interval '2 days'
      and l.next_action_at <= now() + interval '30 days' and (l.stage is null or l.stage not in ('Cierre','Perdido'))
    order by (l.next_action_at >= now()) desc, case when l.next_action_at >= now() then l.next_action_at end asc, l.next_action_at desc
    limit 8
  ) s;

  if v_tasks is null and v_leads is null then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','No tienes acciones ni próximas acciones con fecha en los próximos días. 🎉','inline_keyboard','[]'::jsonb));
  end if;

  v_msg := 'Tu agenda (más cercanas primero):';
  if v_tasks is not null then v_msg := v_msg || E'\n\n📋 Lista de Acción\n' || v_tasks; end if;
  if v_leads is not null then v_msg := v_msg || E'\n\n👤 Seguimiento de clientes\n' || v_leads; end if;
  return jsonb_build_object('ok',true,'reply',jsonb_build_object('text',v_msg,'inline_keyboard','[]'::jsonb));
end;
$function$;
