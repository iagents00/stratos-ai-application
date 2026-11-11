-- The API gateway may strip apikey before PostgREST. Edge verifies the user JWT itself.
create or replace function public.copilot_authenticated_bridge(p_text text) returns text
language plpgsql security definer set search_path=public,extensions,pg_temp as $fn$
declare p public.profiles%rowtype; d public.copilot_rpc_deliveries%rowtype;
 h jsonb; response record; result jsonb; receipt jsonb; v_hash text; v_turn bigint;
 ack constant text:='Estoy atendiendo tu solicitud. Te confirmaré aquí el resultado.';
 problem constant text:='No pude confirmar la recepción de tu solicitud. Conservé el mensaje; el equipo recibirá un aviso. Revisa la conversación antes de enviarlo otra vez.';
begin
 select * into p from public.profiles where id=auth.uid() and active is true;
 if not found or p.organization_id is null or p.telegram_chat_id is null then
  raise exception 'Session required' using errcode='42501';
 end if;
 if not exists(select 1 from public.organizations where id=p.organization_id and coalesce(active,true)
   and meta_config#>>'{crm,authenticatedCopilotBridge}'='true') then return null; end if;
 -- This opt-in is for the CRM brain, never the marketing/task-only brains.
 if p.role in ('marketing','colaborador') or coalesce((to_jsonb(p)->>'is_marketing_admin')::boolean,false) then return null; end if;
 if coalesce(btrim(p_text),'')='' then return null; end if;
 if length(p_text)>20000 then return 'Tu mensaje es demasiado largo para procesarlo completo. Envíamelo en dos partes.'; end if;
 h:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
 if coalesce(h->>'authorization','') !~* '^Bearer .+' then
  raise exception 'Session headers required' using errcode='42501';
 end if;
 v_hash:=md5(p_text||E'\n\ncrm');
 -- Serialize repeated taps from this person; another person/company has a different lock.
 perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));
 select a.id into v_turn from public.tg_bot_activity a where a.organization_id=p.organization_id
  and a.telegram_chat_id=p.telegram_chat_id and a.role='user' and a.content=p_text
  and a.created_at>now()-interval '15 seconds' order by a.id desc limit 1;
 select * into d from public.copilot_rpc_deliveries where organization_id=p.organization_id and profile_id=p.id
  and input_hash=v_hash and created_at>now()-interval '15 seconds'
  and user_turn_id is not distinct from v_turn
  order by created_at desc limit 1;
 if found then
  receipt:=public.copilot_delivery_status(d.id);
  return coalesce(nullif(receipt#>>'{response,reply,text}',''),ack);
 end if;
 if (select count(*) from public.copilot_rpc_deliveries where organization_id=p.organization_id
      and profile_id=p.id and created_at>now()-interval '1 minute')>=20 then
  perform public.fn_copilot_ops_report(p.organization_id,'copilot','bridge_rate_limit');
  return 'Tengo varias solicitudes tuyas en curso. Estoy atendiendo las anteriores; espera sus respuestas aquí.';
 end if;
 insert into public.copilot_rpc_deliveries(organization_id,profile_id,input_hash,user_turn_id)
 values(p.organization_id,p.id,v_hash,v_turn) returning * into d;
 -- Only wait for Edge acceptance, not for the model or a CRM write.
 -- SET LOCAL is transaction-scoped and does not change other requests.
 perform set_config('http.curlopt_timeout_msec','4000',true);
 perform set_config('http.timeout_msec','4000',true);
 begin
  select * into response from extensions.http((
   'POST','https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/copilot-deliver',
   array[extensions.http_header('Authorization',h->>'authorization')],
   'application/json',jsonb_build_object('request_id',d.id,'route','crm','chat_id',p.telegram_chat_id,'text',p_text,'background',true)::text
  )::extensions.http_request);
  result:=response.content::jsonb;
  if response.status between 200 and 299 and result->>'request_id'=d.id::text and result ? 'reply' then
   return coalesce(nullif(result#>>'{reply,text}',''),ack);
  end if;
 exception when others then
  -- Losing acceptance does not authorize replaying an action. Keep this exact ID.
  result:=null;
 end;
 insert into public.copilot_deliveries(id,organization_id,profile_id,input_hash,status,response,error_code)
 values(d.id,p.organization_id,p.id,v_hash,'uncertain',jsonb_build_object('ok',false,'reply',jsonb_build_object('text',problem)),'bridge_transport')
 on conflict(id) do nothing;
 perform public.fn_copilot_ops_report(p.organization_id,'copilot','bridge_transport');
 return problem;
end $fn$;
revoke all on function public.copilot_authenticated_bridge(text) from public,anon;
grant execute on function public.copilot_authenticated_bridge(text) to authenticated;

