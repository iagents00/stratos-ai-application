-- ════════════════════════════════════════════════════════════════════════
-- 027 — fn_proactive_test_simulate (auto-test del motor por el asesor)
-- ────────────────────────────────────────────────────────────────────────
-- Permite que CUALQUIER asesor con Telegram conectado dispare un escenario de
-- prueba del motor proactivo desde su propio Telegram, usando UN lead propio
-- (sin hardcodear ids). Resuelve el asesor por profiles.telegram_chat_id en
-- Duke (active), elige su lead no-terminal más recién actualizado, y encola un
-- recordatorio en proactive_reminders.
--
-- SOLO LECTURA sobre leads + INSERT en la cola. NO modifica ningún lead.
-- dedupe_key=NULL (re-test libre). ignore_quiet=true en ambos escenarios para
-- que el test dispare aunque sea horario quiet.
--
-- Aditiva. Scoped a Duke. service_role only. Validada con dry-run BEGIN/ROLLBACK
-- (leads_modificados=0). IMPORTANTE: ejecutada vía MCP en producción.
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
  v_lead_id    uuid;
  v_lead_name  text;
BEGIN
  IF v_tg IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'advisor_telegram_id required');
  END IF;
  IF v_scenario NOT IN ('zoom','inactividad') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'scenario must be zoom or inactividad');
  END IF;

  -- Resolver asesor por telegram_chat_id en Duke, activo.
  SELECT id, name INTO v_agent_id, v_agent_name
  FROM public.profiles
  WHERE organization_id = v_org_id AND telegram_chat_id = v_tg AND COALESCE(active, true) = true
  LIMIT 1;
  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_conectado');
  END IF;

  -- terminal_stages desde la config (fallback al default Duke v2).
  SELECT terminal_stages INTO v_terminal FROM public.proactive_config WHERE organization_id = v_org_id;
  IF v_terminal IS NULL THEN
    v_terminal := ARRAY['Cierre','Rotación','Postventa'];
  END IF;

  -- UN lead del asesor, no borrado, stage no terminal, el más recién actualizado.
  SELECT id, name INTO v_lead_id, v_lead_name
  FROM public.leads
  WHERE organization_id = v_org_id
    AND deleted_at IS NULL
    AND (asesor_id = v_agent_id OR lower(asesor_name) = lower(v_agent_name))
    AND NOT EXISTS (SELECT 1 FROM unnest(v_terminal) t WHERE lower(t) = lower(stage))
  ORDER BY updated_at DESC
  LIMIT 1;
  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sin_leads');
  END IF;

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

  RETURN jsonb_build_object('ok', true, 'scenario', v_scenario, 'lead_name', v_lead_name);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_test_simulate(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_test_simulate(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
