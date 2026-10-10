import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('company provisioning, auth assignment and database guards isolate tenants', async () => {
 const db = new PGlite();
 const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const root=id(1), partner=id(2), parent=id(3), duke=id(4), nsg=id(5), a=id(6), b=id(7);
 try {
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
   create table public.organizations(id uuid primary key default gen_random_uuid(), name text, slug text unique, seats integer default 5, plan text, active boolean default true, subscription_status text, meta_config jsonb default '{}', parent_organization_id uuid, trial_ends_at timestamptz);
   create table public.profiles(id uuid primary key, name text, role text, organization_id uuid references organizations(id), active boolean default true, recovery_email text, crm_only boolean default false, is_marketing_admin boolean default false, area text);
   create table public.platform_admins(user_id uuid primary key, active boolean default true, scope_organization_id uuid, company_limit integer, support_only boolean default true);
   create table public.platform_admin_events(id uuid default gen_random_uuid(), event_type text,actor_user_id uuid,partner_organization_id uuid,organization_id uuid,payload jsonb,notification_status text);
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
   grant usage on schema public,auth to anon,authenticated,service_role;
  `);
  await db.exec(readFileSync('supabase/migrations/247_managed_company_limits.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/266_company_provisioning_isolation.sql','utf8'));
  await db.exec('create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()');
  for(const [org,name] of [[parent,'Partner'],[duke,'Duke'],[nsg,'NSG']]) await db.query('insert into organizations(id,name,slug) values($1,$2,$3)',[org,name,name.toLowerCase()]);
  await db.query('insert into platform_admins(user_id,scope_organization_id,company_limit) values($1,null,null),($2,$3,1)',[root,partner,parent]);
  await db.query('insert into profiles(id,name,role,organization_id) values($1,\'Root\',\'super_admin\',$3),($2,\'Partner\',\'super_admin\',$3)',[root,partner,parent]);
  await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
  const features={teamAdmin:true,mktModule:false,comandoDirectivo:false};
  const provision=(actor,request,name,seats=2,f=features)=>db.query('select fn_provision_company($1,$2,$3,$4,$5,$6::jsonb) result',[actor,request,name,name.toLowerCase(),seats,JSON.stringify(f)]);
  await provision(root,a,'Alpha'); await provision(partner,b,'Beta',1);
  assert.equal((await db.query('select parent_organization_id from organizations where id=$1',[b])).rows[0].parent_organization_id,parent);
  assert.equal((await provision(partner,b,'Beta',1)).rows[0].result.replayed,true,'retry must succeed at quota without creating duplicates');
  await assert.rejects(provision(partner,id(8),'Third'),/cupo/);
  await assert.rejects(provision(partner,a,'Alpha'),/otro operador/);
  await assert.rejects(provision(root,a,'Renamed'),/otros datos/);
  await assert.rejects(provision(root,id(8),'Third',0),/licencias/);
  await assert.rejects(provision(root,id(8),'Third',2,{...features,procesoGuiado:true}),/Módulos/);
  assert.equal((await db.query('select count(*)::int n from platform_admin_events')).rows[0].n,2,'one durable event per company, including root');
  const newAuth=async(user,org,role,meta={})=>db.query('insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3::jsonb,$4::jsonb)',[user,`${user}@example.com`,JSON.stringify({name:'Test',...meta}),JSON.stringify(org?{stratos_organization_id:org,stratos_role:role}:{})]);
  const before=(await db.query('select count(*)::int n from organizations')).rows[0].n;
  await newAuth(id(10),a,'admin',{organization_id:duke,role:'super_admin'});
  await newAuth(id(11),b,'admin');
  assert.equal((await db.query('select count(*)::int n from organizations')).rows[0].n,before,'Auth provisioning must not create phantom organizations');
  assert.deepEqual((await db.query('select organization_id,role from profiles where id=$1',[id(10)])).rows[0],{organization_id:a,role:'admin'});
  await assert.rejects(newAuth(id(12),b,'asesor'),/licencias/);
  assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[id(12)])).rows[0].n,0,'Auth creation rolls back when no license remains');
  await newAuth(id(13),null,null,{organization_id:duke,role:'super_admin'});
  const forged=(await db.query('select organization_id,role from profiles where id=$1',[id(13)])).rows[0];
  assert.notEqual(forged.organization_id,duke); assert.equal(forged.role,'admin');
  await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(10)]);
  await assert.rejects(db.query('update profiles set organization_id=$1 where id=$2',[duke,id(10)]),/cambiar de empresa/);
  await assert.rejects(db.query("update profiles set role='super_admin' where id=$1",[id(10)]),/propio rol/);
  await assert.rejects(db.query('update organizations set seats=100 where id=$1',[a]),/licencias/);
  await assert.rejects(provision(root,id(14),'Forged'),/Sólo el servidor/);
  await db.exec('set role authenticated');
  await assert.rejects(provision(root,id(14),'Forged'),/permission denied/);
  await db.exec('reset role');
  // Execute repository RLS policies, not mocks. Fixtures include Duke, NSG and
  // two newly provisioned clients, with equal advisor names across tenants.
  await db.exec(`
   create function current_organization_id() returns uuid language sql security definer stable as $$select organization_id from profiles where id=auth.uid()$$;
   create function is_admin_or_above() returns boolean language sql security definer stable as $$select role in ('admin','super_admin','director','ceo') from profiles where id=auth.uid()$$;
   create function current_user_name() returns text language sql security definer stable as $$select name from profiles where id=auth.uid()$$;
   create table leads(id uuid primary key,organization_id uuid not null,name text,asesor_name text);
   alter table profiles enable row level security; alter table leads enable row level security;
   grant select,update on profiles to authenticated; grant select,insert,update on leads to authenticated;
  `);
  const policies=readFileSync('supabase/migrations/005_multi_tenant_scale.sql','utf8');
  await db.exec(policies.slice(policies.indexOf('CREATE POLICY "profiles_select_org"'),policies.indexOf('-- ── AUDIT_LOG')));
  for(const org of [duke,nsg,a,b]) await db.query('insert into leads values($1,$2,$3,\'Test\')',[org,org,'Lead']);
  await db.exec('set role authenticated');
  assert.deepEqual((await db.query('select organization_id from leads')).rows,[{organization_id:a}]);
  assert.deepEqual((await db.query('select distinct organization_id from profiles')).rows,[{organization_id:a}]);
  await assert.rejects(db.query('insert into leads values($1,$2,\'Forged\',\'Test\')',[id(20),nsg]),/row-level security/);
  assert.equal((await db.query("update leads set name='Forged' where organization_id=$1 returning id",[duke])).rows.length,0);
  await db.exec('reset role');
  const rails=(await db.query("select meta_config #>> '{features,procesoGuiado}' as enabled from organizations where id=$1",[a])).rows[0];
  assert.equal(rails.enabled,'false');
 } finally { await db.close(); }
});
