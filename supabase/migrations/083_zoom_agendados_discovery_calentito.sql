-- ════════════════════════════════════════════════════════════════════════
-- 083 — Control de Zooms v2: discovery + calentito (Duke del Caribe)
-- ────────────────────────────────────────────────────────────────────────
-- Reunión Ivan + Emmanuel Ortiz (director comercial) 2026-07-09: replicar su
-- Google Sheet "control de Zooms y roles" dentro del Comando Directivo.
--   · discovery  — notas del Discovery (presupuesto, ubicación, etc.) para que
--                  el presentador sepa qué presentar. En su sheet vivía en
--                  comentarios + columna Sí/No; aquí es campo propio y el
--                  indicador Sí/No se deriva de que no esté vacío.
--   · calentito  — cliente que en el Zoom dio señal de cierre (carta oferta /
--                  mandó identificación / pidió cuentas para apartar). En su
--                  sheet los marcaba en rojo.
--
-- Idempotente y autocontenida: si la 027 nunca se aplicó en este proyecto,
-- esta migración crea la tabla completa; si ya existe, solo agrega columnas.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.zoom_agendados (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),
  lead_id               UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  fecha_agendado        DATE,
  fecha_zoom            DATE,
  hora                  TEXT,
  liner                 TEXT,
  presentador_principal TEXT,
  presentador_apoyo     TEXT,
  cliente               TEXT,
  proyecto              TEXT,
  estatus               TEXT NOT NULL DEFAULT 'Agendado',
  comentarios           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zoom_agendados_org_idx        ON public.zoom_agendados (organization_id);
CREATE INDEX IF NOT EXISTS zoom_agendados_fecha_zoom_idx ON public.zoom_agendados (fecha_zoom);
CREATE INDEX IF NOT EXISTS zoom_agendados_estatus_idx    ON public.zoom_agendados (estatus);
CREATE INDEX IF NOT EXISTS zoom_agendados_lead_idx       ON public.zoom_agendados (lead_id);

ALTER TABLE public.zoom_agendados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zoom_agendados_rw ON public.zoom_agendados;
CREATE POLICY zoom_agendados_rw ON public.zoom_agendados
  FOR ALL
  USING      (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE OR REPLACE FUNCTION public.zoom_agendados_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zoom_agendados_touch ON public.zoom_agendados;
CREATE TRIGGER zoom_agendados_touch
  BEFORE UPDATE ON public.zoom_agendados
  FOR EACH ROW EXECUTE FUNCTION public.zoom_agendados_touch_updated_at();

-- ── v2: columnas nuevas ─────────────────────────────────────────────────
ALTER TABLE public.zoom_agendados ADD COLUMN IF NOT EXISTS discovery  TEXT;
ALTER TABLE public.zoom_agendados ADD COLUMN IF NOT EXISTS calentito  BOOLEAN NOT NULL DEFAULT false;
