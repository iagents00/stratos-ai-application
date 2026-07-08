-- 077_whatsapp_media_tenant_hardening.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Cierra 2 huecos multi-tenant del envío de multimedia (hallazgos de la revisión
-- adversarial del PR #283). Aplicado a stratos-prod por MCP; se versiona acá.
--
--  A) whatsapp_outbox.media_path venía del cliente y NO se validaba contra la
--     org/lead de la fila → n8n (service_role) podía descargar un archivo de OTRA
--     org saltando la RLS del bucket. Misma clase que el trigger 073 arregló con
--     chatwoot_conversation_id. Fix: CHECK que ata media_path a {org}/{lead}/… de
--     la PROPIA fila (org/lead ya validados por RLS de insert + trigger 073).
--
--  B) Las policies del bucket wa-outbound sólo filtraban por ORG, ignorando el
--     segmento {lead}/asesor → un asesor podía listar/leer media de leads de
--     OTROS asesores de su org (el módulo promete "el asesor ve SUS
--     conversaciones"). Fix: además del match de org, exigir admin /
--     can_view_all_leads / is_lead_asesor(lead del path).
--     (n8n usa service_role → bypassa RLS; su descarga no se ve afectada.)
--
-- Reversible: DROP CONSTRAINT + restaurar las policies 076 (solo-org).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A) media_path atado a la org+lead de la fila ─────────────────────────────
ALTER TABLE public.whatsapp_outbox DROP CONSTRAINT IF EXISTS wa_outbox_media_path_scope;
ALTER TABLE public.whatsapp_outbox ADD CONSTRAINT wa_outbox_media_path_scope CHECK (
  media_path IS NULL OR (
    split_part(media_path, '/', 1) = organization_id::text
    AND split_part(media_path, '/', 2) = lead_id::text
  )
);

-- ── B) bucket wa-outbound: org + asesor del lead ─────────────────────────────
DROP POLICY IF EXISTS wa_outbound_insert ON storage.objects;
DROP POLICY IF EXISTS wa_outbound_select ON storage.objects;

CREATE POLICY wa_outbound_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'wa-outbound'
    AND (storage.foldername(name))[1] = current_organization_id()::text
    AND (
      is_admin_or_above()
      OR can_view_all_leads()
      OR is_lead_asesor(NULLIF((storage.foldername(name))[2], '')::uuid)
    )
  );

CREATE POLICY wa_outbound_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'wa-outbound'
    AND (storage.foldername(name))[1] = current_organization_id()::text
    AND (
      is_admin_or_above()
      OR can_view_all_leads()
      OR is_lead_asesor(NULLIF((storage.foldername(name))[2], '')::uuid)
    )
  );
