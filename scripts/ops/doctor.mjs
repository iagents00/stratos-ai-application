import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { probe, webProbe } from "./health-lib.mjs";
const source = readFileSync(
  new URL("../../src/lib/supabase.js", import.meta.url),
  "utf8",
);
const db = source.match(/FALLBACK_URL\s*=\s*'([^']+)'/)?.[1];
const key = source.match(/FALLBACK_KEY\s*=\s*'([^']+)'/)?.[1];
if (!db || !key)
  throw new Error("Falta identificar la conexión pública del cliente");
const args = process.argv.slice(2);
const value = (flag) => {
  const i = args.indexOf(flag);
  return i < 0 ? undefined : args[i + 1];
};
const origins = value("--origin")
  ? [value("--origin")]
  : JSON.parse(
      readFileSync(new URL("../../ops/services.json", import.meta.url)),
    ).production.origins;
const start = Date.now();
const [web, platform] = await Promise.all([
  Promise.all(
    origins.map(async (origin) => ({
      origin,
      checks: await webProbe(origin, value("--expect")),
    })),
  ),
  Promise.all([
    probe("database", `${db}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: key },
      validate: async (r) => Array.isArray(await r.json()),
    }),
    probe("auth_health", `${db}/auth/v1/health`, {
      headers: { apikey: key },
      validate: async (r) => typeof (await r.json()) === "object",
    }),
  ]),
]);
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  durationMs: Date.now() - start,
  ok: [...web.flatMap((w) => w.checks), ...platform].every((c) => c.ok),
  web,
  platform,
  unverified: [
    "authenticated CRUD and tenant isolation",
    "backup restore/PITR",
    "n8n execution and providers",
    "native apps",
  ],
};
const output = value("--output");
if (output) {
  const path = resolve(output);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
