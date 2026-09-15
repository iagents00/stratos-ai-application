import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const git = (...args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};
const release = {
  schemaVersion: 1,
  commit: process.env.VERCEL_GIT_COMMIT_SHA || git("rev-parse", "HEAD"),
  builtAt: new Date().toISOString(),
  serviceWorker:
    readFileSync("public/sw.js", "utf8").match(/stratos-v\d+/)?.[0] || null,
  dirty: Boolean(git("status", "--porcelain")),
  deployment: process.env.VERCEL_URL || null,
};
if (!release.commit || !release.serviceWorker)
  throw new Error("No se puede identificar esta entrega");
writeFileSync(
  `${process.argv[2] || "dist"}/release.json`,
  JSON.stringify(release, null, 2) + "\n",
);
console.log(
  `Entrega identificada: ${release.commit.slice(0, 7)} / ${release.serviceWorker}${release.dirty ? " (árbol modificado)" : ""}`,
);
