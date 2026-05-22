-- ════════════════════════════════════════════════════════════════════════
-- 034 — fn_proactive_log_plan (registrar plan validado del Zoom)
-- ────────────────────────────────────────────────────────────────────────
-- Registra el plan validado del Zoom como comunicación tipo='nota' en el lead,
-- idempotente por report_id (metadata->>'report_id'). service_role only, Duke.
-- NOTA: redefinida luego en 035b (escribe también en expediente_items) y en
-- 036 (cierra el report al validar). Esta es la versión base.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_proactive_log_plan(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id  uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_lead    uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_report  uuid := NULLIF(payload->>'report_id','')::uuid;
  v_asesor  text := COALESCE(NULLIF(payload->>'asesor_name',''),'(sin asesor)');
  v_plan    text := COALESCE(payload->>'plan','');
  v_resumen text := COALESCE(payload->>'resumen','');
  v_agent_id uuid; v_com_id uuid;
BEGIN
  IF v_lead IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'lead_id required'); END IF;
  IF length(trim(v_plan)) = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'plan required'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id=v_lead AND organization_id=v_org_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found'); END IF;
  IF v_report IS NOT NULL THEN
    SELECT id INTO v_com_id FROM public.comunicaciones
    WHERE lead_id=v_lead AND organization_id=v_org_id AND metadata->>'report_id' = v_report::text LIMIT 1;
    IF v_com_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'comunicacion_id', v_com_id, 'action', 'already_logged'); END IF;
  END IF;
  SELECT asesor_id INTO v_agent_id FROM public.leads WHERE id=v_lead;
  INSERT INTO public.comunicaciones (lead_id, organization_id, tipo, resumen, asesor_id, ocurrio_en, metadata)
  VALUES (v_lead, v_org_id, 'nota',
    'Preparación de Zoom (asistente IA) — Asesor: '||v_asesor||'. Plan: '||v_plan||
      CASE WHEN length(trim(v_resumen))>0 THEN '. Resumen: '||v_resumen ELSE '' END||'.',
    v_agent_id, now(), jsonb_build_object('source','proactive_log_plan','report_id',v_report,'asesor_name',v_asesor))
  RETURNING id INTO v_com_id;
  UPDATE public.leads SET updated_at=now(), last_activity=to_char(now(),'YYYY-MM-DD HH24:MI') WHERE id=v_lead;
  RETURN jsonb_build_object('ok', true, 'comunicacion_id', v_com_id, 'action', 'logged');
END; $fn$;
REVOKE ALL ON FUNCTION public.fn_proactive_log_plan(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_log_plan(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
