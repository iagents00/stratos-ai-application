import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('installed clients forward their own session once; disabled/foreign/inactive actors cannot use the bridge',async()=>{
 const db=new PGlite(),org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',actor='20000000-0000-4000-8000-000000000001',foreign='20000000-0000-4000-8000-000000000002';
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table organizations(id uuid primary key,active boolean default true,meta_config jsonb default '{}');
   create table profiles(id uuid primary key,organization_id uuid,active boolean,telegram_chat_id bigint,name text,role text,is_marketing_admin boolean default false);
   create table tg_bot_activity(id bigserial primary key,organization_id uuid,telegram_chat_id bigint,role text,content text,meta jsonb,created_at timestamptz default now());
   create table front_rpc_registry(nombre text primary key,nota text);
   create table http_calls(payload jsonb,headers jsonb);
   create table http_config(mode text);insert into http_config values('accept');
   create type extensions.http_header as (field text,value text);
   create function extensions.http_header(text,text) returns extensions.http_header language sql as $$select row($1,$2)::extensions.http_header$$;
   create type extensions.http_request as(method text,uri text,headers extensions.http_header[],content_type text,content text);
   create function extensions.http(q extensions.http_request) returns table(status int,content text) language plpgsql as $$
   declare b jsonb:=q.content::jsonb;m text;begin
    select mode into m from http_config;
    if m='throw' then raise exception 'network timeout';end if;
    if q.uri<>'https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/copilot-deliver' then raise exception 'wrong destination';end if;
    insert into http_calls values(b,to_jsonb(q.headers));
    if m='reject' then return query select 401,'{}'::text;return;end if;
    perform copilot_delivery_begin((b->>'request_id')::uuid,b->>'text','','crm');
    return query select 202,jsonb_build_object('request_id',b->>'request_id','reply',jsonb_build_object('text','Accepted'))::text;
   end$$;
   create function fn_proactive_check_report(jsonb) returns jsonb language sql as $$select '{"has_report":false}'::jsonb$$;`);
  await db.exec(readFileSync('supabase/migrations/317_copilot_delivery_receipts_and_incidents.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/319_copilot_authenticated_installed_client_bridge.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/320_copilot_rpc_header_transport.sql','utf8'));
  await db.query("insert into organizations(id,meta_config) values($1,'{\"crm\":{\"authenticatedCopilotBridge\":true}}'),($2,'{}')",[org,other]);
  await db.query("insert into profiles(id,organization_id,active,telegram_chat_id,name,role) values($1,$2,true,-1,'Own','asesor'),($3,$4,true,-2,'Foreign','asesor')",[actor,org,foreign,other]);
  const call=()=>one("select copilot_handle_pending('Regístrala en contactado') reply");
  await assert.rejects(db.query("select copilot_authenticated_bridge('Anything')"),/Session/);
  await db.query("select set_config('test.uid',$1,false)",[actor]);
  await assert.rejects(call(),/headers/);
  await db.exec(`select set_config('request.headers','{"authorization":"Bearer own-user-token"}',false);`);
  await db.query("insert into tg_bot_activity(organization_id,telegram_chat_id,role,content) values($1,-1,'user','Regístrala en contactado')",[org]);
  assert.equal((await call()).reply,'Accepted');
  assert.match((await call()).reply,/Estoy atendiendo/);
  assert.equal((await one('select count(*)::int n from http_calls')).n,1);
  const h=await one('select * from http_calls');assert.equal(h.payload.chat_id,-1);assert.equal(h.payload.route,'crm');assert.equal(h.payload.background,true);
  assert.equal(h.headers.find(x=>x.field==='Authorization').value,'Bearer own-user-token');
  const id=h.payload.request_id;
  await db.query('select fn_copilot_delivery_finish($1,$2,$3,$4,$5,$6)',[org,actor,id,'completed',{reply:{text:'Jessica quedó en RS Contactado'}},null]);
  assert.equal((await call()).reply,'Jessica quedó en RS Contactado');
  // A new turn with identical words may refer to a different contact; do not drop it.
  await db.query("insert into tg_bot_activity(organization_id,telegram_chat_id,role,content) values($1,-1,'user','Regístrala en contactado')",[org]);
  assert.equal((await call()).reply,'Accepted');assert.equal((await one('select count(*)::int n from http_calls')).n,2);
  await db.query("select set_config('test.uid',$1,false)",[foreign]);
  assert.equal((await call()).reply,null);
  assert.equal((await one('select copilot_delivery_status($1) r',[id])).r,null);
  await db.query("select set_config('test.uid',$1,false)",[actor]);
  await db.exec("update profiles set active=false where telegram_chat_id=-1");assert.equal((await call()).reply,null);
  await db.exec("update profiles set active=true,role='marketing' where telegram_chat_id=-1");assert.equal((await call()).reply,null);
  await db.exec("update profiles set role='asesor' where telegram_chat_id=-1;update http_config set mode='throw'");
  const failure=(await one("select copilot_handle_pending('Una petición diferente') reply")).reply;assert.match(failure,/No pude confirmar/);
  assert.equal((await one("select count(*)::int n from copilot_deliveries where status='uncertain'")).n,1);
  assert.equal((await one("select count(*)::int n from copilot_ops_incidents where code='bridge_transport'")).n,1);
  assert.equal((await one("select has_table_privilege('authenticated','copilot_rpc_deliveries','select') allowed")).allowed,false);
  assert.equal((await one("select has_function_privilege('anon','copilot_authenticated_bridge(text)','execute') allowed")).allowed,false);
 }finally{await db.close();}
});
