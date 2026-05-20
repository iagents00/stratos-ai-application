-- ════════════════════════════════════════════════════════════════════════
-- 029 — Lead DEMO para simulaciones del motor proactivo
-- ────────────────────────────────────────────────────────────────────────
-- Siembra UN lead demo ([DEMO] Carlos Restrepo) en Duke con historia rica
-- (comunicaciones + expediente_items → get_lead_ai_context devuelve contexto
-- completo). Guarda su id en proactive_config.demo_lead_id.
--
-- fn_proactive_test_simulate ahora: si hay demo_lead_id, usa ESE lead para
-- ambos escenarios y lo REASIGNA dinámicamente al asesor que prueba (cada
-- tester se ve a sí mismo). Si no hay demo, fallback al comportamiento previo.
-- Solo toca el lead demo (UPDATE por id) — verificado en dry-run que ningún
-- otro lead se modifica.
--
-- Aditiva (insert filas nuevas + 1 columna nullable + redefinir función).
-- Idempotente (solo siembra si demo_lead_id IS NULL). Scoped a Duke.
-- IMPORTANTE: ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.proactive_config ADD COLUMN IF NOT EXISTS demo_lead_id uuid;

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_existing uuid;
  v_lead uuid;
BEGIN
  SELECT demo_lead_id INTO v_existing FROM public.proactive_config WHERE organization_id = v_org;
  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.leads
    (name, organization_id, phone, whatsapp_phone_e164, email, stage, source,
     budget, presupuesto, project, bio, notas, next_action, is_new, fecha_ingreso, last_activity)
  VALUES
    ('[DEMO] Carlos Restrepo', v_org, '+57 300 555 0199', '+57 300 555 0199',
     'carlos.demo@ejemplo.com', 'Seguimiento', 'Instagram',
     '$450.000.000 COP', 450000000,
     'Bahía Marina · Apto 2 alcobas vista al mar (Cartagena)',
     'Busca apto de 2 alcobas con vista al mar en Bahía Marina (Cartagena). Inversión + uso familiar. Decisión conjunta con la esposa. Ingeniero, ingresos estables. Requiere crédito hipotecario.',
     'Objeción principal: cuota inicial (20%) y si la entrega será a tiempo.',
     'Enviar plan de pagos + opciones de financiación con bancos aliados.',
     true, now(), to_char(now(),'YYYY-MM-DD HH24:MI'))
  RETURNING id INTO v_lead;

  INSERT INTO public.comunicaciones (lead_id, organization_id, tipo, resumen, ocurrio_en) VALUES
    (v_lead, v_org, 'whatsapp', 'Pidió info por WhatsApp tras ver un anuncio en Instagram. Interesado en apto de 2 alcobas con vista al mar (Bahía Marina, Cartagena).', now() - interval '6 days'),
    (v_lead, v_org, 'zoom', 'Asistió a un Zoom de presentación. Le gustó la zona; quedó de pensarlo con la esposa.', now() - interval '4 days'),
    (v_lead, v_org, 'nota', 'Pendiente: enviar plan de pagos y opciones de financiación con bancos aliados. Objeción: cuota inicial 20% + tiempos de entrega.', now() - interval '1 day');

  INSERT INTO public.expediente_items (lead_id, organization_id, tipo, titulo, descripcion) VALUES
    (v_lead, v_org, 'historial_chat', 'Conversación WhatsApp', 'HUMAN: Hola, vi el anuncio en Instagram del proyecto en Cartagena, me interesa un apto de 2 alcobas con vista al mar.\nAI: ¡Hola Carlos! Bahía Marina tiene aptos de 2 alcobas frente al mar. ¿Para inversión o uso familiar?\nHUMAN: Las dos. Lo decido con mi esposa. Me preocupa la cuota inicial y los tiempos de entrega.'),
    (v_lead, v_org, 'nota', 'Perfil del cliente', 'Ingeniero, ingresos estables. Decisión conjunta con la esposa. Requiere crédito hipotecario. Presupuesto ~$450M COP.');

  UPDATE public.proactive_config SET demo_lead_id = v_lead WHERE organization_id = v_org;
END $$;

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

  -- 1) Lead demo si está configurado: reasignar al asesor que prueba (dinámico)
  --    para que cada tester lo vea como propio. Solo toca el lead demo (por id).
  SELECT demo_lead_id INTO v_demo FROM public.proactive_config WHERE organization_id = v_org_id;
  IF v_demo IS NOT NULL THEN
    UPDATE public.leads
    SET asesor_id = v_agent_id, asesor_name = v_agent_name, updated_at = now()
    WHERE id = v_demo AND organization_id = v_org_id AND deleted_at IS NULL
    RETURNING id, name INTO v_lead_id, v_lead_name;
  END IF;

  -- 2) Fallback: lead propio no-terminal más recién actualizado.
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
