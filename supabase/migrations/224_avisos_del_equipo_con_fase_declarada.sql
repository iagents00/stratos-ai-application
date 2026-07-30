-- mig 224 — Los avisos de actividades del equipo declaran QUÉ son (pedido de Ángel 30-jul):
--   · El aviso de «Nueva actividad asignada» ya NO debe llevar los botones de estado;
--     los botones van en los RECORDATORIOS previos (60 y 10 min antes) y al llegar la hora.
--   · Hasta hoy el front ADIVINABA por el texto cuándo pintar botones (frágil: bundles
--     viejos pintaban de más, el nuevo no pintaba nada). Ahora la base escribe en
--     tg_bot_activity.meta el tipo y la fase ({kind:'team_action', fase:'60'|'10'|'0'|'asignada',
--     action_id}) y el front decide por DATO, no por patrón.
--   · Los recordatorios previos ganan texto claro: «En 1 hora: X (hoy 3:00 p.m.)»,
--     «En 10 minutos: X», «Es la hora: X» — antes salía el texto pelado de la tarea.
-- El escáner (fn_proactive_scan_team_actions, offsets [60,10,0] de Duke) NO se toca.
-- Revertir: CREATE OR REPLACE con el cuerpo anterior (encabezado del backup diario);
-- el front ignora meta si no está.

CREATE OR REPLACE FUNCTION public.fn_proactive_get_pending(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE; v_hour int; v_in_quiet boolean := false;
  v_limit int := COALESCE(NULLIF(payload->>'limit','')::int,50); v_rows jsonb; v_synth int;
  v_tipos text[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'tipo_in')), ARRAY[]::text[]);
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id=v_org;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok',true,'count',0,'reminders','[]'::jsonb,'reason','disabled'); END IF;
  v_hour := EXTRACT(hour FROM (now() AT TIME ZONE v_cfg.timezone))::int;
  IF v_cfg.quiet_start_hour > v_cfg.quiet_end_hour THEN v_in_quiet := (v_hour >= v_cfg.quiet_start_hour OR v_hour < v_cfg.quiet_end_hour);
  ELSE v_in_quiet := (v_hour >= v_cfg.quiet_start_hour AND v_hour < v_cfg.quiet_end_hour); END IF;
  WITH cand AS (
    SELECT r.id,r.lead_id,r.asesor_id,r.asesor_name,r.tipo,r.scheduled_at,r.payload,pr.telegram_chat_id AS advisor_tg,
      coalesce(pr.role,'asesor') AS role,
      row_number() OVER (PARTITION BY pr.telegram_chat_id ORDER BY (CASE WHEN r.tipo LIKE 'zoom%' OR r.tipo LIKE 'visita%' THEN 0 WHEN r.tipo LIKE 'next_action%' THEN 1 WHEN r.tipo IN ('team_action','personal') THEN 2 WHEN r.tipo LIKE 'inactividad%' THEN 9 ELSE 5 END), r.scheduled_at, r.id) AS rn
    FROM public.proactive_reminders r
    JOIN public.profiles pr ON pr.organization_id=v_org AND (pr.id=r.asesor_id OR lower(pr.name)=lower(r.asesor_name)) AND pr.telegram_chat_id IS NOT NULL
    WHERE r.organization_id=v_org AND r.status='pending' AND r.scheduled_at<=now() AND (NOT v_in_quiet OR r.ignore_quiet)
      AND (cardinality(v_tipos)=0 OR r.tipo = ANY(v_tipos))
      AND (
        -- pieza 3 sin fricción (A5, 24-jul): lo DIFERIBLE espera la jornada del asesor
        NOT (r.tipo LIKE 'inactividad%' OR r.tipo = 'next_action_3h')
        OR r.ignore_quiet
        OR public.fn_mkt_in_window(pr.id, now())
      )
      AND (
        r.tipo LIKE 'zoom%' OR r.tipo LIKE 'next_action%' OR r.tipo IN ('team_action','personal') OR r.tipo LIKE 'visita%' OR r.tipo LIKE 'evidence%' OR r.tipo LIKE 'admin%'
        OR NOT EXISTS (SELECT 1 FROM public.proactive_pending_reports o WHERE o.organization_id=v_org AND o.advisor_telegram_id=pr.telegram_chat_id AND o.status='open' AND (o.expires_at IS NULL OR o.expires_at>now()))
      )
  ), pick AS (SELECT * FROM cand WHERE rn=1 ORDER BY scheduled_at LIMIT v_limit),
  claimed AS (UPDATE public.proactive_reminders r SET status='sent',sent_at=now(),attempts=attempts+1 FROM pick WHERE r.id=pick.id
    RETURNING r.id,pick.lead_id,pick.asesor_id,pick.asesor_name,pick.tipo,pick.payload,pick.advisor_tg,pick.role),
  reports AS (INSERT INTO public.proactive_pending_reports (organization_id,advisor_telegram_id,lead_id,reminder_id,kind,status,expires_at)
    SELECT v_org,c.advisor_tg,c.lead_id,c.id,c.tipo,'open',
      CASE WHEN c.tipo='zoom_brief' THEN COALESCE(NULLIF(c.payload->>'zoom_at','')::timestamptz,now()+interval '4 hours')
           WHEN c.tipo LIKE 'next_action%' THEN COALESCE(NULLIF(c.payload->>'next_action_at','')::timestamptz,now()+interval '4 hours')
           ELSE now()+interval '12 hours' END
    FROM claimed c
    WHERE c.advisor_tg > 0
      AND c.tipo NOT IN ('team_action','personal','zoom_1h_missing','zoom_1h_ok','zoom_15min') AND c.tipo NOT LIKE 'visita%' AND c.tipo NOT LIKE 'evidence%' AND c.tipo NOT LIKE 'admin%'
    RETURNING reminder_id,id AS report_id),
  logged AS (
    INSERT INTO public.tg_bot_activity (telegram_chat_id, role, content, meta)
    SELECT c.advisor_tg, 'ai',
      COALESCE(
        CASE WHEN c.tipo='team_action' AND NULLIF(c.payload->>'text','') IS NOT NULL THEN
          CASE c.payload->>'fase'
            WHEN 'asignada' THEN 'Nueva actividad asignada: “'||(c.payload->>'text')||'”'||COALESCE(' — te la asignó '||NULLIF(c.payload->>'quien_asigna',''),'')||'. La ves en Mi Espacio → Agenda.'
            WHEN '60' THEN 'En 1 hora: '||(c.payload->>'text')||COALESCE(' ('||public.fn_fmt_cuando_legible(NULLIF(c.payload->>'due_at','')::timestamptz, COALESCE(NULLIF(c.payload->>'tz',''),'America/Cancun'))||')','')
            WHEN '10' THEN 'En 10 minutos: '||(c.payload->>'text')
            WHEN '0'  THEN 'Es la hora: '||(c.payload->>'text')
            ELSE NULL
          END
        WHEN c.tipo='personal' AND NULLIF(c.payload->>'text','') IS NOT NULL THEN 'Recordatorio: '||(c.payload->>'text') END,
        COALESCE(NULLIF(c.payload->>'text',''), NULLIF(c.payload->>'message',''),
        CASE WHEN c.tipo='zoom_brief' THEN 'Tienes un Zoom con un cliente próximamente. Estudia su información y prepárate.'
             WHEN c.tipo LIKE 'next_action%' THEN 'Tienes una acción programada con un cliente próximamente. Repasa su ficha antes de entrar.'
             WHEN c.tipo LIKE 'visita%' THEN 'Tienes una visita/recorrido agendado con un cliente próximamente.'
             ELSE 'Recordatorio proactivo (' || c.tipo || ').' END)),
      CASE WHEN c.tipo='team_action' THEN jsonb_build_object('kind','team_action','fase', COALESCE(c.payload->>'fase',''), 'action_id', c.payload->>'action_id')
           ELSE jsonb_build_object('kind', c.tipo) END
    FROM claimed c WHERE c.advisor_tg < 0
    RETURNING 1)
  SELECT
    jsonb_agg(jsonb_build_object('reminder_id',c.id,'report_id',rp.report_id,'lead_id',c.lead_id,'asesor_id',c.asesor_id,'asesor_name',c.asesor_name,'advisor_telegram_id',c.advisor_tg,'tipo',c.tipo,'payload',c.payload)) FILTER (WHERE c.advisor_tg > 0),
    count(*) FILTER (WHERE c.advisor_tg < 0)
  INTO v_rows, v_synth
  FROM claimed c LEFT JOIN reports rp ON rp.reminder_id=c.id;

  RETURN jsonb_build_object('ok',true,'count',COALESCE(jsonb_array_length(v_rows),0),'shadow_mode',v_cfg.shadow_mode,'test_telegram_id',v_cfg.test_telegram_id,'reminders',COALESCE(v_rows,'[]'::jsonb),
    'synthetic_logged', COALESCE(v_synth,0));
END; $function$;