-- ════════════════════════════════════════════════════════════════════════
-- 022 — fn_update_lead_name + hardening del nombre en fn_upsert_lead_from_chatwoot
-- ────────────────────────────────────────────────────────────────────────
-- Problema: el nombre del lead se sobreescribía con el nombre de perfil de
-- WhatsApp. Dos causas:
--   (a) cuando el contacto no tiene nombre de perfil, WhatsApp manda el
--       teléfono como "name" → el lead queda con un número de nombre y el
--       guard viejo (NULL/''/'Sin Nombre') no lo consideraba reemplazable.
--   (b) no había una vía explícita para que n8n pushee el nombre REAL que la
--       IA captura en el discovery ("me llamo Juan Pérez").
--
-- Cambios:
--   1. fn_update_lead_name(payload {phone|phone_e164, name}) — setea
--      leads.name SOLO con el nombre que se le pasa. Vía intencional para n8n.
--   2. fn_upsert_lead_from_chatwoot — el perfil de WhatsApp solo escribe el
--      nombre cuando el actual es "débil" (NULL / '' / 'Sin Nombre' / un
--      número sin letras). Si ya hay un nombre real capturado, lo conserva.
--
-- Scoped a la org Stratos/Duke (00000000-0000-0000-0000-000000000001). No
-- afecta a Grupo 28 ni a otras orgs. service_role only.
--
-- IMPORTANTE: ejecutada vía MCP en producción. Source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

-- ───────── 1. fn_update_lead_name ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_update_lead_name(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone      TEXT := COALESCE(payload ->> 'phone_e164', payload ->> 'phone');
  v_name       TEXT := btrim(COALESCE(payload ->> 'name', ''));
  v_phone_norm TEXT;
  v_org_id     UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_lead_id    UUID;
  v_prev_name  TEXT;
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing or invalid');
  END IF;
  IF length(v_name) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name missing or empty');
  END IF;
  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  UPDATE public.leads
  SET name = v_name,
      updated_at = now(),
      last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI')
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone OR phone_normalized = v_phone_norm OR phone = v_phone)
    AND deleted_at IS NULL
  RETURNING id, name INTO v_lead_id, v_prev_name;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone', 'phone', v_phone);
  END IF;
  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'name', v_name);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_update_lead_name(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_lead_name(jsonb) TO service_role;

-- ───────── 2. Hardening del guard de nombre en el upsert ─────────────────
-- Redefinición completa (basada en la versión desplegada con lookup por
-- chatwoot_conversation_id). Único cambio funcional: el CASE del campo name.
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
      -- El nombre de perfil de WhatsApp solo pisa el actual si el actual es
      -- "débil": NULL / '' / 'Sin Nombre' / un número sin letras. Si ya hay
      -- un nombre real capturado (vía fn_update_lead_name o manual), se conserva.
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

REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_chatwoot(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_upsert_lead_from_chatwoot(jsonb) TO service_role;
