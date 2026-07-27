-- ─────────────────────────────────────────────────────────────────────────────
-- EXPEDIENTE DE CLIENTE: objetivos con progreso medible + bitácora de avances.
-- Pedido de Ángel (27-jul): "si fijamos objetivos con nuestros clientes que se vaya
-- viendo el progreso con ese cliente".
-- Nombres GENÉRICOS (client_*, no nsg_*) y todo org-scoped: cuando esto se copie a
-- Mueblería / Legacy / Brasa y Piedra funciona igual sin tocar una línea.
-- El cliente es una fila de `leads` (reusa el Pipeline que ya existe y se ve en el CRM).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id uuid,                       -- el cliente (leads)
  titulo text not null,
  detalle text,
  meta numeric not null default 100,  -- a cuánto queremos llegar
  actual numeric not null default 0,  -- dónde vamos
  unidad text default '%',            -- %, empresas, videos, reuniones…
  due_date date,
  estado text not null default 'activo',   -- activo | logrado | pausado
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);
create index if not exists idx_client_objectives_org on public.client_objectives(organization_id) where deleted_at is null;

create table if not exists public.client_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id uuid,
  objective_id uuid,
  texto text not null,
  tipo text not null default 'avance',     -- avance | reunion | entrega | cobro | nota
  autor_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_client_updates_org on public.client_updates(organization_id, lead_id) where deleted_at is null;

alter table public.client_objectives enable row level security;
alter table public.client_updates    enable row level security;

-- RLS: cada quien ve solo lo de SU organización (aislamiento entre empresas)
drop policy if exists client_objectives_org on public.client_objectives;
create policy client_objectives_org on public.client_objectives for all to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

drop policy if exists client_updates_org on public.client_updates;
create policy client_updates_org on public.client_updates for all to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- Busca un cliente por nombre dentro de la organización
create or replace function public._client_find(p_org uuid, p_nombre text)
returns table(id uuid, name text) language sql stable as $$
  select l.id, l.name from leads l
  where l.organization_id = p_org
    and (p_nombre is null or l.name ilike '%'||trim(p_nombre)||'%')
  order by length(l.name) limit 1;
$$;

-- Barra de progreso en texto (se lee igual en Telegram, en el chat y en un resumen)
create or replace function public._barra(p_actual numeric, p_meta numeric)
returns text language sql immutable as $$
  select repeat('█', greatest(0, least(10, round(coalesce(p_actual,0) / nullif(p_meta,0) * 10)::int)))
      || repeat('░', 10 - greatest(0, least(10, round(coalesce(p_actual,0) / nullif(p_meta,0) * 10)::int)));
$$;;
