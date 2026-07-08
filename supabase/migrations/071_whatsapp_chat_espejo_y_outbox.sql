-- ============================================================================
-- 071: Chat de WhatsApp en el CRM — espejo de mensajes + cola de envío
-- ----------------------------------------------------------------------------
-- Soporta el tab "Chat" del expediente (LeadWhatsAppChat.jsx, flag
-- `whatsappChat`): ver el hilo REAL de WhatsApp y responder desde el CRM.
--
-- Arquitectura:
--   whatsapp_messages  ← espejo (lo llena n8n con los eventos de Chatwoot,
--                        entrantes Y salientes) — fuente de verdad del hilo.
--   whatsapp_outbox    ← cola de envío (el CRM inserta con RLS; n8n reclama,
--                        envía por Chatwoot y marca sent/failed).
--   fn_record_whatsapp_message  ← registra un mensaje desde el payload de
--                        Chatwoot (dedup por chatwoot_message_id, ignora
--                        notas privadas).
--   fn_chatwoot_cecilia_event   ← despachadora del flujo n8n "INBOUND ·
--                        Cecilia": incoming = upsert/asigna lead + espeja;
--                        outgoing = solo espeja.
--   fn_wa_outbox_claim/finish   ← reclamo anti-doble-envío + cierre.
--
-- Seguridad: RLS espejo del patrón expediente_items (org + asesor del lead
-- o admin). El webhook público de n8n NO puede enviar nada sin una fila
-- `pending` legítima creada con sesión del CRM.
-- Aplicada en prod el 2026-07-08 vía MCP. Este archivo la versiona.
-- ============================================================================

-- 1) Espejo de mensajes
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL,
  lead_id                   uuid REFERENCES public.leads(id),
  chatwoot_conversation_id  integer NOT NULL,
  chatwoot_message_id       bigint,
  inbox_id                  integer,
  direction                 text NOT NULL CHECK (direction IN ('in','out')),
  content                   text,
  content_type              text DEFAULT 'text',
  sender_name               text,
  sender_type               text,
  message_created_at        timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_chatwoot_msg_uidx
  ON public.whatsapp_messages (chatwoot_message_id) WHERE chatwoot_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_messages_lead_idx
  ON public.whatsapp_messages (lead_id, message_created_at);
CREATE INDEX IF NOT EXISTS whatsapp_messages_conv_idx
  ON public.whatsapp_messages (chatwoot_conversation_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_messages_select ON public.whatsapp_messages;
CREATE POLICY wa_messages_select ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    organization_id = current_organization_id()
    AND (is_admin_or_above() OR can_view_all_leads() OR is_lead_asesor(lead_id))
  );
DROP POLICY IF EXISTS wa_messages_no_delete ON public.whatsapp_messages;
CREATE POLICY wa_messages_no_delete ON public.whatsapp_messages
  FOR DELETE TO authenticated USING (false);

REVOKE ALL ON public.whatsapp_messages FROM anon;
GRANT SELECT ON public.whatsapp_messages TO authenticated;

-- 2) Cola de envío
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL,
  lead_id                   uuid NOT NULL REFERENCES public.leads(id),
  chatwoot_conversation_id  integer NOT NULL,
  content                   text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 4096),
  status                    text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','sending','sent','failed')),
  error                     text,
  chatwoot_message_id       bigint,
  created_by                uuid NOT NULL DEFAULT auth.uid(),
  sender_name               text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_outbox_lead_idx ON public.whatsapp_outbox (lead_id, created_at);
CREATE INDEX IF NOT EXISTS whatsapp_outbox_status_idx ON public.whatsapp_outbox (status) WHERE status IN ('pending','sending');

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_outbox_insert ON public.whatsapp_outbox;
CREATE POLICY wa_outbox_insert ON public.whatsapp_outbox
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_organization_id()
    AND created_by = auth.uid()
    AND (is_admin_or_above() OR can_view_all_leads() OR is_lead_asesor(lead_id))
  );
DROP POLICY IF EXISTS wa_outbox_select ON public.whatsapp_outbox;
CREATE POLICY wa_outbox_select ON public.whatsapp_outbox
  FOR SELECT TO authenticated
  USING (
    organization_id = current_organization_id()
    AND (is_admin_or_above() OR can_view_all_leads() OR is_lead_asesor(lead_id) OR created_by = auth.uid())
  );
DROP POLICY IF EXISTS wa_outbox_no_delete ON public.whatsapp_outbox;
CREATE POLICY wa_outbox_no_delete ON public.whatsapp_outbox
  FOR DELETE TO authenticated USING (false);

REVOKE ALL ON public.whatsapp_outbox FROM anon;
GRANT SELECT, INSERT ON public.whatsapp_outbox TO authenticated;

-- 3) Registrar mensaje desde payload de Chatwoot (n8n)
CREATE OR REPLACE FUNCTION public.fn_record_whatsapp_message(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id      uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_msg_type    text := payload ->> 'message_type';
  v_private     boolean := COALESCE((payload ->> 'private')::boolean, false);
  v_msg_id      bigint := NULLIF(payload ->> 'id','')::bigint;
  v_conv_id     integer := NULLIF(payload #>> '{conversation,id}','')::integer;
  v_inbox_id    integer := NULLIF(payload #>> '{conversation,inbox_id}','')::integer;
  v_content     text := payload ->> 'content';
  v_ctype       text := COALESCE(payload ->> 'content_type','text');
  v_direction   text;
  v_sender_name text;
  v_sender_type text;
  v_created     timestamptz;
  v_phone       text;
  v_phone_norm  text;
  v_lead_id     uuid;
  v_row_id      uuid;
BEGIN
  IF v_private THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'private_note');
  END IF;
  IF v_msg_type NOT IN ('incoming','outgoing') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'message_type', 'got', v_msg_type);
  END IF;
  IF v_content IS NULL OR length(btrim(v_content)) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'empty_content');
  END IF;

  v_direction := CASE WHEN v_msg_type = 'incoming' THEN 'in' ELSE 'out' END;
  v_sender_name := COALESCE(payload #>> '{sender,name}', payload #>> '{sender,available_name}');
  v_sender_type := CASE WHEN v_direction = 'in' THEN 'contact' ELSE 'agent' END;
  BEGIN
    v_created := (payload ->> 'created_at')::timestamptz;
  EXCEPTION WHEN others THEN
    v_created := now();
  END;
  IF v_created IS NULL THEN v_created := now(); END IF;

  v_phone := payload #>> '{conversation,meta,sender,phone_number}';
  v_phone_norm := regexp_replace(COALESCE(v_phone,''), '[^0-9]', '', 'g');

  SELECT id INTO v_lead_id FROM public.leads
  WHERE organization_id = v_org_id AND chatwoot_conversation_id = v_conv_id
    AND v_conv_id IS NOT NULL AND deleted_at IS NULL
  LIMIT 1;
  IF v_lead_id IS NULL AND length(v_phone_norm) >= 6 THEN
    SELECT id INTO v_lead_id FROM public.leads
    WHERE organization_id = v_org_id AND deleted_at IS NULL
      AND (whatsapp_phone_e164 = v_phone OR phone_normalized = v_phone_norm OR phone = v_phone)
    LIMIT 1;
  END IF;

  INSERT INTO public.whatsapp_messages (
    organization_id, lead_id, chatwoot_conversation_id, chatwoot_message_id,
    inbox_id, direction, content, content_type, sender_name, sender_type,
    message_created_at
  ) VALUES (
    v_org_id, v_lead_id, v_conv_id, v_msg_id,
    v_inbox_id, v_direction, v_content, v_ctype, v_sender_name, v_sender_type,
    v_created
  )
  ON CONFLICT (chatwoot_message_id) WHERE chatwoot_message_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'ok', true, 'message_row_id', v_row_id, 'lead_id', v_lead_id,
    'direction', v_direction, 'deduped', v_row_id IS NULL
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_record_whatsapp_message(jsonb) FROM PUBLIC, anon, authenticated;

-- 4) Despachadora del flujo n8n "INBOUND · Cecilia"
CREATE OR REPLACE FUNCTION public.fn_chatwoot_cecilia_event(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_msg_type text := payload ->> 'message_type';
  v_upsert   jsonb := NULL;
  v_record   jsonb;
BEGIN
  IF v_msg_type = 'incoming' THEN
    v_upsert := public.fn_upsert_lead_from_chatwoot_asesor(payload, 'Cecilia Mendoza');
  END IF;
  v_record := public.fn_record_whatsapp_message(payload);
  RETURN jsonb_build_object('ok', true, 'upsert', v_upsert, 'record', v_record);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_chatwoot_cecilia_event(jsonb) FROM PUBLIC, anon, authenticated;

-- 5) Cola: reclamo anti-doble-envío
CREATE OR REPLACE FUNCTION public.fn_wa_outbox_claim(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.whatsapp_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.whatsapp_outbox
  WHERE id = p_id AND status = 'pending'
  FOR UPDATE SKIP LOCKED;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending_or_missing');
  END IF;

  UPDATE public.whatsapp_outbox SET status = 'sending', updated_at = now() WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', true, 'id', v_row.id,
    'conversation_id', v_row.chatwoot_conversation_id,
    'content', v_row.content, 'lead_id', v_row.lead_id,
    'sender_name', v_row.sender_name
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_wa_outbox_claim(uuid) FROM PUBLIC, anon, authenticated;

-- 6) Cola: cierre del envío
CREATE OR REPLACE FUNCTION public.fn_wa_outbox_finish(p_id uuid, p_ok boolean, p_chatwoot_message_id bigint DEFAULT NULL, p_error text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.whatsapp_outbox
  SET status = CASE WHEN p_ok THEN 'sent' ELSE 'failed' END,
      chatwoot_message_id = COALESCE(p_chatwoot_message_id, chatwoot_message_id),
      error = p_error,
      updated_at = now()
  WHERE id = p_id AND status IN ('sending','pending');
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_wa_outbox_finish(uuid, boolean, bigint, text) FROM PUBLIC, anon, authenticated;

-- 7) Realtime para que el chat del CRM se actualice en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_outbox;
