-- 090: Lista de Acción como agenda Personal / Profesional con seguimiento Telegram.
--
-- Objetivo:
--   1. Cada accion de team_actions tiene categoria operativa: personal/profesional.
--   2. Cada accion debe tener responsable para que Telegram recuerde a la persona correcta.
--   3. Telegram puede marcar cumplimiento: hecha / en proceso / no hecha.
--   4. El motor proactivo recuerda antes y pregunta despues si ya se cumplio.

-- ── Campos forward-compatible para estado del coach ─────────────────────────
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

-- proactive_reminders necesita aceptar tipo='team_action' en instalaciones que
-- aun traen el check original de la migracion 025.
alter table public.proactive_reminders
  drop constraint if exists proactive_reminders_tipo_check;

alter table public.proactive_reminders
  add constraint proactive_reminders_tipo_check
  check (tipo in ('inactividad','zoom_brief','zoom_escalation','custom','team_action'));

-- ── Asignacion segura de responsable ────────────────────────────────────────
create or replace function public.fn_assign_team_action(p_action_id uuid, p_asesor_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_org uuid;
  v_name text := nullif(btrim(coalesce(p_asesor_name,'')), '');
  v_profile public.profiles%rowtype;
begin
  select organization_id into v_org
  from public.team_actions
  where id = p_action_id;

  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'action_not_found');
  end if;

  if v_name is null then
    update public.team_actions
       set asesor_id = null,
           asesor_name = null
     where id = p_action_id;
    return jsonb_build_object('ok', true, 'scope', 'unassigned');
  end if;

  if lower(v_name) = 'todos' then
    update public.team_actions
       set asesor_id = null,
           asesor_name = 'Todos'
     where id = p_action_id;
    return jsonb_build_object('ok', true, 'scope', 'all');
  end if;

  select *
    into v_profile
  from public.profiles p
  where p.organization_id = v_org
    and coalesce(p.active, true) = true
    and lower(btrim(p.name)) = lower(v_name)
  order by p.updated_at desc nulls last
  limit 1;

  if v_profile.id is null then
    update public.team_actions
       set asesor_id = null,
           asesor_name = v_name
     where id = p_action_id;
    return jsonb_build_object('ok', false, 'error', 'profile_not_found', 'asesor_name', v_name);
  end if;

  update public.team_actions
     set asesor_id = v_profile.id,
         asesor_name = v_profile.name
   where id = p_action_id;

  return jsonb_build_object('ok', true, 'scope', 'person', 'asesor_id', v_profile.id, 'asesor_name', v_profile.name);
end;
$function$;

-- ── Respuesta desde Telegram: hecha / en proceso / no hecha ─────────────────
create or replace function public.fn_team_action_mark(
  p_action_id uuid,
  p_telegram_chat_id bigint,
  p_status text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_profile public.profiles%rowtype;
  v_action public.team_actions%rowtype;
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_done boolean := false;
  v_reply text;
  v_mgrs bigint[];
begin
  if p_action_id is null or p_telegram_chat_id is null then
    return jsonb_build_object('ok', false, 'error', 'action_id_and_telegram_required');
  end if;

  select *
    into v_profile
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id
    and coalesce(active, true) = true
  order by updated_at desc nulls last
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estas vinculado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;

  select *
    into v_action
  from public.team_actions
  where id = p_action_id
    and organization_id = v_profile.organization_id
  for update;

  if v_action.id is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No encontre esa accion en tu agenda.','inline_keyboard','[]'::jsonb));
  end if;

  if lower(coalesce(v_action.asesor_name,'')) <> 'todos'
     and v_action.asesor_id is not null
     and v_action.asesor_id <> v_profile.id then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','Esa accion esta asignada a otra persona.','inline_keyboard','[]'::jsonb));
  end if;

  if v_status in ('done','hecha','hecho','si','sí','ya_la_hice','completada') then
    v_status := 'done';
    v_done := true;
    v_reply := 'Perfecto. La marque como completada en tu agenda.';
  elsif v_status in ('in_progress','proceso','en_proceso','trabajando') then
    v_status := 'in_progress';
    v_reply := 'Listo. La deje como en proceso y seguira visible como pendiente.';
  elsif v_status in ('not_done','no','no_hecha','no_la_hice','sin_hacer') then
    v_status := 'not_done';
    v_reply := 'Entendido. La deje como no hecha para que direccion tenga visibilidad.';
  elsif v_status = 'pending' then
    v_reply := 'Listo. La deje pendiente.';
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  update public.team_actions
     set done = v_done,
         status = v_status,
         completed_at = case when v_done then now() else null end,
         last_response_at = now(),
         nota = nullif(btrim(coalesce(p_nota,'')), '')
   where id = p_action_id;

  select coalesce(array_agg(telegram_chat_id order by telegram_chat_id), array[]::bigint[])
    into v_mgrs
  from public.profiles
  where organization_id = v_profile.organization_id
    and role in ('super_admin','admin','ceo','director')
    and coalesce(active,true) = true
    and telegram_chat_id is not null;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'done', v_done,
    'action_id', p_action_id,
    'manager_telegram_ids', to_jsonb(v_mgrs),
    'reply', jsonb_build_object('text', v_reply, 'inline_keyboard', '[]'::jsonb)
  );
end;
$function$;

create or replace function public.fn_team_action_mark(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  return public.fn_team_action_mark(
    nullif(payload->>'action_id','')::uuid,
    nullif(coalesce(payload->>'telegram_chat_id', payload->>'advisor_telegram_id'),'')::bigint,
    coalesce(payload->>'status', payload->>'response', payload->>'answer'),
    payload->>'nota'
  );
end;
$function$;

-- ── Pendientes atomicos con filtro opcional por tipo ────────────────────────
create or replace function public.fn_proactive_get_pending(payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_org_id uuid := coalesce(nullif(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%rowtype;
  v_hour int;
  v_in_quiet boolean := false;
  v_limit int := coalesce(nullif(payload->>'limit','')::int, 50);
  v_rows jsonb;
begin
  select * into v_cfg from public.proactive_config where organization_id = v_org_id;
  if not found or not v_cfg.enabled then
    return jsonb_build_object('ok', true, 'count', 0, 'reminders', '[]'::jsonb, 'reason', 'disabled');
  end if;

  v_hour := extract(hour from (now() at time zone v_cfg.timezone))::int;
  if v_cfg.quiet_start_hour > v_cfg.quiet_end_hour then
    v_in_quiet := (v_hour >= v_cfg.quiet_start_hour or v_hour < v_cfg.quiet_end_hour);
  else
    v_in_quiet := (v_hour >= v_cfg.quiet_start_hour and v_hour < v_cfg.quiet_end_hour);
  end if;

  with claimed as (
    update public.proactive_reminders r
       set status = 'sent',
           sent_at = now(),
           attempts = attempts + 1
     where r.id in (
       select pr.id
       from public.proactive_reminders pr
       where pr.organization_id = v_org_id
         and pr.status = 'pending'
         and pr.scheduled_at <= now()
         and (not v_in_quiet or pr.ignore_quiet)
         and (
           not (payload ? 'tipo_in')
           or pr.tipo in (select jsonb_array_elements_text(payload->'tipo_in'))
         )
       order by pr.scheduled_at
       limit v_limit
       for update skip locked
     )
     returning r.id, r.lead_id, r.asesor_id, r.asesor_name, r.tipo, r.scheduled_at, r.payload, r.dedupe_key
  )
  select jsonb_agg(to_jsonb(c)) into v_rows from claimed c;

  return jsonb_build_object(
    'ok', true,
    'count', coalesce(jsonb_array_length(v_rows), 0),
    'shadow_mode', v_cfg.shadow_mode,
    'test_telegram_id', v_cfg.test_telegram_id,
    'reminders', coalesce(v_rows, '[]'::jsonb)
  );
end;
$function$;

-- ── Scan: 1h/10m antes + follow-up despues de vencida ──────────────────────
create or replace function public.fn_proactive_scan_team_actions(payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_org_id uuid := coalesce(nullif(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%rowtype;
  v_enqueued int := 0;
  v_req_ev boolean := false;
  v_offsets int[];
  v_tz text;
begin
  select * into v_cfg from public.proactive_config where organization_id = v_org_id;
  if not found or not v_cfg.enabled then
    return jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled');
  end if;

  v_req_ev := coalesce(v_cfg.team_requires_evidence, false);
  v_tz := coalesce(v_cfg.timezone, 'America/Cancun');
  v_offsets := coalesce(v_cfg.team_reminder_offsets, case when v_req_ev then array[180, 60] else array[60, 10] end);

  with candidates as (
    select a.id, p.id as member_id, a.asesor_name as member_name, a.text, a.due_at,
           coalesce(a.category, 'profesional') as category, ''::text as scope
    from public.team_actions a
    join public.profiles p on p.id = a.asesor_id and p.telegram_chat_id is not null
    where a.organization_id = v_org_id
      and coalesce(a.done,false) = false
      and a.last_response_at is null
      and a.evidence_at is null
      and a.due_at is not null
      and lower(coalesce(a.asesor_name,'')) <> 'todos'
      and (not v_cfg.shadow_mode or a.asesor_name = any (v_cfg.test_asesor_names))
    union all
    select a.id, p.id as member_id, p.name as member_name, a.text, a.due_at,
           coalesce(a.category, 'profesional') as category, 'all'::text as scope
    from public.team_actions a
    join public.profiles p on p.organization_id = v_org_id and p.telegram_chat_id is not null and coalesce(p.active,true) = true
    where a.organization_id = v_org_id
      and coalesce(a.done,false) = false
      and a.last_response_at is null
      and a.evidence_at is null
      and a.due_at is not null
      and lower(coalesce(a.asesor_name,'')) = 'todos'
      and (not v_cfg.shadow_mode or p.name = any (v_cfg.test_asesor_names))
  ),
  fires as (
    select c.id, c.member_id, c.member_name, c.text, c.due_at, c.category, c.scope,
           m as fase_min,
           c.due_at - (m * interval '1 minute') as fire_at,
           'before_due'::text as mode
    from candidates c
    cross join lateral unnest(v_offsets) as m
    where c.due_at > now()
      and c.due_at <= now() + interval '25 hours'
      and (c.due_at - (m * interval '1 minute')) > now() - interval '30 minutes'
      and (c.due_at - (m * interval '1 minute')) <= now() + interval '15 minutes'
    union all
    select c.id, c.member_id, c.member_name, c.text, c.due_at, c.category, c.scope,
           0 as fase_min,
           greatest(c.due_at + interval '5 minutes', now()) as fire_at,
           'followup'::text as mode
    from candidates c
    where c.due_at <= now()
      and c.due_at > now() - interval '48 hours'
      and c.due_at + interval '5 minutes' <= now() + interval '15 minutes'
  ),
  ins as (
    insert into public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, payload)
    select v_org_id, null, f.member_id, f.member_name, 'team_action', greatest(f.fire_at, now()),
           case when f.mode = 'followup'
             then 'team_action_followup:' || f.id::text || ':' || to_char(f.due_at,'YYYYMMDDHH24MI')
                    || case when f.scope = 'all' then ':all:' || f.member_id::text else '' end
             else 'team_action:' || f.id::text || ':' || f.fase_min::text || ':' || to_char(f.due_at,'YYYYMMDDHH24MI')
                    || case when f.scope = 'all' then ':all:' || f.member_id::text else '' end
           end,
           jsonb_build_object(
             'action_id', f.id,
             'text', f.text,
             'due_at', f.due_at,
             'category', case when lower(f.category) = 'personal' then 'personal' else 'profesional' end,
             'fase', f.fase_min::text,
             'fase_min', f.fase_min,
             'mode', f.mode,
             'followup', f.mode = 'followup',
             'tz', v_tz,
             'scope', f.scope
           )
    from fires f
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_enqueued from ins;

  return jsonb_build_object('ok', true, 'enqueued', v_enqueued, 'organization_id', v_org_id);
end;
$function$;

-- ── Agenda Telegram: separa Personal / Profesional y luego clientes ─────────
create or replace function public.bot_proximas_acciones(p_telegram_chat_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_org uuid; v_pid uuid; v_view_all boolean; v_tz text; v_name text;
  v_personal text; v_profesional text; v_leads text; v_msg text;
begin
  select organization_id, id, coalesce(view_all_leads,false), name
    into v_org, v_pid, v_view_all, v_name
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id and coalesce(active,true) = true
  order by updated_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estas conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;

  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);

  select string_agg(line, E'\n') into v_personal from (
    select '• '||
      case when ta.due_at < now() then '⚠️ '
           when ta.due_at < now() + interval '2 hours' then '🔥 ' else '' end ||
      to_char(ta.due_at at time zone v_tz,'DD/MM HH24:MI')||' — '||ta.text as line,
      ta.due_at
    from public.team_actions ta
    where ta.organization_id = v_org
      and coalesce(ta.done,false) = false
      and ta.due_at is not null
      and lower(coalesce(ta.category,'')) = 'personal'
      and (ta.asesor_id = v_pid or lower(coalesce(ta.asesor_name,'')) = lower(coalesce(v_name,'')))
      and ta.due_at >= now() - interval '2 days'
      and ta.due_at <= now() + interval '14 days'
    order by ta.due_at asc
    limit 12
  ) s;

  select string_agg(line, E'\n') into v_profesional from (
    select '• '||
      case when ta.due_at < now() then '⚠️ '
           when ta.due_at < now() + interval '2 hours' then '🔥 ' else '' end ||
      to_char(ta.due_at at time zone v_tz,'DD/MM HH24:MI')||' — '||ta.text||
      case when lower(coalesce(ta.asesor_name,'')) = 'todos' then ' 👥' else '' end as line,
      ta.due_at
    from public.team_actions ta
    where ta.organization_id = v_org
      and coalesce(ta.done,false) = false
      and ta.due_at is not null
      and lower(coalesce(ta.category,'profesional')) <> 'personal'
      and (ta.asesor_id = v_pid
           or lower(coalesce(ta.asesor_name,'')) = lower(coalesce(v_name,''))
           or lower(coalesce(ta.asesor_name,'')) = 'todos')
      and ta.due_at >= now() - interval '2 days'
      and ta.due_at <= now() + interval '14 days'
    order by ta.due_at asc
    limit 12
  ) s;

  select string_agg(line, E'\n') into v_leads from (
    select '• '||coalesce(l.name,'Sin nombre')||' — '||coalesce(l.next_action,'(sin accion)')||
           ' — '||to_char(l.next_action_at at time zone v_tz,'DD/MM HH24:MI')||
           case when l.next_action_at < now() then ' ⚠️ vencida'
                when l.next_action_at < now() + interval '2 hours' then ' 🔥 pronto' else '' end as line
    from public.leads l
    where l.organization_id = v_org
      and l.deleted_at is null
      and (v_view_all or l.asesor_id = v_pid)
      and l.next_action_at is not null
      and l.next_action_at >= now() - interval '2 days'
      and l.next_action_at <= now() + interval '30 days'
      and (l.stage is null or l.stage not in ('Cierre','Perdido'))
    order by (l.next_action_at >= now()) desc,
             case when l.next_action_at >= now() then l.next_action_at end asc,
             l.next_action_at desc
    limit 8
  ) s;

  if v_personal is null and v_profesional is null and v_leads is null then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No tienes pendientes con fecha en los proximos dias.','inline_keyboard','[]'::jsonb));
  end if;

  v_msg := 'Tu agenda (mas cercanas primero):';
  if v_personal is not null then v_msg := v_msg || E'\n\n🟢 Personal\n' || v_personal; end if;
  if v_profesional is not null then v_msg := v_msg || E'\n\n🔵 Profesional\n' || v_profesional; end if;
  if v_leads is not null then v_msg := v_msg || E'\n\n👤 Seguimiento de clientes\n' || v_leads; end if;

  return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text', v_msg, 'inline_keyboard','[]'::jsonb));
end;
$function$;

-- ── Callback opcional para botones inline firmados ta_* ─────────────────────
create or replace function public.bot_handle_callback(p_telegram_chat_id bigint, p_callback_data text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_verify jsonb;
  v_action text;
  v_payload text;
  v_status text;
begin
  v_verify := public._bot_cb_verify(p_callback_data);
  if (v_verify->>'valid')::boolean then
    v_action := v_verify->>'action';
    v_payload := v_verify->>'payload';

    if v_action in ('ta_done','ta_progress','ta_no','ta_pending') then
      v_status := case v_action
        when 'ta_done' then 'done'
        when 'ta_progress' then 'in_progress'
        when 'ta_no' then 'not_done'
        else 'pending'
      end;
      return public.fn_team_action_mark(nullif(split_part(coalesce(v_payload,''),':',1),'')::uuid, p_telegram_chat_id, v_status, null);
    elsif v_action = 'list' then
      return public.bot_list_my_clients_v2(p_telegram_chat_id);
    elsif v_action = 'setprio' then
      return public.bot_set_priority(p_telegram_chat_id, split_part(coalesce(v_payload,''),':',1), 1);
    elsif v_action = 'nextpick' then
      return public.fn_proactive_next_action_start(p_telegram_chat_id, split_part(coalesce(v_payload,''),':',1));
    end if;
  end if;

  return public.bot_handle_callback_core(p_telegram_chat_id, p_callback_data);
end;
$function$;

revoke all on function public.fn_assign_team_action(uuid,text) from public;
grant execute on function public.fn_assign_team_action(uuid,text) to authenticated, service_role;

revoke all on function public.fn_team_action_mark(uuid,bigint,text,text) from public;
revoke all on function public.fn_team_action_mark(jsonb) from public;
grant execute on function public.fn_team_action_mark(uuid,bigint,text,text) to service_role;
grant execute on function public.fn_team_action_mark(jsonb) to service_role;

revoke all on function public.bot_handle_callback(bigint,text) from public;
grant execute on function public.bot_handle_callback(bigint,text) to service_role;

notify pgrst, 'reload schema';
