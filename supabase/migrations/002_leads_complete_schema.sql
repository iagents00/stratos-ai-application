-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 002
-- Sincroniza la tabla `leads` con TODOS los campos que envía el frontend.
-- Idempotente: usa ADD COLUMN IF NOT EXISTS, se puede correr varias veces.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- ── Campos que faltaban en el schema original ─────────────────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget          text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notas           text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS friction        text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tag             text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority        text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_order  integer;

-- ── Campos JSONB que pueden no haberse aplicado en la 001 ────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS action_history  jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tasks           jsonb NOT NULL DEFAULT '[]';

-- ── Migrar datos antiguos: si existía `notes` (schema viejo), ──
-- copiarlos a `notas` y eliminar la columna duplicada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'notes'
  ) THEN
    UPDATE public.leads SET notas = COALESCE(notas, notes) WHERE notes IS NOT NULL;
    ALTER TABLE public.leads DROP COLUMN notes;
  END IF;
END$$;

-- ── Índices útiles para los nuevos campos ────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_priority       ON public.leads(priority)       WHERE priority IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_priority_order ON public.leads(priority_order) WHERE priority_order IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tag            ON public.leads(tag)            WHERE tag IS NOT NULL;

-- ── Refrescar el schema cache de PostgREST ───────────────────
-- Esto evita el error "Could not find the X column in the schema cache"
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════
-- LISTO. Verifica: SELECT column_name FROM information_schema.columns
--                  WHERE table_name = 'leads' ORDER BY ordinal_position;
-- ═══════════════════════════════════════════════════════════
