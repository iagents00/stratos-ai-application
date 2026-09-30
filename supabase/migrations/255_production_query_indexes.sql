-- 107_production_query_indexes.sql
-- Índices para las consultas calientes observadas en stratos-prod.
-- Aditiva e idempotente: no modifica ni elimina datos.

-- CRM principal: lista activa y papelera, ambas paginadas por fecha + id.
create index if not exists idx_leads_active_recent
  on public.leads (created_at desc, id desc)
  where deleted_at is null;

create index if not exists idx_leads_trash_recent
  on public.leads (deleted_at desc, id desc)
  where deleted_at is not null;

-- Cola de recordatorios mostrada por asesor.
-- En producción, los recordatorios por ejecutar usan `pending`.
create index if not exists idx_proactive_reminders_advisor_queue
  on public.proactive_reminders (asesor_id, scheduled_at desc)
  where status = 'pending';

-- Actividad del equipo ordenada por creación.
create index if not exists idx_team_actions_recent
  on public.team_actions (created_at desc);
