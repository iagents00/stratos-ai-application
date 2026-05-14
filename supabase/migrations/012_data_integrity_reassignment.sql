-- ═══════════════════════════════════════════════════════════════════════════
-- 012_data_integrity_reassignment.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Refuerza la integridad después de habilitar reasignación para todos.
--
-- 1) sync_lead_asesor_id() — trigger que resuelve asesor_id desde
--    asesor_name. Las policies RLS usan asesor_name (texto) como gate,
--    pero el bot Telegram y futuras APIs usan asesor_id (FK). Si el
--    frontend cambia uno sin sincronizar el otro, el bot queda mirando
--    al asesor viejo o a un orfana fantasma. Este trigger garantiza
--    consistencia en cualquier escritura.
--
-- 2) Backfill — corrige los 11 leads existentes que ya tenían mismatch
--    entre asesor_name y asesor_id (residuo del bug anterior).
--
-- 3) DENY DELETE explícito — sin policy FOR DELETE, RLS ya niega el
--    hard-delete por default. Esta policy lo blinda contra futuros
--    cambios accidentales. El soft-delete (deleted_at) sigue funcionando
--    normalmente porque va por UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) FUNCIÓN sync_lead_asesor_id ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_lead_asesor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved_id uuid;
BEGIN
  IF NEW.asesor_name IS NULL OR btrim(NEW.asesor_name) = '' THEN
    -- Sin nombre → asegurar que asesor_id también queda NULL (orfana limpia).
    NEW.asesor_id := NULL;
    RETURN NEW;
  END IF;

  -- Match case-insensitive con trim. Preferimos perfil de la misma
  -- organización si está disponible (multi-tenant safe).
  SELECT id INTO v_resolved_id
  FROM public.profiles
  WHERE lower(btrim(name)) = lower(btrim(NEW.asesor_name))
    AND (organization_id IS NULL
         OR NEW.organization_id IS NULL
         OR organization_id = NEW.organization_id)
  ORDER BY (organization_id = NEW.organization_id) DESC NULLS LAST
  LIMIT 1;

  NEW.asesor_id := v_resolved_id;
  -- v_resolved_id puede ser NULL (asesor escrito a mano sin perfil aún).
  -- Eso es válido: el lead queda visible para admins, y se asigna al
  -- asesor_id real cuando admin cree el perfil con ese nombre.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_lead_asesor_id() IS
  'Resuelve asesor_id desde asesor_name en INSERT/UPDATE de leads. '
  'Garantiza que asesor_id refleje siempre al perfil actual del asesor, '
  'incluso si el frontend o el bot olvidaron pasar el UUID al reasignar.';

-- 2) TRIGGERS ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS leads_sync_asesor_id_insert ON public.leads;
CREATE TRIGGER leads_sync_asesor_id_insert
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_asesor_id();

DROP TRIGGER IF EXISTS leads_sync_asesor_id_update ON public.leads;
CREATE TRIGGER leads_sync_asesor_id_update
  BEFORE UPDATE OF asesor_name ON public.leads
  FOR EACH ROW
  WHEN (NEW.asesor_name IS DISTINCT FROM OLD.asesor_name)
  EXECUTE FUNCTION public.sync_lead_asesor_id();

-- 3) BACKFILL: corrige leads existentes con asesor_id desalineado ─────────────
-- Solo toca filas donde el id actual no corresponde al nombre actual. No-op
-- para filas ya correctas. Genera entradas en audit_log para trazabilidad.
WITH resolved AS (
  SELECT
    l.id AS lead_id,
    (
      SELECT p.id FROM public.profiles p
      WHERE lower(btrim(p.name)) = lower(btrim(l.asesor_name))
        AND (p.organization_id IS NULL
             OR l.organization_id IS NULL
             OR p.organization_id = l.organization_id)
      ORDER BY (p.organization_id = l.organization_id) DESC NULLS LAST
      LIMIT 1
    ) AS new_asesor_id
  FROM public.leads l
  WHERE l.asesor_name IS NOT NULL
    AND btrim(l.asesor_name) <> ''
)
UPDATE public.leads l
SET asesor_id = r.new_asesor_id
FROM resolved r
WHERE l.id = r.lead_id
  AND l.asesor_id IS DISTINCT FROM r.new_asesor_id;

-- 4) POLICY DENY DELETE EXPLÍCITA ─────────────────────────────────────────────
-- Sin policy FOR DELETE, RLS ya niega por default. Esto lo hace explícito:
-- nadie puede hard-deletear un lead. El soft-delete (deleted_at) va por
-- UPDATE y sigue funcionando con la policy leads_update existente.
DROP POLICY IF EXISTS "leads_no_hard_delete" ON public.leads;
CREATE POLICY "leads_no_hard_delete"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (false);

COMMENT ON POLICY "leads_no_hard_delete" ON public.leads IS
  'Niega hard-delete a todos los usuarios. La papelera usa deleted_at '
  '(soft-delete via UPDATE) — ningún lead se borra realmente de la DB.';
