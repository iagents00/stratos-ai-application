import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.STRATOS_PGLITE_MODULE || '@electric-sql/pglite');
const files=['tests/sql/company-appointment-fixture.sql','supabase/migrations/279_company_appointment_mapping.sql','supabase/migrations/280_company_appointment_assistant.sql','supabase/migrations/281_company_copilot_delivery.sql','supabase/migrations/282_company_appointment_legacy_alias.sql'];
const own='10000000-0000-4000-a000-000000000001',other='10000000-0000-4000-a000-000000000002',admin='20000000-0000-4000-a000-000000000001',root='20000000-0000-4000-a000-000000000002';
const pipeline=[{name:'Prospecto',color:'#94A3B8'},{name:'Reunión',color:'#A78BFA'},{name:'Ganado',color:'#34D399'}];
test('appointment publishing is atomic, company-scoped, keeps advanced settings and provisions defaults',async()=>{
 const db=new PGlite();try{
  for(const file of files) await db.exec(readFileSync(file,'utf8'));
  await db.query('insert into organizations(id,name,slug,active,meta_config,updated_at) values($1,$2,$3,true,$4,now()),($5,$6,$7,true,$4,now())',[own,'Own','own',{onboarding:{createdFrom:'whatsapp_admin'},crm:{pipeline},documents:[{title:'Keep'}]},other,'Other','other']);
  await db.query("insert into profiles(id,name,organization_id,role,active,telegram_chat_id) values($1,'Advisor',$2,'admin',true,-771)",[admin,own]);
  await db.query('insert into platform_admins(user_id,active) values($1,true)',[root]);
  const save=async(actor,org,st,pipe=pipeline,at=null)=>{at ||= (await db.query('select updated_at from organizations where id=$1',[org])).rows[0].updated_at;return(await db.query('select fn_company_pipeline_publish($1,$2,$3,$4,$5) result',[actor,org,at,pipe,{appointment_stage:st}])).rows[0].result;};
  await assert.rejects(save(admin,other,'Reunión'),{code:'42501'});
  await assert.rejects(save(admin,own,'Foreign stage'),{code:'22023'});
  assert.equal((await db.query('select count(*) n from proactive_config')).rows[0].n,0);
  let saved=await save(admin,own,'  reunión  ');
  assert.equal(saved.copilot.appointment_stage,'Reunión');assert.equal(saved.organization.meta_config.documents[0].title,'Keep');
  let cfg=(await db.query('select * from proactive_config where organization_id=$1',[own])).rows[0];
  assert.equal(cfg.enabled,true);assert.equal(cfg.shadow_mode,false);assert.equal(Number(cfg.zoom_reminder_hours),3);
  assert.deepEqual(cfg.terminal_stages,['Ganado','Perdido']);
  await assert.rejects(save(admin,own,'Reunión',pipeline,'2000-01-01'),{code:'40001'});
  await db.query('update proactive_config set zoom_reminder_hours=4,quiet_start_hour=22 where organization_id=$1',[own]);
  const renamed=pipeline.map(s=>s.name==='Reunión'?{...s,name:'Evaluación'}:s);
  await save(admin,own,'Evaluación',renamed);
  await db.query("insert into leads(organization_id,name,stage) values($1,'Historical client','Zoom Agendado')",[own]);
  await save(admin,own,'Evaluación',renamed);
  assert.equal((await db.query("select fn_org_stage($1,'Zoom Agendado') stage",[own])).rows[0].stage,'Evaluación');
  assert.equal((await db.query("select stage from leads where organization_id=$1 and name='Historical client'",[own])).rows[0].stage,'Zoom Agendado');
  cfg=(await db.query('select * from proactive_config where organization_id=$1',[own])).rows[0];assert.equal(cfg.zoom_stage_label,'Evaluación');assert.equal(Number(cfg.zoom_reminder_hours),4);assert.equal(cfg.quiet_start_hour,22);
  await save(root,other,'Reunión');
  await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
  await assert.rejects(save(admin,own,'Evaluación',renamed),{code:'42501'});
  await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
  const fresh='10000000-0000-4000-a000-000000000003';
  const provision=(await db.query("select fn_provision_company($1,$2,'Fresh','fresh',5,'{\"teamAdmin\":true,\"mktModule\":false,\"comandoDirectivo\":false}') result",[root,fresh])).rows[0].result;
  assert.equal(provision.organization.meta_config.crm.appointmentStage,'Reunión');assert.equal(provision.organization.meta_config.features.copilotModule,true);
  assert.equal((await db.query('select enabled from proactive_config where organization_id=$1',[fresh])).rows[0].enabled,true);
  assert.equal((await db.query("select fn_org_stage($1,'Zoom Agendado') stage",[fresh])).rows[0].stage,'Reunión');
  await save(admin,own,null,renamed);assert.equal((await db.query('select fn_org_appointment_stage($1) stage',[own])).rows[0].stage,null);
 }finally{await db.close();}
});

test('renamed appointments send the three-hour briefing, open Copilot plans, deduplicate and cancel old dates without touching legacy tenants',async()=>{
 const db=new PGlite();try{
  for(const file of files) await db.exec(readFileSync(file,'utf8'));
  const p=[pipeline[0],{...pipeline[1],name:'Evaluación'},pipeline[2]];
  await db.query('insert into organizations(id,name,slug,active,meta_config) values($1,$2,$3,true,$4),($5,$6,$7,true,$8)',[own,'Own','own',{onboarding:{createdFrom:'whatsapp_admin'},crm:{pipeline:p}},other,'Legacy','legacy',{crm:{pipeline}}]);
  await db.query("insert into profiles(id,name,organization_id,role,active,telegram_chat_id) values($1,'Advisor',$2,'asesor',true,-771)",[admin,own]);
  await db.query("select fn_company_appointment_config($1,'Evaluación')",[own]);
  await db.query('insert into proactive_config(organization_id,enabled,shadow_mode,zoom_stage_label) values($1,true,false,$2)',[other,'Reunión']);
  await assert.rejects(db.query("insert into leads(organization_id,name,stage) values($1,'No date','Evaluación')",[own]),{code:'22023'});
  const lead=(await db.query("insert into leads(organization_id,name,stage,asesor_id,asesor_name,next_action_at) values($1,'Client','Evaluación',$2,'Advisor',now()+interval '2 hours 59 minutes') returning id",[own,admin])).rows[0].id;
  assert.equal((await db.query('select next_action_at=selected_time synced from leads where organization_id=$1 and id=$2',[own,lead])).rows[0].synced,true);
  const tick=async()=>(await db.query('select fn_company_copilot_tick() result')).rows[0].result;
  let result=await tick();assert.deepEqual(result.failures,[]);assert.equal(result.synthetic_logged,1);
  let reminder=(await db.query("select * from proactive_reminders where organization_id=$1 and tipo='zoom_brief'",[own])).rows[0];
  assert.equal(reminder.status,'sent');assert.equal(new Date(reminder.scheduled_at)<=new Date(),true);
  assert.match(reminder.payload.text,/Evaluación/);assert.doesNotMatch(reminder.payload.text,/Zoom/);
  assert.equal((await db.query('select count(*)::int n from proactive_pending_reports where organization_id=$1 and advisor_telegram_id=-771 and status=$2',[own,'open'])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from tg_bot_activity where organization_id=$1 and telegram_chat_id=-771',[own])).rows[0].n,1);
  await tick();assert.equal((await db.query('select count(*)::int n from proactive_reminders where organization_id=$1',[own])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from proactive_reminders where organization_id=$1',[other])).rows[0].n,0);
  await db.query("update leads set next_action_at=now()+interval '4 hours' where organization_id=$1 and id=$2",[own,lead]);await tick();
  assert.equal((await db.query("select status from proactive_pending_reports where organization_id=$1 and lead_id=$2",[own,lead])).rows[0].status,'closed');
  reminder=(await db.query("select * from proactive_reminders where organization_id=$1 and status='pending'",[own])).rows[0];assert.ok(reminder);
  await db.query("update leads set next_action_at=now()+interval '5 hours' where organization_id=$1 and id=$2",[own,lead]);await tick();
  assert.equal((await db.query('select status from proactive_reminders where organization_id=$1 and id=$2',[own,reminder.id])).rows[0].status,'cancelled');
  await db.query("insert into proactive_reminders(organization_id,asesor_id,asesor_name,tipo,scheduled_at,dedupe_key,ignore_quiet,payload) values($1,$2,'Advisor','personal',now(),'test-personal',true,'{\"text\":\"Call supplier\"}')",[own,admin]);
  result=await tick();assert.equal(result.synthetic_logged,1);
 }finally{await db.close();}
});
