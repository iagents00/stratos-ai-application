import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { webProbe } from "../scripts/ops/health-lib.mjs";
import { verifyBackup } from "../scripts/ops/verify-backup.mjs";
const sha = "a".repeat(40);
function fake({ assetStatus = 200, sw = "stratos-v427", dirty = false } = {}) {
  return async (url) => {
    const path = new URL(url).pathname;
    if (path === "/")
      return new Response(
        '<script type="module" src="/assets/app.js"></script>',
      );
    if (path === "/assets/app.js")
      return new Response("app", {
        status: assetStatus,
        headers: { "content-type": "text/javascript" },
      });
    if (path === "/release.json")
      return Response.json({
        commit: sha,
        serviceWorker: "stratos-v427",
        dirty,
      });
    return new Response(sw);
  };
}
test("diagnosis rejects HTTP 200 shells with broken scripts, dirty releases and mismatched versions", async () => {
  assert.ok(
    (await webProbe("https://example.test", sha, fake())).every((c) => c.ok),
  );
  for (const options of [
    { assetStatus: 404 },
    { sw: "stratos-v426" },
    { dirty: true },
  ])
    assert.ok(
      (await webProbe("https://example.test", sha, fake(options))).some(
        (c) => !c.ok,
      ),
    );
  assert.ok(
    (await webProbe("https://example.test", "b".repeat(40), fake())).some(
      (c) => !c.ok,
    ),
  );
});
test("backup verification detects corruption, wrong project and stale files without claiming a restore", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stratos-backup-test-"));
  try {
    const now = new Date();
    const data = "synthetic archive only";
    const hash = createHash("sha256").update(data).digest("hex");
    const manifest = {
      schemaVersion: 1,
      createdAt: now.toISOString(),
      sourceProject: "glulgyhkrqpykxmujodb",
      artifacts: [
        "database",
        "storage",
        "automations",
        "secrets-reference",
      ].map((kind, i) => ({ kind, path: `file${i}`, sha256: hash })),
    };
    manifest.artifacts.forEach((a) => writeFileSync(join(dir, a.path), data));
    const path = join(dir, "manifest.json");
    const write = () => writeFileSync(path, JSON.stringify(manifest));
    write();
    const valid = await verifyBackup(path, now);
    assert.equal(valid.ok, true);
    assert.equal(valid.restoreTested, false);
    writeFileSync(join(dir, "file0"), "corrupted");
    assert.equal((await verifyBackup(path, now)).ok, false);
    writeFileSync(join(dir, "file0"), data);
    manifest.sourceProject = "other";
    write();
    assert.equal((await verifyBackup(path, now)).ok, false);
    manifest.sourceProject = "glulgyhkrqpykxmujodb";
    manifest.createdAt = "2020-01-01";
    write();
    assert.equal((await verifyBackup(path, now)).ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
