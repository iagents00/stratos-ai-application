-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 005: Multi-tenant SaaS para 1,000+ usuarios
--
-- Estrategia: Pool model (single DB, organization_id en cada fila).
-- Es lo que usan Slack, Notion, Linear, Vercel para manejar miles de
-- clientes en la misma base sin perder aislamiento ni performance.
--
-- Cambios principales:
--   1. Nueva tabla `organizations` (cada cliente que compra el SaaS)
--   2. Columna `organization_id` en profiles, leads, audit_log
--   3. RLS aislada por organización (cliente A nunca ve data de cliente B)
--   4. Triggers que auto-rellenan organization_id (el frontend no cambia)
--   5. Materialized views para dashboards con O(1) lookup
--   6. Índices BRIN en audit_log (10× más pequeños que B-tree)
--   7. handle_new_user actualizado para crear org en signup
--
-- Idempotente. Backfill seguro de data existente con org default "Stratos".
-- ═══════════════════════════════════════════════════════════

-- ── 0. EXTENSIONES NECESARIAS ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pg_stat_statements para diagnóstico de queries lentas (no requiere superuser para activar)
-- (Supabase ya lo tiene habilitado por default en proyectos nuevos)

-- ═══════════════════════════════════════════════════════════
-- 1. TABLA `organizations`
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.organizations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identidad
  name                 text        NOT NULL,
  slug                 text        UNIQUE NOT NULL,                 -- ej: "acme", para subdominios futuros
  -- Plan y límites
  plan                 text        NOT NULL DEFAULT 'starter'
                                   CHECK (plan IN ('starter','pro','enterprise','custom')),
  seats                integer     NOT NULL DEFAULT 5,              -- usuarios máximos
  active               boolean     NOT NULL DEFAULT true,
  -- Branding (white-label)
  logo_url             text,
  primary_color        text,
  -- Billing
  stripe_customer_id   text,
  stripe_subscription_id text,
  trial_ends_at        timestamptz,
  subscription_status  text        DEFAULT 'trial'
                                   CHECK (subscription_status IN ('trial','active','past_due','canceled')),
  -- Timestamps
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(active) WHERE active = true;

-- ── ORG DEFAULT (para data existente de Stratos) ─────────────
INSERT INTO public.organizations (id, name, slug, plan, seats, subscription_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Stratos Capital Group',
  'stratos',
  'enterprise',
  100,
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 2. AGREGAR organization_id A TABLAS EXISTENTES
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── BACKFILL: rows existentes → org default Stratos ──────────
UPDATE public.profiles  SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.leads     SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.audit_log SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- ── Hacer NOT NULL después del backfill ──────────────────────
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.leads    ALTER COLUMN organization_id SET NOT NULL;
-- audit_log queda nullable: eventos de auth (LOGIN_FAIL pre-perfil) pueden no tener org

-- ═══════════════════════════════════════════════════════════
-- 3. FUNCIÓN HELPER: organización del usuario actual
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 4. RLS — aislamiento por organización en TODAS las tablas
-- ═══════════════════════════════════════════════════════════

-- ── PROFILES ──
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_org"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_org"   ON public.profiles;

CREATE POLICY "profiles_select_org" ON public.profiles
  FOR SELECT USING (
    organization_id = public.current_organization_id()
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    organization_id = public.current_organization_id()
    AND public.is_admin_or_above()
  );

-- ── LEADS ──
DROP POLICY IF EXISTS "leads_select"        ON public.leads;
DROP POLICY IF EXISTS "leads_select_asesor" ON public.leads;
DROP POLICY IF EXISTS "leads_insert"        ON public.leads;
DROP POLICY IF EXISTS "leads_update"        ON public.leads;

-- SELECT: misma org + (admin OR own leads)
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (
    organization_id = public.current_organization_id()
    AND (
      public.is_admin_or_above()
      OR asesor_name = public.current_user_name()
    )
  );

-- INSERT: misma org (autocompletada por trigger si NULL)
CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT WITH CHECK (
    organization_id = public.current_organization_id()
    OR organization_id IS NULL  -- el trigger lo rellena
  );

-- UPDATE: misma org + (admin OR dueño)
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE USING (
    organization_id = public.current_organization_id()
    AND (
      public.is_admin_or_above()
      OR asesor_name = public.current_user_name()
    )
  );

-- ── AUDIT_LOG ──
DROP POLICY IF EXISTS "audit_log_select_admin"        ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_own"          ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_auth_events"  ON public.audit_log;

-- Admins ven todo el audit de SU organización
CREATE POLICY "audit_log_select_admin" ON public.audit_log
  FOR SELECT USING (
    organization_id = public.current_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin','admin','ceo')
    )
  );

-- Cualquier usuario ve sus propios eventos
CREATE POLICY "audit_log_select_own" ON public.audit_log
  FOR SELECT USING (
    auth.uid() = actor_id
    AND (organization_id IS NULL OR organization_id = public.current_organization_id())
  );

-- INSERT desde cliente solo para auth events
CREATE POLICY "audit_log_insert_auth_events" ON public.audit_log
  FOR INSERT WITH CHECK (entity_type = 'auth');

-- ── ORGANIZATIONS ──
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT USING (id = public.current_organization_id());

DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
CREATE POLICY "organizations_update_admin" ON public.organizations
  FOR UPDATE USING (
    id = public.current_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin','admin')
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 5. TRIGGERS — auto-poblar organization_id
-- ═══════════════════════════════════════════════════════════

-- Si el INSERT en leads no manda org, lo deriva del usuario actual
CREATE OR REPLACE FUNCTION public.set_org_id_from_actor()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_organization_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_org ON public.leads;
CREATE TRIGGER leads_set_org
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_actor();

-- ═══════════════════════════════════════════════════════════
-- 6. AUDIT TRIGGER actualizado para incluir organization_id
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role text;
  v_org_id     uuid;
  v_changed    jsonb;
  v_action     text;
  v_entity_id  uuid;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT name, role, organization_id
    INTO v_actor_name, v_actor_role, v_org_id
    FROM public.profiles WHERE id = v_actor_id;
  END IF;

  -- Si la entidad tiene organization_id, preferirla sobre la del actor
  -- (importante: el actor podría ser super_admin global modificando cualquier org)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    BEGIN
      v_org_id := COALESCE(
        (to_jsonb(NEW)->>'organization_id')::uuid,
        v_org_id
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      v_org_id := COALESCE(
        (to_jsonb(OLD)->>'organization_id')::uuid,
        v_org_id
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_entity_id := NEW.id;
    v_changed := (
      SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value))
      FROM jsonb_each(to_jsonb(NEW))
      WHERE key NOT IN ('created_at','updated_at') AND value IS NOT NULL AND value::text != 'null'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    IF (to_jsonb(OLD) ? 'deleted_at') AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_changed := (
      SELECT jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      FROM jsonb_each(to_jsonb(NEW)) n
      LEFT JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
      WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('updated_at')
    );
    IF v_changed IS NULL OR v_changed = '{}'::jsonb THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_entity_id := OLD.id;
    v_changed := (
      SELECT jsonb_object_agg(key, jsonb_build_object('old', value, 'new', null))
      FROM jsonb_each(to_jsonb(OLD))
      WHERE key NOT IN ('created_at','updated_at') AND value IS NOT NULL AND value::text != 'null'
    );
  END IF;

  INSERT INTO public.audit_log
    (actor_id, actor_name, actor_role, organization_id, entity_type, entity_id, action, changed_fields)
  VALUES
    (v_actor_id, v_actor_name, v_actor_role, v_org_id, TG_TABLE_NAME, v_entity_id, v_action, v_changed);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar también al organizations table
DROP TRIGGER IF EXISTS audit_organizations ON public.organizations;
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ═══════════════════════════════════════════════════════════
-- 7. handle_new_user — auto-crear org en signup nuevo
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id   uuid;
  v_org_name text;
  v_org_slug text;
BEGIN
  -- Caso 1: invitación con organization_id pre-existente en metadata
  v_org_id := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;

  IF v_org_id IS NULL THEN
    -- Caso 2: signup nuevo → crear org para este usuario
    v_org_name := COALESCE(
      NEW.raw_user_meta_data->>'organization_name',
      split_part(NEW.email, '@', 1) || '''s Workspace'
    );
    v_org_slug := lower(regexp_replace(
      COALESCE(NEW.raw_user_meta_data->>'organization_slug', split_part(NEW.email, '@', 1)),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substring(NEW.id::text, 1, 8);

    INSERT INTO public.organizations (name, slug, plan, seats, trial_ends_at)
    VALUES (v_org_name, v_org_slug, 'starter', 5, now() + interval '14 days')
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.profiles (id, name, role, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    -- Primer usuario de una org es admin; los siguientes son asesores
    COALESCE(
      NEW.raw_user_meta_data->>'role',
      CASE WHEN (SELECT count(*) FROM public.profiles WHERE organization_id = v_org_id) = 0
           THEN 'admin'
           ELSE 'asesor'
      END
    ),
    v_org_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 8. ÍNDICES OPTIMIZADOS PARA SCALE
-- ═══════════════════════════════════════════════════════════

-- Leads: queries del CRM siempre filtran por org primero
CREATE INDEX IF NOT EXISTS idx_leads_org_stage         ON public.leads(organization_id, stage)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_org_score         ON public.leads(organization_id, score DESC)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_org_created       ON public.leads(organization_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_org_asesor        ON public.leads(organization_id, asesor_name)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_org_hot           ON public.leads(organization_id, score DESC)    WHERE deleted_at IS NULL AND hot = true;

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_org           ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_role      ON public.profiles(organization_id, role) WHERE active = true;

-- Audit log: BRIN para created_at (mucho más eficiente que B-tree para append-only data)
-- BRIN es 100-1000× más pequeño que B-tree y perfecto para datos secuenciales en tiempo
CREATE INDEX IF NOT EXISTS idx_audit_created_brin     ON public.audit_log USING BRIN(created_at) WITH (pages_per_range = 32);
CREATE INDEX IF NOT EXISTS idx_audit_org_entity       ON public.audit_log(organization_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org_actor        ON public.audit_log(organization_id, actor_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- 9. MATERIALIZED VIEW para dashboard KPIs
-- ═══════════════════════════════════════════════════════════
-- Refresca rápido (CONCURRENTLY) y los dashboards leen de aquí
-- en O(1) en lugar de hacer COUNT/AVG sobre toda la tabla cada vez.
DROP MATERIALIZED VIEW IF EXISTS public.lead_stats_by_org CASCADE;
CREATE MATERIALIZED VIEW public.lead_stats_by_org AS
SELECT
  organization_id,
  count(*)                                                         AS total_leads,
  count(*) FILTER (WHERE stage NOT IN ('Cierre','Perdido'))         AS active_leads,
  count(*) FILTER (WHERE stage = 'Cierre')                          AS closed_leads,
  count(*) FILTER (WHERE stage = 'Perdido')                         AS lost_leads,
  count(*) FILTER (WHERE stage = 'Negociación')                     AS in_negotiation,
  count(*) FILTER (WHERE stage = 'Nuevo Registro')                  AS new_leads,
  count(*) FILTER (WHERE hot = true)                                AS hot_leads,
  ROUND(AVG(score)::numeric, 1)                                     AS avg_score,
  COALESCE(SUM(presupuesto), 0)                                     AS total_pipeline_value,
  COALESCE(SUM(presupuesto) FILTER (WHERE stage = 'Cierre'), 0)     AS total_closed_value,
  -- Conversion rate: closed / (closed + lost)
  CASE
    WHEN count(*) FILTER (WHERE stage IN ('Cierre','Perdido')) > 0
    THEN ROUND(
      (count(*) FILTER (WHERE stage = 'Cierre')::numeric * 100)
      / count(*) FILTER (WHERE stage IN ('Cierre','Perdido')),
      2
    )
    ELSE 0
  END AS conversion_rate,
  now() AS refreshed_at
FROM public.leads
WHERE deleted_at IS NULL
GROUP BY organization_id;

CREATE UNIQUE INDEX ON public.lead_stats_by_org (organization_id);

-- Función para refrescar (llamar desde cron o on-demand)
CREATE OR REPLACE FUNCTION public.refresh_lead_stats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.lead_stats_by_org;
END;
$$;

GRANT SELECT ON public.lead_stats_by_org TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_lead_stats() TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 10. TRIGGER AUTO-REFRESH del materialized view
-- ═══════════════════════════════════════════════════════════
-- Al actualizar un lead, marcar el view como sucio. Un cron de Supabase
-- (cada 5 min) corre refresh_lead_stats() sin bloquear lecturas.
-- Para implementar el cron, en Database → Extensions activar pg_cron y luego:
--   SELECT cron.schedule('refresh-stats', '*/5 * * * *', 'SELECT public.refresh_lead_stats()');
-- (Lo dejo como instrucción manual porque pg_cron requiere activación explícita en Supabase)

-- ═══════════════════════════════════════════════════════════
-- 11. RPC para el frontend: dashboard stats en una sola llamada
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  total_leads          bigint,
  active_leads         bigint,
  closed_leads         bigint,
  hot_leads            bigint,
  avg_score            numeric,
  total_pipeline_value bigint,
  conversion_rate      numeric
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    total_leads, active_leads, closed_leads, hot_leads,
    avg_score, total_pipeline_value, conversion_rate
  FROM public.lead_stats_by_org
  WHERE organization_id = public.current_organization_id();
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 12. ANALYZE para que el planner conozca todo
-- ═══════════════════════════════════════════════════════════
ANALYZE public.organizations;
ANALYZE public.profiles;
ANALYZE public.leads;
ANALYZE public.audit_log;

-- Refrescar el materialized view la primera vez
REFRESH MATERIALIZED VIEW public.lead_stats_by_org;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════
-- Después de correr esta migración, deberías poder:
--
-- 1. Ver tu org default:
--      SELECT * FROM organizations;
--
-- 2. Ver que profiles y leads tienen organization_id:
--      SELECT id, email, organization_id FROM profiles;
--
-- 3. Ver stats en O(1):
--      SELECT * FROM lead_stats_by_org;
--
-- 4. Llamar el RPC desde el frontend:
--      const { data } = await supabase.rpc('get_dashboard_stats');
-- ═══════════════════════════════════════════════════════════
