-- Forward-only fields for the merged agenda UI. Existing Copilot dispatchers are preserved.
alter table public.team_actions
  add column if not exists status text not null default 'pending',
  add column if not exists last_response_at timestamptz,
  add column if not exists evidence_at timestamptz,
  add column if not exists nota text;

do $$
begin
  alter table public.team_actions
    add constraint team_actions_status_check
    check (status in ('pending','in_progress','not_done','done'));
exception when duplicate_object then null;
end $$;

-- Backfill: lo historico "General" se vuelve Profesional. La UI nueva escribe
-- category='personal' | 'profesional' y conserva compatibilidad con filas viejas.
update public.team_actions
   set category = 'profesional'
 where category is null
    or btrim(category) = ''
    or lower(category) = 'general';

update public.team_actions
   set status = case when coalesce(done,false) then 'done' else status end;

create index if not exists idx_team_actions_agenda_due
  on public.team_actions (organization_id, done, due_at)
  where due_at is not null;

create index if not exists idx_team_actions_responsable_due
  on public.team_actions (organization_id, asesor_id, due_at)
  where due_at is not null;

