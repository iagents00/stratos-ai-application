-- Adopt the model's own log when present; otherwise persist the final reply.
-- A completed receipt must never exist without its visible result.
create or replace function public.fn_copilot_delivery_finish(p_org uuid,p_profile uuid,p_id uuid,p_status text,p_response jsonb,p_code text default null) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_chat bigint; v_text text; v_original text; v_started timestamptz; v_log bigint; v_meta jsonb;
begin
 if p_status not in ('completed','failed','uncertain') then raise exception 'Invalid status'; end if;
 select telegram_chat_id into v_chat from public.profiles where id=p_profile and organization_id=p_org and active is true;
 if v_chat is null then return false; end if;
 update public.copilot_deliveries set status=p_status,response=p_response,error_code=p_code,finished_at=now()
 where id=p_id and organization_id=p_org and profile_id=p_profile and status='processing'
 returning created_at into v_started;
 if not found then return false; end if;
 v_text:=coalesce(p_response#>>'{reply,text}',case when jsonb_typeof(p_response->'reply')='string' then p_response->>'reply' end);
 if nullif(btrim(v_text),'') is null then raise exception 'Final reply is missing'; end if;
 v_original:=v_text;
 if nullif(btrim(v_text),'') is not null then
  -- Background cards also work on clients that cannot render their buttons yet.
  v_text:=replace(v_text,'Pásamelo si lo tienes; o regístralo así con el botón de abajo.',
   'Puedes pasarme esos datos o responder «sí» para registrarlo así.');
  if jsonb_typeof(p_response->'reply')='object' then
   p_response:=jsonb_set(p_response,'{reply,text}',to_jsonb(v_text));
   update public.copilot_deliveries set response=p_response where id=p_id and organization_id=p_org and profile_id=p_profile;
  end if;
  v_meta:=jsonb_build_object('kind','copilot_delivery','request_id',p_id,
    'inline_keyboard',coalesce(p_response#>'{reply,inline_keyboard}','[]'::jsonb));
  select id into v_log from public.tg_bot_activity a where a.organization_id=p_org and a.telegram_chat_id=v_chat
   and a.role='ai' and a.created_at>=v_started and nullif(a.meta->>'request_id','') is null
   and public._copilot_msg_same(a.content,v_original) order by a.id desc limit 1 for update;
  if v_log is not null then
   update public.tg_bot_activity set content=v_text,meta=coalesce(meta,'{}'::jsonb)||v_meta
    where id=v_log and organization_id=p_org and telegram_chat_id=v_chat;
  else
   insert into public.tg_bot_activity(organization_id,telegram_chat_id,role,content,meta)
   values(p_org,v_chat,'ai',v_text,v_meta) returning id into v_log;
  end if;
  if v_log is null then raise exception 'Final reply could not be persisted'; end if;
 end if;
 if p_status<>'completed' then perform public.fn_copilot_ops_report(p_org,'copilot',coalesce(p_code,'delivery_uncertain')); end if;
 return true;
end $fn$;
revoke all on function public.fn_copilot_delivery_finish(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.fn_copilot_delivery_finish(uuid,uuid,uuid,text,jsonb,text) to service_role;
