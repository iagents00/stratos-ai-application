import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { senderQualityUrl, sameWhatsAppPhone } from "../supabase/functions/whatsapp-admin/infobip-sender.mjs";

test("quality lookup supplies the required sender filter in provider format", () => {
  const request = new URL(senderQualityUrl("https://api.infobip.com/", "+52 81 8396 3030"));
  assert.equal(request.pathname, "/whatsapp/1/senders/quality");
  assert.deepEqual([...request.searchParams], [["senders", "528183963030,5218183963030"]]);
  assert.equal(new URL(senderQualityUrl("https://api.infobip.com", "5218183963030")).searchParams.get("senders"), "5218183963030,528183963030");
  assert.equal(new URL(senderQualityUrl("https://api.infobip.com", "+573237451221")).searchParams.get("senders"), "573237451221");
  assert.throws(() => senderQualityUrl("https://api.infobip.com", ""));
  assert.throws(() => senderQualityUrl("https://api.infobip.com", "+0123456789"));
});

test("provider Mexico mobile aliases resolve to the same business number", () => {
  assert.equal(sameWhatsAppPhone("5218183963030", "+52 81 8396 3030"), true);
  assert.equal(sameWhatsAppPhone("+528183963030", "5218183963030"), true);
  assert.equal(sameWhatsAppPhone("+52 81 8396 3030", "5218183963031"), false);
  assert.equal(sameWhatsAppPhone("+573237451221", "573237451221"), true);
  assert.equal(sameWhatsAppPhone("+12125551234", "+125551234"), false);
  assert.equal(sameWhatsAppPhone(null, null), false);
});

test("admin channel writes respect the existing database connection-state contract", () => {
  const source = readFileSync(new URL("../supabase/functions/whatsapp-admin/index.ts", import.meta.url), "utf8");
  const states = [...source.matchAll(/estado_conexion:\s*"([^"]+)"/g)].map(match => match[1]);
  const databaseStates = new Set(["conectado", "sin_conexion", "on_premise", "desconocido"]);
  assert.ok(states.length > 0);
  for (const state of states) assert.ok(databaseStates.has(state), `Database rejects state: ${state}`);
});
