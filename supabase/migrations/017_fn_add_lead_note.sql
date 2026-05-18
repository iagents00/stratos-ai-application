-- ════════════════════════════════════════════════════════════════════════
-- 017 — fn_add_lead_note: RPC genérica para inyectar notas tipadas al lead
-- ────────────────────────────────────────────────────────────────────────
-- n8n usa esta función para volcar al CRM cosas como el historial de
-- mensajes de WhatsApp/Chatwoot (note_type='historial_chat'), eventos del
-- sistema (note_type='system'), o cualquier nota tipada que no haya pasado
-- por la lógica de fn_upsert_lead_from_chatwoot.
--
-- Whitelist de note_type:
--   - historial_chat → conversación WhatsApp (tab "Chat" del drawer)
--   - nota_ia        → Perfil Estratégico / nota privada de IA (tab Expediente, badge IA)
--   - system         → eventos automáticos (zoom agendado, llamada hecha, etc.)
--   - nota / texto   → notas manuales (paridad con el resto del expediente)
--
-- Cualquier otro valor devuelve error 'note_type not allowed' con la whitelist
-- en la respuesta.
--
-- IMPORTANTE: ya fue ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_add_lead_note(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone       text   := payload ->> 'phone';
  v_content     text   := payload ->> 'content';
  v_note_type   text   := COALESCE(NULLIF(payload ->> 'note_type', ''), 'nota');
  v_title       text   := NULLIF(payload ->> 'title', '');
  v_metadata    jsonb  := COALESCE(payload -> 'metadata', '{}'::jsonb);
  v_lead_id     uuid;
  v_phone_norm  text;
  v_item_id     uuid;
  v_org_id      uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_allowed     text[] := ARRAY['historial_chat','nota','nota_ia','system','texto'];
  v_default_title text;
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing or invalid');
  END IF;
  IF v_content IS NULL OR length(trim(v_content)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'content missing');
  END IF;
  IF NOT (v_note_type = ANY(v_allowed)) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'note_type not allowed',
      'allowed', to_jsonb(v_allowed),
      'received', v_note_type
    );
  END IF;

  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone
         OR phone_normalized = v_phone_norm
         OR phone = v_phone)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone', 'phone', v_phone);
  END IF;

  v_default_title := CASE v_note_type
    WHEN 'historial_chat' THEN 'Mensaje WhatsApp'
    WHEN 'nota_ia'        THEN 'Nota privada de IA'
    WHEN 'system'         THEN 'Evento del sistema'
    WHEN 'texto'          THEN 'Texto del expediente'
    ELSE 'Nota'
  END;

  INSERT INTO public.expediente_items (
    lead_id, organization_id, tipo, titulo, descripcion, metadata
  ) VALUES (
    v_lead_id, v_org_id, v_note_type,
    COALESCE(v_title, v_default_title),
    v_content,
    v_metadata
  )
  RETURNING id INTO v_item_id;

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', v_item_id,
    'lead_id', v_lead_id,
    'note_type', v_note_type
  );
END;
$fn$;

-- Grants — solo service_role (n8n usa SERVICE_ROLE_KEY)
REVOKE ALL ON FUNCTION public.fn_add_lead_note(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_add_lead_note(jsonb) TO service_role;
