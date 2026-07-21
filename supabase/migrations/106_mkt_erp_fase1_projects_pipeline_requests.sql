-- 106: ERP de marketing Fase 1 — proyectos por marca, kanban del pipeline de propiedades y solicitudes de diseño.
-- Aditivo: solo CREATE/ALTER ADD; no toca datos existentes. Mismo patrón RLS que el resto de mkt_*
-- (org-scoped + is_marketing_or_above(), DELETE prohibido → soft-delete con deleted_at).
-- ⚠️ NO aplicada automáticamente: aplicar con OK humano (Supabase stratos-prod glulgyhkrqpykxmujodb).

create table if not exists public.mkt_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid references public.mkt_brands(id),
  nombre text not null,
  descripcion text,
  drive_url text,
  due_date date,
  estado text not null default 'activo' check (estado in ('activo','pausado','terminado')),
  orden integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists mkt_projects_org_idx on public.mkt_projects (organization_id) where deleted_at is null;
create index if not exists mkt_projects_brand_idx on public.mkt_projects (brand_id) where deleted_at is null;

create table if not exists public.mkt_pipeline_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid references public.mkt_brands(id),
  nombre text not null,
  locacion text,
  etapa text not null default 'seleccionada' check (etapa in ('seleccionada','agendada','grabada','en_edicion','esperando_voz','lista','publicada')),
  fecha_rodaje date,
  drive_url text,
  ig_url text,
  notas text,
  orden integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists mkt_pipeline_org_idx on public.mkt_pipeline_items (organization_id) where deleted_at is null;
create index if not exists mkt_pipeline_etapa_idx on public.mkt_pipeline_items (etapa) where deleted_at is null;

create table if not exists public.mkt_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid references public.mkt_brands(id),
  titulo text not null,
  detalle text,
  objetivo text,
  complejidad text not null default 'A' check (complejidad in ('A','AA','AAA')),
  ref_image_url text,
  voice_url text,
  fecha_entrega date,
  solicitante uuid,
  assignee_id uuid,
  estado text not null default 'nueva' check (estado in ('nueva','en_curso','en_revision','entregada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists mkt_requests_org_idx on public.mkt_requests (organization_id) where deleted_at is null;

-- mkt_tasks: enganche a proyectos + dependencias + link a Drive
alter table public.mkt_tasks add column if not exists project_id uuid references public.mkt_projects(id);
alter table public.mkt_tasks add column if not exists depends_on uuid references public.mkt_tasks(id);
alter table public.mkt_tasks add column if not exists drive_url text;
create index if not exists mkt_tasks_project_idx on public.mkt_tasks (project_id) where deleted_at is null;
create index if not exists mkt_tasks_assignee_idx on public.mkt_tasks (assignee_id) where deleted_at is null;

-- RLS (mismo patrón que el resto de mkt_*)
alter table public.mkt_projects enable row level security;
alter table public.mkt_pipeline_items enable row level security;
alter table public.mkt_requests enable row level security;

do $$
declare t text;
begin
  foreach t in array array['mkt_projects','mkt_pipeline_items','mkt_requests'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('create policy %I on public.%I for select using ((organization_id = current_organization_id()) and is_marketing_or_above())', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert', t);
    execute format('create policy %I on public.%I for insert with check ((organization_id = current_organization_id()) and is_marketing_or_above())', t||'_insert', t);
    execute format('drop policy if exists %I on public.%I', t||'_update', t);
    execute format('create policy %I on public.%I for update using ((organization_id = current_organization_id()) and is_marketing_or_above()) with check ((organization_id = current_organization_id()) and is_marketing_or_above())', t||'_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_nodelete', t);
    execute format('create policy %I on public.%I for delete using (false)', t||'_nodelete', t);
  end loop;
end $$;

-- Rollback (con OK humano + backup):
--   drop table public.mkt_requests; drop table public.mkt_pipeline_items;
--   alter table public.mkt_tasks drop column project_id, drop column depends_on, drop column drive_url;
--   drop table public.mkt_projects;
