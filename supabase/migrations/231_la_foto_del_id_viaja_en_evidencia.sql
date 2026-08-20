-- 231 — La foto del ID/pasaporte viaja en el bucket `evidencia`
-- ─────────────────────────────────────────────────────────────────────────────
-- Complemento de la 230: además del texto (leads.id_document), el asesor puede
-- SUBIR LA IMAGEN del documento (INE / pasaporte / PDF) desde el Discovery.
--
-- · La imagen vive en el bucket privado `evidencia`, carpeta nueva
--   `id-doc/<organization_id>/<lead_id>/<timestamp>.<ext>` — mismo patrón que
--   caja/, chat/, tarea/ (path en columna + URL firmada al vuelo).
-- · Acceso MÁS restringido que las otras carpetas porque es un documento de
--   identidad: org correcta Y (admin / puede ver todos los leads / es el
--   asesor de ESE lead) — el mismo predicado que ya usa `wa-outbound`.
-- · Columna nueva leads.id_document_path (text, nullable): aditiva y
--   reversible (DROP COLUMN + DROP POLICY).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS id_document_path text;

COMMENT ON COLUMN public.leads.id_document_path IS
  'Path en el bucket evidencia (carpeta id-doc/) de la foto del documento de identidad del cliente (INE/pasaporte). Se abre con URL firmada.';

-- ── Policies de storage para la carpeta id-doc/ ─────────────────────────────
-- foldername(name)[1] = 'id-doc' · [2] = organization_id · [3] = lead_id

DROP POLICY IF EXISTS evidencia_iddoc_insert ON storage.objects;
CREATE POLICY evidencia_iddoc_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencia'
    AND (storage.foldername(name))[1] = 'id-doc'
    AND (storage.foldername(name))[2] = (current_organization_id())::text
    AND (
      is_admin_or_above()
      OR can_view_all_leads()
      OR is_lead_asesor((NULLIF((storage.foldername(name))[3], ''))::uuid)
    )
  );

DROP POLICY IF EXISTS evidencia_iddoc_select ON storage.objects;
CREATE POLICY evidencia_iddoc_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencia'
    AND (storage.foldername(name))[1] = 'id-doc'
    AND (storage.foldername(name))[2] = (current_organization_id())::text
    AND (
      is_admin_or_above()
      OR can_view_all_leads()
      OR is_lead_asesor((NULLIF((storage.foldername(name))[3], ''))::uuid)
    )
  );

DROP POLICY IF EXISTS evidencia_iddoc_update ON storage.objects;
CREATE POLICY evidencia_iddoc_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'evidencia'
    AND (storage.foldername(name))[1] = 'id-doc'
    AND (storage.foldername(name))[2] = (current_organization_id())::text
    AND (
      is_admin_or_above()
      OR can_view_all_leads()
      OR is_lead_asesor((NULLIF((storage.foldername(name))[3], ''))::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'evidencia'
    AND (storage.foldername(name))[1] = 'id-doc'
    AND (storage.foldername(name))[2] = (current_organization_id())::text
  );

DROP POLICY IF EXISTS evidencia_iddoc_delete ON storage.objects;
CREATE POLICY evidencia_iddoc_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidencia'
    AND (storage.foldername(name))[1] = 'id-doc'
    AND (storage.foldername(name))[2] = (current_organization_id())::text
    AND (
      is_admin_or_above()
      OR can_view_all_leads()
      OR is_lead_asesor((NULLIF((storage.foldername(name))[3], ''))::uuid)
    )
  );
