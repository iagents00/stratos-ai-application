-- 181 — El registro se edita como una hoja: columnas propias
--
-- Pedido de Alex/Iván (28-jul): «debería ser igual que este Excel pero con todas
-- las funciones, y con una parte para editar la tabla, añadir columnas y todo lo
-- esencial… que se pueda cambiar status y todo funcional».
--
-- Las columnas FIJAS (precio, tipo, fechas, los 8 enlaces) ya existen como
-- columnas de verdad — se editan en la tabla y se filtran. Esto agrega lo que
-- faltaba: que el equipo pueda inventar columnas nuevas sin que nosotros
-- toquemos el esquema, igual que agregar una columna en el Sheet.
--
-- Por qué jsonb y no una columna real por cada una: Alex dijo en la llamada que
-- «conforme las necesidades, cada archivo va mutando, se le van agregando filas».
-- Si cada idea suya necesitara una migración nuestra, volvería al Excel.
--
-- Por qué una TABLA de definiciones y no solo las llaves del jsonb: para que el
-- orden, el tipo y el nombre visible sean estables aunque una fila no tenga ese
-- dato. Sin esto, una columna vacía en todas las filas desaparecería sola.
--
-- Solo CREATE. Revertir: dejar de mostrar las columnas propias (los valores
-- quedan en `datos`, no se pierden).

alter table public.mkt_pipeline_items
  add column if not exists datos jsonb not null default '{}'::jsonb;

comment on column public.mkt_pipeline_items.datos is
  'Valores de las columnas propias que el equipo agregó (clave = mkt_pipeline_columns.clave).';

create table if not exists public.mkt_pipeline_columns (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  clave           text not null,
  nombre          text not null,
  tipo            text not null default 'texto',   -- texto | numero | fecha | enlace | opciones
  opciones        text[],
  orden           int  not null default 0,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (organization_id, clave)
);

comment on table public.mkt_pipeline_columns is
  'Columnas que el equipo agregó al registro de propiedades. Los valores viven en mkt_pipeline_items.datos.';

alter table public.mkt_pipeline_columns enable row level security;

-- Mismo criterio que el resto de mkt_*: org-scoped + marketing o superior.
-- Sin DELETE: se archivan con deleted_at (regla del repo).
create policy mkt_pipeline_columns_select on public.mkt_pipeline_columns
  for select using (organization_id = current_organization_id() and is_marketing_or_above());
create policy mkt_pipeline_columns_insert on public.mkt_pipeline_columns
  for insert with check (organization_id = current_organization_id() and is_marketing_or_above());
create policy mkt_pipeline_columns_update on public.mkt_pipeline_columns
  for update using (organization_id = current_organization_id() and is_marketing_or_above())
             with check (organization_id = current_organization_id() and is_marketing_or_above());
create policy mkt_pipeline_columns_nodelete on public.mkt_pipeline_columns
  for delete using (false);

create index if not exists mkt_pipeline_columns_org_idx
  on public.mkt_pipeline_columns (organization_id, orden) where deleted_at is null;
