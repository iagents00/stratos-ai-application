-- ════════════════════════════════════════════════════════════════════════
-- 036 — Motor proactivo: UNA solicitud abierta a la vez por asesor
-- ────────────────────────────────────────────────────────────────────────
-- Serializa los recordatorios: cada asesor recibe UNA solicitud a la vez.
-- "Solicitud abierta" = fila open (no vencida) en proactive_pending_reports.
--   · get_pending v2: por asesor, salta si tiene report open; si no, despacha
--     UNA (prioridad zoom_brief > inactividad) y ABRE el lock al despachar
--     (zoom → expires_at=zoom_at; inactividad → now()+24h). Máx 1/asesor/ciclo.
--   · Cierres que liberan: log_plan (plan validado), inact_action
--     (contacte/reagendar/perdido). La escalación NO cierra (deja open hasta
--     zoom_at; expire_stale lo cierra). insistencia: scan_insist 24h sin actuar.
--   · Incluye 035: acción 'perdido'→Rotación, tipo 'inactividad_insist',
--     fn_proactive_scan_insist. Reemplaza el enfoque de selected_at.
--   · Mantiene el fix 035b (escritura en expediente_items para el timeline CRM).
-- Aditiva/idempotente. Scoped a Duke, service_role only.
-- IMPORTANTE: ejecutada vía MCP en producción. Source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.proactive_reminders DROP CONSTRAINT proactive_reminders_tipo_check;
ALTER TABLE public.proactive_reminders ADD CONSTRAINT proactive_reminders_tipo_check
  CHECK (tipo = ANY (ARRAY['inactividad','zoom_brief','zoom_escalation','custom','inactividad_insist']));

CREATE OR REPLACE FUNCTION public.fn_proactive_get_pending(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE; v_hour int; v_in_quiet boolean := false;
  v_limit int := COALESCE(NULLIF(payload->>'limit','')::int, 50); v_rows jsonb;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id=v_org;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok',true,'count',0,'reminders','[]'::jsonb,'reason','disabled'); END IF;
  v_hour := EXTRACT(hour FROM (now() AT TIME ZONE v_cfg.timezone))::int;
  IF v_cfg.quiet_start_hour > v_cfg.quiet_end_hour THEN
    v_in_quiet := (v_hour >= v_cfg.quiet_start_hour OR v_hour < v_cfg.quiet_end_hour);
  ELSE v_in_quiet := (v_hour >= v_cfg.quiet_start_hour AND v_hour < v_cfg.quiet_end_hour); END IF;

  WITH cand AS (
    SELECT r.id, r.lead_id, r.asesor_id, r.asesor_name, r.tipo, r.scheduled_at, r.payload,
           pr.telegram_chat_id AS advisor_tg,
           row_number() OVER (PARTITION BY pr.telegram_chat_id
             ORDER BY (CASE WHEN r.tipo='zoom_brief' THEN 0 ELSE 1 END), r.scheduled_at, r.id) AS rn
    FROM public.proactive_reminders r
    JOIN public.profiles pr ON pr.organization_id=v_org
      AND (pr.id = r.asesor_id OR lower(pr.name)=lower(r.asesor_name))
      AND pr.telegram_chat_id IS NOT NULL
    WHERE r.organization_id=v_org AND r.status='pending' AND r.scheduled_at <= now()
      AND (NOT v_in_quiet OR r.ignore_quiet)
      AND NOT EXISTS (SELECT 1 FROM public.proactive_pending_reports o
        WHERE o.organization_id=v_org AND o.advisor_telegram_id=pr.telegram_chat_id
          AND o.status='open' AND (o.expires_at IS NULL OR o.expires_at > now()))
  ),
  pick AS (SELECT * FROM cand WHERE rn=1 ORDER BY scheduled_at LIMIT v_limit),
  claimed AS (
    UPDATE public.proactive_reminders r SET status='sent', sent_at=now(), attempts=attempts+1
    FROM pick WHERE r.id=pick.id
    RETURNING r.id, pick.lead_id, pick.asesor_id, pick.asesor_name, pick.tipo, pick.payload, pick.advisor_tg
  ),
  reports AS (
    INSERT INTO public.proactive_pending_reports
      (organization_id, advisor_telegram_id, lead_id, reminder_id, status, expires_at)
    SELECT v_org, c.advisor_tg, c.lead_id, c.id, 'open',
      CASE WHEN c.tipo='zoom_brief'
           THEN COALESCE(NULLIF(c.payload->>'zoom_at','')::timestamptz, now()+interval '4 hours')
           ELSE now()+interval '24 hours' END
    FROM claimed c
    RETURNING reminder_id, id AS report_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'reminder_id', c.id, 'report_id', rp.report_id, 'lead_id', c.lead_id,
    'asesor_id', c.asesor_id, 'asesor_name', c.asesor_name,
    'advisor_telegram_id', c.advisor_tg, 'tipo', c.tipo, 'payload', c.payload))
  INTO v_rows FROM claimed c LEFT JOIN reports rp ON rp.reminder_id=c.id;

  RETURN jsonb_build_object('ok',true,'count',COALESCE(jsonb_array_length(v_rows),0),
    'shadow_mode',v_cfg.shadow_mode,'test_telegram_id',v_cfg.test_telegram_id,
    'reminders',COALESCE(v_rows,'[]'::jsonb));
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_log_plan(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid; v_report uuid := NULLIF(payload->>'report_id','')::uuid;
  v_asesor text := COALESCE(NULLIF(payload->>'asesor_name',''),'(sin asesor)');
  v_plan text := COALESCE(payload->>'plan',''); v_resumen text := COALESCE(payload->>'resumen','');
  v_desc text; v_agent_id uuid; v_com_id uuid;
BEGIN
  IF v_lead IS NULL THEN RETURN jsonb_build_object('ok',false,'error','lead_id required'); END IF;
  IF length(trim(v_plan))=0 THEN RETURN jsonb_build_object('ok',false,'error','plan required'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id=v_lead AND organization_id=v_org_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok',false,'error','lead not found'); END IF;
  IF v_report IS NOT NULL THEN
    SELECT id INTO v_com_id FROM public.comunicaciones WHERE lead_id=v_lead AND organization_id=v_org_id AND metadata->>'report_id'=v_report::text LIMIT 1;
    IF v_com_id IS NOT NULL THEN
      UPDATE public.proactive_pending_reports SET status='closed', outcome=COALESCE(outcome,'plan validado')
      WHERE organization_id=v_org_id AND status='open' AND (id=v_report OR lead_id=v_lead);
      RETURN jsonb_build_object('ok',true,'comunicacion_id',v_com_id,'action','already_logged'); END IF;
  END IF;
  SELECT asesor_id INTO v_agent_id FROM public.leads WHERE id=v_lead;
  v_desc := 'Preparación de Zoom (asistente IA) — Asesor: '||v_asesor||'. Plan: '||v_plan||CASE WHEN length(trim(v_resumen))>0 THEN '. Resumen: '||v_resumen ELSE '' END||'.';
  INSERT INTO public.comunicaciones (lead_id, organization_id, tipo, resumen, asesor_id, ocurrio_en, metadata)
  VALUES (v_lead, v_org_id, 'nota', v_desc, v_agent_id, now(), jsonb_build_object('source','proactive_log_plan','report_id',v_report,'asesor_name',v_asesor)) RETURNING id INTO v_com_id;
  INSERT INTO public.expediente_items (lead_id, organization_id, tipo, titulo, descripcion, asesor_id, metadata)
  VALUES (v_lead, v_org_id, 'nota_ia', 'Plan de Zoom (asistente IA)', v_desc, v_agent_id, jsonb_build_object('source','proactive_log_plan','report_id',v_report,'asesor_name',v_asesor));
  UPDATE public.proactive_pending_reports SET status='closed', outcome=COALESCE(outcome,'plan validado')
  WHERE organization_id=v_org_id AND status='open' AND (id=v_report OR (v_report IS NULL AND lead_id=v_lead));
  UPDATE public.leads SET updated_at=now(), last_activity=to_char(now(),'YYYY-MM-DD HH24:MI') WHERE id=v_lead;
  RETURN jsonb_build_object('ok',true,'comunicacion_id',v_com_id,'action','logged');
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_inact_action(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_action text := lower(COALESCE(payload->>'action','')); v_lead_id uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_agent_id uuid; v_lead RECORD; v_text text;
BEGIN
  IF v_action NOT IN ('contacte','reagendar','ficha','perdido') THEN
    RETURN jsonb_build_object('ok',false,'text','Acción inválida. Usá: contacte, reagendar, ficha o perdido.'); END IF;
  IF v_lead_id IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Falta lead_id.'); END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id=v_lead_id AND organization_id=v_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'text','No encontré ese lead.'); END IF;
  SELECT id INTO v_agent_id FROM public.profiles WHERE organization_id=v_org_id AND telegram_chat_id=v_tg AND COALESCE(active,true)=true LIMIT 1;

  IF v_action='ficha' THEN
    v_text := '📋 '||COALESCE(v_lead.name,'s/ nombre')||E'\n'||'Proyecto: '||COALESCE(NULLIF(v_lead.project,''),'n/d')||E'\n'||'Presupuesto: '||COALESCE(NULLIF(v_lead.budget,''),'n/d')||E'\n'||'Objeción / perfil: '||COALESCE(NULLIF(v_lead.notas,''),NULLIF(v_lead.bio,''),'n/d')||E'\n'||'Pendiente: '||COALESCE(NULLIF(v_lead.next_action,''),'n/d');
    RETURN jsonb_build_object('ok',true,'text',v_text);
  END IF;

  IF v_action='contacte' THEN
    INSERT INTO public.comunicaciones (lead_id,organization_id,tipo,resumen,asesor_id,ocurrio_en) VALUES (v_lead_id,v_org_id,'nota','El asesor confirmó que ya contactó al cliente desde el recordatorio proactivo.',v_agent_id,now());
    INSERT INTO public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata) VALUES (v_lead_id,v_org_id,'nota','Contacto confirmado (recordatorio IA)','El asesor confirmó que ya contactó al cliente desde el recordatorio proactivo.',v_agent_id,jsonb_build_object('source','proactive_inact_action','action','contacte'));
    UPDATE public.leads SET updated_at=now(),last_activity=to_char(now(),'YYYY-MM-DD HH24:MI'),days_inactive=0,seguimientos=COALESCE(seguimientos,0)+1 WHERE id=v_lead_id;
    v_text := 'Listo, registré que ya lo contactaste. El cliente vuelve a tu seguimiento activo.';
  ELSIF v_action='reagendar' THEN
    INSERT INTO public.lead_tasks (lead_id,organization_id,text,due_at,priority,created_by,metadata) VALUES (v_lead_id,v_org_id,'Seguimiento al cliente (reagendado desde recordatorio proactivo)',now()+interval '2 days','normal',v_agent_id,jsonb_build_object('source','proactive_inact_action'));
    INSERT INTO public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata) VALUES (v_lead_id,v_org_id,'nota','Seguimiento reagendado (recordatorio IA)','Se reagendó el seguimiento al cliente para dentro de 2 días desde el recordatorio proactivo.',v_agent_id,jsonb_build_object('source','proactive_inact_action','action','reagendar'));
    UPDATE public.leads SET next_action='Seguimiento al cliente (reagendado por recordatorio proactivo)',next_action_at=now()+interval '2 days',next_action_date=to_char((now()+interval '2 days') AT TIME ZONE 'America/Cancun','DD Mon, HH24:MI'),updated_at=now(),last_activity=to_char(now(),'YYYY-MM-DD HH24:MI'),days_inactive=0 WHERE id=v_lead_id;
    v_text := 'Te puse un recordatorio de seguimiento para dentro de 2 días. Si quieres otra fecha, dímela en el chat.';
  ELSE
    INSERT INTO public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata) VALUES (v_lead_id,v_org_id,'nota','Movido a Perdido/Rotación (recordatorio IA)','El asesor marcó al cliente como perdido desde el recordatorio proactivo.',v_agent_id,jsonb_build_object('source','proactive_inact_action','action','perdido'));
    UPDATE public.leads SET stage='Rotación',updated_at=now(),last_activity=to_char(now(),'YYYY-MM-DD HH24:MI') WHERE id=v_lead_id;
    v_text := 'Listo, moví a '||COALESCE(v_lead.name,'el lead')||' a Rotación (perdido). Sale del seguimiento proactivo.';
  END IF;

  UPDATE public.proactive_pending_reports SET status='closed', outcome=COALESCE(outcome,v_action)
  WHERE organization_id=v_org_id AND advisor_telegram_id=v_tg AND lead_id=v_lead_id AND status='open';
  RETURN jsonb_build_object('ok',true,'text',v_text);
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_insist(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE; v_n int := 0;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id=v_org;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok',true,'enqueued',0,'reason','disabled'); END IF;
  WITH due AS (
    SELECT r.id AS rid, r.lead_id, r.asesor_id, r.asesor_name FROM public.proactive_reminders r
    JOIN public.leads l ON l.id=r.lead_id
    WHERE r.organization_id=v_org AND r.tipo='inactividad' AND r.status='sent'
      AND r.sent_at IS NOT NULL AND r.sent_at <= now()-interval '24 hours'
      AND l.deleted_at IS NULL AND l.updated_at <= r.sent_at
      AND NOT EXISTS (SELECT 1 FROM unnest(v_cfg.terminal_stages) t WHERE lower(t)=lower(l.stage))
  ),
  ins AS (
    INSERT INTO public.proactive_reminders (organization_id,lead_id,asesor_id,asesor_name,tipo,scheduled_at,dedupe_key,ignore_quiet,payload)
    SELECT v_org,d.lead_id,d.asesor_id,d.asesor_name,'inactividad_insist',now(),'inact_insist:'||d.rid::text,false,
      jsonb_build_object('origin_reminder_id',d.rid,'message_hint','Si el cliente ya no está interesado, decímelo y lo movemos a Perdido (Rotación). Si no, hay que actuar HOY.')
    FROM due d ON CONFLICT (dedupe_key) DO NOTHING RETURNING 1
  ) SELECT count(*) INTO v_n FROM ins;
  RETURN jsonb_build_object('ok',true,'enqueued',v_n);
END; $fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_get_pending(jsonb)  FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_log_plan(jsonb)     FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_inact_action(jsonb) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_scan_insist(jsonb)  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_get_pending(jsonb)  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_log_plan(jsonb)     TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_inact_action(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_scan_insist(jsonb)  TO service_role;

NOTIFY pgrst, 'reload schema';
