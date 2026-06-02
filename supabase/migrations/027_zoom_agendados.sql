-- ════════════════════════════════════════════════════════════════════════
-- 027 — Control de Zooms agendados (Duke del Caribe)
-- ────────────────────────────────────────────────────────────────────────
-- Tabla operativa que replica el Excel "control_zooms_agendados_roles" que
-- el equipo de Duke mantenía a mano. Cada fila = un Zoom de venta agendado,
-- con el Liner (quien lo agenda), el/los Presentador(es) que lo corren, el
-- cliente, el desarrollo y el ciclo de Estatus
-- (Agendado → Confirmado → Asistió / No show / Reagendado / Cancelado).
--
-- Multi-tenant vía organization_id + RLS espejando el patrón de
-- public.appointments / public.leads (migración 015). El panel "Control de
-- Zooms" (pestaña dentro de Comando Directivo) hace CRUD directo sobre esta
-- tabla con el anon key del usuario logueado; RLS lo aísla por organización.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.zoom_agendados (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),
  -- Link opcional al lead del CRM (si el Zoom salió de un lead existente).
  lead_id               UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  -- Fechas: cuándo se agendó vs cuándo ocurre el Zoom.
  fecha_agendado        DATE,
  fecha_zoom            DATE,
  hora                  TEXT,                      -- "11:00", "22:30" (texto, tolerante a la entrada manual)
  -- Roles (de la hoja Catálogos del Excel).
  liner                 TEXT,                      -- setter que agenda la cita
  presentador_principal TEXT,                      -- closer principal que corre el Zoom
  presentador_apoyo     TEXT,                      -- closer de apoyo (opcional)
  -- Negocio.
  cliente               TEXT,
  proyecto              TEXT,                      -- Desarrollo / Proyecto
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

-- RLS: cada org solo ve/edita sus propios Zooms. Mismo patrón que appointments.
DROP POLICY IF EXISTS zoom_agendados_rw ON public.zoom_agendados;
CREATE POLICY zoom_agendados_rw ON public.zoom_agendados
  FOR ALL
  USING      (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

-- updated_at automático en cada UPDATE.
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

COMMENT ON TABLE public.zoom_agendados IS
  'Control operativo de Zooms de venta agendados (Duke). Replica el Excel de control con Liner / Presentadores / Estatus. Multi-tenant por organization_id + RLS.';

-- ════════════════════════════════════════════════════════════════════════
-- PLAN DE ROLLBACK  (migración ADITIVA — cero impacto en datos existentes)
-- ────────────────────────────────────────────────────────────────────────
-- 027 SOLO crea una tabla nueva (public.zoom_agendados) + su trigger/función;
-- no altera ni borra ninguna tabla existente. Revertir es limpio y únicamente
-- afecta las filas de ESTA tabla (re-sembrables con supabase/import_zooms.mjs):
--
--   DROP TRIGGER  IF EXISTS zoom_agendados_touch ON public.zoom_agendados;
--   DROP FUNCTION IF EXISTS public.zoom_agendados_touch_updated_at();
--   DROP TABLE    IF EXISTS public.zoom_agendados CASCADE;
--
-- ════════════════════════════════════════════════════════════════════════
-- VALIDACIÓN POSTERIOR  (correr tras aplicar — deben pasar las 3)
-- ────────────────────────────────────────────────────────────────────────
-- 1) La tabla existe:
--      SELECT to_regclass('public.zoom_agendados') IS NOT NULL AS tabla_ok;   -- → t
-- 2) RLS encendida + política de aislamiento por org presente:
--      SELECT relrowsecurity AS rls_on
--        FROM pg_class WHERE oid = 'public.zoom_agendados'::regclass;          -- → t
--      SELECT polname FROM pg_policy
--        WHERE polrelid = 'public.zoom_agendados'::regclass;                  -- → zoom_agendados_rw
-- 3) Aislamiento multi-tenant en runtime: toda lectura/escritura pasa por
--    current_organization_id(), así que un usuario de una org NUNCA ve filas
--    de otra. Verificación: GET /rest/v1/zoom_agendados con el anon key de un
--    usuario de Duke devuelve solo filas con su organization_id.
-- ════════════════════════════════════════════════════════════════════════
