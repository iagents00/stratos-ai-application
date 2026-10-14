import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("Infobip receiver passes PostgreSQL legacy protection, isolation and 20x20 mass replay", {timeout:120000}, () => {
  const result=spawnSync(process.execPath,[fileURLToPath(new URL("./sql/infobip-receiver-isolation.mjs",import.meta.url))],
    {encoding:"utf8",timeout:110000});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/8 PostgreSQL isolation checks passed/);
});
