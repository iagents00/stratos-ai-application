import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/265_infobip_multitenant_readonly.sql", import.meta.url), "utf8");
const chat = readFileSync(new URL("../src/app/views/CRM/LeadWhatsAppChat.jsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../src/app/constants/navigation.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../supabase/functions/whatsapp-admin/index.ts", import.meta.url), "utf8");
const tenantGate = readFileSync(new URL("../src/contexts/TenantConfigGate.jsx", import.meta.url), "utf8");

test("Infobip inbound derives tenant and advisor from the active channel", () => {
  assert.match(migration, /c\.proveedor = 'infobip'/);
  assert.match(migration, /public\.fn_phone_canon\(c\.numero_whatsapp\) = v_recipient/);
  assert.match(migration, /Tenant and advisor are resolved server-side/);
  assert.doesNotMatch(migration, /4a17b181-35d2-41b3-b639-6e0bd4c38acc/);
  assert.doesNotMatch(migration, /54ef3b9e-44f3-46d5-84c0-b8acab027adf/);
});

test("Infobip inbound is idempotent and service-role only", () => {
  assert.match(migration, /whatsapp_inbox_provider_event_uidx/);
  assert.match(migration, /whatsapp_messages_provider_event_uidx/);
  assert.match(migration, /on conflict \(organization_id, provider_message_id\)/);
  assert.match(migration, /revoke all on function public\.fn_ingest_infobip_multitenant\(jsonb\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.fn_ingest_infobip_multitenant\(jsonb\)[\s\S]*to service_role/);
});

test("The mirror supports privacy identifiers and does not require Chatwoot", () => {
  assert.match(migration, /whatsapp_bsuid/);
  assert.match(migration, /contact,userId/);
  assert.match(migration, /alter column chatwoot_conversation_id drop not null/);
  assert.match(migration, /BUSINESS_APP_MESSAGE_ECHO/);
  assert.match(migration, /infobip_business_app_echo/);
  assert.match(migration, /lower\(v_direction\), v_text/);
});

test("Coexistence UI is available to tenant roles but remains read-only", () => {
  assert.doesNotMatch(navigation, /user\.role !== "super_admin"/);
  assert.match(chat, /const readOnly = clientConfig\?\.features\?\.whatsappReadOnly === true/);
  assert.match(chat, /const canSend = !readOnly/);
  assert.match(chat, /El equipo responde desde WhatsApp Business/);
  assert.match(admin, /const required = \["inbound", "lead", "advisor", "isolation"\]/);
  assert.match(admin, /fn_activate_whatsapp_readonly/);
  assert.match(migration, /'whatsappReadOnly', true/);
  assert.match(migration, /revoke all on function public\.fn_activate_whatsapp_readonly\(uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(tenantGate, /whatsappModule: configuredFeatures\.whatsappModule === true/);
  assert.match(tenantGate, /whatsappReadOnly: configuredFeatures\.whatsappReadOnly === true/);
});
