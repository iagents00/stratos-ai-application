/**
 * scripts/verificar-migraciones.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Las migraciones se numeran en orden. La última siempre es la más nueva.
 *
 * Suena obvio y se rompió dos veces el mismo día: la carpeta va por el 237, y
 * entraron archivos numerados 029, 032 y 033 — que en una carpeta ordenada
 * alfabéticamente aparecen entre migraciones de hace dos años. Quien abra
 * `supabase/migrations/` y lea de arriba abajo entiende exactamente al revés
 * qué pasó primero.
 *
 * Y la versión cara del mismo error: la rama de WhatsApp documentó su migración
 * como `032_whatsapp_tech_provider_routing.sql` y el archivo real terminó
 * llamándose `233_...`. La doc mandaba a un archivo inexistente — la clase de
 * cosa que hace perder media hora a las 11 de la noche.
 *
 * Este chequeo falla si:
 *   · dos migraciones comparten número,
 *   · una migración nueva (sin commitear todavía) usa un número ya pasado.
 *
 *   npm run verificar-migraciones
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(RAIZ, "supabase", "migrations");

const archivos = readdirSync(DIR).filter((f) => f.endsWith(".sql"));
const numerados = archivos
  .map((f) => ({ f, n: Number((f.match(/^(\d+)_/) || [])[1]) }))
  .filter((x) => Number.isFinite(x.n));

let fallos = 0;
const mal = (m) => { console.error(`  ✗ ${m}`); fallos++; };

// Qué agrega ESTA rama. Todo lo demás es historia: ya se aplicó, ya se leyó en
// PRs viejos, y renombrarla ahora solo rompería enlaces sin arreglar nada.
const git = (cmd) => {
  try {
    return execSync(cmd, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").filter((l) => l.endsWith(".sql")).map((r) => r.split("/").pop());
  } catch { return []; }   // sin origin/main (checkout superficial) no hay comparación
};
// `origin/main` a secas, sin `...HEAD`: así entra también lo que todavía no
// commiteaste. Con `...HEAD` el chequeo solo servía en CI, o sea que te avisaba
// después de abrir el PR en vez de antes — probado, y no cazaba nada en local.
let pudoComparar = true;
try {
  execSync("git rev-parse --verify origin/main", { cwd: RAIZ, stdio: "ignore" });
} catch { pudoComparar = false; }

const nuevos = [...new Set([
  ...git("git diff --name-only --diff-filter=A origin/main -- supabase/migrations"),
  ...git("git ls-files --others --exclude-standard -- supabase/migrations"),
])];

const esNuevo = new Set(nuevos);
const viejas = numerados.filter((x) => !esNuevo.has(x.f));

// La deuda histórica se INFORMA, no bloquea. Un chequeo que falla por 17 cosas
// que nadie va a arreglar hoy es un chequeo que alguien apaga el martes.
const ocupados = new Map();
const duplicadosViejos = [];
for (const { f, n } of viejas) {
  if (ocupados.has(n)) duplicadosViejos.push(n);
  else ocupados.set(n, f);
}

const tope = Math.max(...viejas.map((x) => x.n), 0);

for (const f of nuevos) {
  const n = Number((f.match(/^(\d+)_/) || [])[1]);
  if (!Number.isFinite(n)) { mal(`${f} no empieza con un número`); continue; }
  if (ocupados.has(n)) {
    mal(`${f} usa el número ${n}, que ya es de ${ocupados.get(n)}.`);
  } else if (n <= tope) {
    mal(`${f} usa el número ${n}, pero la carpeta ya va en ${tope}.\n` +
        `    Renómbrala a ${String(tope + 1).padStart(3, "0")}_… — si no, aparece entre migraciones de hace años.`);
  }
  ocupados.set(n, f);
}

// Un chequeo que no pudo correr tiene que DECIRLO. Pasar callado es peor que
// fallar: te deja creyendo que alguien revisó.
if (!pudoComparar) {
  console.error("  ✗ No encuentro origin/main, así que no puedo saber qué migraciones son nuevas.");
  console.error("    En CI: fetch-depth: 0 en el checkout. En local: git fetch origin main.");
  process.exit(1);
}

if (fallos) {
  console.error(`\n  Las migraciones tienen que leerse en orden (${fallos}).`);
  process.exit(1);
}
console.log(`  ${numerados.length} migraciones · la última es la más nueva.`);
if (duplicadosViejos.length) {
  console.log(`  (${duplicadosViejos.length} números repetidos de antes, ya aplicados — se dejan como están.)`);
}
