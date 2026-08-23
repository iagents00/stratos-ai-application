#!/usr/bin/env node
/**
 * scripts/verificar-docs.mjs — Que ninguna documentación mienta
 * ─────────────────────────────────────────────────────────────────────────────
 * CLAUDE.md decía que Dash estaba en App.jsx:260. Se había movido meses antes.
 * Una doc que apunta a un archivo inexistente es peor que no tener doc: no la
 * dudás, vas, y no está.
 *
 * Este script busca en todos los .md las referencias a archivos del repo y falla
 * si alguna no existe. Cuando encuentra una rota, propone el archivo real con el
 * mismo nombre, así el arreglo es copiar y pegar.
 *
 *   npm run verificar-docs
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORAR = new Set(["node_modules", ".git", "dist", "backups", ".github"]);

function recorrer(dir, filtro, acc = []) {
  for (const n of readdirSync(dir)) {
    if (IGNORAR.has(n) || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p, filtro, acc);
    else if (filtro(n)) acc.push(p);
  }
  return acc;
}

const docs   = recorrer(RAIZ, (n) => n.endsWith(".md"));
const codigo = recorrer(RAIZ, (n) => /\.(jsx?|mjs|css|json|sql)$/.test(n));

// Índice por nombre de archivo, para proponer el reemplazo correcto.
const porNombre = new Map();
for (const p of codigo) {
  const k = basename(p);
  if (!porNombre.has(k)) porNombre.set(k, []);
  porNombre.get(k).push(relative(RAIZ, p));
}

const REF = /`((?:src|public|scripts|supabase|mobile|n8n|api|ops)\/[A-Za-z0-9_./-]+\.(?:jsx?|mjs|css|json|sql))`/g;

let rotas = 0;
let revisadas = 0;

for (const d of docs) {
  const relDoc = relative(RAIZ, d);
  const vistas = new Set();
  for (const m of readFileSync(d, "utf8").matchAll(REF)) {
    const ref = m[1];
    if (vistas.has(ref)) continue;
    vistas.add(ref);
    revisadas++;
    if (existsSync(join(RAIZ, ref))) continue;

    rotas++;
    const sugerencias = porNombre.get(basename(ref)) || [];
    console.error(`\n  ${relDoc}`);
    console.error(`    apunta a  ${ref}`);
    console.error(sugerencias.length
      ? `    ¿querías decir?  ${sugerencias.slice(0, 3).join("  |  ")}`
      : `    y no existe ningún archivo con ese nombre en el repo`);
  }
}

console.log(`\n${docs.length} documentos · ${revisadas} referencias revisadas · ${rotas} rota${rotas === 1 ? "" : "s"}`);

if (rotas) {
  console.error(`\nHay documentación que manda al lugar equivocado. Corregí las rutas de arriba.\n`);
  process.exit(1);
}
console.log("Ninguna documentación miente.\n");
