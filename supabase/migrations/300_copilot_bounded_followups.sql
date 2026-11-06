-- Opt-in organization policy. Existing organizations retain their current settings.
-- Offsets are measured from the original delivery; the agenda item is never completed here.
create or replace function public.fn_copilot_followup_bounded(p_org uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $fn$
 select coalesce((select meta_config #> '{crm,copilotFollowupScheduleMinutes}'='[3,30,60]'::jsonb from public.organizations where id=p_org),false);
$fn$;
create or replace function public.fn_copilot_followup_next(p_started timestamptz,p_count integer,p_enabled boolean,p_after timestamptz) returns timestamptz
language sql immutable set search_path=public,pg_temp as $fn$
 select min(p_started+make_interval(mins=>s.minutes))
 from unnest(array[3,30,60]) with ordinality s(minutes,ordinal)
 where s.ordinal>p_count and s.ordinal<=case when p_enabled then 3 else 2 end
 and p_started+make_interval(mins=>s.minutes)>p_after;
$fn$;
revoke all on function public.fn_copilot_followup_bounded(uuid),public.fn_copilot_followup_next(timestamptz,integer,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.fn_copilot_followup_bounded(uuid),public.fn_copilot_followup_next(timestamptz,integer,boolean,timestamptz) to service_role;


CREATE OR REPLACE FUNCTION public.copilot_reminder_reply(p_text text, p_followup_id uuid DEFAULT NULL::uuid, p_response text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.profiles%rowtype; v_kind text; v_id uuid; v_reply text;
begin
 select * into p from public.profiles where id=auth.uid() and coalesce(active,true);
 if not found then raise exception 'Inicia sesión para responder al recordatorio.' using errcode='42501'; end if;
 v_kind:=case when p_followup_id is not null then p_response else public.fn_copilot_followup_intent(p_text) end;
 if v_kind in ('enable','disable') then
  perform public.copilot_reminder_settings(v_kind='enable');
  v_reply:=case when public.fn_copilot_followup_bounded(p.organization_id) then
    case when v_kind='enable' then 'Seguimiento activado. Después del aviso inicial, recordaré a los 3 minutos, a los 30 minutos y a la hora. Después me detendré; si respondes antes, también.'
     else 'Seguimiento reducido. Después del aviso inicial, recordaré a los 3 y a los 30 minutos. Después me detendré; si respondes antes, también.' end
   else case when v_kind='enable' then 'Insistencia activada. Repetiré tus recordatorios cada tres minutos hasta que respondas, respetando tu horario de avisos.'
   else 'Insistencia reducida. Cada recordatorio tendrá como máximo dos avisos adicionales, separados por tres minutos. Si respondes antes, se detienen.' end end;
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
end $function$;

CREATE OR REPLACE FUNCTION public.fn_copilot_followup_tick(p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record; v_text text; v_reminder uuid; v_n integer:=0; v_failures integer:=0; v_hour integer; v_quiet boolean;
begin
 if not pg_try_advisory_xact_lock(794115031) then return jsonb_build_object('ok',true,'sent',0,'reason','busy'); end if;
 for r in select f.*,p.name,p.telegram_chat_id,p.copilot_insistence_enabled,public.fn_copilot_followup_bounded(f.organization_id) bounded,
   coalesce(pc.timezone,p.work_tz,p.timezone,'America/Cancun') timezone,pc.quiet_start_hour,pc.quiet_end_hour,
   pc.enabled config_enabled,o.meta_config,coalesce(pc.shadow_mode,false) shadow_mode,pc.test_asesor_names
  from public.copilot_reminder_followups f join public.profiles p on p.id=f.profile_id and p.organization_id=f.organization_id
  join public.organizations o on o.id=f.organization_id left join public.proactive_config pc on pc.organization_id=f.organization_id
  where f.status='pending' and f.next_followup_at<=p_now and coalesce(p.active,true) and coalesce(o.active,true)
  order by f.next_followup_at,f.id limit 200 for update of f skip locked
 loop
  begin
   -- A delayed worker sends no catch-up burst and stops after the final slot.
   -- One minute allows the regular 30-second cron to deliver the 60-minute slot.
   if (r.bounded and (r.repeat_count>=case when r.copilot_insistence_enabled then 3 else 2 end or p_now>r.started_at+interval '61 minutes'))
    or (not r.bounded and not r.copilot_insistence_enabled and r.repeat_count>=2) then
    update public.copilot_reminder_followups set next_followup_at=null where id=r.id and organization_id=r.organization_id; continue;
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
    update public.copilot_reminder_followups set status='cancelled',next_followup_at=null,response_kind='source_changed' where id=r.id and organization_id=r.organization_id; continue;
   end if;
   v_text:='▸ Seguimiento pendiente'||chr(10)||'«'||r.title||'»'||chr(10)||
    case when r.bounded and public.fn_copilot_followup_next(r.started_at,r.repeat_count+1,r.copilot_insistence_enabled,p_now) is null
     then 'Este es el último aviso. La actividad queda pendiente en tu agenda; no enviaré más recordatorios de seguimiento.'
     else case r.repeat_count%3 when 0 then 'Aún no recibo tu confirmación. Indícame si lo vas a realizar o si no podrás.'
     when 1 then 'Continúo pendiente de tu respuesta. Confirma si lo realizarás o si necesitas reprogramarlo.'
     else 'Este recordatorio sigue sin respuesta. Por favor, confirma cómo proceder para detener los avisos.' end end;
   insert into public.proactive_reminders(organization_id,asesor_id,asesor_name,tipo,scheduled_at,status,payload,dedupe_key,ignore_quiet)
    values(r.organization_id,r.profile_id,r.name,'personal',p_now,'pending',
     jsonb_build_object('text',v_text,'copilot_followup_id',r.id,'followup_repeat',true,'repeat_number',r.repeat_count+1),
     'copilot_followup:'||r.id||':'||(r.repeat_count+1),r.ignore_quiet)
    on conflict(dedupe_key) do nothing returning id into v_reminder;
   if v_reminder is null then continue; end if;
   -- The existing trigger emits push on this pending -> sent transition.
   update public.proactive_reminders set status='sent',sent_at=p_now where id=v_reminder and organization_id=r.organization_id;
   insert into public.tg_bot_activity(organization_id,telegram_chat_id,role,content,created_at,meta)
    values(r.organization_id,r.telegram_chat_id,'ai',v_text,p_now,jsonb_build_object('kind','copilot_followup','copilot_followup_id',r.id));
   update public.copilot_reminder_followups set repeat_count=repeat_count+1,last_notified_at=p_now,
    next_followup_at=case when r.bounded then public.fn_copilot_followup_next(r.started_at,r.repeat_count+1,r.copilot_insistence_enabled,p_now)
     when r.copilot_insistence_enabled or r.repeat_count+1<2 then p_now+interval '3 minutes' else null end where id=r.id and organization_id=r.organization_id;
   v_n:=v_n+1;
  exception when others then v_failures:=v_failures+1;
  end;
 end loop;
 return jsonb_build_object('ok',v_failures=0,'sent',v_n,'failures',v_failures);
end $function$;

CREATE OR REPLACE FUNCTION public.copilot_reminder_settings(p_enabled boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() and coalesce(active,true);
 if not found then raise exception 'Inicia sesión para configurar tus recordatorios.' using errcode='42501'; end if;
 if p_enabled is not null then
  update public.profiles set copilot_insistence_enabled=p_enabled where id=p.id and organization_id=p.organization_id;
  p.copilot_insistence_enabled:=p_enabled;
 end if;
 if public.fn_copilot_followup_bounded(p.organization_id) then
  return jsonb_build_object('enabled',p.copilot_insistence_enabled,'followup_minutes',jsonb_build_array(3,30,60),'max_followups',case when p.copilot_insistence_enabled then 3 else 2 end,'minimal_followups',2);
 end if;
 return jsonb_build_object('enabled',p.copilot_insistence_enabled,'interval_minutes',3,'minimal_followups',2);
end $function$;

CREATE OR REPLACE FUNCTION public.fn_copilot_followup_capture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      next_followup_at=case when copilot_reminder_followups.status='pending' and copilot_reminder_followups.next_followup_at is not null then case when public.fn_copilot_followup_bounded(excluded.organization_id)
        then public.fn_copilot_followup_next(copilot_reminder_followups.started_at,copilot_reminder_followups.repeat_count,
          (select copilot_insistence_enabled from public.profiles where id=excluded.profile_id and organization_id=excluded.organization_id),excluded.last_notified_at)
        else excluded.next_followup_at end else copilot_reminder_followups.next_followup_at end
 returning id into v_id;
 -- A second scheduled warning belongs to the same cycle; it never resets its count or acknowledgement.
 update public.proactive_reminders set payload=payload||jsonb_build_object('copilot_followup_id',v_id) where id=new.id and organization_id=new.organization_id;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_copilot_followup_preference_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 -- Applies equally to the settings switch and commands from already-installed apps.
 update public.copilot_reminder_followups set next_followup_at=
  case when public.fn_copilot_followup_bounded(new.organization_id)
   then public.fn_copilot_followup_next(started_at,repeat_count,new.copilot_insistence_enabled,now())
   when new.copilot_insistence_enabled or repeat_count<2 then greatest(last_notified_at+interval '3 minutes',now()+interval '3 minutes') else null end
 where profile_id=new.id and organization_id=new.organization_id and status='pending';
 return new;
end $function$;

-- The requested customer policy is opt-in. No other tenant is reconfigured.
update public.organizations set meta_config=jsonb_set(coalesce(meta_config,'{}'),'{crm}',
 coalesce(meta_config->'crm','{}')||jsonb_build_object('copilotFollowupScheduleMinutes',jsonb_build_array(3,30,60)))
where id='410570d9-2ce4-46eb-b77b-4a732861e238';
-- Reconcile existing cycles without restarting an old event or completing its activity.
update public.copilot_reminder_followups f set next_followup_at=public.fn_copilot_followup_next(f.started_at,f.repeat_count,p.copilot_insistence_enabled,now())
from public.profiles p where f.organization_id='410570d9-2ce4-46eb-b77b-4a732861e238'
 and p.id=f.profile_id and p.organization_id=f.organization_id and f.status='pending';
