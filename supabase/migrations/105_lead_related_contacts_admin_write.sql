-- ═══════════════════════════════════════════════════════════════════════════
-- 105_lead_related_contacts_admin_write.sql
--   "Familiares o Socios": SOLO un admin puede agregar/editar/borrar.
-- ═══════════════════════════════════════════════════════════════════════════
-- Regla (jul 2026): igual que el registro/reasignación de clientes, gestionar
-- los allegados de un contacto (esposa/o, socio, familiar) es SOLO para admin
-- (super_admin/admin/ceo/director). El asesor los VE (lectura) en el expediente,
-- pero no los agrega ni edita. "La seguridad son LLAVES, no prompts": el candado
-- va en la RLS, no solo en el botón del front.
--
-- Antes (migración 104): una sola policy FOR ALL (org + lead visible) → cualquier
-- asesor dueño del lead podía escribir. Ahora se separa:
--   · SELECT  → org + lead visible (asesor dueño Y admin leen).
--   · INSERT/UPDATE/DELETE → además is_admin_or_above().
-- Reversible: volver a la policy única FOR ALL de la 104.
-- Aplicada por MCP; versionada.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS lead_related_contacts_rw ON public.lead_related_contacts;

-- Lectura: cualquiera que vea el lead (asesor dueño o admin), org-scoped.
CREATE POLICY lead_related_contacts_select ON public.lead_related_contacts
  FOR SELECT
  USING (
    organization_id = public.current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_related_contacts.lead_id)
  );

-- Escritura (insert/update/delete): SOLO admin/above, sobre un lead de su org.
CREATE POLICY lead_related_contacts_admin_write ON public.lead_related_contacts
  FOR ALL
  USING (
    public.is_admin_or_above()
    AND organization_id = public.current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_related_contacts.lead_id)
  )
  WITH CHECK (
    public.is_admin_or_above()
    AND organization_id = public.current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_related_contacts.lead_id)
  );

COMMENT ON POLICY lead_related_contacts_admin_write ON public.lead_related_contacts IS
  'Agregar/editar/borrar allegados = solo admin/above. El asesor solo lee (policy select).';
