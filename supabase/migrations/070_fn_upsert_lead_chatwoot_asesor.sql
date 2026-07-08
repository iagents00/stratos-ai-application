-- ============================================================================
-- 070: Registro de leads de Chatwoot con asesor asignado (número dedicado)
-- ----------------------------------------------------------------------------
-- Variante de fn_upsert_lead_from_chatwoot para inboxes DEDICADOS a un asesor
-- (caso: el +1 747 977 9711 queda exclusivo de la asesora Cecilia Mendoza).
--
-- Diferencias con la original:
--   * INSERT: asesor_name = p_asesor_name (en vez de 'iAgents') + asesor_id.
--   * UPDATE: SIEMPRE reasigna al asesor pasado (decisión de Iván 2026-07-08:
--     el número es exclusivo de la asesora, así que todo lead que escriba ahí
--     es de ella — las notas/expediente van pegadas al lead_id y se conservan).
--   * El RETURN refleja el asesor_name REAL final de la fila.
--
-- La llama n8n: flujo "INBOUND · Cecilia" (VD8xXVrAeH7bxmqC) vía la
-- despachadora fn_chatwoot_cecilia_event (migración 071).
-- Aplicada en prod el 2026-07-08 vía MCP (apply_migration). Este archivo la
-- versiona en el repo (fuente de verdad).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_upsert_lead_from_chatwoot_asesor(payload jsonb, p_asesor_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_asesor              text := NULLIF(btrim(p_asesor_name), '');
  v_asesor_id           uuid;
  v_final_asesor        text;
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

  -- Resolver el asesor_id del asesor pasado (explícito, sin depender de triggers)
  IF v_asesor IS NOT NULL THEN
    SELECT id INTO v_asesor_id
    FROM public.profiles
    WHERE organization_id = v_org_id AND name = v_asesor AND active = true
    LIMIT 1;
  END IF;

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
      name = CASE
        WHEN name IS NULL
          OR btrim(name) = ''
          OR name = 'Sin Nombre'
          OR name !~ '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]'
        THEN v_name
        ELSE name
      END,
      email = COALESCE(email, v_email),
      whatsapp_phone_e164 = COALESCE(whatsapp_phone_e164, v_phone),
      phone = COALESCE(phone, v_phone),
      phone_normalized = COALESCE(phone_normalized, v_phone_norm),
      stage = CASE WHEN v_stage IS NOT NULL THEN v_stage ELSE stage END,
      hot = CASE WHEN v_is_human_needed THEN true ELSE hot END,
      priority = CASE WHEN v_is_human_needed THEN 'urgente' ELSE priority END,
      tag = COALESCE(NULLIF(v_first_label, ''), tag),
      -- NÚMERO DEDICADO: siempre reasignar al asesor pasado (Cecilia).
      -- Notas/expediente quedan pegadas al lead_id, no se pierden.
      asesor_name = COALESCE(v_asesor, asesor_name),
      asesor_id   = COALESCE(v_asesor_id, asesor_id),
      chatwoot_conversation_id = COALESCE(v_conv_id, chatwoot_conversation_id),
      updated_at = now(),
      last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI'),
      days_inactive = 0
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      name, email, phone, phone_normalized, whatsapp_phone_e164,
      source, stage, asesor_name, asesor_id, organization_id,
      hot, priority, tag, is_new, bio,
      chatwoot_conversation_id,
      created_at, updated_at, last_activity, fecha_ingreso
    ) VALUES (
      v_name, v_email, v_phone, v_phone_norm, v_phone,
      'whatsapp', COALESCE(v_stage, 'Contáctame ya'), COALESCE(v_asesor, 'iAgents'), v_asesor_id, v_org_id,
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

  SELECT asesor_name INTO v_final_asesor FROM public.leads WHERE id = v_lead_id;

  RETURN jsonb_build_object(
    'ok', true, 'lead_id', v_lead_id, 'existed', v_existing,
    'stage', COALESCE(v_stage, 'unchanged'), 'human_needed', v_is_human_needed,
    'label_received', v_first_label,
    'asesor_name', COALESCE(v_final_asesor, v_asesor, 'iAgents'),
    'chatwoot_conversation_id', v_conv_id
  );
END;
$function$;
