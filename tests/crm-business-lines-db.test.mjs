import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.STRATOS_PGLITE_MODULE || '@electric-sql/pglite');
const own='10000000-0000-4000-a000-000000000001',other='10000000-0000-4000-a000-000000000002';
const admin='20000000-0000-4000-a000-000000000001';
const names=['RS Contacto','RS Reunión','RS Ganado','M Contacto','M Reunión','M Ganado'];
const pipeline=names.map(name=>({name,color:'#123456'}));
const lines=[{id:'real-estate',label:'Bienes raíces',aliases:['inmobiliario','bienes raíces'],entryStage:names[0],stages:names.slice(0,3)},
 {id:'medicine',label:'Medicina',aliases:['medicina','médico','paciente','pacientes'],entryStage:names[3],stages:names.slice(3)}];
test('business-aware registration, continuation, renaming and scoring stay organization scoped',async()=>{
 const db=new PGlite();try{
  for(const file of ['tests/sql/company-appointment-fixture.sql','supabase/migrations/279_company_appointment_mapping.sql','supabase/migrations/280_company_appointment_assistant.sql','supabase/migrations/281_company_copilot_delivery.sql','supabase/migrations/282_company_appointment_legacy_alias.sql','supabase/migrations/283_company_appointment_legacy_publish_guard.sql'])await db.exec(readFileSync(file,'utf8'));
  await db.exec(`
   create table lead_assignment_pools(organization_id uuid,default_stage text);
   create table bot_pending_stage_move(organization_id uuid,from_stage text,to_stage text);
   create function set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp();return new;end$$;
   create function fn_user_tz(uuid,bigint) returns text language sql as $$select 'America/Cancun'::text$$;
   create function parse_relative_or_abs_es(text,text) returns timestamptz language sql as $$select $1::timestamptz$$;
   create function fn_norm_nombre(text) returns text language sql as $$select lower($1)$$;
   create function fn_fmt_fecha_legible(timestamptz,text) returns text language sql as $$select $1::text$$;
   create function fn_fecha_humana(timestamptz,text,boolean) returns text language sql as $$select $1::text$$;
   create function fn_fecha_es(timestamptz,text) returns text language sql as $$select $1::text$$;
   create function fn_visita_avisos_texto(timestamptz) returns text language sql as $$select 'Legacy reminders'::text$$;
   create function fn_uuid_o_nulo(text) returns uuid language sql as $$select null::uuid$$;
   create function _bot_kb_back() returns jsonb language sql as $$select '[]'::jsonb$$;
   create function identify_asesor_by_telegram(bigint) returns jsonb language sql as $$select jsonb_build_object('paired',true,'organization_id',organization_id) from profiles where telegram_chat_id=$1 and active$$;
   create table comunicaciones(lead_id uuid,organization_id uuid,tipo text,resumen text,asesor_id uuid,ocurrio_en timestamptz);
   create table expediente_items(lead_id uuid,organization_id uuid,tipo text,titulo text,descripcion text,asesor_id uuid,metadata jsonb);
  `);
  await db.exec(readFileSync('supabase/migrations/284_rename_occupied_pipeline_stages.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/287_multiple_appointment_stages.sql','utf8'));
 await db.exec(`
 create or replace function unaccent(text) returns text language sql immutable as $$select translate($1,'áéíóúñÁÉÍÓÚÑ','aeiounAEIOUN')$$;
 create or replace function parse_relative_or_abs_es(text,text) returns timestamptz language plpgsql as $$begin if $1 ~ '^20[0-9][0-9]-' then return $1::timestamptz;end if;return null;end$$;
 create or replace function identify_asesor_by_telegram(bigint) returns jsonb language sql as $$select jsonb_build_object('paired',true,'organization_id',organization_id,'profile_id',id,'role',role) from profiles where telegram_chat_id=$1 and active$$;
 create table bot_pending_actions(id uuid default gen_random_uuid(),token text unique,profile_id uuid,organization_id uuid,telegram_chat_id bigint,action_type text,payload jsonb,summary text,consumed_at timestamptz,expires_at timestamptz default now()+interval '1 hour',created_at timestamptz default now());
 create function _bsc_upsert_pending(bigint,uuid,uuid,text,jsonb) returns text language plpgsql as $$declare t text:=coalesce($4,gen_random_uuid()::text);begin insert into bot_pending_actions(token,telegram_chat_id,profile_id,organization_id,action_type,payload) values(t,$1,$2,$3,'create_lead',$5) on conflict(token) do update set payload=excluded.payload;return t;end$$;
 create function _bot_err_envelope(jsonb) returns jsonb language sql as $$select $1$$;
 create function _bot_fmt_phone(text) returns text language sql as $$select $1$$;
 create function _bot_fmt_money(bigint) returns text language sql as $$select $1::text$$;
 create function _bot_fmt_when(timestamptz) returns text language sql as $$select $1::text$$;
 create function _bot_kb_confirm(text) returns jsonb language sql as $$select '[]'::jsonb$$;
 `);
 try { await db.exec(readFileSync('supabase/migrations/288_business_lines_followup_score.sql','utf8')); } catch(error) { throw new Error(error.message+' at '+error.position+' '+(error.where || '')); }
 await db.exec('create trigger zz_score before insert or update on leads for each row execute function fn_leads_score_trigger()');
 await db.query('insert into organizations(id,name,slug,active,meta_config) values($1,$2,$2,true,$3),($4,$5,$5,true,$6)',[own,'Own',{crm:{pipeline,businessLines:lines}},other,'Other',{}]);
 await db.query("insert into profiles(id,name,organization_id,role,active,telegram_chat_id) values($1,'Admin',$2,'admin',true,-771)",[admin,own]);
 const stage=async args=>(await db.query('select bot_stage_create_lead_pre_tarjeta(-771,$1) result',[args])).rows[0].result;
 const pending=async token=>(await db.query('select payload from bot_pending_actions where token=$1 and organization_id=$2',[token,own])).rows[0].payload;
 for(const [text,expected] of [['Registra un paciente llamado Ana','M Contacto'],['Registra un cliente inmobiliario llamado Beto','RS Contacto']]){
  const result=await stage({name:text.includes('Ana')?'Ana':'Beto',phone:text.includes('Ana')?'5215500000101':'5215500000102',input_text:text,stage:'Primer contacto'});
  const p=await pending(result.token);assert.equal(p.stage,expected);assert.equal(p._ready,true);assert.match(result.reply.text,/Negocio:/);
 }
 let result=await stage({name:'Sin decidir',phone:'5215500000103',input_text:'Registra un contacto de medicina y bienes raíces'});
 assert.equal(result.needs_input,'business');
 const ambiguous=(await db.query("select token from bot_pending_actions where organization_id=$1 and consumed_at is null order by created_at desc limit 1",[own])).rows[0].token;
 const blocked=(await db.query('select _bot_execute_pending(-771,$1) result',[ambiguous])).rows[0].result;assert.equal(blocked.needs_input,'business');assert.equal((await db.query('select consumed_at from bot_pending_actions where token=$1 and organization_id=$2',[ambiguous,own])).rows[0].consumed_at,null);assert.equal((await db.query("select payload from bot_pending_actions where organization_id=$1 and consumed_at is null order by created_at desc limit 1",[own])).rows[0].payload._ready,false);
 result=await stage({input_text:'Medicina'});assert.ok(result.token,JSON.stringify(result));assert.equal((await pending(result.token)).stage,'M Contacto');
 result=await stage({name:'Conflicto',phone:'5215500000104',stage:'RS Ganado',input_text:'Registra un paciente en RS Ganado'});assert.equal(result.needs_input,'business_stage');
 assert.equal((await db.query("select fn_org_business_match($1,'medicina') result",[other])).rows[0].result,null);
 // Known contact names do not act as business hints.
 result=await stage({name:'Paciente Ejemplo',phone:'5215500000105',input_text:'Registra a Paciente Ejemplo'});assert.equal((await pending(result.token)).stage,'RS Contacto');
 const at=(await db.query('select updated_at from organizations where id=$1',[own])).rows[0].updated_at;
 const renamed=pipeline.map(s=>s.name==='M Contacto'?{...s,name:'Consulta inicial',previous_name:s.name}:s);
 await db.query('select fn_company_pipeline_publish($1,$2,$3,$4,null)',[admin,own,at,renamed]);
 result=(await db.query("select fn_org_business_match($1,'paciente') result",[own])).rows[0].result;assert.equal(result.entryStage,'Consulta inicial');assert.ok(result.stages.includes('Consulta inicial'));
 result=await stage({name:'Negocio desconocido',phone:'5215500000106',business:'Otro negocio',input_text:'Registra a Negocio desconocido'});assert.equal(result.needs_input,'business');
 const unknown=(await db.query("select token from bot_pending_actions where organization_id=$1 and consumed_at is null order by created_at desc limit 1",[own])).rows[0].token;
 assert.equal((await db.query('select _bot_execute_pending(-771,$1) result',[unknown])).rows[0].result.needs_input,'business');
 await assert.rejects(db.query("select fn_crm_business_lines_remap($1,'{}',$2)",[lines,pipeline.filter(s=>s.name!=='M Contacto')]),{code:'22023'});
 const lead=(await db.query("insert into leads(organization_id,name,stage,seguimientos,source) values($1,'Score','Consulta inicial',1,'telegram') returning *",[own])).rows[0];assert.equal(lead.score,11);
 let updated=(await db.query('update leads set seguimientos=2 where id=$1 and organization_id=$2 returning *',[lead.id,own])).rows[0];assert.equal(updated.score,lead.score+1);assert.equal(updated.source,'telegram');
 updated=(await db.query('update leads set seguimientos=1 where id=$1 and organization_id=$2 returning *',[lead.id,own])).rows[0];assert.equal(updated.score,lead.score);
 const historical=(await db.query("insert into leads(organization_id,name,stage,seguimientos) values($1,'Historical','Seguimiento',2) returning *",[other])).rows[0];assert.equal(historical.score,79); // legacy 70 +5 postzoom +4 follow-ups
 await db.exec("begin");
 await db.query("select set_config('stratos.score_recalculation_org',$1,true)",[own]);
 // Maintenance changes only derived fields and preserves the activity timestamp.
 await db.query("update leads set score=score+1,updated_at=now()+interval '1 minute' where id=$1 and organization_id=$2",[lead.id,own]);
 assert.equal((await db.query('select updated_at from leads where id=$1 and organization_id=$2',[lead.id,own])).rows[0].updated_at.getTime(),updated.updated_at.getTime());
 await db.exec('commit');
 const capped=(await db.query("insert into leads(organization_id,name,stage,seguimientos) values($1,'Capped','RS Contacto',1000) returning score",[own])).rows[0];assert.equal(capped.score,100);
 const postCustom=(await db.query("insert into leads(organization_id,name,stage,seguimientos) values($1,'Post custom','Postventa',20) returning score",[own])).rows[0];assert.equal(postCustom.score,75);
 const postLegacy=(await db.query("insert into leads(organization_id,name,stage,seguimientos) values($1,'Post legacy','Postventa',20) returning score",[other])).rows[0];assert.equal(postLegacy.score,55);
 assert.equal((await db.query("select has_function_privilege('authenticated','fn_org_business_match(uuid,text)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
