-- ─────────────────────────────────────────────────────────────────────────────
-- CAJA / FINANZAS (pedido de Ángel, 27-jul): hoy NO hay registro de nada.
-- Duke le manda a Iván cada semana, de ahí Iván le pasa a Ángel, y los servicios
-- (Claude, Retell) se pagan con la tarjeta que dio Duke. Nadie sabe cuánto queda
-- pendiente. Esto lo registra todo y lo deja a la vista.
-- Org-scoped y con nombres genéricos → sirve igual para las otras empresas.
-- ─────────────────────────────────────────────────────────────────────────────

-- Cuánto se le paga a cada quien y cada cuánto (editable: si cambia, se cambia acá)
create table if not exists public.fin_payroll (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  profile_id uuid,
  persona text not null,
  monto numeric not null,
  moneda text not null default 'USD',
  periodicidad text not null default 'semanal',   -- semanal | quincenal | mensual
  vigente_desde date not null default current_date,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Todo lo que entra y sale
create table if not exists public.fin_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  fecha date not null default current_date,
  tipo text not null,              -- ingreso | nomina | servicio | gasto | reembolso
  concepto text not null,
  monto numeric not null,
  moneda text not null default 'USD',
  de_quien text,                   -- Duke del Caribe, Iván…
  para_quien text,                 -- Iván, Ángel, Anthropic…
  metodo text,                     -- transferencia | tarjeta Duke | efectivo
  estado text not null default 'pagado',   -- pagado | pendiente
  periodo_desde date,
  periodo_hasta date,
  comprobante_url text,
  notas text,
  registrado_por uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);
create index if not exists idx_fin_mov_org on public.fin_movements(organization_id, fecha desc) where deleted_at is null;

-- Cuentas de cobro (para firmar y archivar)
create table if not exists public.fin_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  numero text not null,
  beneficiario text not null,
  periodo_desde date not null,
  periodo_hasta date not null,
  monto numeric not null,
  moneda text not null default 'USD',
  detalle jsonb,
  estado text not null default 'borrador',   -- borrador | enviada | firmada | pagada
  archivo_url text,
  firmada_at timestamptz,
  pagada_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_fin_invoices_numero on public.fin_invoices(organization_id, numero);

alter table public.fin_payroll    enable row level security;
alter table public.fin_movements  enable row level security;
alter table public.fin_invoices   enable row level security;

drop policy if exists fin_payroll_org on public.fin_payroll;
create policy fin_payroll_org on public.fin_payroll for all to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));
drop policy if exists fin_movements_org on public.fin_movements;
create policy fin_movements_org on public.fin_movements for all to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));
drop policy if exists fin_invoices_org on public.fin_invoices;
create policy fin_invoices_org on public.fin_invoices for all to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));;
