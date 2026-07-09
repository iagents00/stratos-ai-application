-- 080_wa_claim_lead_phone.sql
-- fn_wa_outbox_claim ahora devuelve también el TELÉFONO del lead.
-- Motivo: las notas de voz (ogg/opus) se envían DIRECTO a la API de Meta
-- (upload → send por media_id) porque el camino "audio por link de Chatwoot"
-- falla con 131053 para cualquier formato (comprobado con msgs 2304/2306/2310
-- de la conversación 94: status failed + external_error en Chatwoot).
-- Meta necesita el número destino ("to"), que sale del lead de la fila.
-- Aplicada a stratos-prod por MCP; se versiona acá. Reversible (072 tiene la previa).

CREATE OR REPLACE FUNCTION public.fn_wa_outbox_claim(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row   public.whatsapp_outbox%ROWTYPE;
  v_phone text;
BEGIN
  SELECT * INTO v_row FROM public.whatsapp_outbox
  WHERE id = p_id AND status = 'pending'
  FOR UPDATE SKIP LOCKED;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending_or_missing');
  END IF;
  UPDATE public.whatsapp_outbox SET status = 'sending', updated_at = now() WHERE id = p_id;

  SELECT COALESCE(whatsapp_phone_e164, phone) INTO v_phone
  FROM public.leads WHERE id = v_row.lead_id;

  RETURN jsonb_build_object(
    'ok', true, 'id', v_row.id,
    'conversation_id', v_row.chatwoot_conversation_id,
    'content', v_row.content, 'lead_id', v_row.lead_id,
    'lead_phone', v_phone,
    'sender_name', v_row.sender_name,
    'media_path', v_row.media_path, 'media_type', v_row.media_type,
    'media_mime', v_row.media_mime, 'media_filename', v_row.media_filename,
    'has_media', v_row.media_path IS NOT NULL
  );
END;
$$;
