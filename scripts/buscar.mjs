#!/usr/bin/env node
/**
 * scripts/buscar.mjs — "¿dónde está esto?" en una línea
 * ─────────────────────────────────────────────────────────────────────────────
 * Para cuando alguien te dice "cambiá el botón que dice Generar PDF" y no
 * tenés idea de en qué archivo vive. Busca en todo src/ sin distinguir mayúsculas
 * ni acentos, y te dice archivo, línea y contexto.
 *
 *   npm run buscar "generar pdf"
 *   npm run buscar "zoom agendado"
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const q = process.argv.slice(2).join(" ").trim();

if (!q) {
  console.log('Uso: npm run buscar "el texto que ves en pantalla"');
  process.exit(1);
}

// Ignorar acentos y mayúsculas: quien busca escribe "codigo", no "código".
const normalizar = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const objetivo = normalizar(q);

function archivos(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.(jsx?|css|json|md|sql)$/.test(n)) acc.push(p);
  }
  return acc;
}

const hits = [];
for (const p of archivos(join(RAIZ, "src"))) {
  const filas = readFileSync(p, "utf8").split("\n");
  filas.forEach((l, i) => {
    if (normalizar(l).includes(objetivo)) {
      hits.push({ archivo: relative(RAIZ, p), linea: i + 1, texto: l.trim().slice(0, 110) });
    }
  });
}

if (!hits.length) {
  console.log(`\nSin resultados para "${q}".`);
  console.log("Probá con menos palabras, o mirá MAPA.md sección 4.\n");
  process.exit(0);
}

console.log(`\n${hits.length} resultado${hits.length > 1 ? "s" : ""} para "${q}":\n`);
for (const h of hits.slice(0, 25)) {
  console.log(`  ${h.archivo}:${h.linea}`);
  console.log(`    ${h.texto}\n`);
}
if (hits.length > 25) console.log(`  … y ${hits.length - 25} más.\n`);
