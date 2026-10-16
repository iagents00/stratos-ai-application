import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('SQL directory safely reads all legacy Auth rows and diagnoses orphans without mutating identities or tickets', async () => {
  const db = new PGlite();
  const id = n => `27300000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const root=id(1), partner=id(2), legacy=id(3), orphan=id(4), missing=id(5), duke=id(10), partnerOrg=id(11);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
      create table organizations(id uuid primary key,name text,slug text,plan text,seats integer,active boolean,
        subscription_status text,meta_config jsonb,parent_organization_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),stripe_customer_id text);
      create table profiles(id uuid primary key,name text,role text,active boolean,organization_id uuid,
        updated_at timestamptz default now(),is_marketing_admin boolean,crm_only boolean,area text,recovery_email text,phone text);
      create table platform_admins(user_id uuid primary key,active boolean,scope_organization_id uuid,support_only boolean,company_limit integer);
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,last_sign_in_at timestamptz,
        raw_user_meta_data jsonb,raw_app_meta_data jsonb,encrypted_password text,confirmation_token text,recovery_token text,email_change text);
      create table auth_provisioning_tickets(token uuid primary key,email text,organization_id uuid,role text);
      grant usage on schema public,auth to anon,authenticated,service_role;
      alter table profiles enable row level security;
      alter table organizations enable row level security;
    `);
    const old = readFileSync('supabase/migrations/272_platform_global_management.sql','utf8');
    await db.exec(old.slice(old.indexOf('create or replace function public.fn_platform_assert_root_actor'),old.indexOf('-- También las altas')));
    await db.exec(readFileSync('supabase/migrations/273_platform_user_directory.sql','utf8'));
    for (const [org,name,meta] of [[duke,'Duke',{features:{mktModule:true},keep:'unchanged'}],[partnerOrg,'Partner',{platform:{kind:'partner'}}]]) {
      await db.query("insert into organizations(id,name,slug,plan,seats,active,meta_config,stripe_customer_id) values($1,$2,lower($2),'custom',100,true,$3,'never-export')",[org,name,JSON.stringify(meta)]);
    }
    await db.query("insert into profiles(id,name,role,active,organization_id,is_marketing_admin,crm_only,area,recovery_email,phone) values($1,'Root','super_admin',true,$4,false,false,null,'private-recovery@example.com','never-export'),($2,'Partner','super_admin',true,$5,false,false,null,null,null),($3,'Legacy Marketing','marketing',true,$4,true,false,'Marketing',null,null),($6,'Missing identity','asesor',false,$4,false,false,null,null,null)",[root,partner,legacy,duke,partnerOrg,missing]);
    await db.query("insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data,raw_app_meta_data,encrypted_password,confirmation_token,recovery_token,email_change) values($1,'root@example.com',now(),now(),'{\"secret\":\"never-export\"}','{\"secret\":\"never-export\"}','never-export','never-export','never-export','never-export'),($2,'partner@example.com',null,null,null,null,null,null,null,null),($3,'legacy@example.com',null,null,null,null,null,null,null,null),($4,'orphan@example.com',null,null,'{\"name\":\"Orphan identity\",\"secret\":\"never-export\"}',null,null,null,null,null)",[root,partner,legacy,orphan]);
    await db.query('insert into platform_admins values($1,true,null,false,null),($2,true,$3,true,10)',[root,partner,partnerOrg]);
    await db.query("insert into auth_provisioning_tickets values($1,'pending@example.com',$2,'marketing')",[id(20),duke]);
    // More than the REST row cap: a JSON aggregate must not silently truncate.
    await db.exec(`insert into auth.users(id,email) select ('27300000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,'legacy-'||n||'@example.com' from generate_series(1,1200) n`);
    await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
    const beforeUsers=(await db.query('select jsonb_agg(to_jsonb(u) order by id) snapshot from auth.users u')).rows[0].snapshot;
    const beforeTickets=(await db.query('select jsonb_agg(to_jsonb(t) order by token) snapshot from auth_provisioning_tickets t')).rows[0].snapshot;
    const list = async actor => (await db.query('select fn_platform_list_users($1) result',[actor])).rows[0].result;
    const directory=await list(root);
    assert.equal(directory.ok,true);
    assert.equal(directory.users.length,1205);
    assert.equal(directory.organizations.length,2);
    assert.ok(directory.organizations.some(row=>row.id===partnerOrg));
    assert.equal(directory.users.find(row=>row.id===root).protected_from_access_changes,true);
    assert.equal(directory.users.find(row=>row.id===partner).platform_admin.scope_organization_id,partnerOrg);
    const oldIdentity=directory.users.find(row=>row.id===legacy);
    assert.equal(oldIdentity.email,'legacy@example.com');
    assert.equal(oldIdentity.email_confirmed,false);
    assert.equal(oldIdentity.last_sign_in,null);
    assert.equal(oldIdentity.is_marketing_admin,true);
    assert.equal(oldIdentity.identity_missing,false);
    const orphanIdentity=directory.users.find(row=>row.id===orphan);
    assert.equal(orphanIdentity.name,'Orphan identity');
    assert.equal(orphanIdentity.profile_missing,true);
    assert.equal(orphanIdentity.organization_id,null);
    assert.equal(orphanIdentity.role,null);
    assert.equal(orphanIdentity.active,false);
    assert.equal(directory.users.find(row=>row.id===missing).identity_missing,true);
    assert.equal(directory.users.find(row=>row.id===missing).email,null);
    assert.equal(JSON.stringify(directory).includes('never-export'),false);
    assert.equal(JSON.stringify(directory).includes('private-recovery'),false);
    assert.deepEqual(await list(root),directory,'deterministic order and projection');
    assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(u) order by id) snapshot from auth.users u')).rows[0].snapshot,beforeUsers);
    assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(t) order by token) snapshot from auth_provisioning_tickets t')).rows[0].snapshot,beforeTickets);
    await assert.rejects(list(partner),/raíz activo/);
    await db.query('update profiles set active=false where id=$1',[root]);
    await assert.rejects(list(root),/raíz activo/);
    await db.query('update profiles set active=true where id=$1',[root]);
    for (const role of ['anon','authenticated']) {
      await db.query("select set_config('request.jwt.claim.role',$1,false)",[role]);
      await assert.rejects(list(root),/Sólo el servidor/);
      await db.exec(`set role ${role}`);
      await assert.rejects(list(root),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec("select set_config('request.jwt.claim.role','service_role',false); set role service_role");
    assert.equal((await list(root)).users.length,1205);
  } finally { await db.close(); }
});
