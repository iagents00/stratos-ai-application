-- ════════════════════════════════════════════════════════════════════════
-- 016 — chatwoot_conversation_id en leads + fn_delete_lead_completely
-- ────────────────────────────────────────────────────────────────────────
-- Soporta el flujo de "reiniciar" del bot: cuando el operador escribe el
-- comando reiniciar en Chatwoot, n8n hace HTTP POST a esta función con
-- el conversation_id, y borramos completamente el lead + todas sus
-- tablas satélite (discovery_data, appointments, voice_call_logs,
-- expediente_items, lead_events, lead_assignments, lead_tasks).
--
-- Cambios contenidos en esta migration:
--   1. leads.chatwoot_conversation_id (INTEGER) + índice parcial.
--   2. fn_upsert_lead_from_chatwoot — pobla la columna en cada upsert.
--      Lookup ahora prioriza chatwoot_conversation_id; fallback al phone.
--   3. fn_delete_lead_completely(payload jsonb) — la nueva RPC.
--
-- IMPORTANTE: ya fue ejecutada vía MCP en producción. Este archivo queda
-- como source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

-- ───────── 1. Columna + índice ──────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS chatwoot_conversation_id INTEGER;

CREATE INDEX IF NOT EXISTS leads_chatwoot_conv_idx
  ON public.leads (chatwoot_conversation_id)
  WHERE chatwoot_conversation_id IS NOT NULL;

COMMENT ON COLUMN public.leads.chatwoot_conversation_id IS
  'ID de la conversación en Chatwoot. Se pobla automáticamente desde fn_upsert_lead_from_chatwoot. Usado por fn_delete_lead_completely para el "reiniciar" del bot.';

-- ───────── 2. Recrear fn_upsert_lead_from_chatwoot ──────────────────────
CREATE OR REPLACE FUNCTION public.fn_upsert_lead_from_chatwoot(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone               text;
  v_phone_norm          text;
  v_name                text;
  v_email               text;
  v_labels              jsonb;
  v_first_label         text;
  v_inbox_id            int;
  v_conv_id             int;
  v_chatwoot_contact_id int;
  v_stage               text;
  v_is_human_needed     boolean := false;
  v_lead_id             uuid;
  v_org_id              uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_existing            boolean := false;
BEGIN
  v_phone   := payload #>> '{conversation,meta,sender,phone_number}';
  v_name    := COALESCE(payload #>> '{conversation,meta,sender,name}', 'Sin Nombre');
  v_email   := payload #>> '{conversation,meta,sender,email}';
  v_labels  := COALESCE(payload #> '{conversation,labels}', '[]'::jsonb);
  v_inbox_id := NULLIF(payload #>> '{conversation,inbox_id}', '')::int;
  v_conv_id  := NULLIF(payload #>> '{conversation,id}', '')::int;
  v_chatwoot_contact_id := NULLIF(payload #>> '{conversation,meta,sender,id}', '')::int;

  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing or invalid');
  END IF;
  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  v_first_label := lower(COALESCE(v_labels ->> 0, ''));
  v_stage := CASE v_first_label
    WHEN 'inbound'          THEN 'Contáctame ya'
    WHEN 'nuevo'            THEN 'Contáctame ya'
    WHEN 'perfilamiento-ia' THEN 'Segundo Intento'
    WHEN 'meet-agendado'    THEN 'Zoom Agendado'
    WHEN 'meet-pendiente'   THEN 'Zoom Agendado'
    WHEN 'meet-confirmado'  THEN 'Zoom Agendado'
    WHEN 'zoom-realizado'   THEN 'Zoom Concretado'
    WHEN 'meet-realizado'   THEN 'Zoom Concretado'
    WHEN 'visita-agendada'  THEN 'Visita Agendada'
    WHEN 'visita-realizada' THEN 'Visita Concretada'
    WHEN 'negociacion'      THEN 'Negociación'
    WHEN 'cierre'           THEN 'Cierre'
    WHEN 'cerrado-ganado'   THEN 'Cierre'
    WHEN 'no-show'          THEN 'No Show'
    WHEN 'perdido'          THEN 'Rotación'
    WHEN 'rotacion'         THEN 'Rotación'
    WHEN 'remarketing'      THEN 'Remarketing'
    WHEN 'postventa'        THEN 'Postventa'
    WHEN 'requiere-humano'  THEN NULL
    ELSE NULL
  END;
  IF v_first_label = 'requiere-humano' THEN
    v_is_human_needed := true;
  END IF;

  -- Lookup: 1ro por chatwoot_conversation_id (más preciso), 2do por phone.
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE organization_id = v_org_id
    AND chatwoot_conversation_id = v_conv_id
    AND v_conv_id IS NOT NULL
    AND deleted_at IS NULL
  LIMIT 1;
  IF v_lead_id IS NULL THEN
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE organization_id = v_org_id
      AND (whatsapp_phone_e164 = v_phone
           OR phone_normalized = v_phone_norm
           OR phone = v_phone)
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    v_existing := true;
    UPDATE public.leads SET
      name = CASE WHEN name IS NULL OR name IN ('', 'Sin Nombre') THEN v_name ELSE name END,
      email = COALESCE(email, v_email),
      whatsapp_phone_e164 = COALESCE(whatsapp_phone_e164, v_phone),
      phone = COALESCE(phone, v_phone),
      phone_normalized = COALESCE(phone_normalized, v_phone_norm),
      stage = CASE WHEN v_stage IS NOT NULL THEN v_stage ELSE stage END,
      hot = CASE WHEN v_is_human_needed THEN true ELSE hot END,
      priority = CASE WHEN v_is_human_needed THEN 'urgente' ELSE priority END,
      tag = COALESCE(NULLIF(v_first_label, ''), tag),
      chatwoot_conversation_id = COALESCE(v_conv_id, chatwoot_conversation_id),
      updated_at = now(),
      last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI'),
      days_inactive = 0
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      name, email, phone, phone_normalized, whatsapp_phone_e164,
      source, stage, asesor_name, organization_id,
      hot, priority, tag, is_new, bio,
      chatwoot_conversation_id,
      created_at, updated_at, last_activity, fecha_ingreso
    ) VALUES (
      v_name, v_email, v_phone, v_phone_norm, v_phone,
      'whatsapp', COALESCE(v_stage, 'Contáctame ya'), 'iAgents', v_org_id,
      v_is_human_needed,
      CASE WHEN v_is_human_needed THEN 'urgente' ELSE NULL END,
      NULLIF(v_first_label, ''),
      true,
      'Lead capturado por IA desde WhatsApp. Pendiente perfilamiento.',
      v_conv_id,
      now(), now(), to_char(now(), 'YYYY-MM-DD HH24:MI'), now()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  IF COALESCE((payload ->> 'private')::boolean, false) IS TRUE
     AND payload ->> 'content' IS NOT NULL
     AND length(trim(payload ->> 'content')) > 0 THEN
    INSERT INTO public.expediente_items (
      lead_id, organization_id, tipo, titulo, descripcion, metadata
    ) VALUES (
      v_lead_id, v_org_id, 'nota_ia',
      'Nota privada de IA',
      payload ->> 'content',
      jsonb_build_object(
        'source', 'chatwoot',
        'chatwoot_message_id', payload ->> 'id',
        'chatwoot_conversation_id', v_conv_id,
        'chatwoot_inbox_id', v_inbox_id,
        'chatwoot_contact_id', v_chatwoot_contact_id,
        'label', v_first_label
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'lead_id', v_lead_id, 'existed', v_existing,
    'stage', COALESCE(v_stage, 'unchanged'), 'human_needed', v_is_human_needed,
    'label_received', v_first_label,
    'chatwoot_conversation_id', v_conv_id
  );
END;
$fn$;

-- ───────── 3. fn_delete_lead_completely ─────────────────────────────────
-- Recibe { "conversation_id": <int> } y borra el lead + tablas satélite.
-- Scoped a la organización Stratos/Duke. Si el conversation_id no existe,
-- devuelve ok:false con detalle (no falla con excepción).
CREATE OR REPLACE FUNCTION public.fn_delete_lead_completely(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_conv_id          int;
  v_lead_id          uuid;
  v_phone            text;
  v_org_id           uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_n_expediente     int := 0;
  v_n_voice          int := 0;
  v_n_appts          int := 0;
  v_n_discovery      int := 0;
  v_n_events         int := 0;
  v_n_assignments    int := 0;
  v_n_tasks          int := 0;
BEGIN
  v_conv_id := NULLIF(payload ->> 'conversation_id', '')::int;
  IF v_conv_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conversation_id missing or invalid');
  END IF;

  SELECT id, phone INTO v_lead_id, v_phone
  FROM public.leads
  WHERE chatwoot_conversation_id = v_conv_id
    AND organization_id = v_org_id
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'lead not found for conversation_id',
      'conversation_id', v_conv_id
    );
  END IF;

  -- Conteo previo (para devolver al caller cuánto borramos)
  SELECT count(*) INTO v_n_expediente  FROM public.expediente_items WHERE lead_id = v_lead_id;
  SELECT count(*) INTO v_n_voice       FROM public.voice_call_logs  WHERE lead_id = v_lead_id;
  SELECT count(*) INTO v_n_appts       FROM public.appointments     WHERE lead_id = v_lead_id;
  SELECT count(*) INTO v_n_discovery   FROM public.discovery_data   WHERE lead_id = v_lead_id;
  SELECT count(*) INTO v_n_events      FROM public.lead_events      WHERE lead_id = v_lead_id;
  SELECT count(*) INTO v_n_assignments FROM public.lead_assignments WHERE lead_id = v_lead_id;
  SELECT count(*) INTO v_n_tasks       FROM public.lead_tasks       WHERE lead_id = v_lead_id;

  -- Tablas que NO cascadean automáticamente: borrar explícito.
  DELETE FROM public.expediente_items WHERE lead_id = v_lead_id;
  DELETE FROM public.lead_events      WHERE lead_id = v_lead_id;
  DELETE FROM public.lead_assignments WHERE lead_id = v_lead_id;
  DELETE FROM public.lead_tasks       WHERE lead_id = v_lead_id;

  -- DELETE del lead → cascadea a discovery_data, appointments, voice_call_logs
  -- (FK ON DELETE CASCADE definido en migration 015).
  DELETE FROM public.leads WHERE id = v_lead_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'phone', v_phone,
    'conversation_id', v_conv_id,
    'deleted_counts', jsonb_build_object(
      'lead',             1,
      'expediente_items', v_n_expediente,
      'voice_call_logs',  v_n_voice,
      'appointments',     v_n_appts,
      'discovery_data',   v_n_discovery,
      'lead_events',      v_n_events,
      'lead_assignments', v_n_assignments,
      'lead_tasks',       v_n_tasks
    )
  );
END;
$fn$;

-- ───────── Grants ───────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.fn_delete_lead_completely(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_lead_completely(jsonb) TO service_role;
