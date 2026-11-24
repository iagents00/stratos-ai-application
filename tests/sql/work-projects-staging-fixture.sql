-- Schema contracts preceding the additive migration. The staging database
-- comes from Supabase CLI and uses its real auth and PostgREST services.
create table public.organizations (id uuid primary key, active boolean, meta_config jsonb);
create table public.profiles (
  id uuid primary key references auth.users(id),
  organization_id uuid references public.organizations(id),
  active boolean, crm_only boolean, role text, name text, is_marketing_admin boolean default false
);
create table public.front_rpc_registry (nombre text primary key, nota text);
