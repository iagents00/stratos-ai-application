-- Review before executing against Stratos after migration 274. Only fresh QA
-- organizations, Auth identities and clients are inserted, all rolled back.
-- No passwords, sessions, real Telegram chat IDs, phone numbers or messages
-- are supplied. Profile triggers may allocate internal synthetic chat IDs;
-- those QA profiles roll back with every other QA row.
-- A synchronous networking trigger without the established QA-source guard
-- aborts preflight; do not remove that guard to force a green smoke test.
begin;
set local statement_timeout='30s';
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare t record; v_def text;
begin
  for t in select p.oid,p.proname from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
    join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=tg.tgfoid
    where n.nspname='public' and c.relname in ('leads','profiles','organizations') and not tg.tgisinternal and tg.tgenabled<>'D'
  loop
    v_def:=pg_get_functiondef(t.oid);
    if v_def ~* '(extensions\.http|http_post\(|http_get\(|http_request\()'
       and v_def !~* 'qa_centinela' then
      raise exception 'Review external networking trigger % before QA insertion',t.proname;
    end if;
  end loop;
end $$;

insert into public.organizations(id,name,slug,seats,parent_organization_id,meta_config) values
 ('a2740000-0000-4000-8000-000000000001','QA274 root','qa-rollback-root-274',5,null,'{}'),
 ('a2740000-0000-4000-8000-000000000002','QA274 partner','qa-rollback-partner-274',5,null,'{"platform":{"kind":"partner"}}'),
 ('a2740000-0000-4000-8000-000000000003','QA274 company','qa-rollback-company-274',5,'a2740000-0000-4000-8000-000000000002','{"crm":{"pipeline":[{"name":"Prospecto","color":"#94A3B8"},{"name":"Ganado","color":"#34D399"}]},"features":{"procesoGuiado":false}}'),
 ('a2740000-0000-4000-8000-000000000004','QA274 foreign','qa-rollback-foreign-274',5,null,'{}');
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('a2740000-0000-4000-8000-000000000010','qa-root-274@example.invalid','{"stratos_organization_id":"a2740000-0000-4000-8000-000000000001","stratos_role":"super_admin"}','{"name":"QA274 root"}'),
 ('a2740000-0000-4000-8000-000000000011','qa-partner-274@example.invalid','{"stratos_organization_id":"a2740000-0000-4000-8000-000000000002","stratos_role":"super_admin"}','{"name":"QA274 partner"}'),
 ('a2740000-0000-4000-8000-000000000012','qa-advisor-274@example.invalid','{"stratos_organization_id":"a2740000-0000-4000-8000-000000000003","stratos_role":"asesor"}','{"name":"QA274 advisor"}'),
 ('a2740000-0000-4000-8000-000000000013','qa-foreign-274@example.invalid','{"stratos_organization_id":"a2740000-0000-4000-8000-000000000004","stratos_role":"asesor"}','{"name":"QA274 foreign"}');
insert into public.platform_admins(user_id,scope_organization_id,active,support_only) values
 ('a2740000-0000-4000-8000-000000000010',null,true,false),
 ('a2740000-0000-4000-8000-000000000011','a2740000-0000-4000-8000-000000000002',true,true);
create temporary table qa274_profiles_before as select id,to_jsonb(p) snapshot from public.profiles p
  where id::text like 'a2740000-%';
create temporary table qa274_auth_before as select id,to_jsonb(u) snapshot from auth.users u
  where id::text like 'a2740000-%';
do $$
declare
 root_id uuid:='a2740000-0000-4000-8000-000000000010';
 partner_id uuid:='a2740000-0000-4000-8000-000000000011';
 advisor_id uuid:='a2740000-0000-4000-8000-000000000012';
 org_id uuid:='a2740000-0000-4000-8000-000000000003';
 foreign_org uuid:='a2740000-0000-4000-8000-000000000004';
 lead_id uuid:='a2740000-0000-4000-8000-000000000100';
 patch jsonb; result jsonb; version timestamptz; original_name text;
begin
 patch:=jsonb_build_object('name','QA274 gateway client','source','qa_centinela','stage','Prospecto','asesor_id',advisor_id,'notas','QA274 original note');
 result:=fn_platform_crm_mutate(root_id,org_id,lead_id,null,patch,true);
 if result->>'audit_saved'<>'true' or result#>>'{lead,organization_id}'<>org_id::text
   or result#>>'{lead,asesor_id}'<>advisor_id::text then raise exception 'Create/assignment/audit failed'; end if;
 if not exists(select 1 from audit_log where actor_id=root_id and organization_id=org_id and entity_id=lead_id
   and metadata->>'source'='platform_crm' and metadata->>'operation'='create') then raise exception 'Missing real actor audit'; end if;
 result:=fn_platform_crm_mutate(root_id,org_id,lead_id,null,patch,true);
 if result->>'replayed'<>'true' then raise exception 'Create retry was not idempotent'; end if;
 if (select count(*) from audit_log where actor_id=root_id and entity_id=lead_id and metadata->>'operation'='create')<>1 then raise exception 'Duplicate create audit'; end if;
 begin
  perform fn_platform_crm_read(partner_id,foreign_org);
  raise exception 'Partner crossed company scope'; exception when insufficient_privilege then null;
 end;
 begin
  perform fn_platform_crm_read(advisor_id,org_id);
  raise exception 'Tenant superadmin/ordinary advisor gained global access'; exception when insufficient_privilege then null;
 end;
 result:=fn_platform_crm_read(partner_id,org_id,null,0,1,'QA274');
 if (result->>'total')::integer<>1 or jsonb_array_length(result->'leads')<>1 then raise exception 'Scoped list/count failed'; end if;
 insert into expediente_items(lead_id,organization_id,tipo,titulo,descripcion,asesor_id) values
   (lead_id,org_id,'nota','QA274 visible','Visible note',advisor_id);
 insert into expediente_items(lead_id,organization_id,tipo,titulo,descripcion,asesor_id,deleted_at) values
   (lead_id,org_id,'nota','QA274 deleted','Deleted note',advisor_id,now());
 result:=fn_platform_crm_read(root_id,org_id,lead_id);
 if jsonb_array_length(result->'notes')<>1 then raise exception 'Deleted notes leaked'; end if;
 version:=(result#>>'{lead,updated_at}')::timestamptz;
 result:=fn_platform_crm_mutate(root_id,org_id,lead_id,version,'{"stage":"Ganado","notas":"QA274 saved"}',false);
 if result#>>'{lead,stage}'<>'Ganado' or result#>>'{lead,notas}'<>'QA274 saved' then raise exception 'Update failed'; end if;
 begin
  perform fn_platform_crm_mutate(root_id,org_id,lead_id,'2000-01-01','{"name":"Stale write"}',false);
  raise exception 'Stale write accepted'; exception when serialization_failure then null;
 end;
 if exists(select 1 from qa274_profiles_before b join profiles p using(id) where b.snapshot is distinct from to_jsonb(p)) then raise exception 'Operator/tenant profile changed'; end if;
 if exists(select 1 from qa274_auth_before b join auth.users u using(id) where b.snapshot is distinct from to_jsonb(u)) then raise exception 'Auth identity/session metadata changed'; end if;
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.fn_platform_crm_read('a2740000-0000-4000-8000-000000000010','a2740000-0000-4000-8000-000000000003');
  raise exception 'Authenticated execution exposed'; exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: scoped CRM list/detail/create/update, assignment, notes, optimistic version, real actor audit and unchanged identities; QA rolled back' as result;
