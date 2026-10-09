/** Isolated PostgreSQL contract test. Never connects to production. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { PGlite } = await import(
  process.env.STRATOS_PGLITE_MODULE || "@electric-sql/pglite"
);

const db = new PGlite();
const org1 = "10000000-0000-0000-0000-000000000001";
const org2 = "10000000-0000-0000-0000-000000000002";
const advisor1 = "20000000-0000-0000-0000-000000000001";
const advisor2 = "20000000-0000-0000-0000-000000000002";
const channel1 = "30000000-0000-0000-0000-000000000001";
const channel2 = "30000000-0000-0000-0000-000000000002";
let passed = 0;

const ok = (message) => {
  passed += 1;
  console.log(`✓ ${message}`);
};

const call = (payload) =>
  db.query("select public.fn_ingest_infobip_multitenant($1::jsonb) result", [
    JSON.stringify(payload),
  ]);
const callAsService = async (payload) => {
  await db.exec("set role service_role");
  try {
    return await call(payload);
  } finally {
    await db.exec("reset role");
  }
};

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    grant usage on schema public to anon, authenticated, service_role;

    create table public.organizations (
      id uuid primary key,
      meta_config jsonb not null default '{}'::jsonb
    );
    create table public.profiles (
      id uuid primary key,
      organization_id uuid not null,
      name text,
      active boolean not null default true
    );
    create table public.leads (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      name text,
      phone text,
      whatsapp_phone_e164 text,
      whatsapp_wa_id text,
      source text,
      stage text,
      asesor_id uuid,
      asesor_name text,
      fecha_ingreso timestamptz,
      last_activity text,
      is_new boolean,
      action_history jsonb default '[]'::jsonb,
      days_inactive integer default 0,
      deleted_at timestamptz,
      updated_at timestamptz default now()
    );
    create table public.whatsapp_numero_asesor (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      numero_whatsapp text not null,
      asesor_id uuid,
      asesor_name text not null,
      proveedor text,
      active boolean not null default true
    );
    create table public.whatsapp_inbox (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      source text,
      asesor_phone text,
      asesor_id uuid,
      sender_phone text,
      sender_phone_normalized text,
      sender_name text,
      message_text text,
      media_urls jsonb,
      raw_payload jsonb,
      received_at timestamptz,
      provider_message_id text,
      lead_id uuid,
      processed_at timestamptz,
      processing_error text
    );
    create table public.whatsapp_messages (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      lead_id uuid,
      chatwoot_conversation_id integer not null,
      direction text not null,
      content text,
      content_type text,
      sender_name text,
      sender_type text,
      message_created_at timestamptz,
      media jsonb,
      created_at timestamptz not null default now()
    );
    create table public.comunicaciones (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      lead_id uuid,
      asesor_id uuid,
      tipo text,
      resumen text,
      transcripcion text,
      ocurrio_en timestamptz,
      metadata jsonb
    );
    create function public.fn_phone_canon(value text)
    returns text language sql immutable as $$
      select nullif(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), '')
    $$;

    insert into public.organizations(id, meta_config) values
      ('${org1}', '{"crm":{"pipeline":[{"name":"Nuevo prospecto"}]}}'),
      ('${org2}', '{}');
    insert into public.profiles(id, organization_id, name) values
      ('${advisor1}', '${org1}', 'Asesor Uno'),
      ('${advisor2}', '${org2}', 'Asesor Dos');
    insert into public.whatsapp_numero_asesor(
      id, organization_id, numero_whatsapp, asesor_id, asesor_name, proveedor
    ) values
      ('${channel1}', '${org1}', '+57 300 000 0001', '${advisor1}', 'Asesor Uno', 'infobip'),
      ('${channel2}', '${org2}', '+57 300 000 0002', '${advisor2}', 'Asesor Dos', 'infobip');
  `);

  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/265_infobip_multitenant_readonly.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  ok("Migration compiles and applies atomically");

  await db.exec("set role service_role");
  await db.query("select public.fn_activate_whatsapp_readonly($1::uuid)", [org1]);
  await db.exec("reset role");
  const activated = (
    await db.query("select meta_config from public.organizations where id = $1", [org1])
  ).rows[0].meta_config;
  assert.equal(activated.crm.pipeline[0].name, "Nuevo prospecto");
  assert.equal(activated.features.whatsappModule, true);
  assert.equal(activated.features.whatsappChat, true);
  assert.equal(activated.features.whatsappReadOnly, true);
  ok("Read-only activation preserves concurrent tenant configuration");

  const first = {
    results: [
      {
        integrationType: "WHATSAPP",
        to: "+57 300 000 0001",
        from: "+57 311 111 1111",
        messageId: "msg-org-1",
        receivedAt: "2026-10-09T15:00:00Z",
        contact: { userId: "573111111111", name: "Cliente Uno" },
        message: { type: "TEXT", text: "Quiero información" },
      },
    ],
  };

  const firstResult = (await callAsService(first)).rows[0].result;
  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.created, 1);
  const leadOne = (
    await db.query(
      "select organization_id::text, asesor_id::text, stage, phone from public.leads",
    )
  ).rows[0];
  assert.equal(leadOne.organization_id, org1);
  assert.equal(leadOne.asesor_id, advisor1);
  assert.equal(leadOne.stage, "Nuevo prospecto");
  assert.equal(leadOne.phone, "+573111111111");
  ok("Destination number resolves tenant, advisor and tenant pipeline stage");

  const duplicate = (await callAsService(first)).rows[0].result;
  assert.equal(duplicate.duplicate, 1);
  assert.equal(
    (await db.query("select count(*)::int n from public.whatsapp_messages"))
      .rows[0].n,
    1,
  );
  ok("Provider message ID is idempotent");

  const appEcho = {
    eventType: "BUSINESS_APP_MESSAGE_ECHO",
    results: [
      {
        integrationType: "WHATSAPP",
        direction: "OUT",
        from: "+57 300 000 0001",
        to: "+57 311 111 1111",
        messageId: "echo-org-1",
        receivedAt: "2026-10-09T15:02:00Z",
        contact: { userId: "573111111111", name: "Cliente Uno" },
        message: { type: "TEXT", text: "Claro, te envío la información" },
      },
    ],
  };
  const echoResult = (await callAsService(appEcho)).rows[0].result;
  assert.equal(echoResult.echoed, 1);
  assert.equal(echoResult.created, 0);
  const echoMessage = (
    await db.query(
      "select direction, sender_name, sender_type from public.whatsapp_messages where provider_message_id = 'echo-org-1'",
    )
  ).rows[0];
  assert.equal(echoMessage.direction, "out");
  assert.equal(echoMessage.sender_name, "Asesor Uno");
  assert.equal(echoMessage.sender_type, "advisor");
  assert.equal(
    (await db.query("select count(*)::int n from public.leads where organization_id = $1", [org1]))
      .rows[0].n,
    1,
  );
  ok("Business App echoes complete the read-only conversation without duplicating leads");

  const duplicateEcho = (await callAsService(appEcho)).rows[0].result;
  assert.equal(duplicateEcho.duplicate, 1);
  ok("Business App echoes are idempotent");

  const bsuidPayload = {
    results: [
      {
        integrationType: "WHATSAPP",
        to: "573000000002",
        from: "co.private_contact_42",
        messageId: "msg-org-2",
        contact: {
          userId: "co.private_contact_42",
          username: "cliente_privado",
          name: "Cliente Dos",
        },
        message: { type: "TEXT", text: "Necesito una cotización" },
      },
    ],
  };
  await callAsService(bsuidPayload);
  const leadTwo = (
    await db.query(
      `select organization_id::text, asesor_id::text, whatsapp_bsuid,
              whatsapp_username, phone
         from public.leads
        where organization_id = '${org2}'`,
    )
  ).rows[0];
  assert.equal(leadTwo.organization_id, org2);
  assert.equal(leadTwo.asesor_id, advisor2);
  assert.equal(leadTwo.whatsapp_bsuid, "co.private_contact_42");
  assert.equal(leadTwo.whatsapp_username, "cliente_privado");
  assert.equal(leadTwo.phone, null);
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from public.whatsapp_messages where organization_id = '${org1}'`,
      )
    ).rows[0].n,
    2,
  );
  ok("BSUID-only contacts remain isolated in the correct tenant");

  await assert.rejects(
    callAsService({ ...first, organization_id: org2 }),
    /Tenant and advisor are resolved server-side/,
  );
  ok("Payload cannot forge organization or advisor");

  await db.exec("set role authenticated");
  await assert.rejects(call(first), /permission denied/);
  ok("Only service_role can invoke the ingestion RPC");

  console.log(`${passed} isolated PostgreSQL checks passed.`);
} finally {
  await db.close();
}
