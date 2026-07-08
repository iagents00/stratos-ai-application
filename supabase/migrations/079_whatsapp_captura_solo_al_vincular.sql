-- 079_whatsapp_captura_solo_al_vincular.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Refina la 078 (hallazgos de la revisión adversarial). Aplicada a stratos-prod
-- por MCP; se versiona acá.
--
--  A) La "captura" (reasignar al asesor del número, is_new=true, revival de
--     etapa temprana, etiqueta→etapa) ocurre SOLO cuando la conversación de
--     Chatwoot se vincula por primera vez al lead — NO en cada mensaje.
--     Sin esto: (1) una reasignación manual hecha desde la bandeja de WhatsApp
--     se deshacía con el siguiente mensaje del cliente (la despachadora
--     fn_chatwoot_cecilia_event corre por CADA mensaje entrante); (2) cada
--     mensaje re-marcaba is_new=true → halo "nuevo" en cada mensaje + una
--     escritura de vuelta (updateLead isNew:false) por cada sesión abierta.
--  B) El mapa etiqueta→etapa se actualiza al pipeline v2 vigente: los nombres
--     'Visita Concretada'→'Seguimiento', 'Negociación'→'Seguimiento',
--     'No Show'→'Reactivar Zoom' y 'Remarketing'→'Remarketing IA' (los viejos
--     ya no existen en STAGES del CRM).
--
-- Reversible: git revert (versión previa en 078).
-- Lección aparte (078): las limpiezas de datos deben ir SIEMPRE org-scoped;
-- las de 078 filtraban por strings exactos del call center de Duke (impacto
-- real nulo en otras orgs) pero la regla es explícita — de acá en adelante
-- toda limpieza lleva organization_id en el WHERE.
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
  v_prev_conv           int;
  v_newly_linked        boolean := false;
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
  -- Mapa etiqueta→etapa en NOMBRES DEL PIPELINE V2 vigente.
  -- ('perfilamiento-ia' es del bot viejo: no mapea.)
  v_stage := CASE v_first_label
    WHEN 'inbound'          THEN 'Contáctame Ya'
    WHEN 'nuevo'            THEN 'Contáctame Ya'
    WHEN 'meet-agendado'    THEN 'Zoom Agendado'
    WHEN 'meet-pendiente'   THEN 'Zoom Agendado'
    WHEN 'meet-confirmado'  THEN 'Zoom Agendado'
    WHEN 'zoom-realizado'   THEN 'Zoom Concretado'
    WHEN 'meet-realizado'   THEN 'Zoom Concretado'
    WHEN 'visita-agendada'  THEN 'Visita Agendada'
    WHEN 'visita-realizada' THEN 'Seguimiento'
    WHEN 'negociacion'      THEN 'Seguimiento'
    WHEN 'cierre'           THEN 'Cierre'
    WHEN 'cerrado-ganado'   THEN 'Cierre'
    WHEN 'no-show'          THEN 'Reactivar Zoom'
    WHEN 'perdido'          THEN 'Rotación'
    WHEN 'rotacion'         THEN 'Rotación'
    WHEN 'remarketing'      THEN 'Remarketing IA'
    WHEN 'postventa'        THEN 'Postventa'
    ELSE NULL
  END;
  IF v_first_label = 'requiere-humano' THEN
    v_is_human_needed := true;
  END IF;

  SELECT id, chatwoot_conversation_id INTO v_lead_id, v_prev_conv
  FROM public.leads
  WHERE organization_id = v_org_id
    AND chatwoot_conversation_id = v_conv_id
    AND v_conv_id IS NOT NULL
    AND deleted_at IS NULL
  LIMIT 1;
  IF v_lead_id IS NULL THEN
    SELECT id, chatwoot_conversation_id INTO v_lead_id, v_prev_conv
    FROM public.leads
    WHERE organization_id = v_org_id
      AND (whatsapp_phone_e164 = v_phone
           OR phone_normalized = v_phone_norm
           OR phone = v_phone)
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  -- "Captura": la conversación se vincula por primera vez a este lead.
  v_newly_linked := v_conv_id IS NOT NULL
    AND (v_prev_conv IS NULL OR v_prev_conv <> v_conv_id);

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
      -- Etapa: SOLO en la captura. Label explícito gana; sin label, un lead en
      -- etapa temprana revive a 'Contáctame Ya'. Después de capturado, la etapa
      -- la manejan los asesores (mensajes posteriores NO la tocan).
      stage = CASE
        WHEN v_newly_linked AND v_stage IS NOT NULL THEN v_stage
        WHEN v_newly_linked AND stage IN ('Contáctame Ya','Contáctame ya','Segundo Intento','Tercer Intento','Rotación','Remarketing IA','Remarketing')
          THEN 'Contáctame Ya'
        ELSE stage
      END,
      hot = CASE WHEN v_is_human_needed THEN true ELSE hot END,
      priority = CASE WHEN v_is_human_needed THEN 'urgente' ELSE priority END,
      tag = CASE
        WHEN v_newly_linked AND v_first_label NOT IN ('', 'perfilamiento-ia') THEN v_first_label
        ELSE NULLIF(tag, 'perfilamiento-ia')
      END,
      bio = NULLIF(bio, 'Lead capturado por IA desde WhatsApp. Pendiente perfilamiento.'),
      -- Pulso de "nuevo" SOLO en la captura (no en cada mensaje del hilo).
      is_new = CASE WHEN v_newly_linked THEN true ELSE is_new END,
      -- Reasignación al asesor del número SOLO en la captura: una reasignación
      -- manual posterior (bandeja/CRM) queda respetada.
      asesor_name = CASE WHEN v_newly_linked THEN COALESCE(v_asesor, asesor_name) ELSE asesor_name END,
      asesor_id   = CASE WHEN v_newly_linked THEN COALESCE(v_asesor_id, asesor_id) ELSE asesor_id END,
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
      NULL,
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
    'newly_linked', v_newly_linked,
    'stage', COALESCE(v_stage, 'unchanged'), 'human_needed', v_is_human_needed,
    'label_received', v_first_label,
    'asesor_name', v_final_asesor,
    'chatwoot_conversation_id', v_conv_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_chatwoot_asesor(jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_upsert_lead_from_chatwoot_asesor(jsonb, text) TO service_role;
