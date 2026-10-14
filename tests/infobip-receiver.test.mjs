import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeInfobipPayload, buildInfobipReadonlyWorkflow } from "../tools/workflows/infobip-readonly-receiver.mjs";

const sample = () => ({ results: [{ from: "573111111111", to: "573000000001", messageId: "evt-1",
  integrationType: "WHATSAPP", message: { type: "text", text: "Información" } }] });
test("Infobip receiver accepts inbound and forces endpoint-bound direction", () => {
  assert.equal(normalizeInfobipPayload(sample(), "INBOUND_MESSAGE").results[0].direction, "IN");
  assert.equal(normalizeInfobipPayload(sample(), "BUSINESS_APP_MESSAGE_ECHO").results[0].direction, "OUT");
  assert.equal(normalizeInfobipPayload(sample(), "INBOUND_MESSAGE").results[0].message.type, "TEXT");
  const spoofed = sample(); spoofed.results[0].direction = "OUT";
  assert.throws(() => normalizeInfobipPayload(spoofed, "INBOUND_MESSAGE"), /Direction mismatch/);
});
test("Infobip receiver fails closed on tenant overrides, unknown envelopes and oversized batches", () => {
  assert.throws(() => normalizeInfobipPayload({ ...sample(), organization_id: "other" }, "INBOUND_MESSAGE"));
  const forged = sample(); forged.results[0].asesor_id = "other";
  assert.throws(() => normalizeInfobipPayload(forged, "INBOUND_MESSAGE"));
  assert.throws(() => normalizeInfobipPayload({ entry: [] }, "INBOUND_MESSAGE"));
  assert.throws(() => normalizeInfobipPayload({ results: Array(2001).fill(sample().results[0]) }, "INBOUND_MESSAGE"));
  assert.throws(() => normalizeInfobipPayload(sample(), "DELIVERY"));
  assert.deepEqual(normalizeInfobipPayload({ results: [] }, "INBOUND_MESSAGE"), { eventType: "INBOUND_MESSAGE", results: [] });
});
test("Workflow is authenticated, new-path-only, retries storage errors and does not send WhatsApp", () => {
  const flow = buildInfobipReadonlyWorkflow({ basicCredentialId: "new-auth", supabaseCredentialId: "stratos-auth" });
  const hooks = flow.nodes.filter(node => node.type.endsWith(".webhook"));
  assert.equal(hooks.length, 2);
  assert.ok(hooks.every(node => node.parameters.authentication === "basicAuth"));
  assert.ok(hooks.every(node => node.parameters.path.startsWith("stratos-infobip-readonly-")));
  assert.ok(flow.nodes.filter(node => node.type.endsWith(".httpRequest")).every(
    node => node.parameters.url.endsWith("/rpc/fn_ingest_infobip_multitenant")));
  assert.equal(flow.settings.saveDataSuccessExecution, "none");
  assert.equal(flow.settings.saveDataErrorExecution, "none");
  assert.equal(flow.nodes.find(node => node.id === "retry").parameters.options.responseCode, 503);
  assert.doesNotMatch(JSON.stringify(flow), /infobip-nsg-ivan|fn_ingest_infobip_nsg|message\/send/);
});
test("Incremental migration protects existing channels and preserves legacy contracts", () => {
  const sql = readFileSync(new URL("../supabase/migrations/271_infobip_readonly_receiver_isolation.sql", import.meta.url), "utf8");
  assert.match(sql, /select id, true from public\.whatsapp_numero_asesor/);
  assert.match(sql, /Existing production channel is protected/);
  assert.match(sql, /route\.enabled and not route\.protected/);
  assert.match(sql, /where provider_message_id is not null and channel_id is not null/);
  assert.match(sql, /provider <> 'chatwoot' or chatwoot_conversation_id is not null/);
  assert.doesNotMatch(sql, /create or replace function public\.fn_activate_whatsapp_readonly/);
  assert.doesNotMatch(sql, /\b(delete from|truncate|drop table|drop function)\b/i);
});
