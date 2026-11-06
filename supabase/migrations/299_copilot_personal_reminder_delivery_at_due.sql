-- Personal reminders stay visible in the agenda and fire once at the requested time. No historical backfill.
CREATE OR REPLACE FUNCTION public.bot_create_personal_reminder(p_telegram_chat_id bigint, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_as jsonb := public.identify_asesor_by_telegram(p_telegram_chat_id);
  v_org uuid; v_pid uuid; v_name text; v_tz text;
  v_text text := nullif(btrim(coalesce(p_args->>'text', p_args->>'reminder', p_args->>'texto', p_args->>'nota', p_args->>'mensaje','')),'');
  v_raw  text := nullif(btrim(coalesce(p_args->>'when', p_args->>'fecha', p_args->>'datetime', p_args->>'cuando', p_args->>'hora','')),'');
  v_when timestamptz; v_legible text; v_agenda jsonb; v_action uuid;
BEGIN
  IF NOT coalesce((v_as->>'paired')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'reply', jsonb_build_object(
      'text','Primero conecta tu Telegram al CRM para usar recordatorios.', 'parse_mode', null,
      'inline_keyboard', public._bot_kb_back()));
  END IF;
  v_org := (v_as->>'organization_id')::uuid;
  v_pid := (v_as->>'profile_id')::uuid;
  v_name := v_as->>'name';
  v_tz := coalesce(public.fn_user_tz(v_org, p_telegram_chat_id), 'America/Cancun');

  IF v_text IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reply', jsonb_build_object(
      'text','¿Qué quieres que te recuerde y a qué hora? Ej: "recordame llamar a Juan mañana 9am".',
      'parse_mode', null, 'inline_keyboard', public._bot_kb_back()));
  END IF;

  v_when := public.parse_relative_or_abs_es(coalesce(v_raw, v_text), v_tz);
  IF v_when IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reply', jsonb_build_object(
      'text','¿Para cuándo te lo recuerdo? Ej: en 2 horas, mañana 9am, el viernes 10am.',
      'parse_mode', null, 'inline_keyboard', public._bot_kb_back()));
  END IF;
  IF v_when <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reply', jsonb_build_object(
      'text','Esa hora ya pasó ⏰. Dime una hora futura, ej: mañana 9am.',
      'parse_mode', null, 'inline_keyboard', public._bot_kb_back()));
  END IF;

  -- A personal reminder belongs to the same person's visible agenda. The
  -- normalized title and DB-resolved instant keep story dates out of scheduling.
  v_agenda:=public.bot_agenda_personal_create(p_telegram_chat_id,jsonb_build_object(
    'input_text',v_text,'due_at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'category','personal'));
  if not coalesce((v_agenda->>'ok')::boolean,false) or nullif(v_agenda->>'action_id','') is null then return v_agenda; end if;
  select id,due_at into v_action,v_when from public.team_actions where organization_id=v_org and asesor_id=v_pid and id=(v_agenda->>'action_id')::uuid;
  if v_action is null then raise exception 'No se confirmó el recordatorio en tu agenda.'; end if;
  update public.team_actions set nota=coalesce(nota,'')||E'\ncopilot_personal_reminder'
   where organization_id=v_org and id=v_action and position('copilot_personal_reminder' in coalesce(nota,''))=0;
  -- Deliver at the requested instant even when this company's task offsets omit 0.
  -- The task scanners skip this marker, avoiding extra warnings or duplicate alerts.
  insert into public.proactive_reminders(organization_id,lead_id,asesor_id,asesor_name,tipo,scheduled_at,dedupe_key,payload,ignore_quiet)
  values(v_org,null,v_pid,v_name,'personal',v_when,'personal_action:'||v_action||':'||to_char(v_when AT TIME ZONE 'UTC','YYYYMMDDHH24MISS'),
   jsonb_build_object('text',v_text,'action_id',v_action,'due_at',v_when),true)
  on conflict(dedupe_key) do nothing;
  return v_agenda;


END; $function$;

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
  
  v_offsets := coalesce(v_cfg.team_reminder_offsets,
                        CASE WHEN v_req_ev THEN ARRAY[180, 60] ELSE ARRAY[60, 10, 0] END);

  WITH candidates AS (
    SELECT a.id, p.id AS member_id, a.asesor_name AS member_name, a.text, a.due_at, ''::text AS scope
    FROM public.team_actions a
    JOIN public.profiles p ON p.id = a.asesor_id AND p.telegram_chat_id IS NOT NULL
    WHERE a.organization_id = v_org_id AND position('copilot_personal_reminder' in coalesce(a.nota,''))=0 AND a.done = false AND a.last_response_at IS NULL AND a.evidence_at IS NULL AND a.due_at IS NOT NULL
      AND lower(coalesce(a.asesor_name,'')) <> 'todos'
      AND a.due_at > now() - interval '1 hour' AND a.due_at <= now() + interval '25 hours'
      AND (NOT v_cfg.shadow_mode OR a.asesor_name = ANY (v_cfg.test_asesor_names))
    UNION ALL
    SELECT a.id, p.id AS member_id, p.name AS member_name, a.text, a.due_at, 'all'::text AS scope
    FROM public.team_actions a
    JOIN public.profiles p ON p.organization_id = v_org_id AND p.telegram_chat_id IS NOT NULL AND coalesce(p.active,true) = true
    WHERE a.organization_id = v_org_id AND position('copilot_personal_reminder' in coalesce(a.nota,''))=0 AND a.done = false AND a.last_response_at IS NULL AND a.evidence_at IS NULL AND a.due_at IS NOT NULL
      AND lower(coalesce(a.asesor_name,'')) = 'todos'
      AND a.due_at > now() - interval '1 hour' AND a.due_at <= now() + interval '25 hours'
      AND (NOT v_cfg.shadow_mode OR p.name = ANY (v_cfg.test_asesor_names))
  ),
  fires AS (
    SELECT c.id, c.member_id, c.member_name, c.text, c.due_at, c.scope,
           m AS fase_min,
           c.due_at - (m * interval '1 minute') AS fire_at
    FROM candidates c
    CROSS JOIN LATERAL unnest(v_offsets) AS m
    WHERE (c.due_at - (m * interval '1 minute')) >  now() - interval '45 minutes'
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

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_team_overdue(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org   uuid := coalesce(nullif(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg   public.proactive_config%rowtype;
  v_enq   int := 0;
  v_hour  int;
  v_admin_id   uuid;
  v_admin_name text;
begin
  select * into v_cfg from public.proactive_config where organization_id = v_org;
  if not found or not v_cfg.enabled or not coalesce(v_cfg.team_requires_evidence, false) then
    return jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'overdue_off');
  end if;

  v_hour := extract(hour from (now() at time zone v_cfg.timezone))::int;
  if v_hour < 8 or v_hour >= 20 then
    return jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'off_hours');
  end if;

  select id, name into v_admin_id, v_admin_name
  from public.profiles
  where organization_id = v_org
    and role in ('admin','super_admin','ceo','director')
    and coalesce(active, true) = true
    and telegram_chat_id is not null
    and coalesce(receives_sales_alerts,true)
  order by created_at
  limit 1;

  if v_admin_id is null then
    return jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'no_admin');
  end if;

  with last_alert as (
    select r.payload->>'action_id' as action_id,
           max(coalesce(r.sent_at, r.scheduled_at)) as last_at,
           count(*) as alert_count
    from public.proactive_reminders r
    where r.organization_id = v_org and r.tipo = 'admin_overdue'
    group by r.payload->>'action_id'
  ),
  cand as (
    select a.id, a.asesor_name as obrero, a.text, a.due_at,
           (select p.telegram_chat_id from public.profiles p where p.id = a.asesor_id) as obrero_tg
    from public.team_actions a
    left join last_alert la on la.action_id = a.id::text
    where a.organization_id = v_org
      and position('copilot_personal_reminder' in coalesce(a.nota,''))=0
      and a.done = false and a.evidence_at is null
      and lower(coalesce(a.asesor_name,'')) <> 'todos'
      and a.due_at is not null
      and a.due_at < now() - interval '15 minutes'
      and (a.last_response_at is null or a.last_response_at < now() - interval '2 hours')
      and (
            (la.action_id is null and a.due_at > now() - interval '6 hours')
         or (la.last_at <= now() - interval '24 hours' and la.alert_count < 3)
          )
  ),
  ins as (
    insert into public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    select v_org, null, v_admin_id, v_admin_name, 'admin_overdue', now(),
           'team_overdue:' || c.id::text || ':' || to_char(now(),'YYYYMMDDHH24MI'),
           false,
           jsonb_build_object('action_id', c.id, 'text', c.text, 'due_at', c.due_at,
                              'obrero', c.obrero, 'obrero_tg', c.obrero_tg, 'fase', 'admin_overdue')
    from cand c
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_enq from ins;
  return jsonb_build_object('ok', true, 'enqueued', v_enq, 'organization_id', v_org);
end;
$function$;