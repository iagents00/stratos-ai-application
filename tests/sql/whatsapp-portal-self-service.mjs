/** Real PostgreSQL semantics in memory; no network or production credentials. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const org1="10000000-0000-0000-0000-000000000001", org2="10000000-0000-0000-0000-000000000002";
const advisor1="20000000-0000-0000-0000-000000000001", advisor2="20000000-0000-0000-0000-000000000002";
const channel1="30000000-0000-0000-0000-000000000001", channel2="30000000-0000-0000-0000-000000000002";
const root="40000000-0000-0000-0000-000000000001", partner="40000000-0000-0000-0000-000000000002";
const read = file => readFileSync(new URL(file, import.meta.url),"utf8");
const fixture=read("./whatsapp-infobip-readonly.mjs").match(/await db\.exec\(`([\s\S]*?)`\);/)[1]
  .replace(/\$\{(org1|org2|advisor1|advisor2|channel1|channel2)\}/g,(_,k)=>({org1,org2,advisor1,advisor2,channel1,channel2})[k]);
const invoke = async (name,args,casts) => (await db.query(`select ${name}(${casts.map((type,i)=>`$${i+1}::${type}`).join(",")}) result`,args)).rows[0].result;
const start = (actor,org,advisor,phone="+528183963030") => invoke("fn_whatsapp_portal_start",[actor,org,advisor,phone,"company"],["uuid","uuid","uuid","text","text"]);
const prepare = (actor,run,phone="5218183963030") => invoke("fn_whatsapp_portal_prepare",[actor,run,phone],["uuid","uuid","text"]);
const probe = (actor,run) => invoke("fn_whatsapp_portal_probe",[actor,run],["uuid","uuid"]);
let checks=0; const ok=label=>{checks++;console.log(`✓ ${label}`);};
try {
  await db.exec(fixture);
  await db.exec(`
    alter role service_role bypassrls;
    alter table organizations add column active boolean default true, add column parent_organization_id uuid;
    alter table profiles add column role text default 'asesor';
    alter table whatsapp_numero_asesor add column platform_type text, add column onboarded_via text,
      add column onboarded_at timestamptz, add column estado_conexion text check(estado_conexion in ('desconocido','conectado','sin_conexion','on_premise')),
      add column verificado_at timestamptz, add column ultimo_error text;
    alter table whatsapp_inbox add column created_at timestamptz default now();
    create table platform_admins(user_id uuid primary key,active boolean,scope_organization_id uuid);
    create table whatsapp_onboarding_runs(id uuid primary key default gen_random_uuid(),organization_id uuid,
      requested_by uuid,advisor_id uuid,owner_type text,phone_e164 text,status text,provider_state jsonb,
      created_at timestamptz default now(),verified_at timestamptz,last_error text);
    create or replace function fn_phone_canon(value text) returns text language sql immutable as $$
      select case when digits ~ '^521[0-9]{10}$' then '52'||right(digits,10) else nullif(digits,'') end
      from (select regexp_replace(coalesce(value,''),'[^0-9]','','g') digits) d;
    $$;
    insert into platform_admins values('${root}',true,null),('${partner}',true,'${org1}');
    update organizations set parent_organization_id='${org1}' where id='${org1}';
  `);
  const original=read("../../supabase/migrations/265_infobip_multitenant_readonly.sql");
  await db.exec(original.slice(original.indexOf("create or replace function public.fn_activate_whatsapp_readonly"),original.indexOf("create or replace function public.fn_ingest_infobip_multitenant")));
  await db.exec(`begin; ${read("../../supabase/migrations/271_infobip_readonly_receiver_isolation.sql")} commit;`);
  await db.exec(`begin; ${read("../../supabase/migrations/322_whatsapp_portal_self_service.sql")} commit;`);
  ok("incremental RPC migration preserves existing route protections");
  const baseline=(await db.query("select jsonb_agg(to_jsonb(c) order by id) c from whatsapp_numero_asesor c")).rows[0].c;
  await assert.rejects(start(partner,org2,advisor2),/no está disponible/);
  await assert.rejects(start(root,org1,advisor2),/asesor activo/);
  await assert.rejects(start(root,org1,advisor1,"573000000001"),/protegida/);
  ok("partner scope, advisor organization and protected legacy number are enforced in PostgreSQL");

  const run=await start(root,org1,advisor1);
  assert.equal((await start(root,org1,advisor1,"5218183963030")).id,run.id);
  assert.equal((await db.query("select count(*)::int n from whatsapp_onboarding_runs")).rows[0].n,1);
  await assert.rejects(prepare(root,run.id,"5218183963031"),/mismo número/);
  const channel=await prepare(root,run.id);
  assert.equal((await prepare(root,run.id)).channel_id,channel.channel_id);
  await assert.rejects(start(root,org2,advisor2),/conexión diferente/);
  const prepared=(await db.query("select * from whatsapp_readonly_ingestion_routes where channel_id=$1",[channel.channel_id])).rows[0];
  assert.equal(prepared.enabled,true);assert.equal(prepared.protected,false);
  assert.equal((await db.query("select meta_config#>>'{crm,pipeline,0,name}' stage from organizations where id=$1",[org1])).rows[0].stage,"Nuevo prospecto");
  ok("Mexico aliases and retries retain one run/channel; number cannot move to another tenant");

  const waiting=await probe(root,run.id);
  assert.equal(waiting.status,"ready_to_test");assert.equal(waiting.inbound,false);
  assert.equal(waiting.receiver_ready,false);
  await db.query("update whatsapp_onboarding_runs set provider_state=jsonb_set(provider_state,'{receiver,configured_at}',to_jsonb(now())) where id=$1",[run.id]);
  assert.equal((await probe(root,run.id)).status,"ready_to_test");
  ok("registration, configured subscriptions and client checkboxes cannot manufacture a real receipt");

  const payload={results:[{from:"co.private_angel",to:"5218183963030",messageId:"real-fixture-in",
    contact:{userId:"co.private_angel",username:"angel",name:"Angel G"},message:{type:"TEXT",text:"Hola"}}]};
  const received=await invoke("fn_ingest_infobip_multitenant",[JSON.stringify(payload)],["jsonb"]);
  assert.equal(received.created,1);
  const proof=await probe(root,run.id);
  assert.equal(proof.status,"active");assert.equal(proof.lead,true);assert.equal(proof.advisor,true);
  assert.equal(proof.echo_received_at,null);
  assert.equal((await invoke("fn_ingest_infobip_multitenant",[JSON.stringify(payload)],["jsonb"])).duplicate,1);
  assert.equal((await db.query("select estado_conexion from whatsapp_numero_asesor where id=$1",[channel.channel_id])).rows[0].estado_conexion,"conectado");
  ok("real ingestion evidence activates the matching lead/advisor without duplicating BSUID contacts");

  await db.exec("set role authenticated");
  await assert.rejects(start(root,org1,advisor1),/permission denied/);
  await assert.rejects(probe(root,run.id),/permission denied/);
  await db.exec("reset role");
  assert.deepEqual((await db.query("select jsonb_agg(to_jsonb(c) order by id) c from whatsapp_numero_asesor c where id=any($1::uuid[])",[[channel1,channel2]])).rows[0].c,baseline);
  ok("browser roles cannot invoke privileged RPCs; original channels remain byte-equivalent");
  console.log(`${checks} portal PostgreSQL checks passed`);
} finally { await db.close(); }
