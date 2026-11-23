import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';

test('each completed request stays visible, repeated text survives, and a suppressed final reply rolls back',async()=>{
 const db=new PGlite(),org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',actor='20000000-0000-4000-8000-000000000001';
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const ids=[1,2,3,4].map(n=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table organizations(id uuid primary key);create table profiles(id uuid primary key,organization_id uuid,active boolean,telegram_chat_id bigint);
   create table tg_bot_activity(id bigserial primary key,organization_id uuid,telegram_chat_id bigint,role text,content text,meta jsonb,created_at timestamptz default now(),media_path text,media_type text);
   create table front_rpc_registry(nombre text primary key,nota text);
   create function current_organization_id() returns uuid language sql stable as $$select organization_id from profiles where id=auth.uid()$$;
   create function _copilot_msg_norm(text) returns text language sql immutable as $$select lower(btrim($1))$$;
   create function _copilot_msg_same(text,text) returns boolean language sql immutable as $$select _copilot_msg_norm($1)=_copilot_msg_norm($2)$$;`);
  await db.exec(readFileSync('supabase/migrations/317_copilot_delivery_receipts_and_incidents.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/324_copilot_final_reply_visibility.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/325_copilot_final_reply_receipt.sql','utf8'));
  await db.exec(`create trigger dedupe before insert on tg_bot_activity for each row execute function tg_bot_activity_dedupe();
   create trigger no_duplicar before insert on tg_bot_activity for each row execute function tg_bot_activity_no_duplicar();`);
  await db.query('insert into organizations values($1),($2)',[org,other]);
  await db.query('insert into profiles values($1,$2,true,-1)',[actor,org]);await db.query("select set_config('test.uid',$1,false)",[actor]);
  const text='Esta es una respuesta final extensa que puede ser igual en dos solicitudes distintas del usuario.';
  const begin=id=>db.query('select copilot_delivery_begin($1,$2,$3,$4)',[id,'Una petición','','crm']);
  const finish=(id,reply=text)=>one('select fn_copilot_delivery_finish($1,$2,$3,$4,$5,$6) r',[org,actor,id,'completed',{reply:{text:reply,inline_keyboard:[[{text:'Ver ficha',callback_data:'view:one'}]]}},null]);
  for(const id of ids.slice(0,2)){await begin(id);assert.equal((await finish(id)).r,true);}
  assert.equal((await one('select count(*)::int n from tg_bot_activity')).n,2);
  const history=(await db.query('select * from get_my_copilot_activity(40)')).rows;
  assert.deepEqual(history.map(x=>x.meta.request_id),[ids[1],ids[0]]);
  assert.equal(history[0].meta.inline_keyboard[0][0].text,'Ver ficha');
  assert.equal((await finish(ids[1])).r,false);
  // Existing model logging is adopted, rather than leaving two copies of one result.
  await begin(ids[2]);const row=await one("insert into tg_bot_activity(organization_id,telegram_chat_id,role,content) values($1,-1,'ai','El modelo ya guardó este resultado') returning id",[org]);
  assert.equal((await finish(ids[2],'El modelo ya guardó este resultado')).r,true);
  assert.equal((await one('select meta from tg_bot_activity where id=$1',[row.id])).meta.request_id,ids[2]);
  assert.equal((await one('select count(*)::int n from tg_bot_activity')).n,3);
  // Keep suppression for uncorrelated transport echoes.
  await db.query("insert into tg_bot_activity(organization_id,telegram_chat_id,role,content) values($1,-1,'ai','Una respuesta legacy larga que llega repetida por el transporte'),($1,-1,'ai','Una respuesta legacy larga que llega repetida por el transporte')",[org]);
  assert.equal((await one('select count(*)::int n from tg_bot_activity')).n,4);
  await begin(ids[3]);
  await db.exec(`create function test_drop_final() returns trigger language plpgsql as $$begin if new.content='force_drop' then return null;end if;return new;end$$;
   create trigger test_drop before insert on tg_bot_activity for each row execute function test_drop_final();`);
  await assert.rejects(finish(ids[3],'force_drop'),/persisted/);
  assert.equal((await one('select status from copilot_deliveries where id=$1',[ids[3]])).status,'processing');
  await db.query("select set_config('test.uid',$1,false)",['20000000-0000-4000-8000-000000000002']);
  assert.equal((await db.query('select * from get_my_copilot_activity(40)')).rows.length,0);
 }finally{await db.close();}
});
