-- 095_bot_personal_agenda_fix_short_reminders.sql
--
-- Fix: Recordatorios personales y de agenda de corto plazo / a la hora exacta (`0` minutos).
-- - Actualiza proactive_config para incluir `0` en team_reminder_offsets si no estaba.
-- - Actualiza fn_proactive_scan_team_actions para lookahead inmediato en recordatorios de `0` min (vencimiento exacto).
-- - Actualiza bot_agenda_personal_create para encolar en proactive_reminders la alerta exacta y no responder
--   "Te recordaré 1 hora antes y 10 minutos antes" cuando faltan menos de 60 minutos.

-- 1. Añadir 0 a los offsets para que siempre avise a la hora del vencimiento además de pre-avisos
UPDATE public.proactive_config
   SET team_reminder_offsets = ARRAY[60, 10, 0]
 WHERE team_reminder_offsets = ARRAY[60, 10]
    OR team_reminder_offsets IS NULL;

-- 2. Actualizar fn_proactive_scan_team_actions con lookahead y tolerancia hacia atrás
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
    WHERE a.organization_id = v_org_id AND a.done = false AND a.last_response_at IS NULL AND a.evidence_at IS NULL AND a.due_at IS NOT NULL
      AND lower(coalesce(a.asesor_name,'')) <> 'todos'
      AND a.due_at > now() - interval '1 hour' AND a.due_at <= now() + interval '25 hours'
      AND (NOT v_cfg.shadow_mode OR a.asesor_name = ANY (v_cfg.test_asesor_names))
    UNION ALL
    SELECT a.id, p.id AS member_id, p.name AS member_name, a.text, a.due_at, 'all'::text AS scope
    FROM public.team_actions a
    JOIN public.profiles p ON p.organization_id = v_org_id AND p.telegram_chat_id IS NOT NULL AND coalesce(p.active,true) = true
    WHERE a.organization_id = v_org_id AND a.done = false AND a.last_response_at IS NULL AND a.evidence_at IS NULL AND a.due_at IS NOT NULL
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

-- 3. Actualizar bot_agenda_personal_create con encolado directo en proactive_reminders y respuesta inteligente
CREATE OR REPLACE FUNCTION public.bot_agenda_personal_create(p_telegram_chat_id bigint, p_args jsonb default '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path to 'public','pg_temp'
AS $$
DECLARE
  v_profile public.profiles%rowtype;
  v_tz text;
  v_text text := public._bot_agenda_extract_text(coalesce(p_args,'{}'::jsonb));
  v_title text;
  v_due_info jsonb;
  v_due timestamptz;
  v_action_id uuid;
  v_order int;
  v_default_time boolean;
  v_mins_until int;
  v_reminder_msg text;
BEGIN
  SELECT *
    INTO v_profile
  FROM public.profiles
  WHERE telegram_chat_id = p_telegram_chat_id
    AND coalesce(active, true) = true
  ORDER BY updated_at desc nulls last
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estás conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  END IF;

  v_tz := public.fn_user_tz(v_profile.organization_id, p_telegram_chat_id);
  v_due_info := public._bot_agenda_parse_due_at(v_text, coalesce(p_args,'{}'::jsonb), v_tz);

  IF NOT coalesce((v_due_info->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'needs_date', true,
      'reply', jsonb_build_object(
        'text', 'Claro. Dime fecha y hora para agendarlo, por ejemplo: “recuérdame llamar a Juan mañana a las 10”.',
        'inline_keyboard', '[]'::jsonb
      )
    );
  END IF;

  v_due := (v_due_info->>'due_at')::timestamptz;
  v_default_time := coalesce((v_due_info->>'default_time')::boolean, false);
  v_title := public._bot_agenda_extract_title(coalesce(nullif(v_text,''), p_args->>'task', p_args->>'title', p_args->>'name'));

  SELECT coalesce(max(order_idx), 0) + 1
    INTO v_order
  FROM public.team_actions
  WHERE organization_id = v_profile.organization_id
    AND coalesce(done,false) = false;

  INSERT INTO public.team_actions (
    organization_id,
    text,
    asesor_id,
    asesor_name,
    category,
    priority,
    done,
    due_at,
    completed_at,
    nota,
    assignee_type,
    order_idx,
    created_by,
    status
  )
  VALUES (
    v_profile.organization_id,
    v_title,
    v_profile.id,
    v_profile.name,
    'personal',
    CASE WHEN public._bot_agenda_norm(v_text) ~ '\burgente\b|\bimportante\b' THEN 'alta' ELSE 'normal' END,
    false,
    v_due,
    null,
    'created_from_telegram',
    'human',
    v_order,
    v_profile.id,
    'pending'
  )
  RETURNING id INTO v_action_id;

  -- Encolar INMEDIATAMENTE en proactive_reminders para la hora exacta (fase 0)
  INSERT INTO public.proactive_reminders (
    organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, payload
  )
  VALUES (
    v_profile.organization_id, NULL, v_profile.id, v_profile.name, 'team_action', v_due,
    'team_action:' || v_action_id::text || ':0:' || to_char(v_due,'YYYYMMDDHH24MI'),
    jsonb_build_object('action_id', v_action_id, 'text', v_title, 'due_at', v_due,
                       'fase', '0', 'fase_min', 0, 'tz', v_tz, 'scope', '')
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  v_mins_until := ROUND(EXTRACT(EPOCH FROM (v_due - now())) / 60.0);

  IF v_mins_until <= 65 THEN
    v_reminder_msg := E'\n\n🔔 Te enviaré la alerta exactamente a la hora programada.';
  ELSE
    v_reminder_msg := E'\n\nTe recordaré 1 hora antes, 10 minutos antes y a la hora exacta.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'reply', jsonb_build_object(
      'text',
      'Listo, lo agregué a tu agenda personal: “' || v_title || '” para ' ||
      public._bot_agenda_reply_date(v_due, v_tz) ||
      CASE WHEN v_default_time THEN E'\n\nNo detecté hora exacta, así que lo dejé a las 09:00. Puedes decir “pospón esto 30 minutos” o “cámbialo a las 11”.' ELSE '' END ||
      v_reminder_msg,
      'inline_keyboard',
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_proactive_scan_team_actions(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_agenda_personal_create(bigint, jsonb) TO service_role;
