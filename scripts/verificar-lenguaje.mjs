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
const PUBLIC = join(RAIZ, "public");

// Formas voseantes que no existen en el español mexicano. Se listan explícitas
// en vez de una regla morfológica: "está" y "acá" también acaban en tilde y son
// perfectamente normales en México — el voseo está en la CONJUGACIÓN.
// Las formas se GENERAN de la raíz del verbo, no se listan a mano: la lista a
// mano se quedó corta la primera vez (se le escaparon "Actualizá" y "Probá" en
// el Copilot). Voseo = raíz + á/ás (-ar), é/és (-er), í/ís (-ir).
//
// OJO con las exclusiones: "estar" daría "está", que es tercera persona normal;
// "dar" daría "dá". Por eso las raíces se listan explícitas y esos verbos NO
// están. Es la diferencia entre un chequeo que se usa y uno que se apaga porque
// grita de más.
const RAIZ_AR = [
  "actualiz", "prob", "intent", "revis", "busc", "seleccion", "esper", "toc",
  "apret", "llam", "avis", "confirm", "complet", "agreg", "guard", "cerr",
  "mand", "asign", "empez", "registr", "marc", "dej", "llev", "mir", "fij",
  "carg", "borr", "cambi", "filtr", "orden", "descarg", "activ", "apag",
  "program", "verific", "valid", "coment", "edit", "copi", "peg", "ajust",
  "cancel", "acept", "rechaz", "arregl", "anot", "cont", "record", "olvid",
];
const RAIZ_ER = [
  "volv", "ten", "pod", "quer", "sab", "hac", "corr", "aprend", "entend",
  "resolv", "respond", "escog", "prend", "encend", "vend", "romp", "le",
];
// De los -ir SOLO se genera el presente (-ís). El imperativo (-í) se escribe
// igual que la primera persona del pasado: "Subí tu foto" es «yo subí», no
// «subí vos». Un chequeo que grita ahí se apaga a la semana, y entonces no
// sirve para nada. Los pocos imperativos -ir que aparezcan se ven a ojo.
const RAIZ_IR = [
  "sub", "abr", "escrib", "decid", "ped", "permit", "imprim", "compart", "eleg",
];
// Pronominales y sueltas que no salen de la fórmula.
const SUELTAS = [
  "decime", "decilo", "contame", "avisame", "mandámela", "mandámelo",
  "asignámelo", "asignámela", "fijate", "acordate", "quedate", "andá", "vení",
  "poné", "ponés", "vos", "tuyo tuyo",
];

const VOSEO = [
  ...RAIZ_AR.flatMap((r) => [`${r}á`, `${r}ás`]),
  ...RAIZ_ER.flatMap((r) => [`${r}é`, `${r}és`]),
  ...RAIZ_IR.map((r) => `${r}ís`),
  ...SUELTAS,
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
function recorrer(dir, extensiones) {
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules" || entrada.startsWith(".")) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) recorrer(ruta, extensiones);
    else if (extensiones.includes(extname(ruta))) archivos.push(ruta);
  }
}
recorrer(SRC, [".js", ".jsx"]);

// LAS PÁGINAS PÚBLICAS TAMBIÉN CUENTAN.
//
// Se revisaba solo el código y quedaban afuera las páginas sueltas del sitio
// —privacidad, soporte— que son justo las que leen el cliente y el revisor de
// Apple. El 28-ago-2026 las dos salieron escritas en voseo argentino y este
// verificador dijo que todo estaba bien: no las miraba.
//
// Son las páginas de MÁS exposición del producto y eran las únicas sin control.
//
// Solo las de la raíz de public/: las carpetas de adentro son material de
// campaña de cada cliente, con su propia voz, y no las escribimos nosotros.
for (const entrada of readdirSync(PUBLIC)) {
  const ruta = join(PUBLIC, entrada);
  if (statSync(ruta).isFile() && extname(ruta) === ".html") archivos.push(ruta);
}

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
