-- ═══════════════════════════════════════════════════════════════════════════
-- 032 — Stratos Rails: la agenda del día y la clasificación de cartera
-- APLICADA EN PRODUCCIÓN el 2026-08-23.
-- ───────────────────────────────────────────────────────────────────────────
-- LA LEY QUE ESTO HABILITA
-- "Ningún lead vivo existe sin un próximo paso con fecha y hora."
-- La violan 1,495 de 1,834 leads de Duke (81.5%).
--
-- El motor de próxima acción vive en src/lib/next-action-engine.js y Mi Día ya
-- lo pinta, pero sin esta tabla el "Hecho" era optimista y se perdía al
-- recargar. Acá se persiste.
--
-- TODO ADITIVO E IDEMPOTENTE. No borra ni una fila.
--
-- RLS: copia el patrón EXACTO de la tabla leads
--   organization_id = current_organization_id()
--   AND (is_admin_or_above() OR can_view_all_leads() OR asesor_name = current_user_name())
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clasificacion text
  CHECK (clasificacion IN ('prioritario','intermedio','reactivar','rotacion'));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clasificacion_razon text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clasificacion_at timestamptz;

-- Regla 2: 6 toques en 7 días con cambio de canal. Velocify sobre 3.5M
-- registros: el 93% de los que convierten se alcanzan en <=6 intentos.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sprint_toques int NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sprint_ultimo_canal text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sprint_inicio timestamptz;

-- Regla 4: nunca "descartado". Nurture CON FECHA.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS nurture_desde timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reactivar_at timestamptz;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enganche_liquido bigint;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enganche_disponible boolean;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS uso text
  CHECK (uso IN ('inversion','segunda_residencia','hibrido','retiro'));

-- Regla 5: sin co-decisor identificado no se agenda Zoom.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS codecisor_nombre text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS codecisor_relacion text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS criterios_decision jsonb;

-- Regla 7: duda alta apaga la urgencia. JOLT: presionar al indeciso falla 84%.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS nivel_duda text
  CHECK (nivel_duda IN ('baja','media','alta'));

-- Regla 9: opt_out absoluto, sin override.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS opt_out boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_clasificacion
  ON public.leads (organization_id, clasificacion) WHERE deleted_at IS NULL;

ALTER TABLE public.zoom_agendados ADD COLUMN IF NOT EXISTS lock_respuesta text;
ALTER TABLE public.zoom_agendados ADD COLUMN IF NOT EXISTS confirmado_activo_at timestamptz;
ALTER TABLE public.zoom_agendados ADD COLUMN IF NOT EXISTS codecisor_presente boolean;

CREATE TABLE IF NOT EXISTS public.agenda_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  asesor_id       uuid,
  asesor_name     text NOT NULL,
  lead_id         uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  fecha           date NOT NULL,
  orden           int  NOT NULL DEFAULT 0,
  tipo            text NOT NULL,
  canal           text,
  razon           text NOT NULL,
  pedir           text,
  guion           text,
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','hecho','movido','saltado')),
  resultado       text,
  completado_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_items_dia  ON public.agenda_items (asesor_name, fecha, estado);
CREATE INDEX IF NOT EXISTS agenda_items_lead ON public.agenda_items (lead_id);
-- Una acción por lead por día: si el clasificador nocturno corre dos veces,
-- no duplica la tarjeta.
CREATE UNIQUE INDEX IF NOT EXISTS agenda_items_lead_dia
  ON public.agenda_items (lead_id, fecha) WHERE lead_id IS NOT NULL;

ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_items_select ON public.agenda_items;
CREATE POLICY agenda_items_select ON public.agenda_items
  FOR SELECT TO authenticated
  USING (organization_id = current_organization_id()
         AND (is_admin_or_above() OR can_view_all_leads()
              OR asesor_name = current_user_name()));

DROP POLICY IF EXISTS agenda_items_insert ON public.agenda_items;
CREATE POLICY agenda_items_insert ON public.agenda_items
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_organization_id());

DROP POLICY IF EXISTS agenda_items_update ON public.agenda_items;
CREATE POLICY agenda_items_update ON public.agenda_items
  FOR UPDATE TO authenticated
  USING (organization_id = current_organization_id()
         AND (is_admin_or_above() OR can_view_all_leads()
              OR asesor_name = current_user_name()));

-- Igual que leads: nada de borrados duros. Una acción se marca 'saltado', no
-- se borra — si no, se pierde la evidencia de qué se decidió no hacer.
DROP POLICY IF EXISTS agenda_items_no_hard_delete ON public.agenda_items;
CREATE POLICY agenda_items_no_hard_delete ON public.agenda_items
  FOR DELETE TO authenticated USING (false);

REVOKE ALL ON public.agenda_items FROM anon;

COMMENT ON TABLE public.agenda_items IS
  'Stratos Rails: la lista del día del asesor. Máximo ~7 visibles. Una fila por lead por día.';

-- Mide el proceso. REGLA DE GOBIERNO: estas métricas NO alimentan ranking ni
-- bono (ley de Goodhart), y el asesor ve sus datos antes que su jefe.
CREATE TABLE IF NOT EXISTS public.proceso_daily_stats (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL,
  asesor_name               text NOT NULL,
  fecha                     date NOT NULL,
  agenda_total              int DEFAULT 0,
  agenda_hecha              int DEFAULT 0,
  ttfc_mediano_min          int,
  leads_sin_segundo_intento int DEFAULT 0,
  leads_sin_next_action     int DEFAULT 0,
  zooms_con_codecisor       int DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, asesor_name, fecha)
);

ALTER TABLE public.proceso_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proceso_stats_select ON public.proceso_daily_stats;
CREATE POLICY proceso_stats_select ON public.proceso_daily_stats
  FOR SELECT TO authenticated
  USING (organization_id = current_organization_id()
         AND (is_admin_or_above() OR can_view_all_leads()
              OR asesor_name = current_user_name()));

REVOKE ALL ON public.proceso_daily_stats FROM anon;

COMMENT ON TABLE public.proceso_daily_stats IS
  'Stratos Rails: cumplimiento diario del proceso. NO alimenta ranking ni bono (ley de Goodhart).';
