-- ════════════════════════════════════════════════════════════════════════
-- 037 — check_report solo Zoom + zoom_reschedule + ficha rica + manager_telegram_id
-- ────────────────────────────────────────────────────────────────────────
-- 1) BUG texto secuestrado: proactive_pending_reports.kind (zoom_brief/inactividad),
--    seteado por get_pending al abrir el lock. check_report filtra kind='zoom_brief'
--    → el lock de inactividad sigue serializando la cola pero NO captura texto.
-- 2) fn_proactive_zoom_reschedule: nota (comunicaciones+expediente) + cierra report.
-- 3) ficha (fn_proactive_inact_action) enriquecida con get_lead_ai_context
--    (incluye la key 'discovery' = migración 033, antes nunca aplicada).
-- 4) proactive_config.manager_telegram_id (gerente=admin con Telegram). Expuesto en
--    scan_escalations[].manager_telegram_id y check_report.manager_telegram_id.
--    Resolución dinámica fallback: super_admin/admin/ceo/director con telegram.
-- Aditiva, scoped Duke, service_role. Ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.proactive_pending_reports ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.proactive_config ADD COLUMN IF NOT EXISTS manager_telegram_id bigint;
UPDATE public.proactive_config SET manager_telegram_id = 7378104238 WHERE organization_id='00000000-0000-0000-0000-000000000001';

CREATE OR REPLACE FUNCTION public.get_lead_ai_context(p_lead_id uuid, p_max_comunic integer DEFAULT 50)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_org uuid; v_lead RECORD; v_is_admin BOOLEAN; v_result jsonb;
BEGIN
  v_uid := auth.uid(); v_org := public.current_organization_id();
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_uid IS NOT NULL THEN
    IF v_org IS NULL OR v_org <> v_lead.organization_id THEN RAISE EXCEPTION 'forbidden_org' USING ERRCODE='42501'; END IF;
    v_is_admin := public.is_admin_or_above();
    IF NOT v_is_admin AND v_lead.asesor_id IS NOT NULL AND v_lead.asesor_id <> v_uid THEN RAISE EXCEPTION 'forbidden_asesor' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT jsonb_build_object(
    'lead', jsonb_build_object('id',v_lead.id,'name',v_lead.name,'phone',v_lead.phone,'email',v_lead.email,'stage',v_lead.stage,'score',v_lead.score,'hot',v_lead.hot,'budget',v_lead.budget,'presupuesto',v_lead.presupuesto,'project',v_lead.project,'campaign',v_lead.campaign,'bio',v_lead.bio,'seguimientos',v_lead.seguimientos,'next_action',v_lead.next_action,'next_action_at',v_lead.next_action_at,'last_activity',v_lead.last_activity,'asesor_name',v_lead.asesor_name,'fecha_ingreso',v_lead.fecha_ingreso,'created_at',v_lead.created_at,'updated_at',v_lead.updated_at,'notas',v_lead.notas),
    'discovery', COALESCE((SELECT data FROM public.discovery_data WHERE lead_id=p_lead_id), '{}'::jsonb),
    'comunicaciones', COALESCE((SELECT jsonb_agg(c ORDER BY c->>'ocurrio_en' DESC) FROM (SELECT jsonb_build_object('id',id,'tipo',tipo,'resumen',resumen,'transcripcion',transcripcion,'ocurrio_en',ocurrio_en,'duracion_segundos',duracion_segundos,'asesor_id',asesor_id,'metadata',metadata) AS c FROM public.comunicaciones WHERE lead_id=p_lead_id ORDER BY ocurrio_en DESC LIMIT GREATEST(p_max_comunic,1)) sub), '[]'::jsonb),
    'expediente', COALESCE((SELECT jsonb_agg(e ORDER BY e->>'created_at' DESC) FROM (SELECT jsonb_build_object('id',id,'tipo',tipo,'titulo',titulo,'descripcion',descripcion,'mime_type',mime_type,'size_bytes',size_bytes,'created_at',created_at) AS e FROM public.expediente_items WHERE lead_id=p_lead_id) sub), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_proactive_get_pending(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE; v_hour int; v_in_quiet boolean := false; v_limit int := COALESCE(NULLIF(payload->>'limit','')::int,50); v_rows jsonb;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id=v_org;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok',true,'count',0,'reminders','[]'::jsonb,'reason','disabled'); END IF;
  v_hour := EXTRACT(hour FROM (now() AT TIME ZONE v_cfg.timezone))::int;
  IF v_cfg.quiet_start_hour > v_cfg.quiet_end_hour THEN v_in_quiet := (v_hour >= v_cfg.quiet_start_hour OR v_hour < v_cfg.quiet_end_hour);
  ELSE v_in_quiet := (v_hour >= v_cfg.quiet_start_hour AND v_hour < v_cfg.quiet_end_hour); END IF;
  WITH cand AS (
    SELECT r.id,r.lead_id,r.asesor_id,r.asesor_name,r.tipo,r.scheduled_at,r.payload,pr.telegram_chat_id AS advisor_tg,
      row_number() OVER (PARTITION BY pr.telegram_chat_id ORDER BY (CASE WHEN r.tipo='zoom_brief' THEN 0 ELSE 1 END), r.scheduled_at, r.id) AS rn
    FROM public.proactive_reminders r
    JOIN public.profiles pr ON pr.organization_id=v_org AND (pr.id=r.asesor_id OR lower(pr.name)=lower(r.asesor_name)) AND pr.telegram_chat_id IS NOT NULL
    WHERE r.organization_id=v_org AND r.status='pending' AND r.scheduled_at<=now() AND (NOT v_in_quiet OR r.ignore_quiet)
      AND NOT EXISTS (SELECT 1 FROM public.proactive_pending_reports o WHERE o.organization_id=v_org AND o.advisor_telegram_id=pr.telegram_chat_id AND o.status='open' AND (o.expires_at IS NULL OR o.expires_at>now()))
  ), pick AS (SELECT * FROM cand WHERE rn=1 ORDER BY scheduled_at LIMIT v_limit),
  claimed AS (UPDATE public.proactive_reminders r SET status='sent',sent_at=now(),attempts=attempts+1 FROM pick WHERE r.id=pick.id
    RETURNING r.id,pick.lead_id,pick.asesor_id,pick.asesor_name,pick.tipo,pick.payload,pick.advisor_tg),
  reports AS (INSERT INTO public.proactive_pending_reports (organization_id,advisor_telegram_id,lead_id,reminder_id,kind,status,expires_at)
    SELECT v_org,c.advisor_tg,c.lead_id,c.id,c.tipo,'open',
      CASE WHEN c.tipo='zoom_brief' THEN COALESCE(NULLIF(c.payload->>'zoom_at','')::timestamptz,now()+interval '4 hours') ELSE now()+interval '24 hours' END
    FROM claimed c RETURNING reminder_id,id AS report_id)
  SELECT jsonb_agg(jsonb_build_object('reminder_id',c.id,'report_id',rp.report_id,'lead_id',c.lead_id,'asesor_id',c.asesor_id,'asesor_name',c.asesor_name,'advisor_telegram_id',c.advisor_tg,'tipo',c.tipo,'payload',c.payload))
  INTO v_rows FROM claimed c LEFT JOIN reports rp ON rp.reminder_id=c.id;
  RETURN jsonb_build_object('ok',true,'count',COALESCE(jsonb_array_length(v_rows),0),'shadow_mode',v_cfg.shadow_mode,'test_telegram_id',v_cfg.test_telegram_id,'reminders',COALESCE(v_rows,'[]'::jsonb));
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_check_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_id uuid; v_lead uuid; v_mgr bigint;
BEGIN
  IF v_tg IS NULL THEN RETURN jsonb_build_object('ok',false,'error','advisor_telegram_id required'); END IF;
  SELECT COALESCE((SELECT manager_telegram_id FROM public.proactive_config WHERE organization_id=v_org),
    (SELECT telegram_chat_id FROM public.profiles WHERE organization_id=v_org AND role IN ('super_admin','admin','ceo','director') AND telegram_chat_id IS NOT NULL ORDER BY (role='super_admin') DESC LIMIT 1)) INTO v_mgr;
  SELECT id,lead_id INTO v_id,v_lead FROM public.proactive_pending_reports
  WHERE organization_id=v_org AND advisor_telegram_id=v_tg AND status='open' AND kind='zoom_brief' AND (expires_at IS NULL OR expires_at>now())
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',true,'has_report',false,'manager_telegram_id',v_mgr); END IF;
  RETURN jsonb_build_object('ok',true,'has_report',true,'lead_id',v_lead,'report_id',v_id,'manager_telegram_id',v_mgr);
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_escalations(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid); v_rows jsonb; v_mgr bigint;
BEGIN
  SELECT COALESCE((SELECT manager_telegram_id FROM public.proactive_config WHERE organization_id=v_org_id),
    (SELECT telegram_chat_id FROM public.profiles WHERE organization_id=v_org_id AND role IN ('super_admin','admin','ceo','director') AND telegram_chat_id IS NOT NULL ORDER BY (role='super_admin') DESC LIMIT 1)) INTO v_mgr;
  WITH due AS (SELECT id FROM public.proactive_pending_reports WHERE organization_id=v_org_id AND status='open' AND escalated_at IS NULL AND expires_at IS NOT NULL AND expires_at<=now()+interval '30 minutes' ORDER BY expires_at FOR UPDATE SKIP LOCKED),
  claimed AS (UPDATE public.proactive_pending_reports r SET escalated_at=now() FROM due WHERE r.id=due.id RETURNING r.id,r.advisor_telegram_id,r.lead_id,r.expires_at)
  SELECT jsonb_agg(jsonb_build_object('report_id',c.id,'advisor_telegram_id',c.advisor_telegram_id,'lead_id',c.lead_id,'asesor_name',pr.name,'lead_name',l.name,'expires_at',c.expires_at,'manager_telegram_id',v_mgr))
  INTO v_rows FROM claimed c LEFT JOIN public.leads l ON l.id=c.lead_id LEFT JOIN public.profiles pr ON pr.organization_id=v_org_id AND pr.telegram_chat_id=c.advisor_telegram_id;
  RETURN jsonb_build_object('ok',true,'count',COALESCE(jsonb_array_length(v_rows),0),'escalations',COALESCE(v_rows,'[]'::jsonb));
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_zoom_reschedule(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org uuid := '00000000-0000-0000-0000-000000000001'::uuid; v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_report uuid := NULLIF(payload->>'report_id','')::uuid; v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_agent_id uuid;
BEGIN
  IF v_lead IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Falta lead_id.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id=v_lead AND organization_id=v_org AND deleted_at IS NULL) THEN RETURN jsonb_build_object('ok',false,'text','No encontré ese lead.'); END IF;
  SELECT id INTO v_agent_id FROM public.profiles WHERE organization_id=v_org AND telegram_chat_id=v_tg AND COALESCE(active,true)=true LIMIT 1;
  INSERT INTO public.comunicaciones (lead_id,organization_id,tipo,resumen,asesor_id,ocurrio_en) VALUES (v_lead,v_org,'nota','El asesor reagendará este Zoom — coordinar nueva fecha con el cliente.',v_agent_id,now());
  INSERT INTO public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata) VALUES (v_lead,v_org,'nota','Zoom a reagendar (recordatorio IA)','El asesor reagendará este Zoom — coordinar nueva fecha con el cliente.',v_agent_id,jsonb_build_object('source','proactive_zoom_reschedule'));
  UPDATE public.proactive_pending_reports SET status='closed',outcome=COALESCE(outcome,'reagendar') WHERE organization_id=v_org AND status='open' AND (id=v_report OR (v_report IS NULL AND lead_id=v_lead AND advisor_telegram_id=v_tg));
  UPDATE public.leads SET updated_at=now(),last_activity=to_char(now(),'YYYY-MM-DD HH24:MI') WHERE id=v_lead;
  RETURN jsonb_build_object('ok',true,'text','Ok, coordina la nueva fecha con el cliente y actualízala en el CRM.');
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_inact_action(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid; v_action text := lower(COALESCE(payload->>'action','')); v_lead_id uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_agent_id uuid; v_lead RECORD; v_text text; v_ctx jsonb;
BEGIN
  IF v_action NOT IN ('contacte','reagendar','ficha','perdido') THEN RETURN jsonb_build_object('ok',false,'text','Acción inválida.'); END IF;
  IF v_lead_id IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Falta lead_id.'); END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id=v_lead_id AND organization_id=v_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'text','No encontré ese lead.'); END IF;
  SELECT id INTO v_agent_id FROM public.profiles WHERE organization_id=v_org_id AND telegram_chat_id=v_tg AND COALESCE(active,true)=true LIMIT 1;
  IF v_action='ficha' THEN
    v_ctx := public.get_lead_ai_context(v_lead_id, 20);
    v_text := '📋 '||COALESCE(v_ctx#>>'{lead,name}','s/ nombre')||' · '||COALESCE(v_ctx#>>'{lead,stage}','')||E'\n'
      ||'💰 Presupuesto: '||COALESCE(NULLIF(v_ctx#>>'{discovery,presupuesto}',''),NULLIF(v_ctx#>>'{lead,budget}',''),'n/d')||E'\n'
      ||'🏠 Interés: '||COALESCE(NULLIF(v_ctx#>>'{discovery,propiedades_interes}',''),NULLIF(v_ctx#>>'{lead,project}',''),'n/d')||E'\n'
      ||'⚠️ Objeciones: '||COALESCE(NULLIF(v_ctx#>>'{discovery,posibles_objeciones}',''),'n/d')||E'\n'
      ||'✅ Cómo resolver: '||COALESCE(NULLIF(v_ctx#>>'{discovery,como_solucionarlas_asesor}',''),'n/d')||E'\n'
      ||'🧠 Resumen: '||COALESCE(NULLIF(v_ctx#>>'{discovery,anotaciones_finales_resumen}',''),NULLIF(v_ctx#>>'{lead,bio}',''),'n/d')||E'\n'
      ||'🕘 Último contacto: '||COALESCE(v_ctx#>>'{comunicaciones,0,resumen}','sin registros')||E'\n'
      ||'➡️ Próxima acción: '||COALESCE(NULLIF(v_ctx#>>'{lead,next_action}',''),'n/d');
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
  UPDATE public.proactive_pending_reports SET status='closed',outcome=COALESCE(outcome,v_action) WHERE organization_id=v_org_id AND advisor_telegram_id=v_tg AND lead_id=v_lead_id AND status='open';
  RETURN jsonb_build_object('ok',true,'text',v_text);
END; $fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_zoom_reschedule(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_zoom_reschedule(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
