-- ═══════════════════════════════════════════════════════════════════════════
-- 104_lead_related_contacts.sql — "Familiares o Socios" del contacto
-- ═══════════════════════════════════════════════════════════════════════════
-- Pedido (jul 2026): en el expediente (sección Discovery) el asesor debe poder
-- agregar personas ALLEGADAS al contacto — normalmente la esposa/o, un socio o
-- un familiar — con su propio teléfono/email. Es data EDITABLE por el asesor
-- (distinta del perfilamiento de la IA en discovery_data, que es solo lectura).
--
-- Modelo: 1 lead → N contactos relacionados (tabla propia, no el JSONB de la IA).
-- RLS: misma visibilidad que discovery_data — org-scoped + el lead debe ser
--   visible por RLS (un asesor solo agrega/ve allegados de SUS leads; admin ve
--   todo). organization_id se autopobla desde el lead (defensa multi-tenant).
-- Reversible: DROP TABLE (solo esta tabla, aislada). Aplicada por MCP; versionada.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lead_related_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  name            text NOT NULL,
  relationship    text,           -- "Esposa", "Socio", "Familiar", "Hermano", texto libre
  phone           text,
  email           text,
  notas           text,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_related_contacts_lead
  ON public.lead_related_contacts(lead_id);

-- organization_id se toma del lead (no se confía en el cliente) + refresca updated_at.
CREATE OR REPLACE FUNCTION public.lead_related_contacts_biu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT l.organization_id INTO NEW.organization_id
      FROM public.leads l WHERE l.id = NEW.lead_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lrc_biu ON public.lead_related_contacts;
CREATE TRIGGER trg_lrc_biu
  BEFORE INSERT OR UPDATE ON public.lead_related_contacts
  FOR EACH ROW EXECUTE FUNCTION public.lead_related_contacts_biu();

ALTER TABLE public.lead_related_contacts ENABLE ROW LEVEL SECURITY;

-- Misma regla que discovery_data: org del caller + el lead debe existir/verse por RLS.
DROP POLICY IF EXISTS lead_related_contacts_rw ON public.lead_related_contacts;
CREATE POLICY lead_related_contacts_rw ON public.lead_related_contacts
  FOR ALL
  USING (
    organization_id = public.current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_related_contacts.lead_id)
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_related_contacts.lead_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_related_contacts TO authenticated;

COMMENT ON TABLE public.lead_related_contacts IS
  'Personas allegadas a un lead (esposa/o, socio, familiar) con su contacto. '
  'Editable por el asesor dueño del lead (o admin). Sección "Familiares o Socios" '
  'del expediente. RLS org-scoped + lead visible, igual que discovery_data.';
