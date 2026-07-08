-- 076_whatsapp_outbound_storage.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket privado `wa-outbound` para los adjuntos que el asesor ENVÍA desde el
-- CRM (imagen/audio/video/archivo). El front sube el archivo acá, guarda la
-- ruta en whatsapp_outbox.media_path, y n8n lo descarga (Service Role) para
-- reenviarlo por Chatwoot.
--
-- Aislamiento por organización: la ruta es `{org_id}/{lead_id}/{archivo}` y la
-- RLS exige que la PRIMERA carpeta sea la org del usuario (current_organization_id()).
-- Así un usuario de una org no puede leer/escribir adjuntos de otra.
--
-- Límite 16 MB (tope práctico de WhatsApp) + allowlist de MIME.
-- Aplicado a stratos-prod. Reversible (borrar bucket + policies).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wa-outbound', 'wa-outbound', false, 16777216,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/mpeg','audio/ogg','audio/mp4','audio/aac','audio/amr','audio/wav','audio/webm',
    'video/mp4','video/3gpp','video/quicktime',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = EXCLUDED.public;

DROP POLICY IF EXISTS wa_outbound_insert ON storage.objects;
DROP POLICY IF EXISTS wa_outbound_select ON storage.objects;

-- Subir: solo dentro de la carpeta de la propia org.
CREATE POLICY wa_outbound_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'wa-outbound'
    AND (storage.foldername(name))[1] = current_organization_id()::text
  );

-- Leer: solo adjuntos de la propia org.
CREATE POLICY wa_outbound_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'wa-outbound'
    AND (storage.foldername(name))[1] = current_organization_id()::text
  );
