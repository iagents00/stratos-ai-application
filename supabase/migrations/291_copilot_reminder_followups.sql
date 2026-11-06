-- One acknowledgement cycle per person and scheduled event. No historical backfill.
-- Delivery reuses the existing Copilot history and native/web push trigger.
alter table public.profiles add column if not exists copilot_insistence_enabled boolean not null default true;

create table if not exists public.copilot_reminder_followups (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 event_key text not null,
 source_reminder_id uuid not null references public.proactive_reminders(id) on delete cascade,
 kind text not null,
 title text not null,
 lead_id uuid,
 action_id uuid,
 mkt_task_id uuid,
 event_at timestamptz,
 ignore_quiet boolean not null default false,
 status text not null default 'pending' check(status in ('pending','answered','cancelled')),
 repeat_count integer not null default 0 check(repeat_count>=0),
 started_at timestamptz not null default now(),
 last_notified_at timestamptz not null default now(),
 next_followup_at timestamptz,
 responded_at timestamptz,
 response_kind text,
 unique(organization_id,profile_id,event_key)
);
create index if not exists copilot_followups_due on public.copilot_reminder_followups(next_followup_at) where status='pending';
alter table public.copilot_reminder_followups enable row level security;
revoke all on public.copilot_reminder_followups from public,anon,authenticated;
grant all on public.copilot_reminder_followups to service_role;

create or replace function public.fn_copilot_followup_capture() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p record; v_action uuid; v_task uuid; v_at timestamptz; v_key text; v_title text; v_id uuid; v_now timestamptz;
begin
 if new.status<>'sent' or (tg_op='UPDATE' and old.status='sent') or new.payload ? 'copilot_followup_id' then return new; end if;
 select pr.id,pr.organization_id into p from public.profiles pr
 where pr.id=new.asesor_id and pr.organization_id=new.organization_id and coalesce(pr.active,true);
 if not found then return new; end if;
 v_now:=coalesce(new.sent_at,now());
 -- Notification types without a pending action (receipts, evidence, announcements) are not chased.
 if not (new.tipo in ('team_action','personal','custom','inactividad','inactividad_insist','mkt_assign')
   or new.tipo like 'zoom%' or new.tipo like 'next_action%' or new.tipo like 'visita%') then return new; end if;
 begin v_action:=nullif(coalesce(new.payload->>'action_id',new.payload->>'team_action_id'),'')::uuid; exception when invalid_text_representation then v_action:=null; end;
 begin v_task:=nullif(new.payload->>'mkt_task_id','')::uuid; exception when invalid_text_representation then v_task:=null; end;
 begin v_at:=nullif(coalesce(new.payload->>'due_at',new.payload->>'zoom_at',new.payload->>'next_action_at',new.payload->>'visita_at'),'')::timestamptz; exception when others then v_at:=null; end;
 if v_action is not null then
  select a.text,a.due_at into v_title,v_at from public.team_actions a where a.id=v_action and a.organization_id=new.organization_id and not coalesce(a.done,false);
  if not found then return new; end if;
  v_key:='action:'||v_action;
 elsif v_task is not null then
  select t.titulo,t.due_at into v_title,v_at from public.mkt_tasks t where t.id=v_task and t.organization_id=new.organization_id and t.assignee_id=p.id and t.deleted_at is null and t.estado<>'hecha';
  if not found then return new; end if;
  v_key:='task:'||v_task;
 elsif new.lead_id is not null then
  select case when new.tipo like 'zoom%' then 'Cita con ' when new.tipo like 'visita%' then 'Visita con ' else 'Seguimiento de ' end||l.name,
   coalesce(v_at,case when new.tipo like 'visita%' then l.visita_at else l.next_action_at end)
   into v_title,v_at from public.leads l where l.id=new.lead_id and l.organization_id=new.organization_id and l.deleted_at is null;
  if not found then return new; end if;
  -- Zoom and next-action workers can describe the same appointment: one cycle, not two.
  v_key:='lead:'||new.lead_id||':'||case when new.tipo like 'inactividad%' then 'inactividad' else 'scheduled' end;
 else
  v_title:=nullif(btrim(coalesce(new.payload->>'text',new.payload->>'message','')),'');
  if v_title is null then return new; end if;
  v_key:='reminder:'||coalesce(new.payload->>'origin_reminder_id',new.id::text);
 end if;
 v_key:=v_key||':'||coalesce(extract(epoch from v_at)::text,'none');
 insert into public.copilot_reminder_followups(organization_id,profile_id,event_key,source_reminder_id,kind,title,lead_id,action_id,mkt_task_id,event_at,ignore_quiet,started_at,last_notified_at,next_followup_at)
 values(new.organization_id,p.id,v_key,new.id,new.tipo,left(v_title,500),new.lead_id,v_action,v_task,v_at,new.ignore_quiet,v_now,v_now,v_now+interval '3 minutes')
 on conflict(organization_id,profile_id,event_key) do update
  set source_reminder_id=excluded.source_reminder_id,title=excluded.title,
      last_notified_at=excluded.last_notified_at,
      next_followup_at=case when copilot_reminder_followups.status='pending' and copilot_reminder_followups.next_followup_at is not null then excluded.next_followup_at else copilot_reminder_followups.next_followup_at end
 returning id into v_id;
 -- A second scheduled warning belongs to the same cycle; it never resets its count or acknowledgement.
 update public.proactive_reminders set payload=payload||jsonb_build_object('copilot_followup_id',v_id) where id=new.id;
 return new;
end $fn$;
revoke all on function public.fn_copilot_followup_capture() from public,anon,authenticated;
drop trigger if exists copilot_followup_capture on public.proactive_reminders;
create trigger copilot_followup_capture after insert or update of status on public.proactive_reminders
 for each row execute function public.fn_copilot_followup_capture();

create or replace function public.fn_copilot_followup_answer(p_profile uuid,p_id uuid,p_kind text) returns text
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare r public.copilot_reminder_followups%rowtype;
begin
 if p_kind not in ('will_do','unavailable','acknowledged','reschedule','done') then raise exception 'Respuesta no válida.' using errcode='22023'; end if;
 select f.* into r from public.copilot_reminder_followups f join public.profiles p on p.id=f.profile_id and p.organization_id=f.organization_id
 where f.id=p_id and f.profile_id=p_profile and coalesce(p.active,true) for update of f;
 if not found then raise exception 'No tienes acceso a este recordatorio.' using errcode='42501'; end if;
 if r.status='cancelled' then return 'Este recordatorio ya cambió o se canceló. Revisa la fecha actual en tu agenda.'; end if;
 if r.status='answered' then return 'Este recordatorio ya tiene una respuesta. La insistencia está detenida.'; end if;
 update public.copilot_reminder_followups set status='answered',responded_at=coalesce(responded_at,now()),response_kind=coalesce(response_kind,p_kind),next_followup_at=null where id=r.id;
 update public.proactive_pending_reports rep set status='closed',outcome='copilot_acknowledged'
 where rep.organization_id=r.organization_id and rep.status='open' and rep.kind not like 'awaiting_%'
  and rep.reminder_id in(select pr.id from public.proactive_reminders pr where pr.organization_id=r.organization_id and pr.payload->>'copilot_followup_id'=r.id::text);
 return case when p_kind='unavailable' then 'Entendido. Detuve los avisos de «'||r.title||'». La actividad sigue pendiente; puedes reprogramarla cuando lo necesites.'
  when p_kind='reschedule' then 'Detuve los avisos de «'||r.title||'». Indica la nueva fecha y hora para reprogramarla.'
  else 'Confirmación recibida para «'||r.title||'». Detuve la insistencia; confirmar no marca la actividad como terminada.' end;
end $fn$;
revoke all on function public.fn_copilot_followup_answer(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.fn_copilot_followup_intent(p_text text) returns text
language sql immutable set search_path=public,pg_temp as $fn$
 select case
  when n ~ '^(por favor )?(activa|activar|enciende|habilita)( la)? insistencia( del copilot)?$' then 'enable'
  when n ~ '^(por favor )?(desactiva|desactivar|apaga|quita)( la)? insistencia( del copilot)?$' then 'disable'
  when n ~ '^(ah )?(si |te )?confirmo( que (lo |la )?(voy a hacer|hare))?$|^(si[ ,]+)?(lo voy a hacer|voy a hacerlo|lo hare|la hare|en proceso|ya estoy en eso|ya lo estoy haciendo)$' then 'will_do'
  when n ~ '^(ah )?(ahora |hoy )?no (puedo|podre|voy a poder)( (hacerlo|hacerla|hoy|ahora))?$' then 'unavailable'
  when n ~ '^(ok|okay|vale|entendido|recibido|de acuerdo|si)$' then 'acknowledged'
  when n ~ '^(ya (lo|la) hice|hecho|hecha|listo|lista|ya termine)$' then 'done'
  when n ~ '^(reagenda|reprograma|pospon|aplaza)(lo|la| esto| eso| el recordatorio| la tarea)?( |$)' then 'reschedule'
 end from (select btrim(regexp_replace(public._bot_agenda_norm(p_text),'[.!¡¿?]+$','','g')) n) q;
$fn$;
revoke all on function public.fn_copilot_followup_intent(text) from public,anon,authenticated;

create or replace function public.fn_copilot_followup_context(p_profile uuid,p_before bigint default null) returns uuid
language sql stable security definer set search_path=public,pg_temp as $fn$
 -- A generic "sí" must not answer an older reminder after another conversation.
 select f.id from public.copilot_reminder_followups f join public.profiles p on p.id=f.profile_id and p.organization_id=f.organization_id
 cross join lateral(select a.* from public.tg_bot_activity a where a.organization_id=f.organization_id and a.telegram_chat_id=p.telegram_chat_id
  and (p_before is null or a.id<p_before) order by a.created_at desc,a.id desc limit 1) last_message
 where f.profile_id=p_profile and f.status='pending' and last_message.role in ('ai','assistant')
  and (last_message.meta->>'copilot_followup_id'=f.id::text
   or (last_message.created_at>=f.started_at and last_message.content like '▸%' and length(f.title)>3
       and position(lower(regexp_replace(f.title,'^(Cita con|Visita con|Seguimiento de) ','')) in lower(last_message.content))>0)
   or (last_message.meta->>'action_id'=f.action_id::text and last_message.created_at>=f.started_at))
 order by f.last_notified_at desc limit 1;
$fn$;
revoke all on function public.fn_copilot_followup_context(uuid,bigint) from public,anon,authenticated;

create or replace function public.fn_copilot_followup_user_message() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_profile uuid; v_intent text; v_id uuid;
begin
 if new.role<>'user' or new.meta->>'copilot_followup_handled'='true' then return new; end if;
 v_intent:=public.fn_copilot_followup_intent(new.content);
 if v_intent is null then return new; end if;
 select id into v_profile from public.profiles where telegram_chat_id=new.telegram_chat_id and organization_id=new.organization_id and coalesce(active,true);
 if v_profile is null then return new; end if;
 if v_intent in ('enable','disable') then
  update public.profiles set copilot_insistence_enabled=(v_intent='enable') where id=v_profile;
 else
  v_id:=public.fn_copilot_followup_context(v_profile,new.id);
  if v_id is not null then perform public.fn_copilot_followup_answer(v_profile,v_id,v_intent); end if;
 end if;
 return new;
end $fn$;
revoke all on function public.fn_copilot_followup_user_message() from public,anon,authenticated;
drop trigger if exists copilot_followup_user_message on public.tg_bot_activity;
create trigger copilot_followup_user_message after insert on public.tg_bot_activity for each row execute function public.fn_copilot_followup_user_message();

create or replace function public.fn_copilot_followup_preference_changed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
 -- Applies equally to the settings switch and commands from already-installed apps.
 update public.copilot_reminder_followups set next_followup_at=
  case when new.copilot_insistence_enabled or repeat_count<2 then greatest(last_notified_at+interval '3 minutes',now()+interval '3 minutes') else null end
 where profile_id=new.id and organization_id=new.organization_id and status='pending';
 return new;
end $fn$;
revoke all on function public.fn_copilot_followup_preference_changed() from public,anon,authenticated;
drop trigger if exists copilot_followup_preference_changed on public.profiles;
create trigger copilot_followup_preference_changed after update of copilot_insistence_enabled on public.profiles
 for each row when(old.copilot_insistence_enabled is distinct from new.copilot_insistence_enabled)
 execute function public.fn_copilot_followup_preference_changed();

create or replace function public.copilot_reminder_settings(p_enabled boolean default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() and coalesce(active,true);
 if not found then raise exception 'Inicia sesión para configurar tus recordatorios.' using errcode='42501'; end if;
 if p_enabled is not null then
  update public.profiles set copilot_insistence_enabled=p_enabled where id=p.id;
  p.copilot_insistence_enabled:=p_enabled;
 end if;
 return jsonb_build_object('enabled',p.copilot_insistence_enabled,'interval_minutes',3,'minimal_followups',2);
end $fn$;
revoke all on function public.copilot_reminder_settings(boolean) from public,anon;
grant execute on function public.copilot_reminder_settings(boolean) to authenticated;

create or replace function public.copilot_reminder_reply(p_text text,p_followup_id uuid default null,p_response text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; v_kind text; v_id uuid; v_reply text;
begin
 select * into p from public.profiles where id=auth.uid() and coalesce(active,true);
 if not found then raise exception 'Inicia sesión para responder al recordatorio.' using errcode='42501'; end if;
 v_kind:=case when p_followup_id is not null then p_response else public.fn_copilot_followup_intent(p_text) end;
 if v_kind in ('enable','disable') then
  perform public.copilot_reminder_settings(v_kind='enable');
  v_reply:=case when v_kind='enable' then 'Insistencia activada. Repetiré tus recordatorios cada tres minutos hasta que respondas, respetando tu horario de avisos.'
   else 'Insistencia reducida. Cada recordatorio tendrá como máximo dos avisos adicionales, separados por tres minutos. Si respondes antes, se detienen.' end;
 elsif v_kind in ('will_do','unavailable','acknowledged') then
  v_id:=coalesce(p_followup_id,public.fn_copilot_followup_context(p.id));
  if v_id is null then return jsonb_build_object('handled',false); end if;
  v_reply:=public.fn_copilot_followup_answer(p.id,v_id,v_kind);
 elsif p_followup_id is not null then
  raise exception 'Respuesta no válida.' using errcode='22023';
 else return jsonb_build_object('handled',false);
 end if;
 insert into public.tg_bot_activity(organization_id,telegram_chat_id,role,content,meta)
 values(p.organization_id,p.telegram_chat_id,'user',left(coalesce(nullif(btrim(p_text),''),'Respuesta al recordatorio'),2000),jsonb_build_object('copilot_followup_handled',true));
 insert into public.tg_bot_activity(organization_id,telegram_chat_id,role,content,meta)
 values(p.organization_id,p.telegram_chat_id,'ai',v_reply,jsonb_build_object('kind','copilot_followup_response'));
 return jsonb_build_object('handled',true,'reply',v_reply,'persisted',true,'settings_changed',v_kind in ('enable','disable'));
end $fn$;
revoke all on function public.copilot_reminder_reply(text,uuid,text) from public,anon;
grant execute on function public.copilot_reminder_reply(text,uuid,text) to authenticated;

create or replace function public.fn_copilot_followup_source_changed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_changed boolean:=false;
begin
 if tg_op='DELETE' then v_changed:=true;
 elsif tg_table_name='team_actions' then v_changed:=new.done or new.due_at is distinct from old.due_at or new.asesor_id is distinct from old.asesor_id or new.last_response_at is distinct from old.last_response_at or new.evidence_at is distinct from old.evidence_at;
 elsif tg_table_name='mkt_tasks' then v_changed:=new.deleted_at is not null or new.estado is distinct from old.estado or new.due_at is distinct from old.due_at or new.assignee_id is distinct from old.assignee_id;
 elsif tg_table_name='leads' then v_changed:=new.deleted_at is not null or new.stage is distinct from old.stage or new.next_action_at is distinct from old.next_action_at or new.visita_at is distinct from old.visita_at or new.asesor_id is distinct from old.asesor_id;
 end if;
 if v_changed then
  update public.copilot_reminder_followups set status='cancelled',next_followup_at=null,response_kind='source_changed'
   where organization_id=old.organization_id and status='pending' and
    ((tg_table_name='team_actions' and action_id=old.id) or (tg_table_name='mkt_tasks' and mkt_task_id=old.id) or (tg_table_name='leads' and lead_id=old.id));
 end if;
 return null;
end $fn$;
revoke all on function public.fn_copilot_followup_source_changed() from public,anon,authenticated;
drop trigger if exists copilot_followup_source_changed on public.team_actions;
create trigger copilot_followup_source_changed after update or delete on public.team_actions for each row execute function public.fn_copilot_followup_source_changed();
drop trigger if exists copilot_followup_source_changed on public.mkt_tasks;
create trigger copilot_followup_source_changed after update or delete on public.mkt_tasks for each row execute function public.fn_copilot_followup_source_changed();
drop trigger if exists copilot_followup_source_changed on public.leads;
create trigger copilot_followup_source_changed after update or delete on public.leads for each row execute function public.fn_copilot_followup_source_changed();

create or replace function public.fn_copilot_followup_tick(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare r record; v_text text; v_reminder uuid; v_n integer:=0; v_failures integer:=0; v_hour integer; v_quiet boolean;
begin
 if not pg_try_advisory_xact_lock(794115031) then return jsonb_build_object('ok',true,'sent',0,'reason','busy'); end if;
 for r in select f.*,p.name,p.telegram_chat_id,p.copilot_insistence_enabled,
   coalesce(pc.timezone,p.work_tz,p.timezone,'America/Cancun') timezone,pc.quiet_start_hour,pc.quiet_end_hour,
   pc.enabled config_enabled,o.meta_config,coalesce(pc.shadow_mode,false) shadow_mode,pc.test_asesor_names
  from public.copilot_reminder_followups f join public.profiles p on p.id=f.profile_id and p.organization_id=f.organization_id
  join public.organizations o on o.id=f.organization_id left join public.proactive_config pc on pc.organization_id=f.organization_id
  where f.status='pending' and f.next_followup_at<=p_now and coalesce(p.active,true) and coalesce(o.active,true)
  order by f.next_followup_at,f.id limit 200 for update of f skip locked
 loop
  begin
   if not r.copilot_insistence_enabled and r.repeat_count>=2 then
    update public.copilot_reminder_followups set next_followup_at=null where id=r.id; continue;
   end if;
   if r.config_enabled=false and coalesce(r.meta_config->>'mkt_persecucion','off')<>'on' then continue; end if;
   if r.shadow_mode and not (r.name=any(coalesce(r.test_asesor_names,array[]::text[]))) then continue; end if;
   if not r.ignore_quiet then
    v_hour:=extract(hour from p_now at time zone r.timezone);
    v_quiet:=case when r.quiet_start_hour>r.quiet_end_hour then v_hour>=r.quiet_start_hour or v_hour<r.quiet_end_hour
     else v_hour>=r.quiet_start_hour and v_hour<r.quiet_end_hour end;
    if coalesce(v_quiet,false) or (r.mkt_task_id is not null and not public.fn_mkt_in_window(r.profile_id,p_now)) then continue; end if;
   end if;
   -- Suppress cancelled/deleted work even if an earlier writer bypassed the source trigger.
   if (r.action_id is not null and not exists(select 1 from public.team_actions a where a.id=r.action_id and a.organization_id=r.organization_id and not coalesce(a.done,false) and a.due_at is not distinct from r.event_at))
    or (r.mkt_task_id is not null and not exists(select 1 from public.mkt_tasks t where t.id=r.mkt_task_id and t.organization_id=r.organization_id and t.assignee_id=r.profile_id and t.deleted_at is null and t.estado<>'hecha' and t.due_at is not distinct from r.event_at))
    or (r.lead_id is not null and not exists(select 1 from public.leads l where l.id=r.lead_id and l.organization_id=r.organization_id and l.deleted_at is null)) then
    update public.copilot_reminder_followups set status='cancelled',next_followup_at=null,response_kind='source_changed' where id=r.id; continue;
   end if;
   v_text:='▸ Seguimiento pendiente'||chr(10)||'«'||r.title||'»'||chr(10)||
    case r.repeat_count%3 when 0 then 'Aún no recibo tu confirmación. Indícame si lo vas a realizar o si no podrás.'
     when 1 then 'Continúo pendiente de tu respuesta. Confirma si lo realizarás o si necesitas reprogramarlo.'
     else 'Este recordatorio sigue sin respuesta. Por favor, confirma cómo proceder para detener los avisos.' end;
   insert into public.proactive_reminders(organization_id,asesor_id,asesor_name,tipo,scheduled_at,status,payload,dedupe_key,ignore_quiet)
    values(r.organization_id,r.profile_id,r.name,'personal',p_now,'pending',
     jsonb_build_object('text',v_text,'copilot_followup_id',r.id,'followup_repeat',true,'repeat_number',r.repeat_count+1),
     'copilot_followup:'||r.id||':'||(r.repeat_count+1),r.ignore_quiet)
    on conflict(dedupe_key) do nothing returning id into v_reminder;
   if v_reminder is null then continue; end if;
   -- The existing trigger emits push on this pending -> sent transition.
   update public.proactive_reminders set status='sent',sent_at=p_now where id=v_reminder;
   insert into public.tg_bot_activity(organization_id,telegram_chat_id,role,content,created_at,meta)
    values(r.organization_id,r.telegram_chat_id,'ai',v_text,p_now,jsonb_build_object('kind','copilot_followup','copilot_followup_id',r.id));
   update public.copilot_reminder_followups set repeat_count=repeat_count+1,last_notified_at=p_now,
    next_followup_at=case when r.copilot_insistence_enabled or r.repeat_count+1<2 then p_now+interval '3 minutes' else null end where id=r.id;
   v_n:=v_n+1;
  exception when others then v_failures:=v_failures+1;
  end;
 end loop;
 return jsonb_build_object('ok',v_failures=0,'sent',v_n,'failures',v_failures);
end $fn$;
revoke all on function public.fn_copilot_followup_tick(timestamptz) from public,anon,authenticated;
grant execute on function public.fn_copilot_followup_tick(timestamptz) to service_role;

-- Replace the old retry-only scans; the initial schedules remain intact.
create or replace function public.fn_proactive_scan_insist(payload jsonb default '{}'::jsonb) returns jsonb
language sql set search_path=public,pg_temp as $fn$ select jsonb_build_object('ok',true,'enqueued',0,'reason','copilot_followup_engine'); $fn$;
create or replace function public.fn_proactive_scan_team_insist(payload jsonb default '{}'::jsonb) returns jsonb
language sql security definer set search_path=public,pg_temp as $fn$ select jsonb_build_object('ok',true,'enqueued',0,'reason','copilot_followup_engine'); $fn$;
revoke all on function public.fn_proactive_scan_insist(jsonb),public.fn_proactive_scan_team_insist(jsonb) from public,anon,authenticated;
grant execute on function public.fn_proactive_scan_insist(jsonb),public.fn_proactive_scan_team_insist(jsonb) to service_role;
update public.proactive_reminders set status='cancelled' where status='pending' and (tipo='inactividad_insist' or (tipo='team_action' and payload->>'fase'='insist'));

-- The task coach's second "have you started?" is also a retry, now owned by this engine.
do $coach$
declare v_def text; v_old text:=E'then 2\n                else 0 end as intento';
begin
 if to_regprocedure('public.fn_mkt_persecucion_tick()') is not null then
  select pg_get_functiondef('public.fn_mkt_persecucion_tick()'::regprocedure) into v_def;
  if position('COPILOT_FOLLOWUP_291' in v_def)>0 then return; end if;
  if position(v_old in v_def)=0 then raise exception 'Task coach changed; inspect before replacing its legacy retry.'; end if;
  execute replace(v_def,v_old,E'then 0 -- COPILOT_FOLLOWUP_291: retries use the per-person preference\n                else 0 end as intento');
 end if;
end $coach$;

insert into public.front_rpc_registry(nombre,nota) values
 ('copilot_reminder_settings','Preferencia personal de insistencia con identidad desde auth.uid().'),
 ('copilot_reminder_reply','Responde a un recordatorio propio sin completar la actividad.')
on conflict(nombre) do update set nota=excluded.nota;

-- pg_cron exists in production. The guard also permits isolated PostgreSQL tests.
do $cron$
begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  perform cron.schedule('copilot-followups-tick','30 seconds','select public.fn_copilot_followup_tick();');
 end if;
end $cron$;
