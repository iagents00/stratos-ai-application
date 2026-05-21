-- ════════════════════════════════════════════════════════════════════════
-- 039 — Reagendamiento REAL del Zoom (start/apply) con estado awaiting_reschedule
-- ────────────────────────────────────────────────────────────────────────
-- El botón "Reagendar" del Zoom: el bot pregunta fecha, el asesor responde, y
-- se guarda como la nueva hora real (leads.next_action_at), no solo una nota.
--   · fn_proactive_reschedule_start: marca el report kind='awaiting_reschedule'
--     (NO lo cierra) → mantiene el lock. Devuelve el prompt de fecha.
--   · check_report: ahora devuelve también kind='awaiting_reschedule' con la
--     bandera awaiting_reschedule=true → n8n sabe que el próximo texto es la
--     fecha (no un plan ni comando normal). Campo: awaiting_reschedule (bool).
--   · fn_proactive_reschedule_apply: setea leads.next_action_at = new_datetime_iso,
--     stage='Zoom Agendado', nota (comunicaciones+expediente), cierra el report.
--     El próximo scan_zooms re-encola el briefing para la nueva hora.
-- Aditiva, scoped Duke, service_role. Ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_proactive_check_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_id uuid; v_lead uuid; v_kind text; v_mgr bigint; v_mgrs bigint[];
BEGIN
  IF v_tg IS NULL THEN RETURN jsonb_build_object('ok',false,'error','advisor_telegram_id required'); END IF;
  SELECT COALESCE(array_agg(telegram_chat_id ORDER BY telegram_chat_id), ARRAY[]::bigint[]) INTO v_mgrs
  FROM public.profiles WHERE organization_id=v_org AND role IN ('super_admin','admin','ceo','director') AND COALESCE(active,true)=true AND telegram_chat_id IS NOT NULL;
  v_mgr := COALESCE((SELECT manager_telegram_id FROM public.proactive_config WHERE organization_id=v_org), v_mgrs[1]);
  SELECT id,lead_id,kind INTO v_id,v_lead,v_kind FROM public.proactive_pending_reports
  WHERE organization_id=v_org AND advisor_telegram_id=v_tg AND status='open' AND kind IN ('zoom_brief','awaiting_reschedule') AND (expires_at IS NULL OR expires_at>now())
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',true,'has_report',false,'awaiting_reschedule',false,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs)); END IF;
  RETURN jsonb_build_object('ok',true,'has_report',true,'awaiting_reschedule',(v_kind='awaiting_reschedule'),'report_kind',v_kind,'lead_id',v_lead,'report_id',v_id,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs));
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_reschedule_start(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org uuid := '00000000-0000-0000-0000-000000000001'::uuid; v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_id uuid;
BEGIN
  IF v_lead IS NULL OR v_tg IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Faltan datos.'); END IF;
  UPDATE public.proactive_pending_reports SET kind='awaiting_reschedule'
  WHERE organization_id=v_org AND advisor_telegram_id=v_tg AND lead_id=v_lead AND status='open' AND kind IN ('zoom_brief','awaiting_reschedule')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',false,'text','No hay un Zoom activo para reagendar.'); END IF;
  RETURN jsonb_build_object('ok',true,'report_id',v_id,'text','¿Para cuándo reagendamos? Dime fecha y hora (ej: mañana 3pm).');
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_reschedule_apply(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org uuid := '00000000-0000-0000-0000-000000000001'::uuid; v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_new timestamptz; v_agent_id uuid; v_name text; v_legible text;
BEGIN
  IF v_lead IS NULL OR v_tg IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Faltan datos.'); END IF;
  BEGIN v_new := (payload->>'new_datetime_iso')::timestamptz; EXCEPTION WHEN others THEN RETURN jsonb_build_object('ok',false,'text','No entendí la fecha. Mandá algo como 2026-05-22T15:00:00-05:00.'); END;
  IF v_new IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Falta la fecha.'); END IF;
  SELECT name INTO v_name FROM public.leads WHERE id=v_lead AND organization_id=v_org AND deleted_at IS NULL;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'text','No encontré ese lead.'); END IF;
  SELECT id INTO v_agent_id FROM public.profiles WHERE organization_id=v_org AND telegram_chat_id=v_tg AND COALESCE(active,true)=true LIMIT 1;
  v_legible := to_char(v_new AT TIME ZONE 'America/Cancun','DD/MM HH24:MI')||' hs (Cancún)';
  UPDATE public.leads SET stage='Zoom Agendado', next_action='Zoom con cliente (reagendado)', next_action_at=v_new,
    next_action_date=to_char(v_new AT TIME ZONE 'America/Cancun','DD Mon, HH24:MI'), updated_at=now(), last_activity=to_char(now(),'YYYY-MM-DD HH24:MI')
  WHERE id=v_lead;
  INSERT INTO public.comunicaciones (lead_id,organization_id,tipo,resumen,asesor_id,ocurrio_en) VALUES (v_lead,v_org,'nota','Zoom reagendado para '||v_legible||'.',v_agent_id,now());
  INSERT INTO public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata) VALUES (v_lead,v_org,'nota','Zoom reagendado (recordatorio IA)','Zoom reagendado para '||v_legible||'.',v_agent_id,jsonb_build_object('source','proactive_reschedule_apply','new_datetime',v_new));
  UPDATE public.proactive_pending_reports SET status='closed', outcome='reagendado' WHERE organization_id=v_org AND advisor_telegram_id=v_tg AND lead_id=v_lead AND status='open';
  RETURN jsonb_build_object('ok',true,'text','Listo, reagendé el Zoom de '||v_name||' para '||v_legible||'.','next_action_at',v_new);
END; $fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_reschedule_start(jsonb) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_reschedule_apply(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_reschedule_start(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_reschedule_apply(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
