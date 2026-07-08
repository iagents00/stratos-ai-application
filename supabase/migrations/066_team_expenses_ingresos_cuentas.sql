-- 066: Caja — team_expenses pasa de "solo gastos" a libro de movimientos.
--
-- El módulo Caja del CRM (feature flag `caja`, hoy solo Constructora Vega)
-- registra ingresos y egresos con cuenta. Los gastos que el equipo carga por
-- Telegram (bot_register_expense) son filas de esta misma tabla, por eso
-- aparecen en Caja sin tocar el bot: quedan como tipo='egreso' (default).
--
--   tipo    'ingreso' | 'egreso'  (default egreso: todo lo histórico es gasto)
--   account cuenta libre ("Caja", "Banco", …) — null = sin cuenta asignada
--
-- RLS existente ya cubre el módulo: select/insert/update org-scoped SIN
-- restricción de rol (asesores registran igual que admins) y sin hard delete.

alter table public.team_expenses
  add column if not exists tipo text not null default 'egreso';

alter table public.team_expenses
  add column if not exists account text;

do $$ begin
  alter table public.team_expenses
    add constraint team_expenses_tipo_check check (tipo in ('ingreso','egreso'));
exception when duplicate_object then null; end $$;

create index if not exists idx_team_expenses_org_spent
  on public.team_expenses (organization_id, spent_at desc);
