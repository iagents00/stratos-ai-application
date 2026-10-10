-- Prueba transaccional: todas las filas QA y cambios se revierten.
-- Ejecutar con postgres después de instalar 266. No crea sesiones ni envía mensajes.
begin;
set local statement_timeout = '30s';
select set_config('request.jwt.claim.role','service_role',true);
insert into organizations(id,name,slug) values ('a6600000-0000-4000-8000-000000000001','QA rollback root','qa-rollback-root-266');
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('a6600000-0000-4000-8000-000000000002','qa-root-266@example.invalid','{"stratos_organization_id":"a6600000-0000-4000-8000-000000000001","stratos_role":"super_admin"}','{"name":"QA rollback"}');
insert into platform_admins(user_id,active,support_only) values('a6600000-0000-4000-8000-000000000002',true,false);
select fn_provision_company('a6600000-0000-4000-8000-000000000002','a6600000-0000-4000-8000-000000000003','QA rollback Alpha','qa-rollback-alpha-266',1,'{"teamAdmin":true,"mktModule":false,"comandoDirectivo":false}');
select fn_provision_company('a6600000-0000-4000-8000-000000000002','a6600000-0000-4000-8000-000000000004','QA rollback Beta','qa-rollback-beta-266',2,'{"teamAdmin":true,"mktModule":false,"comandoDirectivo":false}');
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('a6600000-0000-4000-8000-000000000005','qa-alpha-266@example.invalid','{"stratos_organization_id":"a6600000-0000-4000-8000-000000000003","stratos_role":"admin"}','{"name":"QA rollback"}'),
('a6600000-0000-4000-8000-000000000006','qa-beta-266@example.invalid','{"organization_id":"a6600000-0000-4000-8000-000000000004","role":"admin"}','{"name":"QA rollback"}');
do $$ declare v jsonb; begin
 if (select count(*) from organizations where slug like 'qa-rollback-%-266') <> 3 then raise exception 'Unexpected organization count'; end if;
 if not exists(select 1 from profiles where id='a6600000-0000-4000-8000-000000000005' and organization_id='a6600000-0000-4000-8000-000000000003' and role='admin') then raise exception 'Wrong tenant'; end if;
 v:=fn_provision_company('a6600000-0000-4000-8000-000000000002','a6600000-0000-4000-8000-000000000003','QA rollback Alpha','qa-rollback-alpha-266',1,'{"teamAdmin":true,"mktModule":false,"comandoDirectivo":false}');
 if v->>'replayed' <> 'true' then raise exception 'Retry not idempotent'; end if;
 begin
  insert into auth.users(id,email,raw_app_meta_data) values('a6600000-0000-4000-8000-000000000007','qa-full-266@example.invalid','{"stratos_organization_id":"a6600000-0000-4000-8000-000000000003","stratos_role":"asesor"}');
  raise exception 'Quota allowed unexpected user';
 exception when check_violation then null; end;
 if exists(select 1 from auth.users where id='a6600000-0000-4000-8000-000000000007') then raise exception 'Auth did not rollback'; end if;
 if exists(select 1 from organizations where id in ('a6600000-0000-4000-8000-000000000003','a6600000-0000-4000-8000-000000000004') and meta_config#>>'{features,procesoGuiado}' is distinct from 'false') then raise exception 'Rails enabled'; end if;
end $$;
insert into leads(name,organization_id) values ('QA rollback Alpha','a6600000-0000-4000-8000-000000000003'),('QA rollback Beta','a6600000-0000-4000-8000-000000000004');
select set_config('request.jwt.claim.sub','a6600000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare n integer; begin
 if (select count(*) from leads) <> 1 then raise exception 'Lead RLS leaked or hid tenant'; end if;
 if exists(select 1 from profiles where organization_id <> 'a6600000-0000-4000-8000-000000000003') then raise exception 'Profile RLS leak'; end if;
 if (select count(*) from organizations) <> 1 then raise exception 'Organization RLS leak'; end if;
 begin
 if exists(select 1 from temporary_login_credentials) then raise exception 'Credential RLS leak'; end if;
 exception when insufficient_privilege then null; end;
 begin
 if exists(select 1 from platform_admins) then raise exception 'Platform RLS leak'; end if;
 exception when insufficient_privilege then null; end;
 update leads set name='forbidden' where organization_id='a6600000-0000-4000-8000-000000000004';
 get diagnostics n=row_count; if n<>0 then raise exception 'Cross tenant update'; end if;
 begin
 insert into leads(name,organization_id) values ('forbidden','a6600000-0000-4000-8000-000000000004');
 raise exception 'Cross tenant insert'; exception when insufficient_privilege then null; end;
 begin
 update organizations set seats=100 where id='a6600000-0000-4000-8000-000000000003';
 raise exception 'Tenant changed quota'; exception when insufficient_privilege then null; end;
 update profiles set organization_id='a6600000-0000-4000-8000-000000000004',role='super_admin' where id=auth.uid();
 if exists(select 1 from profiles where id=auth.uid() and (organization_id<>'a6600000-0000-4000-8000-000000000003' or role<>'admin')) then raise exception 'Self escalation'; end if;
 begin
 perform fn_provision_company(auth.uid(),gen_random_uuid(),'Forbidden','forbidden',1,'{}');
 raise exception 'RPC exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: company, Auth, quota, retry, RLS and privilege checks; all QA rows rolled back' as result;
