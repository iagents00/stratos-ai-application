/**
 * scripts/verificar-lenguaje.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * El español de la interfaz es NEUTRO MEXICANO: tú / puedes / háblale.
 * Nunca vos / podés / mandá.
 *
 * La regla ya estaba escrita en el repo (src/landing/manual-telegram-content.js)
 * pero no la revisaba nadie, y se habían colado 29 textos en voseo rioplatense
 * — incluido el botón de registrar un cliente ("Asigná un asesor") y el
 * confirmar de llamar. A un asesor de Cancún eso le suena a que el sistema lo
 * escribió alguien que no es de aquí, que es exactamente la impresión que no
 * queremos dar.
 *
 * Solo mira TEXTO DE PANTALLA. Los comentarios del código quedan libres: no los
 * lee ningún cliente.
 *   npm run verificar-lenguaje
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");

// Formas voseantes que no existen en el español mexicano. Se listan explícitas
// en vez de una regla morfológica: "está" y "acá" también acaban en tilde y son
// perfectamente normales en México — el voseo está en la CONJUGACIÓN.
const VOSEO = [
  "querés", "podés", "tenés", "sabés", "hacés", "vení", "andá", "mirá", "dale que",
  "poné", "asigná", "empezá", "registrá", "escribí", "elegí", "mencioná", "mandá",
  "decime", "decilo", "contame", "fijate", "mandámela", "asignámelo", "avisame",
  "marcás", "bajás", "ponés", "mandás", "llevás", "dejás", "guardá", "agregá", "cerrá",
];

// OJO con \b: en JavaScript es ASCII, así que trata la "á" como frontera de
// palabra y "mirándose" daba positivo por "mirá". Con lookarounds Unicode, una
// letra acentuada cuenta como letra y el falso positivo desaparece.
const RE = new RegExp(`(?<![\\p{L}])(${VOSEO.join("|")})(?![\\p{L}])`, "iu");
const ES_COMENTARIO = /^\s*(\/\/|\*|\/\*)/;
// `tags:` son sinónimos de BÚSQUEDA: ahí "avisame" está a propósito, porque un
// usuario puede escribirlo así aunque la interfaz nunca se lo diga.
const ES_SINONIMOS = /^\s*tags\s*:/;

const archivos = [];
(function recorrer(dir) {
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules" || entrada.startsWith(".")) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else if ([".js", ".jsx"].includes(extname(ruta))) archivos.push(ruta);
  }
})(SRC);

const hallazgos = [];
for (const ruta of archivos) {
  let enBloque = false;
  readFileSync(ruta, "utf8").split("\n").forEach((linea, i) => {
    // Los comentarios /* */ de varias líneas: sus líneas interiores no empiezan
    // con "*" necesariamente, así que hay que llevar la cuenta.
    const abre = linea.lastIndexOf("/*"), cierra = linea.lastIndexOf("*/");
    const eraBloque = enBloque;
    if (!enBloque && abre > cierra) enBloque = true;
    else if (enBloque && cierra > abre) enBloque = false;
    if (eraBloque || enBloque) return;
    if (ES_COMENTARIO.test(linea) || ES_SINONIMOS.test(linea)) return;
    const m = linea.match(RE);
    if (m) hallazgos.push({ ruta: relative(RAIZ, ruta), n: i + 1, palabra: m[1], linea: linea.trim().slice(0, 96) });
  });
}

if (hallazgos.length) {
  console.error(`  Voseo en texto de pantalla (${hallazgos.length}). La interfaz habla mexicano neutro:\n`);
  for (const h of hallazgos) console.error(`  ✗ ${h.ruta}:${h.n}  «${h.palabra}»\n    ${h.linea}`);
  console.error("\n  tú / puedes / háblale — nunca vos / podés / mandá.");
  process.exit(1);
}
console.log(`  ${archivos.length} archivos revisados · la interfaz habla mexicano neutro.`);
