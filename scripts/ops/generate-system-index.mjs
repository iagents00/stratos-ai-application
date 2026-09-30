import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
const walk = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir)
        .sort()
        .flatMap((n) => {
          const p = join(dir, n);
          return statSync(p).isDirectory() ? walk(p) : [p];
        });
const apis = walk("api").filter((p) => /\.[jt]s$/.test(p));
const edge = walk("supabase/functions").filter((p) =>
  /\/index\.[jt]s$/.test(p),
);
const flows = walk("n8n/workflows").filter((p) => p.endsWith(".json"));
const sources = [
  ...walk("src"),
  ...walk("api"),
  ...walk("supabase/functions"),
].filter((p) => /\.[jt]sx?$/.test(p));
const env = new Map();
for (const p of sources) {
  const s = readFileSync(p, "utf8");
  for (const m of s.matchAll(
    /(?:import\.meta\.env\.|process\.env\.)([A-Z][A-Z0-9_]+)|Deno\.env\.get\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
  )) {
    const key = m[1] || m[2];
    if (!env.has(key)) env.set(key, new Set());
    env.get(key).add(p);
  }
}
const link = (p) => `[${p}](../../${p})`;
const table = (title, paths) =>
  `## ${title}\n\n| Archivo | Despliegue |\n|---|---|\n${paths.map((p) => `| ${link(p)} | Verificar en su proveedor; existencia en Git no acredita publicación |`).join("\n")}\n`;
const text = `# Inventario de superficies del sistema\n\nGenerado por scripts/ops/generate-system-index.mjs. No editar a mano. Identifica entradas HTTP, funciones, workflows y nombres de variables; no expone valores. Las importaciones/consultas dinámicas pueden requerir revisión manual.\n\n${table("API web de Vercel", apis)}\n${table("Entradas Edge de Supabase", edge)}\n${table("Workflows exportados de n8n", flows)}\n## Variables encontradas en el código\n\nVITE_ se publica al navegador. Las demás necesitan clasificación y custodia del servidor correspondiente; nunca colocar credenciales privadas en una variable VITE_.\n\n| Nombre | Referencias |\n|---|---|\n${[
  ...env,
]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([name, paths]) => `| ${name} | ${[...paths].map(link).join(", ")} |`)
  .join("\n")}\n`;
const output = "docs/operacion/INVENTARIO.md";
if (process.argv.includes("--check")) {
  if (!existsSync(output) || readFileSync(output, "utf8") !== text) {
    console.error("Inventario desactualizado: npm run ops:inventory");
    process.exit(1);
  }
} else writeFileSync(output, text);
console.log(
  `${apis.length} rutas API, ${edge.length} funciones Edge, ${flows.length} workflows, ${env.size} variables documentadas.`,
);
