/** Validates artifact integrity. Does NOT certify restorability or load any data. */
import { readFileSync, statSync, createReadStream } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
export async function verifyBackup(path, now = new Date()) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const errors = [];
  const root = dirname(resolve(path));
  if (manifest.sourceProject !== "glulgyhkrqpykxmujodb")
    errors.push("El respaldo no pertenece al proyecto Stratos");
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.createdAt ||
    !manifest.sourceProject
  )
    errors.push("Manifiesto incompleto");
  const age = (now - new Date(manifest.createdAt)) / 3600000;
  if (!Number.isFinite(age) || age < 0 || age > 24)
    errors.push("Fecha inválida o respaldo con más de 24 horas");
  const required = ["database", "storage", "automations", "secrets-reference"];
  for (const kind of required)
    if (!manifest.artifacts?.some((a) => a.kind === kind))
      errors.push(`Falta ${kind}`);
  for (const a of manifest.artifacts || []) {
    const target = resolve(root, a.path || "");
    const rel = relative(root, target);
    if (!a.path || isAbsolute(a.path) || rel.startsWith("..")) {
      errors.push("Ruta fuera del paquete");
      continue;
    }
    try {
      if (statSync(target).size === 0) throw new Error();
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(target)) hash.update(chunk);
      if (hash.digest("hex") !== a.sha256)
        errors.push(`Integridad inválida: ${a.kind}`);
    } catch {
      errors.push(`Artefacto ausente o vacío: ${a.kind}`);
    }
  }
  return {
    ok: !errors.length,
    errors,
    restoreTested: false,
    notice:
      "Integridad de archivos solamente. Falta un ensayo de restauración aislado.",
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv[2])
    throw new Error("Uso: npm run ops:backup-check -- /ruta/manifest.json");
  const result = await verifyBackup(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
