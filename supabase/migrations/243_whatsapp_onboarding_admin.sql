-- 243_whatsapp_onboarding_admin.sql
-- Consola de onboarding multiempresa para WhatsApp + Infobip.
-- CREATE-only: no elimina ni reescribe canales productivos existentes.

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id),
  active boolean not null default true,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  note text
);

comment on table public.platform_admins is
  'Operadores internos autorizados a crear tenants, usuarios y canales para toda la plataforma.';

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;

create table if not exists public.whatsapp_onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  requested_by uuid not null references public.profiles(id),
  advisor_id uuid references public.profiles(id),
  owner_type text not null default 'company'
    check (owner_type in ('company','advisor')),
  owner_name text,
  phone_e164 text,
  business_portfolio_id text,
  waba_id text,
  phone_number_id text,
  status text not null default 'draft'
    check (status in (
      'draft','waiting_customer','meta_finished','infobip_registering',
      'ready_to_test','active','failed','disconnected'
    )),
  registration_info text,
  last_error text,
  provider_state jsonb not null default '{}'::jsonb,
  meta_completed_at timestamptz,
  provider_completed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_onboarding_runs_org_idx
  on public.whatsapp_onboarding_runs (organization_id, created_at desc);
create index if not exists whatsapp_onboarding_runs_waba_idx
  on public.whatsapp_onboarding_runs (waba_id)
  where waba_id is not null;
create index if not exists whatsapp_onboarding_runs_status_idx
  on public.whatsapp_onboarding_runs (status, updated_at desc);

alter table public.whatsapp_onboarding_runs enable row level security;
revoke all on table public.whatsapp_onboarding_runs from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'whatsapp_onboarding_runs_updated_at'
      and tgrelid = 'public.whatsapp_onboarding_runs'::regclass
  ) then
    create trigger whatsapp_onboarding_runs_updated_at
    before update on public.whatsapp_onboarding_runs
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Columnas de observabilidad ya presentes en producción, declaradas aquí para
-- que una instalación limpia quede igual y el callback sea idempotente.
alter table public.whatsapp_numero_asesor
  add column if not exists estado_conexion text,
  add column if not exists app_suscrita_id text,
  add column if not exists verificado_at timestamptz,
  add column if not exists intentos_registro integer not null default 0,
  add column if not exists ultimo_intento_registro timestamptz,
  add column if not exists ultimo_error text;

-- El usuario Auth se crea fuera del repositorio para que su clave jamás quede
-- en Git. Si ya existe, este bloque le asigna el perfil NSG y la consola.
insert into public.profiles (id, organization_id, name, role, active)
select u.id, o.id, 'Admin Stratos', 'super_admin', true
from auth.users u
join public.organizations o on o.slug = 'nsg'
where lower(u.email) = 'admin2026@stratoscapitalgroup.com'
on conflict (id) do update set
  organization_id = excluded.organization_id,
  name = excluded.name,
  role = excluded.role,
  active = excluded.active;

insert into public.platform_admins (user_id, note)
select u.id, 'Administrador inicial de la consola WhatsApp'
from auth.users u
where lower(u.email) = 'admin2026@stratoscapitalgroup.com'
on conflict (user_id) do update set active = true;
