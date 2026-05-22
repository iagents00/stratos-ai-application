-- ════════════════════════════════════════════════════════════════════════
-- 038 — manager_telegram_ids como ARRAY (todos los admins conectados)
-- ────────────────────────────────────────────────────────────────────────
-- El gerente = TODOS los perfiles super_admin/admin/ceo/director con Telegram
-- conectado. check_report y scan_escalations ahora devuelven
-- manager_telegram_ids (array dinámico vía array_agg). Se mantiene
-- manager_telegram_id (singular) como fallback. Aditiva, scoped Duke, service_role.
-- Ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_proactive_check_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_id uuid; v_lead uuid; v_mgr bigint; v_mgrs bigint[];
BEGIN
  IF v_tg IS NULL THEN RETURN jsonb_build_object('ok',false,'error','advisor_telegram_id required'); END IF;
  SELECT COALESCE(array_agg(telegram_chat_id ORDER BY telegram_chat_id), ARRAY[]::bigint[]) INTO v_mgrs
  FROM public.profiles WHERE organization_id=v_org AND role IN ('super_admin','admin','ceo','director') AND COALESCE(active,true)=true AND telegram_chat_id IS NOT NULL;
  v_mgr := COALESCE((SELECT manager_telegram_id FROM public.proactive_config WHERE organization_id=v_org), v_mgrs[1]);
  SELECT id,lead_id INTO v_id,v_lead FROM public.proactive_pending_reports
  WHERE organization_id=v_org AND advisor_telegram_id=v_tg AND status='open' AND kind='zoom_brief' AND (expires_at IS NULL OR expires_at>now())
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',true,'has_report',false,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs)); END IF;
  RETURN jsonb_build_object('ok',true,'has_report',true,'lead_id',v_lead,'report_id',v_id,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs));
END; $fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_escalations(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid); v_rows jsonb; v_mgr bigint; v_mgrs bigint[];
BEGIN
  SELECT COALESCE(array_agg(telegram_chat_id ORDER BY telegram_chat_id), ARRAY[]::bigint[]) INTO v_mgrs
  FROM public.profiles WHERE organization_id=v_org_id AND role IN ('super_admin','admin','ceo','director') AND COALESCE(active,true)=true AND telegram_chat_id IS NOT NULL;
  v_mgr := COALESCE((SELECT manager_telegram_id FROM public.proactive_config WHERE organization_id=v_org_id), v_mgrs[1]);
  WITH due AS (SELECT id FROM public.proactive_pending_reports WHERE organization_id=v_org_id AND status='open' AND escalated_at IS NULL AND expires_at IS NOT NULL AND expires_at<=now()+interval '30 minutes' ORDER BY expires_at FOR UPDATE SKIP LOCKED),
  claimed AS (UPDATE public.proactive_pending_reports r SET escalated_at=now() FROM due WHERE r.id=due.id RETURNING r.id,r.advisor_telegram_id,r.lead_id,r.expires_at)
  SELECT jsonb_agg(jsonb_build_object('report_id',c.id,'advisor_telegram_id',c.advisor_telegram_id,'lead_id',c.lead_id,'asesor_name',pr.name,'lead_name',l.name,'expires_at',c.expires_at,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs)))
  INTO v_rows FROM claimed c LEFT JOIN public.leads l ON l.id=c.lead_id LEFT JOIN public.profiles pr ON pr.organization_id=v_org_id AND pr.telegram_chat_id=c.advisor_telegram_id;
  RETURN jsonb_build_object('ok',true,'count',COALESCE(jsonb_array_length(v_rows),0),'escalations',COALESCE(v_rows,'[]'::jsonb));
END; $fn$;

NOTIFY pgrst, 'reload schema';
