-- 245_partner_admin_quotas_and_events.sql
-- Cupos comerciales y bitacora durable para administradores distribuidores.
-- Aditivo: no cambia la visibilidad de tenants existentes ni concede accesos.

alter table public.platform_admins
  add column if not exists company_limit integer,
  add column if not exists support_only boolean not null default true;

alter table public.platform_admins
  drop constraint if exists platform_admins_company_limit_check;

alter table public.platform_admins
  add constraint platform_admins_company_limit_check
  check (company_limit is null or company_limit between 1 and 10000);

comment on column public.platform_admins.company_limit is
  'Cantidad maxima de empresas hijas que puede crear el distribuidor. NULL solo es valido para operadores raiz.';

comment on column public.platform_admins.support_only is
  'Si es true, la cuenta entra exclusivamente a la consola de soporte y nunca al CRM de un tenant.';

create table if not exists public.platform_admin_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('partner_created','company_created','quota_changed')),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  partner_organization_id uuid references public.organizations(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  notification_status text not null default 'pending'
    check (notification_status in ('pending','sent','failed','not_configured')),
  notification_attempts integer not null default 0,
  notification_error text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_events_created_idx
  on public.platform_admin_events (created_at desc);

create index if not exists platform_admin_events_partner_idx
  on public.platform_admin_events (partner_organization_id, created_at desc)
  where partner_organization_id is not null;

alter table public.platform_admin_events enable row level security;
revoke all on table public.platform_admin_events from public, anon, authenticated;

comment on table public.platform_admin_events is
  'Bitacora privada de altas y cupos de partners. Conserva el evento aunque Telegram o n8n fallen.';
