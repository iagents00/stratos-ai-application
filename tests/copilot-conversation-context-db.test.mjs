import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.STRATOS_PGLITE_MODULE || '@electric-sql/pglite');
const org='10000000-0000-4000-a000-000000000001',other='10000000-0000-4000-a000-000000000002';
const actor='20000000-0000-4000-a000-000000000001';
test('dictated contacts persist without phone, confirm once, keep notes and their own business',async()=>{
 const db=new PGlite();
 try {
  await db.exec(readFileSync('tests/sql/company-appointment-fixture.sql','utf8'));
  await db.exec(`
   alter table profiles add column if not exists crm_prefs jsonb default '{}';
   create table bot_pending_actions(id uuid default gen_random_uuid(),token text unique,asesor_id uuid,organization_id uuid,telegram_chat_id bigint,action_type text,payload jsonb,summary text,consumed_at timestamptz,expires_at timestamptz,created_at timestamptz default now());
   create table bot_pending_confirm(telegram_chat_id bigint,organization_id uuid,action text,payload jsonb);
   create table expediente_items(id uuid default gen_random_uuid(),organization_id uuid,lead_id uuid,asesor_id uuid,tipo text,titulo text,descripcion text,metadata jsonb,created_at timestamptz default now(),deleted_at timestamptz);
   create table team_actions(organization_id uuid,created_by uuid,text text,asesor_name text,due_at timestamptz,created_at timestamptz default now(),done boolean);
   create or replace function unaccent(text) returns text language sql immutable as $$select translate($1,'áéíóúñÁÉÍÓÚÑ','aeiounAEIOUN')$$;
   create function fn_norm_nombre(text) returns text language sql immutable as $$select lower(unaccent(btrim($1)))$$;
   create function fn_uuid_o_nulo(text) returns uuid language plpgsql immutable as $$begin return $1::uuid;exception when invalid_text_representation then return null;end$$;
   create function fn_user_tz(uuid,bigint) returns text language sql as $$select 'America/Cancun'::text$$;
   create function parse_relative_or_abs_es(text,text) returns timestamptz language plpgsql as $$begin if $1 ~ '^20[0-9][0-9]-' then return $1::timestamptz;end if;return null;end$$;
   create function identify_asesor_by_telegram(bigint) returns jsonb language sql as $$select jsonb_build_object('paired',true,'organization_id',organization_id,'profile_id',id,'role',role) from profiles where telegram_chat_id=$1 and active$$;
   create function fn_org_stages_list(uuid) returns text[] language sql stable as $$select array_agg(nombre order by orden) from org_stages where organization_id=$1$$;
   create function fn_org_stage(uuid,text) returns text language sql stable as $$select nombre from org_stages where organization_id=$1 and (nombre ilike '%'||$2||'%' or $2='primera etapa') order by length(nombre),orden limit 1$$;
   create function fn_resolve_campaign(uuid,text) returns text language sql as $$select $2$$;
   create function fn_is_org_appointment_stage(uuid,text) returns boolean language sql as $$select $2 like '%Reunión'$$;
   create function _bot_fmt_phone(text) returns text language sql as $$select $1$$;
   create function _bot_fmt_money(bigint) returns text language sql as $$select $1::text$$;
   create function _bot_fmt_when(timestamptz) returns text language sql as $$select $1::text$$;
   create function _bot_kb_confirm(text) returns jsonb language sql as $$select '[[]]'::jsonb$$;
   create function _bot_kb_back() returns jsonb language sql as $$select '[]'::jsonb$$;
   create function _bot_err_envelope(jsonb) returns jsonb language sql as $$select jsonb_build_object('ok',false,'reply',jsonb_build_object('text',$1->>'error'))$$;
   create function fn_fmt_tarjeta_lead(text) returns text language sql as $$select $1$$;
   create function fn_fmt_hecho(text) returns text language sql as $$select 'Guardado: '||$1$$;
   create function fn_fecha_humana(timestamptz,text,boolean) returns text language sql as $$select $1::text$$;
   create function _bot_canonical_phone(uuid,uuid,text,text) returns text language sql as $$select $4$$;
   create function _bot_btn(text,text,text) returns jsonb language sql as $$select '{}'::jsonb$$;
  `);
  const baseline=readFileSync('supabase/migrations/288_business_lines_followup_score.sql','utf8');
  await db.exec(baseline.slice(0,baseline.indexOf('CREATE OR REPLACE FUNCTION public.fn_score_v2_row')));
  // The pending writer and note writer are existing production contracts, not mocked writes.
  await db.exec(`create function _bsc_upsert_pending(bigint,uuid,uuid,text,jsonb) returns text language plpgsql as $$declare t text:=coalesce($4,gen_random_uuid()::text);begin insert into bot_pending_actions(token,telegram_chat_id,asesor_id,organization_id,action_type,payload,expires_at) values(t,$1,$2,$3,'create_lead',$5,now()+interval '1 hour') on conflict(token) do update set payload=excluded.payload;return t;end$$;
   create function bot_add_expediente_note(bigint,text,text,text,text) returns jsonb language plpgsql as $$declare p record;begin select * into p from profiles where telegram_chat_id=$1;insert into expediente_items(organization_id,lead_id,asesor_id,titulo,descripcion) values(p.organization_id,$2::uuid,p.id,$3,$4);return '{"success":true}'::jsonb;end$$;`);
  for(const f of ['293_copilot_conversation_helpers.sql','294_copilot_conversation_context.sql']) await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
  const stages=['RS Primer contacto','RS Contactado','RS Reunión','RS Cliente Ganado','M Primer Contacto','M Contactado','M Reunión','M Cliente Ganado'];
  const businessLines=[{id:'realestate',label:'Bienes raíces',entryStage:stages[0],stages:stages.slice(0,4),aliases:['bienes raíces']},{id:'medicine',label:'Medicina',entryStage:stages[4],stages:stages.slice(4),aliases:['medicina']}];
  await db.query("insert into organizations(id,name,slug,meta_config) values($1,'Own','own',$2),($3,'Other','other','{}')",[org,{crm:{businessLines,pipeline:stages.map(name=>({name}))}},other]);
  for(const [i,name] of stages.entries())await db.query('insert into org_stages(organization_id,orden,nombre) values($1,$2,$3)',[org,i+1,name]);
  await db.query("insert into profiles(id,organization_id,name,role,telegram_chat_id,active) values($1,$2,'Operator','admin',-771,true)",[actor,org]);
  const call=async(tool,args)=>(await db.query('select bot_nlu_dispatch_gvintell(-771,$1,$2) result',[tool,args])).rows[0].result;
  let r=await call('upsert_lead',{name:'Marco Valerio Pérez Goya',notas:'Terreno casi 10 ha en Tequila. Revisa agua con un arquitecto.',business:'bienes raíces',input_text:'Dame de alta a Marco en bienes raíces, mañana revisa el agua.'});
  assert.equal(r.staged,true);assert.match(r.reply.text,/Confirmas/);const token=r.token;
  assert.equal((await db.query('select count(*)::int n from leads')).rows[0].n,0);
  r=(await db.query('select _bot_execute_pending(-771,$1) result',[token])).rows[0].result;assert.equal(r.ok,true,JSON.stringify(r));
  let saved=(await db.query('select * from leads where organization_id=$1',[org])).rows[0];
  assert.equal(saved.phone,null);assert.equal(saved.next_action_at,null);assert.equal(saved.stage,'RS Primer contacto');
  assert.match((await db.query('select descripcion from expediente_items where lead_id=$1',[saved.id])).rows[0].descripcion,/10 ha/);
  assert.equal((await db.query('select _bot_execute_pending(-771,$1) result',[token])).rows[0].result.ok,false);
  r=await call('update_client',{lead_id:saved.id,second_surname:'Golán',stage:'Contactado'});assert.equal(r.ok,true,JSON.stringify(r));
  saved=(await db.query('select * from leads where organization_id=$1',[org])).rows[0];assert.equal(saved.name,'Marco Valerio Pérez Golán');assert.equal(saved.stage,'RS Contactado');
  r=await call('update_client',{lead_id:saved.id,phone:'3315201480'});assert.equal(r.ok,true);assert.equal((await db.query('select count(*)::int n from leads')).rows[0].n,1);
  // Read permissions do not grant the right to modify another company's explicit ID.
  const foreign=(await db.query("insert into leads(organization_id,name,stage) values($1,'Foreign','M Contactado') returning id",[other])).rows[0].id;
  assert.equal((await call('update_client',{lead_id:foreign,second_surname:'Changed'})).ok,false);
  assert.equal((await db.query('select name from leads where id=$1',[foreign])).rows[0].name,'Foreign');
  await db.query("insert into leads(organization_id,name,stage,asesor_id) values($1,'Marco Valerio Otro','RS Primer contacto',$2)",[org,actor]);
  assert.equal((await call('update_client',{client_name:'Marco Valerio',stage:'Contactado'})).needs_input,'client');
  assert.equal((await db.query("select fn_crm_stage_for_contact($1,'M Primer Contacto','Contactado') result",[org])).rows[0].result,'M Contactado');
  assert.equal((await db.query("select fn_crm_stage_for_contact($1,null,'Contactado') result",[org])).rows[0].result,null);
  assert.equal((await call('update_client',{lead_id:saved.id,stage:'RS Reunión'})).needs_input,'date');
  // Missing names produce a question without a fake confirmation button.
  r=await call('upsert_lead',{phone:'5512345678'});assert.doesNotMatch(r.reply.text,/Confirmas/);
 } finally { await db.close(); }
});
