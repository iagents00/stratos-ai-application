-- Installed clients already call this authenticated RPC before their old webhook.
-- Forward the user's JWT in memory to a fixed Edge URL; never queue/store a token.
-- Enable per organization only after an end-to-end acceptance test.
create table public.copilot_rpc_deliveries(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 profile_id uuid not null references public.profiles(id),
 input_hash text not null, user_turn_id bigint,
 created_at timestamptz not null default now()
);
alter table public.copilot_rpc_deliveries enable row level security;
revoke all on public.copilot_rpc_deliveries from public,anon,authenticated;
grant all on public.copilot_rpc_deliveries to service_role;
create index copilot_rpc_delivery_recent on public.copilot_rpc_deliveries(profile_id,created_at desc);

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
 if coalesce(h->>'authorization','') !~* '^Bearer .+' or nullif(h->>'apikey','') is null then
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
   array[extensions.http_header('Authorization',h->>'authorization'),extensions.http_header('apikey',h->>'apikey')],
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

CREATE OR REPLACE FUNCTION public.copilot_handle_pending(p_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_chat bigint; v_org uuid; v_asesor text; v_check jsonb; v_kind text; v_lead uuid; v_report uuid; v_res jsonb;
BEGIN
  IF COALESCE(btrim(p_text),'')='' THEN RETURN NULL; END IF;
  SELECT telegram_chat_id, organization_id, name INTO v_chat, v_org, v_asesor FROM public.profiles WHERE id=auth.uid() LIMIT 1;
  IF v_chat IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=auth.uid() AND p.active IS TRUE AND coalesce(o.active,true)) THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM public.organizations WHERE id=v_org AND meta_config#>>'{crm,authenticatedCopilotBridge}'='true') THEN
    RETURN public.copilot_authenticated_bridge(p_text);
  END IF;
  v_check := public.fn_proactive_check_report(jsonb_build_object('organization_id', v_org, 'advisor_telegram_id', v_chat, 'text', p_text));
  IF COALESCE((v_check->>'has_report')::boolean,false) IS NOT TRUE THEN RETURN NULL; END IF;
  v_kind := v_check->>'report_kind';
  v_lead := NULLIF(v_check->>'lead_id','')::uuid;
  v_report := NULLIF(v_check->>'report_id','')::uuid;

  IF v_kind = 'awaiting_plan' THEN
    v_res := public.fn_proactive_log_plan(jsonb_build_object('lead_id', v_lead, 'report_id', v_report, 'plan', p_text, 'asesor_name', v_asesor));
    IF COALESCE((v_res->>'ok')::boolean,false) THEN
      RETURN '✅ Listo, guardé tu plan en el expediente del cliente. Vas a llegar preparado a la llamada.';
    END IF;
    RETURN NULL;
  ELSIF v_kind = 'awaiting_reschedule' THEN
    v_res := public.fn_proactive_reschedule_apply(jsonb_build_object(
      'organization_id', v_org, 'lead_id', v_lead, 'advisor_telegram_id', v_chat, 'raw_text', p_text));
    RETURN NULLIF(btrim(COALESCE(v_res->>'text','')),'');
  ELSIF v_kind = 'awaiting_next_action' THEN
    v_res := public.fn_proactive_next_action_apply(jsonb_build_object(
      'organization_id', v_org, 'advisor_telegram_id', v_chat, 'lead_id', v_lead,
      'next_action', p_text, 'raw_text', p_text));
    RETURN NULLIF(btrim(COALESCE(v_res->>'text','')),'');
  END IF;
  RETURN NULL;
END; $function$;

revoke all on function public.copilot_handle_pending(text) from public,anon;
grant execute on function public.copilot_handle_pending(text) to authenticated;
