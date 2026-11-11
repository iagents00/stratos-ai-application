-- Durable delivery identity: losing an HTTP response never authorizes a replay.
create table public.copilot_deliveries(
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 profile_id uuid not null references public.profiles(id), input_hash text not null,
 status text not null default 'processing' check(status in ('processing','completed','failed','uncertain')),
 response jsonb, error_code text, created_at timestamptz not null default now(), finished_at timestamptz
);
alter table public.copilot_deliveries enable row level security;
revoke all on public.copilot_deliveries from anon,authenticated;
grant all on public.copilot_deliveries to service_role;
create index on public.copilot_deliveries(organization_id,profile_id,created_at desc);

create table public.copilot_ops_incidents(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 component text not null, code text not null, bucket timestamptz not null,
 occurrences integer not null default 1, first_seen timestamptz not null default now(),last_seen timestamptz not null default now(),
 telegram_sent_at timestamptz,email_sent_at timestamptz,
 unique(organization_id,component,code,bucket)
);
alter table public.copilot_ops_incidents enable row level security;
revoke all on public.copilot_ops_incidents from anon,authenticated;
grant all on public.copilot_ops_incidents to service_role;

create or replace function public.fn_copilot_ops_report(p_org uuid,p_component text,p_code text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_id uuid;
begin
 if p_component not in ('copilot','transcription','n8n','vps') or p_code !~ '^[a-z0-9_]{1,60}$' then raise exception 'Invalid incident'; end if;
 insert into public.copilot_ops_incidents(organization_id,component,code,bucket)
 values(p_org,p_component,p_code,to_timestamp(floor(extract(epoch from now())/1800)*1800))
 on conflict(organization_id,component,code,bucket) do update
 set occurrences=copilot_ops_incidents.occurrences+1,last_seen=now()
 returning id into v_id;
 return v_id;
end $fn$;
revoke all on function public.fn_copilot_ops_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.fn_copilot_ops_report(uuid,text,text) to service_role;

create or replace function public.copilot_report_problem(p_component text,p_code text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() and active is true;
 if not found or p.organization_id is null then raise exception 'Session required' using errcode='42501'; end if;
 if p_component not in ('copilot','transcription') or p_code not in ('delivery_network','delivery_timeout','empty_response','audio_engine','audio_timeout','audio_provider','audio_quota') then raise exception 'Invalid incident'; end if;
 perform public.fn_copilot_ops_report(p.organization_id,p_component,p_code);
 return true;
end $fn$;
revoke all on function public.copilot_report_problem(text,text) from public,anon;
grant execute on function public.copilot_report_problem(text,text) to authenticated;

create or replace function public.copilot_delivery_begin(p_id uuid,p_text text,p_callback text,p_route text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; d public.copilot_deliveries%rowtype; v_hash text; v_inserted boolean;
begin
 select * into p from public.profiles where id=auth.uid() and active is true;
 if not found or p.organization_id is null then raise exception 'Session required' using errcode='42501'; end if;
 if length(coalesce(p_text,''))>20000 or length(coalesce(p_callback,''))>1000 or p_route not in ('crm','marketing','tenant','nsg','dental') then raise exception 'Invalid request'; end if;
 v_hash:=md5(coalesce(p_text,'')||E'\n'||coalesce(p_callback,'')||E'\n'||p_route);
 insert into public.copilot_deliveries(id,organization_id,profile_id,input_hash) values(p_id,p.organization_id,p.id,v_hash)
 on conflict(id) do nothing;
 v_inserted:=found;
 select * into d from public.copilot_deliveries where id=p_id and organization_id=p.organization_id and profile_id=p.id;
 if not found or d.input_hash<>v_hash then raise exception 'Request does not belong to this operation' using errcode='42501'; end if;
 return jsonb_build_object('run',v_inserted,'id',d.id,'status',d.status,'response',d.response,'created_at',d.created_at);
end $fn$;

create or replace function public.copilot_delivery_status(p_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $fn$
 select jsonb_build_object('id',d.id,'status',d.status,'response',d.response,'error_code',d.error_code)
 from public.copilot_deliveries d join public.profiles p on p.id=auth.uid() and p.active is true
 where d.id=p_id and d.profile_id=p.id and d.organization_id=p.organization_id;
$fn$;
revoke all on function public.copilot_delivery_begin(uuid,text,text,text),public.copilot_delivery_status(uuid) from public,anon;
grant execute on function public.copilot_delivery_begin(uuid,text,text,text),public.copilot_delivery_status(uuid) to authenticated;

create or replace function public.fn_copilot_delivery_finish(p_org uuid,p_profile uuid,p_id uuid,p_status text,p_response jsonb,p_code text default null) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_chat bigint; v_text text;
begin
 if p_status not in ('completed','failed','uncertain') then raise exception 'Invalid status'; end if;
 select telegram_chat_id into v_chat from public.profiles where id=p_profile and organization_id=p_org and active is true;
 if v_chat is null then return false; end if;
 update public.copilot_deliveries set status=p_status,response=p_response,error_code=p_code,finished_at=now()
 where id=p_id and organization_id=p_org and profile_id=p_profile and status='processing';
 if not found then return false; end if;
 v_text:=coalesce(p_response#>>'{reply,text}',case when jsonb_typeof(p_response->'reply')='string' then p_response->>'reply' end);
 if nullif(btrim(v_text),'') is not null then
  insert into public.tg_bot_activity(organization_id,telegram_chat_id,role,content,meta)
  values(p_org,v_chat,'ai',v_text,jsonb_build_object('kind','copilot_delivery','request_id',p_id));
 end if;
 if p_status<>'completed' then perform public.fn_copilot_ops_report(p_org,'copilot',coalesce(p_code,'delivery_uncertain')); end if;
 return true;
end $fn$;
revoke all on function public.fn_copilot_delivery_finish(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.fn_copilot_delivery_finish(uuid,uuid,uuid,text,jsonb,text) to service_role;

insert into public.front_rpc_registry(nombre,nota) values
 ('copilot_delivery_status','Read only the signed-in person delivery receipt'),
 ('copilot_report_problem','Report a bounded operational category without conversation content')
on conflict(nombre) do update set nota=excluded.nota;
