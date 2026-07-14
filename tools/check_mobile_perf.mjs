#!/usr/bin/env node
/**
 * tools/check_mobile_perf.mjs — Guardián anti-crash de iPhone
 * ─────────────────────────────────────────────────────────────────────────────
 * Corre en CADA build (npm run build → prebuild). Si falla, el build NO pasa.
 *
 * POR QUÉ EXISTE: el CRM se cayó VARIAS veces en Safari/iPhone ("Ocurrió un
 * problema varias veces") por memoria de compositing de WebKit: capas con
 * backdrop-filter + animaciones infinitas. Se arregló en julio-7 (PR #273) y
 * VOLVIÓ en julio-9 porque los PRs nuevos agregaron capas que las defensas no
 * cubrían. Este script hace que las defensas sean OBLIGATORIAS para siempre.
 * Detalle completo: memory/lessons.md del AIOS (2026-07-07 y 2026-07-09).
 *
 * QUÉ VERIFICA:
 *   1. src/mobile-perf.css existe y conserva sus 3 reglas marcadas con
 *      [guard:...] (apagado universal de backdrop-filter en móvil, will-change
 *      y freno de animaciones infinitas inline).
 *   2. src/main.jsx sigue importando mobile-perf.css.
 *   3. index.html conserva el detector de crash ([guard:BOOT-HEALTH]).
 *   4. Ningún archivo .css de src/ (salvo mobile-perf.css) declara animaciones
 *      `infinite` por CLASE: el freno de móvil solo mata las inline
 *      ([style*="infinite"]); una animación infinita por clase se le escaparía
 *      y repintaría cada frame en iPhone. Si de verdad la necesitás, hacela
 *      inline (style={{animation:"... infinite"}}) y quedará frenada en móvil
 *      automáticamente.
 *
 * Si este guard te está bloqueando: NO lo borres — arreglá el patrón que
 * introduce riesgo de crash. El look de PC no se toca; todo esto es solo móvil.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const errores = [];

function leer(p) {
  try { return readFileSync(join(ROOT, p), "utf8"); } catch { return null; }
}

/* 1) mobile-perf.css intacto (por marcadores, no por texto exacto) */
const css = leer("src/mobile-perf.css");
if (!css) {
  errores.push("src/mobile-perf.css NO EXISTE. Es la defensa anti-crash de iPhone (lessons 07/09-jul). Restauralo desde git.");
} else {
  for (const marca of ["guard:MOBILE-KILL-BACKDROP", "guard:MOBILE-KILL-WILLCHANGE", "guard:MOBILE-KILL-INFINITE"]) {
    if (!css.includes(marca)) {
      errores.push(`src/mobile-perf.css perdió la regla [${marca}]. Esa regla evita el crash de memoria en iPhone — restaurala (git log del archivo).`);
    }
  }
  // la regla universal de backdrop debe seguir siendo universal
  if (!/\*\s*,[\s\S]{0,80}backdrop-filter:\s*none\s*!important/.test(css.replace(/\/\*[\s\S]*?\*\//g, ""))) {
    errores.push("src/mobile-perf.css: el apagado de backdrop-filter en móvil ya no es UNIVERSAL (selector *). Un blur nuevo se escaparía y vuelve el crash.");
  }
}

/* 2) main.jsx lo importa */
const main = leer("src/main.jsx");
if (main && !main.includes("mobile-perf.css")) {
  errores.push('src/main.jsx ya no importa "./mobile-perf.css" — sin el import, TODA la defensa móvil desaparece.');
}

/* 3) index.html conserva el detector de crash */
const html = leer("index.html");
if (html && !html.includes("guard:BOOT-HEALTH")) {
  errores.push("index.html perdió el detector de crash [guard:BOOT-HEALTH] (modo seguro pegajoso de 48h). Restauralo.");
}

/* 4) sin animaciones `infinite` por CLASE en CSS (el freno móvil no las ve) */
function cssFiles(dir) {
  const out = [];
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, f);
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) out.push(...cssFiles(rel));
    else if (f.endsWith(".css") && !rel.endsWith("mobile-perf.css")) out.push(rel);
  }
  return out;
}
for (const f of cssFiles("src")) {
  const contenido = leer(f).replace(/\/\*[\s\S]*?\*\//g, "");
  const lineas = contenido.split("\n");
  lineas.forEach((l, i) => {
    if (/animation[^;]*\binfinite\b/.test(l)) {
      errores.push(`${f}:${i + 1} declara una animación INFINITA por clase — en iPhone repinta cada frame y el freno móvil no la ve. Usala INLINE (style={{animation:"... infinite"}}) para que móvil la frene sola.`);
    }
  });
}

if (errores.length) {
  console.error("\n⛔ GUARDIÁN ANTI-CRASH DE IPHONE — el build se detuvo:\n");
  for (const e of errores) console.error("  • " + e);
  console.error("\nContexto: el CRM se cayó en Safari/iPhone por memoria de compositing");
  console.error("(lessons del AIOS 2026-07-07 y 2026-07-09). Estas defensas son obligatorias.\n");
  process.exit(1);
}
console.log("✓ guardián anti-crash iPhone: defensas intactas");
