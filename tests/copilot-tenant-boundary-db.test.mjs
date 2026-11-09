import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Copilot and push require the authenticated owner; service writes cannot cross tenants',async()=>{
 const db=new PGlite();
 const a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002';
 const u='20000000-0000-4000-8000-000000000001', v='20000000-0000-4000-8000-000000000002';
 const lead='30000000-0000-4000-8000-000000000001';
 const one=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create table organizations(id uuid primary key,active boolean default true);
   create table profiles(id uuid primary key,organization_id uuid,telegram_chat_id bigint,active boolean default true);
   create table leads(id uuid primary key,organization_id uuid);
   create table proactive_reminders(id uuid default gen_random_uuid(),organization_id uuid,asesor_id uuid,lead_id uuid,status text);
   create table tg_bot_activity(id bigint generated always as identity,organization_id uuid,telegram_chat_id bigint,role text,content text,created_at timestamptz default now(),media_path text,media_type text,meta jsonb);
   create table push_secure_config(key text primary key,value text);
   create table push_subscriptions(user_id uuid,endpoint text,p256dh text,auth text,platform text,updated_at timestamptz,unique(user_id,endpoint));
   create function current_organization_id() returns uuid language sql stable as $$ select organization_id from profiles where id=auth.uid() $$;
   create function _copilot_msg_same(a text,b text) returns boolean language sql immutable as $$select a=b$$;`);
  await db.query('insert into organizations(id) values($1),($2)',[a,b]);
  await db.query('insert into profiles(id,organization_id,telegram_chat_id) values($1,$2,-1),($3,$4,-2)',[u,a,v,b]);
  await db.query('insert into leads values($1,$2)',[lead,b]);
  // Simulate historical unattributed and wrongly attributed rows before the guard.
  await db.query("insert into tg_bot_activity(organization_id,telegram_chat_id,role,content) values($1,-1,'ai','own'),($2,-1,'ai','foreign'),(null,-1,'ai','unattributed')",[a,b]);
  await db.exec(readFileSync('supabase/migrations/315_copilot_authenticated_tenant_boundary.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/316_push_private_sender_key.sql','utf8'));
  await db.exec("insert into push_secure_config values('webhook_secret','server-only-test-value')");
  assert.equal((await one('select fn_push_internal_headers() result')).result['x-push-secret'],'server-only-test-value');
  assert.equal((await one("select has_function_privilege('anon','fn_push_internal_headers()','execute') allowed")).allowed,false);
  assert.equal((await one("select has_function_privilege('anon','push_subscribe(uuid,text,text,text,text)','execute') allowed")).allowed,false);
  assert.equal((await one("select has_function_privilege('anon','copilot_ingress_actor(bigint)','execute') allowed")).allowed,false);
  await assert.rejects(db.query('select copilot_ingress_actor(-1)'),/sesión/);
  await db.query("select set_config('test.uid',$1,false)",[u]);
  assert.equal((await one('select copilot_ingress_actor(-1) result')).result.organization_id,a);
  await assert.rejects(db.query('select copilot_ingress_actor(-2)'),/sesión/);
  await assert.rejects(db.query('select push_subscribe($1,$2,$3,$4)',[v,'foreign','key','auth']),/propias/);
  await assert.rejects(db.query('select push_unsubscribe($1)',[v]),/propias/);
  assert.equal((await one('select push_subscribe($1,$2,$3,$4) ok',[u,'own','key','auth'])).ok,true);
  assert.deepEqual((await db.query('select content from get_my_copilot_activity()')).rows.map(x=>x.content),['own']);
  assert.deepEqual((await db.query('select content from get_my_telegram_activity()')).rows.map(x=>x.content),['own']);
  await assert.rejects(db.query("insert into proactive_reminders(organization_id,asesor_id,status) values($1,$2,'pending')",[a,v]),/destinatario/);
  await assert.rejects(db.query("insert into proactive_reminders(organization_id,asesor_id,lead_id,status) values($1,$2,$3,'pending')",[a,u,lead]),/contacto/);
  await assert.rejects(db.query("insert into tg_bot_activity(organization_id,telegram_chat_id) values($1,-2)",[a]),/chat/);
  await assert.rejects(db.query('insert into tg_bot_activity(telegram_chat_id) values(-1)'),/chat/);
  await db.query("insert into proactive_reminders(organization_id,asesor_id,status) values($1,$2,'pending')",[a,u]);
  await db.query('update profiles set active=false where id=$1',[u]);
  await assert.rejects(db.query('select copilot_ingress_actor(-1)'),/sesión/);
 } finally {await db.close();}
});

