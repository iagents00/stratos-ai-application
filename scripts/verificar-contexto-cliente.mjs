/**
 * scripts/verificar-contexto-cliente.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Chequeo de regresión del contexto de cliente.
 *
 * En PR #666 el ClientProvider renombró la llave `config` a `activa`, y los 13
 * componentes que la leen —todos con optional chaining— dejaron de recibirla sin
 * crashear ni una vez: la personalización por cliente (branding del login, bot
 * de Telegram por tenant, nombre legal en los tableros, KPIs y etiquetas del
 * CRM, la pestaña de Zoom Control) se apagó en silencio durante días.
 *
 * Este script falla si esa forma vuelve a romperse.
 *   npm run verificar-contexto     ·     también corre dentro de `npm run verificar-docs`
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const LLAVES = ["config", "clientId", "setClientById", "isFeatureEnabled"];

let fallos = 0;
const err = (m) => { console.error(`  ✗ ${m}`); fallos++; };
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");

// ── 1. Comportamiento real ──────────────────────────────────────────────────
// El código de la app importa sin extensión (lo resuelve Vite), así que se carga
// con el propio Vite en vez de con Node pelado: se prueba lo que corre, no una copia.
const vite = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
try {
  const { crearValorCliente } = await vite.ssrLoadModule("/src/clients/_shared/client-value.js");
  const { getClientConfig, CLIENT_IDS } = await vite.ssrLoadModule("/src/clients/index.js");

  const ids = Array.isArray(CLIENT_IDS) && CLIENT_IDS.length
    ? CLIENT_IDS : ["duke", "grupo28", "nsg", "vega", "tgenius"];

  for (const id of ids) {
    const cfg = getClientConfig(id);
    if (!cfg) continue;
    const v = crearValorCliente(cfg);
    const faltan = LLAVES.filter((k) => !(k in v));
    if (faltan.length)     err(`${id}: al value le faltan las llaves ${faltan.join(", ")}`);
    else if (!v.config)    err(`${id}: config vino vacía`);
    else console.log(`  ✓ ${String(id).padEnd(9)} config.name="${v.config.name}"  clientId=${v.clientId}`);
  }

  // Sin config cae a defaults, nunca a undefined.
  if (!crearValorCliente(null).config) err("crearValorCliente(null) devolvió config vacía");
} finally {
  await vite.close();
}

// ── 2. Nadie arma el value a mano ───────────────────────────────────────────
// Así es exactamente como se desincronizó la primera vez.
for (const [ruta, quien] of [
  ["src/contexts/ClientContext.jsx", "el Provider"],
  ["src/hooks/useClient.js",         "useClient()"],
]) {
  if (!leer(ruta).includes("crearValorCliente")) {
    err(`${quien} (${ruta}) ya no usa crearValorCliente() — así se rompió en #666`);
  }
}
if (/\bactiva:\s*cfg/.test(leer("src/contexts/ClientContext.jsx"))) {
  err("el Provider volvió a exponer `activa:` en vez de `config:`");
}

if (fallos) {
  console.error(`\n  El contexto de cliente está desincronizado (${fallos}). Ver src/clients/_shared/client-value.js.`);
  process.exit(1);
}
console.log("\n  El contexto de cliente expone la misma forma en los tres lugares.");
