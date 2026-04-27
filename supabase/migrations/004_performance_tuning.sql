-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 004
-- Ajustes finos de performance para escala 10 × 30 = 300+ leads
--
-- Qué hace:
--   • Índices compuestos para los filtros típicos del CRM
--     (asesor + etapa, asesor + score, próxima acción)
--   • Funciones helper SECURITY DEFINER para RLS:
--     evita repetir el subquery a profiles en cada fila
--   • Política RLS de leads simplificada y más rápida
--
-- Ejecutar DESPUÉS de las migraciones 001, 002 y 003.
-- Idempotente: se puede correr varias veces sin romper nada.
-- ═══════════════════════════════════════════════════════════

-- ── 1. ÍNDICES COMPUESTOS para queries comunes del CRM ────
-- "Mis leads en etapa Negociación":
CREATE INDEX IF NOT EXISTS idx_leads_asesor_stage
  ON public.leads(asesor_name, stage)
  WHERE deleted_at IS NULL;

-- "Mis leads ordenados por score":
CREATE INDEX IF NOT EXISTS idx_leads_asesor_score
  ON public.leads(asesor_name, score DESC)
  WHERE deleted_at IS NULL;

-- "Leads con próxima acción hoy/atrasada":
CREATE INDEX IF NOT EXISTS idx_leads_next_action_date
  ON public.leads(next_action_date)
  WHERE deleted_at IS NULL AND next_action_date IS NOT NULL;

-- "Leads hot del pipeline":
CREATE INDEX IF NOT EXISTS idx_leads_hot
  ON public.leads(hot, score DESC)
  WHERE deleted_at IS NULL AND hot = true;

-- Index en profiles.name — usado por el RLS de leads
CREATE INDEX IF NOT EXISTS idx_profiles_name
  ON public.profiles(name);

-- ── 2. FUNCIONES HELPER para RLS ──────────────────────────
-- En lugar de hacer un EXISTS + JOIN en cada policy check
-- (caro cuando se evalúa por fila), usamos funciones cacheadas
-- por transacción.

-- Devuelve true si el usuario actual es super_admin/admin/ceo/director
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS boolean
LANGUAGE sql
STABLE                  -- mismo resultado en una transacción → caché
SECURITY DEFINER        -- corre con permisos del owner, salta RLS
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin','admin','ceo','director')
  );
$$;

-- Devuelve el nombre del usuario actual (para el match con asesor_name)
CREATE OR REPLACE FUNCTION public.current_user_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.profiles WHERE id = auth.uid();
$$;

-- Permitir que cualquier autenticado las invoque
GRANT EXECUTE ON FUNCTION public.is_admin_or_above()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_name()  TO authenticated;

-- ── 3. POLÍTICA RLS DE LEADS — versión optimizada ──────────
-- Reemplaza la política original con una que usa las funciones helper
DROP POLICY IF EXISTS "leads_select_asesor" ON public.leads;
DROP POLICY IF EXISTS "leads_select" ON public.leads;

CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (
    public.is_admin_or_above()
    OR asesor_name = public.current_user_name()
  );

-- Update también: solo admins/director o el dueño asesor
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE USING (
    public.is_admin_or_above()
    OR asesor_name = public.current_user_name()
  );

-- ── 4. ÍNDICE GIN para búsqueda en JSONB (action_history, tasks) ──
-- Solo si en el futuro queremos buscar dentro del historial de acciones
-- (ej: "leads que hicieron tour"). Lo dejo comentado: agrega ~10% storage
-- y solo vale la pena si se usa la consulta. Activarlo cuando haga falta:
--
-- CREATE INDEX IF NOT EXISTS idx_leads_action_history_gin
--   ON public.leads USING GIN (action_history);

-- ── 5. ANALYZE para que el query planner conozca los nuevos índices ──
ANALYZE public.leads;
ANALYZE public.profiles;
ANALYZE public.audit_log;

-- ── 6. Refrescar schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN — corre esto y deberías ver los nuevos índices:
-- ═══════════════════════════════════════════════════════════
-- SELECT indexname, tablename
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_leads%' OR indexname LIKE 'idx_profiles%'
-- ORDER BY tablename, indexname;
--
-- Y testea la velocidad:
-- EXPLAIN ANALYZE SELECT * FROM public.leads
-- WHERE asesor_name = 'Tu Nombre' AND stage = 'Negociación';
--
-- Debe usar idx_leads_asesor_stage (no Seq Scan).
-- ═══════════════════════════════════════════════════════════
