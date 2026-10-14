/** Runs PostgreSQL in memory. No production URL, users, messages or credentials. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const id = (kind, n) => `${kind}0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const org1=id(1,1), org2=id(1,2), advisor1=id(2,1), advisor2=id(2,2), channel1=id(3,1), channel2=id(3,2);
const oldSource = readFileSync(new URL("./whatsapp-infobip-readonly.mjs", import.meta.url), "utf8");
const fixture = oldSource.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replace(
  /\$\{(org1|org2|advisor1|advisor2|channel1|channel2)\}/g,
  (_, key) => ({ org1,org2,advisor1,advisor2,channel1,channel2 })[key],
);
const original = readFileSync(new URL("../../supabase/migrations/265_infobip_multitenant_readonly.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/271_infobip_readonly_receiver_isolation.sql", import.meta.url), "utf8");
const call = async (payload) => (await db.query("select fn_ingest_infobip_multitenant($1::jsonb) result", [JSON.stringify(payload)])).rows[0].result;
const enroll = (org, channel) => db.query("select fn_set_whatsapp_readonly_route($1::uuid,$2::uuid,true)", [org, channel]);
const counts = async () => (await db.query(`select (select count(*)::int from leads) leads,
  (select count(*)::int from whatsapp_messages) messages,(select count(*)::int from whatsapp_inbox) inbox`)).rows[0];
const event = (business, n, contact="573111111111") => ({to:business,from:contact,messageId:`in-${n}`,
  contact:{userId:contact,name:`Contacto ${n}`},message:{type:"TEXT",text:"Información"}});
let checks=0;
const ok = (label) => {checks++; console.log(`✓ ${label}`);};
try {
  await db.exec(fixture);
  await db.exec("alter role service_role bypassrls; alter table organizations add column active boolean default true;");
  await db.exec(original.slice(original.indexOf("create or replace function public.fn_activate_whatsapp_readonly"),
    original.indexOf("create or replace function public.fn_ingest_infobip_multitenant")));
  await db.exec(`insert into whatsapp_inbox(organization_id,provider_message_id) values
    ('${org1}','legacy-duplicate'),('${org1}','legacy-duplicate');`);
  await db.exec(`begin; ${migration} commit;`);
  ok("Incremental migration applies without a legacy duplicate cleanup");
  assert.equal((await db.query("select count(*)::int n from whatsapp_readonly_ingestion_routes where protected and not enabled")).rows[0].n,2);
  await assert.rejects(enroll(org1,channel1), /Existing production channel is protected/);
  await assert.rejects(call({results:[event("573000000001","protected")]}), /route is not enabled/);
  assert.deepEqual(await counts(),{leads:0,messages:0,inbox:2});
  ok("Existing production channels cannot be enrolled or modified by the new receiver");
  await assert.rejects(db.exec(`insert into whatsapp_messages(organization_id,direction) values('${org1}','in')`), /legacy_conversation_required/);
  await db.exec(`insert into whatsapp_messages(organization_id,direction,chatwoot_conversation_id) values('${org1}','in',123)`);
  ok("Legacy Chatwoot writers retain their non-null conversation contract");
  await db.exec(`insert into whatsapp_numero_asesor(id,organization_id,numero_whatsapp,asesor_id,asesor_name,proveedor)
    values('${id(3,101)}','${org1}','573000000101','${advisor1}','Asesor Uno','infobip'),
          ('${id(3,102)}','${org2}','573000000102','${advisor2}','Asesor Dos','infobip');`);
  await assert.rejects(enroll(org1,id(3,101)), /read-only organization required/);
  for(const org of [org1,org2]) await db.query("select fn_activate_whatsapp_readonly($1::uuid)",[org]);
  assert.equal((await db.query("select meta_config#>>'{crm,pipeline,0,name}' stage from organizations where id=$1",[org1])).rows[0].stage,"Nuevo prospecto");
  await assert.rejects(enroll(org2,id(3,101)),/Channel not found/);
  await enroll(org1,id(3,101)); await enroll(org2,id(3,102));
  ok("Enrollment requires the correct organization, active advisor and explicit read-only flag");
  const incoming={results:[event("573000000101","one")]};
  assert.equal((await call(incoming)).created,1);
  assert.equal((await call(incoming)).duplicate,1);
  const echo={eventType:"BUSINESS_APP_MESSAGE_ECHO",results:[{...incoming.results[0],
    from:incoming.results[0].to,to:incoming.results[0].from,direction:"OUT",messageId:"echo-one"}]};
  assert.equal((await call(echo)).echoed,1);
  assert.equal((await call(echo)).duplicate,1);
  assert.equal((await db.query("select stage from leads where organization_id=$1",[org1])).rows[0].stage,"Nuevo prospecto");
  ok("Inbound and Business App echoes share a lead, preserve its stage and deduplicate");
  await call({results:[{...event("573000000102","bsuid","co.private_contact_42"),contact:{userId:"co.private_contact_42",username:"privado"}}]});
  assert.equal((await db.query("select phone from leads where organization_id=$1",[org2])).rows[0].phone,null);
  ok("Private BSUID contacts remain isolated without an invented phone number");
  const before=await counts();
  await assert.rejects(call({results:[event("573000000101","rollback-good"),event("579999999999","rollback-bad")]}));
  assert.deepEqual(await counts(),before);
  await assert.rejects(call({...incoming,organization_id:org2}));
  await db.exec("set role authenticated");
  await assert.rejects(call(incoming),/permission denied/);
  await assert.rejects(enroll(org1,id(3,101)),/permission denied/);
  await assert.rejects(db.query("select * from whatsapp_readonly_ingestion_routes"),/permission denied/);
  await db.exec("reset role");
  ok("Failed batches are atomic; browser users cannot call ingestion or edit routes");

  const incomingMass=[], echoesMass=[];
  for(let company=1;company<=20;company++) {
    const org=id(1,1000+company);
    await db.query("insert into organizations(id,meta_config) values($1,$2::jsonb)",[org,
      JSON.stringify({features:{whatsappReadOnly:true},crm:{pipeline:[{name:`Etapa ${company}`}]}})]);
    for(let advisor=1;advisor<=20;advisor++) {
      const n=company*100+advisor, user=id(2,10000+n), channel=id(3,10000+n);
      const business=`5735${String(n).padStart(8,"0")}`, contact=`5736${String(advisor).padStart(8,"0")}`;
      await db.query("insert into profiles(id,organization_id,name) values($1,$2,$3)",[user,org,`Asesor ${n}`]);
      await db.query("insert into whatsapp_numero_asesor(id,organization_id,numero_whatsapp,asesor_id,asesor_name,proveedor) values($1,$2,$3,$4,$5,'infobip')",
        [channel,org,business,user,`Asesor ${n}`]);
      await enroll(org,channel);
      incomingMass.push(event(business,`mass-${n}`,contact));
      echoesMass.push({...event(contact,`mass-echo-${n}`,business),direction:"OUT",contact:{userId:contact}});
    }
  }
  assert.equal((await call({results:incomingMass})).created,400);
  assert.equal((await call({eventType:"BUSINESS_APP_MESSAGE_ECHO",results:echoesMass})).echoed,400);
  assert.equal((await call({results:incomingMass})).duplicate,400);
  assert.equal((await call({eventType:"BUSINESS_APP_MESSAGE_ECHO",results:echoesMass})).duplicate,400);
  const organizations=(await db.query(`select l.organization_id,count(distinct l.id)::int leads,
    count(m.id)::int messages,bool_and(l.asesor_id=p.id and p.organization_id=l.organization_id) isolated
    from leads l join profiles p on p.id=l.asesor_id join whatsapp_messages m on m.lead_id=l.id
    and m.organization_id=l.organization_id where l.organization_id not in ($1,$2) group by l.organization_id`,[org1,org2])).rows;
  assert.equal(organizations.length,20);
  assert.ok(organizations.every(row=>row.leads===20 && row.messages===40 && row.isolated));
  await assert.rejects(call({results:Array(2001).fill(incoming.results[0])}),/Batch exceeds limit/);
  ok("20x20: 400 leads, 800 messages and 800 replays without duplicates or cross-company assignment");
  console.log(`${checks} PostgreSQL isolation checks passed.`);
} finally {await db.close();}
