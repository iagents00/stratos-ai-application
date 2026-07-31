-- mig 227 — Limpieza de las actividades de PRUEBA de Duke (orden de Ángel 31-jul):
--   «todas, todas son pruebas… eliminemos todo, tanto de equipo como personales…
--    también de marketing… dejemos las de NSG, esas sí son reales».
-- Alcance (SOLO org Duke 00000000-0000-0000-0000-000000000001; NSG y QA intactas):
--   · team_actions: TODAS (62: la función de tareas de ventas nunca tuvo uso real).
--   · proactive_reminders pendientes tipo personal / team_action / team_escalation
--     (los inactividad* son de leads y se quedan).
--   · mkt_tasks: SOLO las de la ventana de pruebas (creadas desde el 27-jul) y con
--     borrado SUAVE (deleted_at) — las de antes del 27-jul se conservan.
-- Respaldo FRESCO antes de tocar (regla §2 del AIOS): tablas zz_respaldo_*_20260731.
-- Revertir: insert desde zz_respaldo_team_actions/reminders_20260731;
--           update mkt_tasks set deleted_at=null where id in (select id from zz_respaldo_mkt_tasks_20260731).

create table if not exists public.zz_respaldo_team_actions_20260731 as
  select * from public.team_actions
  where organization_id = '00000000-0000-0000-0000-000000000001';

create table if not exists public.zz_respaldo_reminders_20260731 as
  select * from public.proactive_reminders
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and status = 'pending' and tipo in ('personal','team_action','team_escalation');

create table if not exists public.zz_respaldo_mkt_tasks_20260731 as
  select * from public.mkt_tasks
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and deleted_at is null and created_at >= '2026-07-27';

do $mig$
declare v_ta int; v_rem int; v_mkt int; b_ta int; b_rem int; b_mkt int;
begin
  select count(*) into v_ta from public.team_actions where organization_id='00000000-0000-0000-0000-000000000001';
  select count(*) into v_rem from public.proactive_reminders where organization_id='00000000-0000-0000-0000-000000000001' and status='pending' and tipo in ('personal','team_action','team_escalation');
  select count(*) into v_mkt from public.mkt_tasks where organization_id='00000000-0000-0000-0000-000000000001' and deleted_at is null and created_at >= '2026-07-27';
  select count(*) into b_ta from public.zz_respaldo_team_actions_20260731;
  select count(*) into b_rem from public.zz_respaldo_reminders_20260731;
  select count(*) into b_mkt from public.zz_respaldo_mkt_tasks_20260731;
  -- el respaldo tiene que cubrir TODO lo que se va a tocar, o no se toca nada
  if b_ta < v_ta then raise exception 'respaldo team_actions incompleto: % < %', b_ta, v_ta; end if;
  if b_rem < v_rem then raise exception 'respaldo reminders incompleto: % < %', b_rem, v_rem; end if;
  if b_mkt < v_mkt then raise exception 'respaldo mkt_tasks incompleto: % < %', b_mkt, v_mkt; end if;

  delete from public.proactive_reminders
  where organization_id='00000000-0000-0000-0000-000000000001'
    and status='pending' and tipo in ('personal','team_action','team_escalation');

  delete from public.team_actions
  where organization_id='00000000-0000-0000-0000-000000000001';

  update public.mkt_tasks set deleted_at = now()
  where organization_id='00000000-0000-0000-0000-000000000001'
    and deleted_at is null and created_at >= '2026-07-27';

  raise notice 'limpieza duke: % team_actions, % reminders, % mkt_tasks ocultas', v_ta, v_rem, v_mkt;
end $mig$;