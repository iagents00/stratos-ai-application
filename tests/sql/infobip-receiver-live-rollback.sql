-- Run only against stratos-prod AFTER migration 271. All QA data is rolled back.
-- Does not send messages, connect a sender, call a webhook or create an Auth session.
begin;
set local lock_timeout='2s';
set local statement_timeout='40s';
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
do $qa$
declare
  v_org uuid; v_user uuid; v_channel uuid; v_business text; v_contact text;
  v_payload jsonb; v_result jsonb; v_n integer; v_legacy uuid;
begin
  if exists(select 1 from organizations where id in
    ('a2700000-0000-4000-8000-000000000001','a2700000-0000-4000-8000-000000000002')) then
    raise exception 'QA identifiers already exist; no changes allowed';
  end if;
  insert into organizations(id,name,slug,seats,meta_config) values
    ('a2700000-0000-4000-8000-000000000001','QA receiver rollback Alpha','qa-receiver-270-alpha',30,
      '{"features":{"whatsappReadOnly":true},"crm":{"pipeline":[{"name":"Captado QA"}]}}'),
    ('a2700000-0000-4000-8000-000000000002','QA receiver rollback Beta','qa-receiver-270-beta',30,
      '{"features":{"whatsappReadOnly":true},"crm":{"pipeline":[{"name":"Captado QA"}]}}');
  for v_n in 1..24 loop
    v_org:=('a2700000-0000-4000-8000-'||lpad(case when v_n<=12 then '1' else '2' end,12,'0'))::uuid;
    v_user:=('a2700000-0000-4000-8000-'||lpad((100+v_n)::text,12,'0'))::uuid;
    v_channel:=('a2700000-0000-4000-8000-'||lpad((200+v_n)::text,12,'0'))::uuid;
    v_business:='1999555'||lpad(v_n::text,4,'0');
    v_contact:='1999666'||lpad((((v_n-1)%12)+1)::text,4,'0');
    insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
      (v_user,'qa-receiver-270-'||v_n||'@example.invalid',
       jsonb_build_object('stratos_organization_id',v_org,'stratos_role','asesor'),
       jsonb_build_object('name','QA receiver advisor '||v_n));
    insert into whatsapp_numero_asesor(id,organization_id,numero_whatsapp,asesor_id,asesor_name,proveedor)
      values(v_channel,v_org,v_business,v_user,'QA receiver advisor '||v_n,'infobip');
    perform fn_set_whatsapp_readonly_route(v_org,v_channel,true);
    v_payload:=jsonb_build_object('results',jsonb_build_array(jsonb_build_object(
      'to',v_business,'from',v_contact,'messageId','qa-270-in-'||v_n,
      'contact',jsonb_build_object('name','QA receiver contact '||v_n,'userId',v_contact),
      'message',jsonb_build_object('type','TEXT','text','QA rollback only'))));
    v_result:=fn_ingest_infobip_multitenant(v_payload);
    if (v_result->>'created')::int<>1 then raise exception 'New lead failed: %',v_result; end if;
    v_result:=fn_ingest_infobip_multitenant(v_payload);
    if (v_result->>'duplicate')::int<>1 then raise exception 'Replay not idempotent'; end if;
    v_result:=fn_ingest_infobip_multitenant(jsonb_build_object('eventType','BUSINESS_APP_MESSAGE_ECHO',
      'results',jsonb_build_array(jsonb_build_object('from',v_business,'to',v_contact,
      'direction','OUT','messageId','qa-270-echo-'||v_n,
      'contact',jsonb_build_object('userId',v_contact),
      'message',jsonb_build_object('type','TEXT','text','QA app echo rollback only')))));
    if (v_result->>'echoed')::int<>1 or (v_result->>'created')::int<>0 then raise exception 'Echo failed'; end if;
  end loop;
  if (select count(*) from leads where organization_id in
      ('a2700000-0000-4000-8000-000000000001','a2700000-0000-4000-8000-000000000002'))<>24 then raise exception 'Lead count'; end if;
  if (select count(*) from whatsapp_messages where organization_id in
      ('a2700000-0000-4000-8000-000000000001','a2700000-0000-4000-8000-000000000002'))<>48 then raise exception 'Message count'; end if;
  if exists(select 1 from leads l join profiles p on p.id=l.asesor_id where l.organization_id in
      ('a2700000-0000-4000-8000-000000000001','a2700000-0000-4000-8000-000000000002') and
      (l.organization_id<>p.organization_id or l.stage<>'Captado QA')) then raise exception 'Assignment or stage changed'; end if;
  select c.id into v_legacy from whatsapp_numero_asesor c
    join whatsapp_readonly_ingestion_routes r on r.channel_id=c.id and r.protected
    where c.organization_id='00000000-0000-0000-0000-000000000001' limit 1;
  if v_legacy is not null then
    begin
      perform fn_set_whatsapp_readonly_route('00000000-0000-0000-0000-000000000001',v_legacy,true);
      raise exception 'Legacy Duke channel was not protected';
    exception when insufficient_privilege then null; end;
  end if;
end;
$qa$;
select set_config('request.jwt.claim.sub','a2700000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $rls$
begin
  if (select count(*) from leads)<>1 then raise exception 'Advisor RLS leaked or hid leads'; end if;
  if (select count(*) from whatsapp_messages)<>2 then raise exception 'Advisor message RLS'; end if;
  if (select count(*) from fn_wa_conversations())<>1 then raise exception 'CRM inbox cannot see the mirror'; end if;
  if exists(select 1 from leads where organization_id<>'a2700000-0000-4000-8000-000000000001') then raise exception 'Cross organization read'; end if;
  begin
    perform fn_ingest_infobip_multitenant('{"results":[]}');
    raise exception 'Browser user invoked ingestion';
  exception when insufficient_privilege then null; end;
  begin
    perform fn_set_whatsapp_readonly_route('a2700000-0000-4000-8000-000000000001','a2700000-0000-4000-8000-000000000201',true);
    raise exception 'Browser user changed route';
  exception when insufficient_privilege then null; end;
end;
$rls$;
reset role;
rollback;
select 'PASS: 2 QA companies, 24 advisors, 24 leads, 48 messages, 24 replays; actual triggers/RLS; rolled back' as result;
