-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Schema inicial de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- ── 1. PROFILES — extiende auth.users con rol y datos del asesor ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  role        text        NOT NULL DEFAULT 'asesor'
                          CHECK (role IN ('super_admin','admin','ceo','director','asesor')),
  phone       text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-crear perfil cuando se crea un usuario en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'asesor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. LEADS — CRM principal ──
CREATE TABLE IF NOT EXISTS public.leads (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Datos del cliente
  name             text        NOT NULL,
  email            text,
  phone            text,
  source           text        DEFAULT 'manual',
  -- Pipeline
  stage            text        NOT NULL DEFAULT 'Nuevo Registro',
  score            integer     NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  hot              boolean     NOT NULL DEFAULT false,
  is_new           boolean     NOT NULL DEFAULT true,
  -- Presupuesto
  presupuesto      bigint      DEFAULT 0,
  -- Proyecto / campaña
  project          text,
  campaign         text,
  -- Seguimiento
  seguimientos     integer     NOT NULL DEFAULT 0,
  next_action      text,
  next_action_date text,
  last_activity    text,
  days_inactive    integer     NOT NULL DEFAULT 0,
  ai_agent         text,
  asesor_name      text,
  -- Historia y tareas (JSONB)
  action_history   jsonb       NOT NULL DEFAULT '[]',
  tasks            jsonb       NOT NULL DEFAULT '[]',
  -- Notas
  notes            text,
  bio              text,
  risk             text,
  -- Auditoría
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz           -- soft delete
);

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. ROW LEVEL SECURITY ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads    ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario ve su propio perfil; admins ven todos
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin','admin')
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin','admin')
    )
  );

-- Leads: asesores ven solo los suyos; director/admin/ceo ven todos
CREATE POLICY "leads_select_asesor" ON public.leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('super_admin','admin','ceo','director')
          OR leads.asesor_name = p.name
        )
    )
  );

CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ── 4. ÍNDICES para performance ──
CREATE INDEX IF NOT EXISTS idx_leads_stage        ON public.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_asesor       ON public.leads(asesor_name);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at   ON public.leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at   ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role      ON public.profiles(role);

-- ═══════════════════════════════════════════════════════════
-- FIN — Verifica en Table Editor que existen: profiles, leads
-- ═══════════════════════════════════════════════════════════
