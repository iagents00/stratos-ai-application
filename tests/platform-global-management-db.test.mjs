import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('global management is root-only, audited, capacity-safe and preserves tenant data', async () => {
  const db = new PGlite();
  const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const root = id(1), partner = id(2), duke = id(3), nsg = id(4), partnerOrg = id(5), target = id(6);
  const admin = id(10), colleague = id(11), advisor = id(12), marketer = id(13);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role; create role authenticator;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
      create table organizations(id uuid primary key, name text, slug text unique, seats integer, active boolean default true,
        updated_at timestamptz default now(), meta_config jsonb default '{}', parent_organization_id uuid);
      create table profiles(id uuid primary key, name text, role text, active boolean default true, organization_id uuid references organizations,
        updated_at timestamptz default now(), is_marketing_admin boolean default false, crm_only boolean default false, area text, telegram_chat_id bigint);
      create table platform_admins(user_id uuid primary key, active boolean default true, scope_organization_id uuid);
      create table auth.users(id uuid primary key, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', banned_until timestamptz);
      create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users);
      create table audit_log(id uuid primary key default gen_random_uuid(), actor_id uuid, organization_id uuid, entity_type text,
        entity_id uuid, action text check(action in ('INSERT','UPDATE','DELETE','SOFT_DELETE','LOGIN','LOGIN_FAIL','LOGOUT','SIGNUP','PASSWORD_RESET')), changed_fields jsonb, metadata jsonb);
      create table temporary_login_credentials(user_id uuid primary key, organization_id uuid);
      create table company_module_permissions(organization_id uuid, principal_type text, principal_id text, decision text, changed_by uuid, changed_at timestamptz);
      create table leads(id uuid primary key, organization_id uuid, asesor_id uuid, name text, action_history jsonb, asesor_name text);
      alter table profiles enable row level security;
      alter table leads enable row level security;
      create table device_tokens(user_id uuid primary key, token text);
      alter table device_tokens enable row level security;
      create policy qa_device_own on device_tokens for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      grant select,insert on device_tokens to authenticated;
      create table bot_pending_actions(id uuid default gen_random_uuid(), asesor_id uuid, telegram_chat_id bigint, consumed_at timestamptz, expires_at timestamptz);
      create table bot_pending_confirm(telegram_chat_id bigint primary key);
      create table n8n_chat_histories(id integer primary key, session_id text, created_at timestamptz default now(), message jsonb);
      create table tg_bot_activity(id bigint primary key, telegram_chat_id bigint, organization_id uuid, created_at timestamptz default now(), role text, content text, media_path text, media_type text, meta jsonb);
      create function _copilot_msg_same(a text,b text) returns boolean language sql immutable as $$select a=b$$;
      grant usage on schema public,auth to anon, authenticated, service_role;
    `);
    const historical = { features: { mktModule: true, procesoGuiado: false }, custom: { keep: 'exactly' }, setup_history: [{ event: 'legacy' }] };
    for (const [org, name, seats, meta] of [[duke, 'Duke', 100, historical], [nsg, 'NSG', 5, {}], [partnerOrg, 'Partner', 5, { platform: { kind: 'partner' } }], [target, 'Target', 2, {}]]) {
      await db.query('insert into organizations(id,name,slug,seats,meta_config) values($1,$2,$3,$4,$5)', [org, name, name.toLowerCase(), seats, JSON.stringify(meta)]);
    }
    for (const [user, name, role, org] of [[root, 'Root', 'super_admin', duke], [partner, 'Partner', 'super_admin', partnerOrg], [admin, 'Admin', 'admin', nsg], [colleague, 'Colleague', 'admin', nsg], [advisor, 'Advisor', 'asesor', nsg], [marketer, 'Marketing', 'marketing', duke]]) {
      await db.query('insert into profiles(id,name,role,organization_id) values($1,$2,$3,$4)', [user, name, role, org]);
      await db.query('insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values($1,$2,$3)', [user, JSON.stringify({ providers: ['email'], foreign_key: 'keep', stratos_organization_id: org, stratos_role: role }), JSON.stringify({ name, theme: 'keep' })]);
    }
    await db.query('insert into platform_admins(user_id,scope_organization_id) values($1,null),($2,$3)', [root, partner, partnerOrg]);
    await db.exec(readFileSync('supabase/migrations/272_platform_global_management.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/272_platform_global_management.sql', 'utf8'));
    assert.equal((await db.query("select count(*)::int n from pg_policies where tablename='device_tokens' and policyname='stratos_platform_active_actor'")).rows[0].n, 1, 'idempotent guards preserve an explicit policy on available tables');
    await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
    const get = async user => (await db.query('select * from profiles where id=$1', [user])).rows[0];
    const change = async (user, patch = {}, actor = root, expected) => {
      const person = await get(user);
      const value = { ...person, confirm_move: false, ...patch };
      return (await db.query('select fn_platform_update_user($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) result', [actor, user, expected || person.updated_at, value.name, value.role, value.active, value.organization_id, value.is_marketing_admin, value.crm_only, value.area, value.confirm_move])).rows[0].result;
    };
    const company = async (org, patch = {}, actor = root, expected) => {
      const before = (await db.query('select * from organizations where id=$1', [org])).rows[0];
      const value = { ...before, ...patch };
      return (await db.query('select fn_platform_update_company($1,$2,$3,$4,$5,$6) result', [actor, org, expected || before.updated_at, value.name, value.seats, value.active])).rows[0].result;
    };
    await assert.rejects(change(marketer, { name: 'Forged' }, partner), /raíz activo/);
    await assert.rejects(company(duke, { name: 'Forged' }, partner), /raíz activo/);
    await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
    await assert.rejects(change(marketer, { name: 'Forged' }), /Sólo el servidor/);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select fn_platform_update_company($1,$2,now(),\'Forged\',100,true)', [root, duke]), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
    await assert.rejects(change(root, { active: false }), /propia cuenta/);
    await assert.rejects(change(partner, { organization_id: duke, confirm_move: true }), /operador de plataforma/);
    await assert.rejects(company(duke, { active: false }), /operadores de plataforma/);
    await assert.rejects(company(partnerOrg, { active: false }), /operadores de plataforma/);
    const nominal = await change(root, { name: 'Root Operator', area: 'Administración' });
    assert.equal(nominal.audit_saved, true);
    const marketing = await change(marketer, { is_marketing_admin: true, area: 'Marketing' });
    assert.equal(marketing.user.is_marketing_admin, true);
    await assert.rejects(change(marketer, { crm_only: true }), /rol compatible/);
    await assert.rejects(change(marketer, { role: 'contabilidad' }), /inválidos/);
    const savedAt = (await get(advisor)).updated_at;
    await change(advisor, { name: 'Updated Advisor' });
    await assert.rejects(change(advisor, { name: 'Lost update' }, root, savedAt), /usuario cambió/);
    await assert.rejects(change(advisor, { organization_id: target }), /Confirma/);
    await db.query('update profiles set telegram_chat_id=272001 where id=$1', [advisor]);
    await db.query('insert into bot_pending_actions(asesor_id,telegram_chat_id,expires_at) values($1,272001,now()+interval \'10 minutes\')', [advisor]);
    await assert.rejects(change(advisor, { organization_id: target, confirm_move: true }), /acciones pendientes de Telegram/);
    await db.exec('delete from bot_pending_actions');
    await db.exec('insert into bot_pending_confirm values(272001)');
    await assert.rejects(change(advisor, { organization_id: target, confirm_move: true }), /confirmación pendiente de Telegram/);
    await db.exec('delete from bot_pending_confirm');
    await db.query("insert into tg_bot_activity(id,telegram_chat_id,organization_id,role,content) values(1,272001,$1,'assistant','Source business history'),(2,272001,$2,'assistant','Destination business history')", [nsg, target]);
    await db.exec("insert into tg_bot_activity(id,telegram_chat_id,organization_id,role,content) values(3,272001,null,'assistant','Legacy business history')");
    await db.exec("insert into n8n_chat_histories(id,session_id,message) values(1,'tg:272001','{\"type\":\"ai\",\"content\":\"Legacy source business\"}')");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [advisor]);
    assert.deepEqual((await db.query('select content from get_my_copilot_activity()')).rows, [{ content: 'Legacy business history' }, { content: 'Source business history' }]);
    assert.equal((await db.query('select count(*)::int n from get_my_telegram_activity()')).rows[0].n, 1);
    await db.query('insert into leads(id,organization_id,asesor_id,name,action_history) values($1,$2,$3,\'Original client\',\'[{"keep":true}]\')', [id(20), nsg, advisor]);
    await db.query('insert into temporary_login_credentials values($1,$2)', [advisor, nsg]);
    await db.query('insert into auth.sessions(user_id) values($1)', [advisor]);
    await db.query("insert into company_module_permissions values($1,'user',$2,'allow',null,null)", [nsg, advisor]);
    await db.query("insert into company_module_permissions values($1,'user',$2,'allow',null,null)", [target, advisor]);
    const moved = await change(advisor, { organization_id: target, confirm_move: true });
    assert.equal(moved.user.organization_id, target);
    assert.deepEqual((await db.query('select content from get_my_copilot_activity()')).rows, [{ content: 'Destination business history' }]);
    assert.equal((await db.query('select count(*)::int n from get_my_telegram_activity()')).rows[0].n, 0);
    await db.exec("insert into n8n_chat_histories(id,session_id,message) values(2,'tg:272001','{\"type\":\"ai\",\"content\":\"New source message after movement\"}')");
    assert.equal((await db.query('select count(*)::int n from get_my_telegram_activity()')).rows[0].n, 0, 'old Telegram binding cannot reveal later source messages either');
    assert.equal((await db.query('select count(*)::int n from tg_bot_activity where organization_id=$1', [nsg])).rows[0].n, 1);
    assert.equal((await db.query('select organization_id from leads where id=$1', [id(20)])).rows[0].organization_id, nsg);
    assert.deepEqual((await db.query('select action_history from leads where id=$1', [id(20)])).rows[0].action_history, [{ keep: true }]);
    assert.equal((await db.query('select count(*)::int n from temporary_login_credentials where user_id=$1', [advisor])).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int n from auth.sessions where user_id=$1', [advisor])).rows[0].n, 0);
    assert.ok((await db.query('select decision from company_module_permissions where principal_id=$1', [advisor])).rows.every(row => row.decision === 'inherit'), 'source and destination user overrides do not survive a move');
    const auth = (await db.query('select * from auth.users where id=$1', [advisor])).rows[0];
    assert.equal(auth.raw_app_meta_data.stratos_organization_id, target);
    assert.equal(auth.raw_app_meta_data.foreign_key, 'keep');
    assert.equal(auth.raw_user_meta_data.theme, 'keep');
    await change(admin, { role: 'asesor' });
    await assert.rejects(change(colleague, { active: false }), /administrador activo/);
    await assert.rejects(change(colleague, { organization_id: target, confirm_move: true }), /administrador activo/);
    await change(marketer, { organization_id: target, confirm_move: true });
    await assert.rejects(change(admin, { organization_id: target, confirm_move: true }), /licencias/);
    await assert.rejects(company(target, { seats: 1 }), /usuarios activos/);
    await company(target, { active: false });
    await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [marketer]);
    const originalBan = (await db.query('select banned_until from auth.users where id=$1', [marketer])).rows[0].banned_until;
    await change(marketer, { active: false });
    assert.equal((await db.query("select raw_app_meta_data->>'stratos_platform_disabled' disabled from auth.users where id=$1", [marketer])).rows[0].disabled, 'true');
    await assert.rejects(change(marketer, { active: true }), /destino no está activa/);
    await company(target, { active: true });
    await change(marketer, { active: true });
    assert.equal((await db.query('select banned_until from auth.users where id=$1', [marketer])).rows[0].banned_until.toISOString(), originalBan.toISOString(), 'reactivation preserves an unrelated prior Auth ban');
    await change(marketer, { active: false });
    await db.query("update auth.users set banned_until=now()+interval '2 days' where id=$1", [marketer]);
    const externalBan = (await db.query('select banned_until from auth.users where id=$1', [marketer])).rows[0].banned_until;
    await change(marketer, { active: true });
    assert.equal((await db.query('select banned_until from auth.users where id=$1', [marketer])).rows[0].banned_until.toISOString(), externalBan.toISOString(), 'reactivation never overrides a later external Auth ban');
    const beforeOrg = (await db.query('select * from organizations where id=$1', [duke])).rows[0];
    const changedOrg = await company(duke, { name: 'Duke Inmobiliaria', seats: 101 });
    assert.deepEqual(changedOrg.organization.meta_config, historical);
    assert.equal(changedOrg.organization.slug, 'duke');
    await assert.rejects(company(duke, { name: 'Lost change' }, root, beforeOrg.updated_at), /empresa cambió/);
    const audit = (await db.query("select * from audit_log where action='UPDATE' and metadata->>'operation'='PLATFORM_USER_UPDATED' and entity_id=$1 and metadata->>'moved'='true'", [advisor])).rows[0];
    assert.equal(audit.actor_id, root);
    assert.equal(audit.changed_fields.before.organization_id, nsg);
    assert.equal(audit.changed_fields.after.organization_id, target);
    assert.equal(audit.metadata.business_data_moved, false);
    // The actual tenant policies continue to apply, including to a root
    // operator using a browser JWT. Cross-tenant management stays server-side.
    await db.exec(`
      alter table profiles enable row level security;
      alter table leads enable row level security;
      grant select on profiles,leads to authenticated;
      create table mkt_daily_reports(id uuid primary key, organization_id uuid);
      alter table mkt_daily_reports enable row level security;
      grant select on mkt_daily_reports to authenticated;
      create policy qa_mkt_select on mkt_daily_reports for select to authenticated
        using(organization_id=current_organization_id() and is_marketing_or_above());
    `);
    const policies = readFileSync('supabase/migrations/005_multi_tenant_scale.sql', 'utf8');
    await db.exec(policies.slice(policies.indexOf('CREATE POLICY "profiles_select_org"'), policies.indexOf('-- ── AUDIT_LOG')));
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [root]);
    await db.exec("select set_config('request.jwt.claim.role','authenticated',false); set role authenticated");
    assert.deepEqual((await db.query('select distinct organization_id from profiles')).rows, [{ organization_id: duke }]);
    await db.exec('reset role');
    await db.query("insert into leads(id,organization_id,asesor_name,name) values($1,$2,'Marketing','Target lead')", [id(21), target]);
    await db.query('insert into mkt_daily_reports values($1,$2)', [id(22), target]);
    await db.query("insert into device_tokens values($1,'private-token')", [marketer]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [marketer]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select count(*)::int n from mkt_daily_reports')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int n from device_tokens')).rows[0].n, 1);
    await db.query('select fn_platform_require_active_actor()');
    await db.exec("reset role; select set_config('request.jwt.claim.role','service_role',false)");
    await change(marketer, { active: false });
    // Keep the SAME JWT subject/role to model an access token already issued.
    await db.exec("select set_config('request.jwt.claim.role','authenticated',false); set role authenticated");
    assert.deepEqual((await db.query('select current_organization_id() org,current_user_name() name,is_admin_or_above() admin,is_marketing_or_above() marketing')).rows[0], { org: null, name: null, admin: false, marketing: false });
    assert.equal((await db.query('select count(*)::int n from leads')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int n from mkt_daily_reports')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int n from device_tokens')).rows[0].n, 0);
    await assert.rejects(db.query('select fn_platform_require_active_actor()'), /cuenta está desactivada/);
    await assert.rejects(db.query("insert into device_tokens values($1,'forged-token')", [marketer]), /row-level security/);
    await db.exec('reset role');
    for (const role of ['anon','service_role']) {
      await db.query("select set_config('request.jwt.claim.role',$1,false)", [role]);
      await db.exec(`set role ${role}`);
      await db.query('select fn_platform_require_active_actor()');
      await db.exec('reset role');
    }
    await db.exec("alter role authenticator set pgrst.db_pre_request='public.external_hook'");
    await assert.rejects(db.exec(readFileSync('supabase/migrations/272_platform_global_management.sql', 'utf8')), /Ya existe un hook/);
    // Required audit failure rolls back profile AND Auth identity changes.
    await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
    await db.exec("alter table audit_log add constraint reject_qa check(metadata->>'operation' <> 'PLATFORM_USER_UPDATED') not valid");
    const prior = await get(advisor);
    await assert.rejects(change(advisor, { name: 'Should roll back' }), /reject_qa/);
    assert.deepEqual(await get(advisor), prior);
    assert.equal((await db.query('select raw_user_meta_data->>\'name\' name from auth.users where id=$1', [advisor])).rows[0].name, prior.name);
  } finally { await db.close(); }
});
