import { readFileSync, existsSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync(new URL("../../ops/services.json", import.meta.url)),
);
const root = new URL("../../", import.meta.url);
const ids = new Set(catalog.services.map((s) => s.id));
const errors = [];
if (ids.size !== catalog.services.length) errors.push("Servicios duplicados");
for (const service of catalog.services) {
  if (!service.ownerRole || !service.recovery)
    errors.push(`${service.id}: falta responsable o recuperación`);
  for (const path of [...service.entrypoints, service.runbook])
    if (!existsSync(new URL(path, root)))
      errors.push(`${service.id}: ruta inexistente ${path}`);
  for (const dep of service.dependsOn)
    if (!ids.has(dep))
      errors.push(`${service.id}: dependencia inexistente ${dep}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `${ids.size} servicios con responsables por función, dependencias, entradas y procedimiento. La asignación de personas y acceso real se valida en el ensayo operativo.`,
);
