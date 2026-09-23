/** Prints a concrete rollback by default. Execution requires an explicit deployment and flag. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const c = JSON.parse(
  readFileSync(new URL("../../ops/services.json", import.meta.url)),
).production;
const args = process.argv.slice(2);
const i = args.indexOf("--deployment");
const id = i >= 0 ? args[i + 1] : null;
if (!/^dpl_[A-Za-z0-9]+$/.test(id || ""))
  throw new Error(
    "Indica --deployment dpl_ID de una entrega previamente verificada.",
  );
const metadata = JSON.parse(
  execFileSync("vercel", ["api", `/v13/deployments/${id}`, "--scope", c.team], {
    encoding: "utf8",
    timeout: 20000,
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
if (metadata.projectId !== c.projectId || metadata.readyState !== "READY")
  throw new Error(
    "Entrega no lista o de otro proyecto. No se cambia producción.",
  );
const command = [
  "promote",
  metadata.url,
  "--scope",
  c.team,
  "--yes",
  "--timeout",
  "60s",
];
console.log(
  JSON.stringify(
    {
      mode: args.includes("--execute") ? "execute" : "dry-run",
      project: c.projectId,
      fromVerifiedDeployment: id,
      commit: metadata.meta?.githubCommitSha || null,
      command: ["vercel", ...command],
      after: "npm run ops:doctor",
      scope:
        "Solo web. No restaura base, secretos, automatizaciones ni apps nativas.",
    },
    null,
    2,
  ),
);
if (args.includes("--execute"))
  execFileSync("vercel", command, { stdio: "inherit", timeout: 75000 });
