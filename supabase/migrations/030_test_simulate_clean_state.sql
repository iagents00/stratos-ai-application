-- ════════════════════════════════════════════════════════════════════════
-- 030 — fn_proactive_test_simulate: estado limpio entre simulaciones
-- ────────────────────────────────────────────────────────────────────────
-- Bug: como el validador prueba siempre con el lead demo, fn_proactive_open_report
-- dedupea por advisor+lead y reabría el MISMO report_id → la memoria
-- validar:<report_id> de n8n se acumulaba entre simulaciones (aprobaba
-- respuestas vacías, mezclaba datos viejos).
--
-- Fix: antes de encolar, test_simulate cierra cualquier reporte 'open' de ese
-- asesor+lead. Así el dispatch (n8n → fn_proactive_open_report) crea un reporte
-- NUEVO con report_id distinto en cada simulación zoom, y en inactividad no
-- queda ningún reporte abierto. La memoria del validador arranca limpia sola.
--
-- Aditivo (solo lógica). Toca solo proactive_pending_reports (status open→closed
-- del tester+lead). Scoped a Duke, service_role only. Dry-run: 2 zoom seguidos
-- dieron report_id distintos, R1 quedó closed, 0 abiertos tras inactividad.
-- IMPORTANTE: ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_proactive_test_simulate(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id     uuid   := '00000000-0000-0000-0000-000000000001'::uuid;
  v_tg         bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_scenario   text   := lower(COALESCE(payload->>'scenario',''));
  v_agent_id   uuid;
  v_agent_name text;
  v_terminal   text[];
  v_demo       uuid;
  v_lead_id    uuid;
  v_lead_name  text;
BEGIN
  IF v_tg IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'advisor_telegram_id required');
  END IF;
  IF v_scenario NOT IN ('zoom','inactividad') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'scenario must be zoom or inactividad');
  END IF;

  SELECT id, name INTO v_agent_id, v_agent_name
  FROM public.profiles
  WHERE organization_id = v_org_id AND telegram_chat_id = v_tg AND COALESCE(active, true) = true
  LIMIT 1;
  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_conectado');
  END IF;

  -- Lead demo (reasignado dinámicamente al asesor que prueba) o fallback.
  SELECT demo_lead_id INTO v_demo FROM public.proactive_config WHERE organization_id = v_org_id;
  IF v_demo IS NOT NULL THEN
    UPDATE public.leads
    SET asesor_id = v_agent_id, asesor_name = v_agent_name, updated_at = now()
    WHERE id = v_demo AND organization_id = v_org_id AND deleted_at IS NULL
    RETURNING id, name INTO v_lead_id, v_lead_name;
  END IF;

  IF v_lead_id IS NULL THEN
    SELECT terminal_stages INTO v_terminal FROM public.proactive_config WHERE organization_id = v_org_id;
    IF v_terminal IS NULL THEN v_terminal := ARRAY['Cierre','Rotación','Postventa']; END IF;
    SELECT id, name INTO v_lead_id, v_lead_name
    FROM public.leads
    WHERE organization_id = v_org_id AND deleted_at IS NULL
      AND (asesor_id = v_agent_id OR lower(asesor_name) = lower(v_agent_name))
      AND NOT EXISTS (SELECT 1 FROM unnest(v_terminal) t WHERE lower(t) = lower(stage))
    ORDER BY updated_at DESC LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sin_leads');
  END IF;

  -- Estado limpio: cerrar cualquier reporte abierto de este asesor+lead para
  -- que el dispatch abra uno NUEVO (report_id distinto) y la memoria del
  -- validador en n8n arranque limpia. Solo toca proactive_pending_reports.
  UPDATE public.proactive_pending_reports
  SET status = 'closed', outcome = COALESCE(outcome, 'auto-cerrado: nueva simulación de prueba')
  WHERE organization_id = v_org_id AND advisor_telegram_id = v_tg
    AND lead_id = v_lead_id AND status = 'open';

  IF v_scenario = 'zoom' THEN
    INSERT INTO public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    VALUES (v_org_id, v_lead_id, v_agent_id, v_agent_name, 'zoom_brief', now(), NULL, true,
            jsonb_build_object('zoom_at', now() + interval '3 hours', 'advisor_telegram_id', v_tg));
  ELSE
    INSERT INTO public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    VALUES (v_org_id, v_lead_id, v_agent_id, v_agent_name, 'inactividad', now(), NULL, true,
            jsonb_build_object('advisor_telegram_id', v_tg));
  END IF;

  RETURN jsonb_build_object('ok', true, 'scenario', v_scenario, 'lead_name', v_lead_name, 'asesor_name', v_agent_name);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_test_simulate(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_test_simulate(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
