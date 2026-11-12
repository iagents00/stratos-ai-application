import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
test("self-service WhatsApp enrollment enforces real PostgreSQL scope, retries and receipt evidence", {timeout:120000}, () => {
  const result=spawnSync(process.execPath,[fileURLToPath(new URL("./sql/whatsapp-portal-self-service.mjs",import.meta.url))],{encoding:"utf8",timeout:110000});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/6 portal PostgreSQL checks passed/);
});
