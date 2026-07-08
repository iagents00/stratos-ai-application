-- 075_whatsapp_multimedia.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Multimedia en el chat de WhatsApp del CRM: imágenes, audios, video y archivos,
-- tanto RECIBIDOS (espejo desde Chatwoot) como ENVIADOS (cola → n8n → Chatwoot).
--
-- Motivo (bug real): se envió una imagen a Cecilia y NO apareció en el CRM,
-- porque `fn_record_whatsapp_message` descartaba todo mensaje con `content`
-- vacío — y una foto sin caption llega justamente así. Ahora un mensaje se
-- guarda si tiene texto O adjuntos.
--
-- Cambios:
--   • whatsapp_messages: + columna `media jsonb` (array de adjuntos
--     {type,url,thumb,mime,ext,size}).
--   • whatsapp_outbox: + `media_path/media_type/media_mime/media_filename`,
--     `content` pasa a NULLABLE y se agrega CHECK "texto O media".
--   • fn_record_whatsapp_message: parsea `payload->'attachments'`, no descarta
--     si hay media, guarda `media` + `content_type` del primer adjunto.
--   • fn_wa_outbox_claim: devuelve los campos de media + `has_media`.
--   • fn_wa_conversations: preview "📷 Foto / 🎤 Audio / 🎬 Video / 📎 Archivo"
--     cuando el último mensaje no tiene texto.
-- Aplicado a stratos-prod. Reversible (DROP COLUMN / CREATE OR REPLACE previo).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Columnas de media ────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media jsonb;

ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS media_path     text;
ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS media_type     text;
ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS media_mime     text;
ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS media_filename text;
ALTER TABLE public.whatsapp_outbox ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.whatsapp_outbox DROP CONSTRAINT IF EXISTS wa_outbox_content_or_media;
ALTER TABLE public.whatsapp_outbox ADD CONSTRAINT wa_outbox_content_or_media CHECK (
  (content IS NOT NULL AND length(btrim(content)) BETWEEN 1 AND 4096)
  OR media_path IS NOT NULL
);

-- ── Registrar mensaje entrante/saliente (con adjuntos) ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_record_whatsapp_message(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org_id      uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_msg_type    text := payload ->> 'message_type';
  v_private     boolean := COALESCE((payload ->> 'private')::boolean, false);
  v_msg_id      bigint := NULLIF(payload ->> 'id','')::bigint;
  v_conv_id     integer := NULLIF(payload #>> '{conversation,id}','')::integer;
  v_inbox_id    integer := NULLIF(payload #>> '{conversation,inbox_id}','')::integer;
  v_content     text := payload ->> 'content';
  v_atts        jsonb := COALESCE(payload -> 'attachments', '[]'::jsonb);
  v_media       jsonb;
  v_ctype       text;
  v_direction   text;
  v_sender_name text;
  v_sender_type text;
  v_created     timestamptz;
  v_phone       text;
  v_phone_norm  text;
  v_lead_id     uuid;
  v_row_id      uuid;
  v_has_media   boolean;
BEGIN
  IF v_private THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'private_note');
  END IF;
  IF v_msg_type NOT IN ('incoming','outgoing') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'message_type', 'got', v_msg_type);
  END IF;

  IF jsonb_typeof(v_atts) = 'array' AND jsonb_array_length(v_atts) > 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
      'type',  COALESCE(a->>'file_type','file'),
      'url',   a->>'data_url',
      'thumb', a->>'thumb_url',
      'mime',  a->>'content_type',
      'ext',   a->>'extension',
      'size',  NULLIF(a->>'file_size','')::bigint
    ))
    INTO v_media
    FROM jsonb_array_elements(v_atts) a
    WHERE COALESCE(a->>'data_url','') <> '';
  END IF;
  v_has_media := v_media IS NOT NULL AND jsonb_array_length(v_media) > 0;

  -- Solo se descarta si NO hay texto NI adjuntos.
  IF (v_content IS NULL OR length(btrim(v_content)) = 0) AND NOT v_has_media THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'empty');
  END IF;

  v_ctype := CASE WHEN v_has_media THEN (v_media->0->>'type') ELSE 'text' END;
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
    inbox_id, direction, content, content_type, media, sender_name, sender_type,
    message_created_at
  ) VALUES (
    v_org_id, v_lead_id, v_conv_id, v_msg_id,
    v_inbox_id, v_direction, v_content, v_ctype, v_media, v_sender_name, v_sender_type,
    v_created
  )
  ON CONFLICT (chatwoot_message_id) WHERE chatwoot_message_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'ok', true, 'message_row_id', v_row_id, 'lead_id', v_lead_id,
    'direction', v_direction, 'has_media', v_has_media, 'deduped', v_row_id IS NULL
  );
END;
$$;

-- ── Reclamar item de la cola de salida (con media) ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_wa_outbox_claim(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
    'sender_name', v_row.sender_name,
    'media_path', v_row.media_path, 'media_type', v_row.media_type,
    'media_mime', v_row.media_mime, 'media_filename', v_row.media_filename,
    'has_media', v_row.media_path IS NOT NULL
  );
END;
$$;

-- ── Lista de conversaciones con preview de media ──────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_wa_conversations()
RETURNS TABLE(
  lead_id uuid, lead_name text, lead_phone text, asesor_name text, stage text,
  last_content text, last_direction text, last_sender text,
  last_at timestamptz, unread_count bigint
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH ranked AS (
    SELECT m.lead_id, m.content, m.media, m.direction, m.sender_name, m.message_created_at,
           row_number() OVER (PARTITION BY m.lead_id ORDER BY m.message_created_at DESC) AS rn
    FROM public.whatsapp_messages m
    WHERE m.lead_id IS NOT NULL
  ),
  last_msg AS (SELECT * FROM ranked WHERE rn = 1),
  unread AS (
    SELECT m.lead_id, count(*) AS c
    FROM public.whatsapp_messages m
    LEFT JOIN public.whatsapp_reads r
      ON r.lead_id = m.lead_id AND r.user_id = auth.uid()
    WHERE m.direction = 'in' AND m.lead_id IS NOT NULL
      AND m.message_created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
    GROUP BY m.lead_id
  )
  SELECT lm.lead_id, ld.name, ld.phone, ld.asesor_name, ld.stage,
         COALESCE(
           NULLIF(lm.content, ''),
           CASE WHEN lm.media IS NOT NULL AND jsonb_array_length(lm.media) > 0
             THEN CASE lm.media->0->>'type'
               WHEN 'image' THEN '📷 Foto'
               WHEN 'audio' THEN '🎤 Audio'
               WHEN 'video' THEN '🎬 Video'
               ELSE '📎 Archivo' END
             ELSE '' END
         ),
         lm.direction, lm.sender_name, lm.message_created_at,
         COALESCE(u.c, 0)
  FROM last_msg lm
  JOIN public.leads ld ON ld.id = lm.lead_id AND ld.deleted_at IS NULL
  LEFT JOIN unread u ON u.lead_id = lm.lead_id
  ORDER BY lm.message_created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.fn_wa_conversations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_wa_conversations() TO authenticated, service_role;
