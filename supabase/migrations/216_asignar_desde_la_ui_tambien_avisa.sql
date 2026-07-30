-- Ángel, 30-jul: «probé asignar tareas desde Mi Espacio → Agenda, y quiero que
-- también lleguen los recordatorios: que se le programó una actividad y QUIÉN
-- lo hizo.»
--
-- El aviso al asignar vivía SOLO en el camino del Copilot
-- (bot_create_team_actions). Asignar desde la interfaz (Mi Espacio → Agenda,
-- o reasignar con el desplegable) no avisaba nada.
--
-- EL ARREGLO VA EN LA TABLA, no en cada camino: un trigger sobre team_actions
-- encola el aviso al INSERTAR con asesor distinto del creador, y al REASIGNAR
-- (cambio de asesor_id). Cubre el Copilot, la UI y cualquier camino futuro.
--
-- SIN DUPLICADOS: usa el MISMO dedupe_key que ya usa el camino del Copilot
-- ('team_assigned:<action_id>:<asesor_id>') con ON CONFLICT DO NOTHING — si el
-- Copilot ya encoló el suyo, el del trigger no entra, y viceversa.
--
-- QUIÉN LO ASIGNÓ: payload.quien_asigna = el nombre del creador (en la
-- reasignación por UI no hay contexto de quién editó → se omite esa parte).
-- El texto del aviso lo arma la mig 215: «Nueva actividad asignada: “X” — te
-- la asignó Y. La ves en Mi Espacio → Agenda.»
--
-- GUARDIAS: no avisa si la tarea nace hecha, si es 'personal', si el asesor es
-- el mismo creador (autoasignación ya tiene su propio mensaje), o si el
-- interruptor team_notify_on_assign de la org está apagado.
--
-- REVERTIR: drop trigger trg_team_action_avisa_asignacion on team_actions;
-- (la función queda huérfana, no molesta). Sin tocar datos.

create or replace function public.trg_team_action_avisa_asignacion_fn()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_flag boolean; v_quien text;
begin
  if new.asesor_id is null then return new; end if;
  if coalesce(new.done, false) then return new; end if;
  if lower(coalesce(new.category,'')) = 'personal' then return new; end if;
  if tg_op = 'INSERT' and new.created_by is not distinct from new.asesor_id then return new; end if;
  if tg_op = 'UPDATE' and old.asesor_id is not distinct from new.asesor_id then return new; end if;

  select team_notify_on_assign or team_requires_evidence into v_flag
    from public.proactive_config where organization_id = new.organization_id;
  if not coalesce(v_flag, false) then return new; end if;

  select name into v_quien from public.profiles where id = new.created_by;

  insert into public.proactive_reminders
    (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
  select new.organization_id, null, new.asesor_id, coalesce(new.asesor_name, p.name), 'team_action', now(),
         'team_assigned:' || new.id::text || ':' || new.asesor_id::text, true,
         jsonb_build_object('action_id', new.id, 'text', new.text, 'due_at', new.due_at,
                            'fase', 'asignada', 'quien_asigna', v_quien, 'scope', '')
  from public.profiles p
  where p.id = new.asesor_id and p.telegram_chat_id is not null and coalesce(p.active, true)
  on conflict (dedupe_key) do nothing;

  return new;
end;
$fn$;

drop trigger if exists trg_team_action_avisa_asignacion on public.team_actions;
create trigger trg_team_action_avisa_asignacion
after insert or update of asesor_id on public.team_actions
for each row execute function public.trg_team_action_avisa_asignacion_fn();
