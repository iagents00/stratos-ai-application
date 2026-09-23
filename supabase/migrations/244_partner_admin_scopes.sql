-- 244_partner_admin_scopes.sql
-- Alcance seguro para distribuidores que administran varias empresas.
-- Aditivo: no cambia el dueño ni la visibilidad de ninguna organización actual.

alter table public.organizations
  add column if not exists parent_organization_id uuid
    references public.organizations(id) on delete restrict;

create index if not exists organizations_parent_idx
  on public.organizations (parent_organization_id, active, created_at desc)
  where parent_organization_id is not null;

comment on column public.organizations.parent_organization_id is
  'Organización distribuidora que administra este tenant. NULL = tenant directo de Stratos.';

alter table public.platform_admins
  add column if not exists scope_organization_id uuid
    references public.organizations(id) on delete restrict;

create index if not exists platform_admins_scope_idx
  on public.platform_admins (scope_organization_id)
  where active = true and scope_organization_id is not null;

comment on column public.platform_admins.scope_organization_id is
  'NULL = operador raíz de Stratos. Con valor = solo la organización distribuidora y sus empresas hijas.';

