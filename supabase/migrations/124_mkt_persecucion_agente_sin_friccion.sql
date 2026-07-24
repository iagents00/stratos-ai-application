-- 124_mkt_persecucion_agente_sin_friccion.sql
-- Pieza 3 (horario laboral + tz por usuario) + Pieza 4 (motor de PERSECUCIÓN) del
-- agente sin fricción (spec 24-jul, Iván). Extiende el motor de vencimientos mkt
-- (fn_mkt_scan_vencimientos, cron 30min) SIN tocarlo: nuevo tick cada 5 min.
-- Gate por tenant: organizations.meta_config->>'mkt_persecucion' = 'on' (regla white-label).
-- APLICADA en stratos-prod el 2026-07-24 vía MCP (este archivo es el espejo para git).
-- Seeds aplicados aparte: work_* de Ángel (9:30-16:30 America/Bogota) e Iván
-- (9:00-18:00 America/Cancun = jornada Duke, horas exactas por confirmar);
-- gate ON solo org Duke (00000000-...-0001). Verificado: tick 1 = 2 avisos
-- (start-check Luis/Emmanuel), tick 2 = 0 (dedupe), QA dorado mkt 17/17.

-- (1) PIEZA 3 — jornada laboral por usuario. NULL => defaults (09:00-18:00, tz del perfil o Cancún).
alter table public.profiles
  add column if not exists work_start time,
  add column if not exists work_end   time,
  add column if not exists work_tz    text;

comment on column public.profiles.work_start is 'Inicio de jornada (hora local) — ventana de entrega de avisos (agente sin fricción #3). NULL=09:00';
comment on column public.profiles.work_end   is 'Fin de jornada (hora local) — NULL=18:00';
comment on column public.profiles.work_tz    is 'Zona de la jornada (ej America/Bogota). NULL=profiles.timezone → America/Cancun';

-- (2) Helper: ¿el instante cae dentro de la jornada del usuario?
create or replace function public.fn_mkt_in_window(p_profile uuid, p_at timestamptz default now())
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_tz text; v_ws time; v_we time; v_local time;
begin
  select coalesce(work_tz, timezone, 'America/Cancun'),
         coalesce(work_start, '09:00'::time),
         coalesce(work_end,   '18:00'::time)
    into v_tz, v_ws, v_we
  from profiles where id = p_profile;
  if not found then return true; end if;
  begin
    v_local := (p_at at time zone v_tz)::time;
  exception when others then
    v_local := (p_at at time zone 'America/Cancun')::time;  -- tz inválida => fallback, no bloquear
  end;
  return v_local >= v_ws and v_local <= v_we;
end $$;

-- (3) PIEZA 4 — el tick de persecución (cada 5 min):
--     A) 1h antes del vencimiento (respeta jornada)  B) 10 min antes (urgente: siempre)
--     C) "¿ya pudiste comenzar?" para tareas quietas en por_hacer (máx 2 intentos, 3h entre sí, en jornada)
--     Entrega = mismo canal que el motor existente: proactive_reminders (→ push) + fn_log_proactive_copilot (→ campanita).
create or replace function public.fn_mkt_persecucion_tick()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  r record; v_id uuid; v_txt text; v_n int := 0; v_key text;
begin
  -- A) FALTA 1 HORA (ventana 10-65 min para no duplicar con la B) — respeta jornada
  for r in
    select t.id, t.titulo, t.due_at, t.organization_id,
           p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz
    from mkt_tasks t
    join profiles p on p.id = t.assignee_id and coalesce(p.active,true)
    join organizations o on o.id = t.organization_id
    where t.deleted_at is null and t.estado <> 'hecha'
      and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and t.due_at between now() + interval '10 minutes' and now() + interval '65 minutes'
      and fn_mkt_in_window(p.id, now())
      and not exists (select 1 from proactive_reminders x
                      where x.dedupe_key = 'mkt_due_1h:'||t.id||':'||to_char(t.due_at,'YYYYMMDDHH24MI'))
  loop
    v_txt := 'Falta 1 hora: «'||r.titulo||'» vence a las '
      || to_char(r.due_at at time zone r.ptz, 'HH24:MI')
      || '. ¿Cómo vas? Cuando la termines dime "ya terminé '||r.titulo||'" y, si tienes evidencia, adjúntala con el botón de cámara.';
    v_key := 'mkt_due_1h:'||r.id||':'||to_char(r.due_at,'YYYYMMDDHH24MI');
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.organization_id, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', r.id), v_key)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  -- B) ÚLTIMOS 10 MINUTOS — urgente, se envía siempre (el usuario fijó esa hora)
  for r in
    select t.id, t.titulo, t.due_at, t.organization_id,
           p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz
    from mkt_tasks t
    join profiles p on p.id = t.assignee_id and coalesce(p.active,true)
    join organizations o on o.id = t.organization_id
    where t.deleted_at is null and t.estado <> 'hecha'
      and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and t.due_at between now() and now() + interval '10 minutes'
      and not exists (select 1 from proactive_reminders x
                      where x.dedupe_key = 'mkt_due_10m:'||t.id||':'||to_char(t.due_at,'YYYYMMDDHH24MI'))
  loop
    v_txt := 'Últimos 10 minutos: «'||r.titulo||'» vence a las '
      || to_char(r.due_at at time zone r.ptz, 'HH24:MI')
      || '. ¿Ya está hecha o no? Si ya está, dime "ya terminé '||r.titulo||'"; si no llegas, avísale a tu líder.';
    v_key := 'mkt_due_10m:'||r.id||':'||to_char(r.due_at,'YYYYMMDDHH24MI');
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.organization_id, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', r.id), v_key)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  -- C) "¿YA PUDISTE COMENZAR?" — tareas quietas en por_hacer (45+ min desde su creación),
  --    lejos del vencimiento (o sin fecha). Intento 1, y un intento 2 recién 3h después. En jornada.
  for r in
    select t.id, t.titulo, t.due_at, t.organization_id,
           p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz,
           case when not exists (select 1 from proactive_reminders x where x.dedupe_key = 'mkt_start:'||t.id||':1')
                then 1
                when not exists (select 1 from proactive_reminders x where x.dedupe_key = 'mkt_start:'||t.id||':2')
                 and exists (select 1 from proactive_reminders x
                             where x.dedupe_key = 'mkt_start:'||t.id||':1' and x.sent_at < now() - interval '3 hours')
                then 2
                else 0 end as intento
    from mkt_tasks t
    join profiles p on p.id = t.assignee_id and coalesce(p.active,true)
    join organizations o on o.id = t.organization_id
    where t.deleted_at is null and t.estado = 'por_hacer'
      and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and t.created_at < now() - interval '45 minutes'
      and (t.due_at is null or t.due_at > now() + interval '2 hours')
      and fn_mkt_in_window(p.id, now())
  loop
    if r.intento = 0 then continue; end if;
    if r.intento = 1 then
      v_txt := '¿Ya pudiste comenzar «'||r.titulo||'»?'
        || case when r.due_at is not null
                then ' Va para el '||to_char(r.due_at at time zone r.ptz, 'DD Mon HH24:MI')||'.'
                else '' end
        || ' Cuando la termines dime "ya terminé '||r.titulo||'".';
    else
      v_txt := 'Sigo pendiente de «'||r.titulo||'» — ¿pudiste avanzar? Cuando esté, dime "ya terminé '
        || r.titulo||'". Si algo te bloquea, cuéntale a tu líder.';
    end if;
    v_key := 'mkt_start:'||r.id||':'||r.intento;
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.organization_id, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', r.id), v_key)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'avisos', v_n);
end $$;

-- (4) Cron cada 5 minutos (idempotente: si existe, se re-agenda)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'mkt-persecucion-tick') then
    perform cron.unschedule('mkt-persecucion-tick');
  end if;
  perform cron.schedule('mkt-persecucion-tick', '*/5 * * * *', 'select public.fn_mkt_persecucion_tick();');
end $$;

-- ROLLBACK:
--   select cron.unschedule('mkt-persecucion-tick');
--   drop function if exists public.fn_mkt_persecucion_tick();
--   drop function if exists public.fn_mkt_in_window(uuid, timestamptz);
--   alter table public.profiles drop column if exists work_start, drop column if exists work_end, drop column if exists work_tz;
--   update organizations set meta_config = meta_config - 'mkt_persecucion';
