-- Run only against stratos-prod after migration 272. Every QA row/change rolls
-- back. No real account is edited, no password/session is created, no email sent.
begin;
set local statement_timeout = '30s';
select set_config('request.jwt.claim.role','service_role',true);
insert into public.organizations(id,name,slug,seats,meta_config) values
 ('a2720000-0000-4000-8000-000000000001','QA272 operator','qa-rollback-operator-272',5,'{"custom":{"keep":true},"features":{"procesoGuiado":false}}'),
 ('a2720000-0000-4000-8000-000000000002','QA272 source','qa-rollback-source-272',5,'{"custom":{"keep":true},"features":{"mktModule":true,"procesoGuiado":false}}'),
 ('a2720000-0000-4000-8000-000000000003','QA272 destination','qa-rollback-destination-272',1,'{}'),
 ('a2720000-0000-4000-8000-000000000004','QA272 partner','qa-rollback-partner-272',5,'{"platform":{"kind":"partner"}}');
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('a2720000-0000-4000-8000-000000000010','qa-root-272@example.invalid','{"stratos_organization_id":"a2720000-0000-4000-8000-000000000001","stratos_role":"super_admin"}','{"name":"QA root272"}'),
 ('a2720000-0000-4000-8000-000000000011','qa-admin-272@example.invalid','{"stratos_organization_id":"a2720000-0000-4000-8000-000000000002","stratos_role":"admin"}','{"name":"QA admin272"}'),
 ('a2720000-0000-4000-8000-000000000012','qa-marketing-272@example.invalid','{"stratos_organization_id":"a2720000-0000-4000-8000-000000000002","stratos_role":"marketing","keep":"unchanged"}','{"name":"QA marketing272","keep":"unchanged"}'),
 ('a2720000-0000-4000-8000-000000000013','qa-advisor-272@example.invalid','{"stratos_organization_id":"a2720000-0000-4000-8000-000000000002","stratos_role":"asesor"}','{"name":"QA advisor272"}'),
 ('a2720000-0000-4000-8000-000000000014','qa-partner-272@example.invalid','{"stratos_organization_id":"a2720000-0000-4000-8000-000000000004","stratos_role":"super_admin"}','{"name":"QA partner272"}');
insert into public.platform_admins(user_id,active,scope_organization_id,support_only) values
 ('a2720000-0000-4000-8000-000000000010',true,null,false),
 ('a2720000-0000-4000-8000-000000000014',true,'a2720000-0000-4000-8000-000000000004',true);

do $$
declare
 v_actor uuid := 'a2720000-0000-4000-8000-000000000010';
 v_partner uuid := 'a2720000-0000-4000-8000-000000000014';
 v_user uuid := 'a2720000-0000-4000-8000-000000000012';
 v_source uuid := 'a2720000-0000-4000-8000-000000000002';
 v_target uuid := 'a2720000-0000-4000-8000-000000000003';
 v_version timestamptz; v jsonb; v_prior timestamptz;
begin
 select updated_at into v_version from profiles where id=v_user;
 begin
  perform fn_platform_update_user(v_partner,v_user,v_version,'Forbidden','marketing',true,v_source,false,false,'Marketing',false);
  raise exception 'Partner gained root rights'; exception when insufficient_privilege then null;
 end;
 begin
  perform fn_platform_update_user(v_actor,v_user,'2000-01-01','Stale','marketing',true,v_source,false,false,'Marketing',false);
  raise exception 'Stale version accepted'; exception when serialization_failure then null;
 end;
 begin
  perform fn_platform_update_user(v_actor,v_user,v_version,'QA marketing272','marketing',true,v_target,false,false,'Marketing',false);
  raise exception 'Unconfirmed movement accepted'; exception when invalid_parameter_value then null;
 end;
 v := fn_platform_update_user(v_actor,v_user,v_version,'QA marketing272','marketing',true,v_target,true,false,'Marketing',true);
 if v#>>'{user,organization_id}' <> v_target::text or v->>'audit_saved'<>'true' then raise exception 'Move/audit failed'; end if;
 if not exists(select 1 from auth.users where id=v_user and raw_app_meta_data->>'keep'='unchanged' and raw_user_meta_data->>'keep'='unchanged'
   and raw_app_meta_data->>'stratos_organization_id'=v_target::text) then raise exception 'Auth metadata overwritten'; end if;
 if not exists(select 1 from audit_log where actor_id=v_actor and entity_id=v_user
   and metadata->>'operation'='PLATFORM_USER_UPDATED' and metadata->>'business_data_moved'='false') then raise exception 'Missing real actor audit'; end if;
 begin
  perform fn_platform_update_user(v_actor,'a2720000-0000-4000-8000-000000000013',
   (select updated_at from profiles where id='a2720000-0000-4000-8000-000000000013'),'QA advisor272','asesor',true,v_target,false,false,null,true);
  raise exception 'Full destination allowed another active account'; exception when check_violation then null;
 end;
 begin
  perform fn_platform_update_user(v_actor,'a2720000-0000-4000-8000-000000000011',
   (select updated_at from profiles where id='a2720000-0000-4000-8000-000000000011'),'QA admin272','asesor',true,v_source,false,false,null,false);
  raise exception 'Last admin demoted'; exception when check_violation then null;
 end;
 begin
  perform fn_platform_update_user(v_actor,v_actor,(select updated_at from profiles where id=v_actor),'QA root272','asesor',true,
    'a2720000-0000-4000-8000-000000000001',false,false,null,false);
  raise exception 'Operator changed own access'; exception when insufficient_privilege then null;
 end;
 begin
  perform fn_platform_update_company(v_actor,'a2720000-0000-4000-8000-000000000001',
   (select updated_at from organizations where id='a2720000-0000-4000-8000-000000000001'),'QA272 operator',5,false);
  raise exception 'Operator organization disabled'; exception when insufficient_privilege then null;
 end;
 v:=fn_platform_update_company(v_actor,v_source,(select updated_at from organizations where id=v_source),'QA272 renamed',6,true);
 if v#>>'{organization,slug}'<>'qa-rollback-source-272' or v#>>'{organization,meta_config,custom,keep}'<>'true'
   or v#>>'{organization,meta_config,features,procesoGuiado}'<>'false' then raise exception 'Historical configuration changed'; end if;
 update auth.users set banned_until=now()+interval '1 day' where id=v_user returning banned_until into v_prior;
 perform fn_platform_update_user(v_actor,v_user,(select updated_at from profiles where id=v_user),'QA marketing272','marketing',false,v_target,true,false,'Marketing',false);
 if not exists(select 1 from auth.users where id=v_user and banned_until>now()+interval '99 years') then raise exception 'Auth disable ban absent'; end if;
 perform fn_platform_update_user(v_actor,v_user,(select updated_at from profiles where id=v_user),'QA marketing272','marketing',true,v_target,true,false,'Marketing',false);
 if not exists(select 1 from auth.users where id=v_user and banned_until=v_prior) then raise exception 'Previous ban not preserved'; end if;
 perform fn_platform_update_user(v_actor,v_user,(select updated_at from profiles where id=v_user),'QA marketing272','marketing',false,v_target,true,false,'Marketing',false);
end $$;

select set_config('request.jwt.claim.sub','a2720000-0000-4000-8000-000000000012',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
 if current_organization_id() is not null or current_user_name() is not null or is_admin_or_above() or is_marketing_or_above() then
  raise exception 'Inactive JWT retained effective tenant/role';
 end if;
 begin
  perform fn_platform_require_active_actor();
  raise exception 'Inactive JWT bypassed pre-request hook'; exception when insufficient_privilege then null;
 end;
 begin
  perform fn_platform_update_company('a2720000-0000-4000-8000-000000000010','a2720000-0000-4000-8000-000000000002',now(),'Forbidden',6,true);
  raise exception 'Authenticated RPC exposed'; exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
select fn_platform_require_active_actor();
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select fn_platform_require_active_actor();
do $$ begin
 begin
  perform fn_platform_update_company('a2720000-0000-4000-8000-000000000010','a2720000-0000-4000-8000-000000000002',now(),'Forbidden',6,true);
  raise exception 'Anonymous RPC exposed'; exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: root/partner/anon controls, move, licenses, last admin, Auth, audit and historical configuration; QA rolled back' as result;
