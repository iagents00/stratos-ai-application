-- 078_whatsapp_campana_lead_fresco.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Los leads del número dedicado (campañas de Cecilia) deben entrar "frescos".
-- Aplicada a stratos-prod por MCP; se versiona acá.
--
-- Caso real que la motivó: "Camila" escribió al +1 747 y apareció en
-- "Segundo Intento" con perfil "Lead capturado por IA… Pendiente perfilamiento."
-- Causa: su lead lo había creado el bot del call center viejo (16-may) con la
-- etiqueta `perfilamiento-ia` (mapeada a Segundo Intento); al escribir hoy, el
-- upsert la reconoció por teléfono y conservó etapa/perfil viejos.
--
-- Cambios en fn_upsert_lead_from_chatwoot_asesor:
--  1) Se elimina el texto placeholder del bot viejo en el INSERT (bio = NULL).
--  2) La etiqueta legacy 'perfilamiento-ia' YA NO mapea a etapa ni se guarda.
--  3) is_new = true también en el UPDATE (lead existente que vuelve a escribir)
--     → el CRM lo muestra PRIMERO en la lista con halo verde (mecanismo isNew).
--  4) Revival: lead existente en etapa TEMPRANA (Contáctame Ya / Segundo /
--     Tercer Intento / Rotación / Remarketing) que escribe → vuelve a
--     'Contáctame Ya'. Etapas avanzadas (Zoom+, Seguimiento, Apartó…) intactas.
--  5) Casing correcto: 'Contáctame Ya' (antes insertaba 'Contáctame ya').
--
-- Limpieza de datos (cosmética, sobre strings exactos):
--  - bio placeholder (17 filas) → NULL; tag 'perfilamiento-ia' (31) → NULL;
--  - stage 'Contáctame ya' (1) → 'Contáctame Ya';
--  - Camila → Contáctame Ya + is_new.
-- Reversible: git revert (la versión previa de la función está en 070/072).
-- ─────────────────────────────────────────────────────────────────────────────

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

  IF v_asesor IS NOT NULL THEN
    SELECT id INTO v_asesor_id
    FROM public.profiles
    WHERE organization_id = v_org_id AND name = v_asesor AND active = true
    LIMIT 1;
  END IF;

  v_first_label := lower(COALESCE(v_labels ->> 0, ''));
  -- OJO: 'perfilamiento-ia' era del bot del call center viejo → YA NO mapea
  -- a etapa (mandaba leads frescos a "Segundo Intento").
  v_stage := CASE v_first_label
    WHEN 'inbound'          THEN 'Contáctame Ya'
    WHEN 'nuevo'            THEN 'Contáctame Ya'
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
      -- Etapa: label explícito gana; si no hay, un lead en etapa TEMPRANA que
      -- escribe vuelve a 'Contáctame Ya' (revival); etapas avanzadas intactas.
      stage = CASE
        WHEN v_stage IS NOT NULL THEN v_stage
        WHEN stage IN ('Contáctame Ya','Contáctame ya','Segundo Intento','Tercer Intento','Rotación','Remarketing IA','Remarketing')
          THEN 'Contáctame Ya'
        ELSE stage
      END,
      hot = CASE WHEN v_is_human_needed THEN true ELSE hot END,
      priority = CASE WHEN v_is_human_needed THEN 'urgente' ELSE priority END,
      -- Nada de la etiqueta legacy; otras etiquetas de campaña sí se guardan.
      tag = CASE
        WHEN v_first_label IN ('', 'perfilamiento-ia') THEN NULLIF(tag, 'perfilamiento-ia')
        ELSE v_first_label
      END,
      -- Texto placeholder del bot viejo: se limpia al pasar.
      bio = NULLIF(bio, 'Lead capturado por IA desde WhatsApp. Pendiente perfilamiento.'),
      -- Que el CRM lo grite: pulso de "nuevo" también al revivir.
      is_new = true,
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
      'whatsapp', COALESCE(v_stage, 'Contáctame Ya'), COALESCE(v_asesor, 'iAgents'), v_asesor_id, v_org_id,
      v_is_human_needed,
      CASE WHEN v_is_human_needed THEN 'urgente' ELSE NULL END,
      NULLIF(NULLIF(v_first_label, ''), 'perfilamiento-ia'),
      true,
      NULL,  -- sin texto placeholder: el perfil se llena con datos reales
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
    'asesor_name', v_final_asesor,
    'chatwoot_conversation_id', v_conv_id
  );
END;
$function$;

-- La 073 ya revocó anon/authenticated; CREATE OR REPLACE conserva ACLs, pero
-- se re-asegura por claridad.
REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_chatwoot_asesor(jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_upsert_lead_from_chatwoot_asesor(jsonb, text) TO service_role;

-- ── Limpieza de datos legacy (cosmético, reversible por backup) ──────────────
UPDATE public.leads SET bio = NULL
WHERE bio = 'Lead capturado por IA desde WhatsApp. Pendiente perfilamiento.';
UPDATE public.leads SET tag = NULL WHERE tag = 'perfilamiento-ia';
UPDATE public.leads SET stage = 'Contáctame Ya' WHERE stage = 'Contáctame ya';
-- Camila (lead de mayo revivido hoy por el número de Cecilia): criterio nuevo.
UPDATE public.leads SET stage = 'Contáctame Ya', is_new = true, updated_at = now()
WHERE id = '9926d444-50e0-4e73-b9d9-c05b67e154fc' AND stage = 'Segundo Intento';
