#!/usr/bin/env node
/**
 * salud.mjs — ¿está viva la producción, ahora mismo?
 *
 * Tres preguntas, en el orden en que se rompen las cosas:
 *   1. ¿Responde la base de datos?   (y si no, ¿por qué: pago, pausa, caída)
 *   2. ¿Se puede iniciar sesión?
 *   3. ¿Está sirviendo la app, y con qué versión?
 *
 *     npm run salud
 *
 * Es de LECTURA. No escribe nada, no necesita credenciales privadas: usa la
 * llave `anon`, la misma que viaja en el bundle del navegador.
 *
 * NO va en CI: depende de la red, y un falso rojo en main cuesta más de lo que
 * ahorra. Se corre a mano cuando hay una sospecha — o cuando hay una factura
 * sin pagar y quieres saber si ya te restringieron antes de que te lo digan
 * los usuarios.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// Una sola fuente de verdad: lo que la app usa de verdad al arrancar.
const cliente = readFileSync(join(raiz, "src/lib/supabase.js"), "utf8");
const URL_BASE = cliente.match(/FALLBACK_URL\s*=\s*'([^']+)'/)?.[1];
const LLAVE = cliente.match(/FALLBACK_KEY\s*=\s*'([^']+)'/)?.[1];

if (!URL_BASE || !LLAVE) {
  console.error("No pude leer FALLBACK_URL / FALLBACK_KEY de src/lib/supabase.js.");
  console.error("Si los renombraron, actualiza scripts/salud.mjs.");
  process.exit(2);
}

const APP = "https://app.stratoscapitalgroup.com";
const ESPERA = 15000;

async function pedir(url, opciones = {}) {
  const corte = AbortSignal.timeout(ESPERA);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { ...opciones, signal: corte });
    return { estado: r.status, ms: Date.now() - t0, cuerpo: r };
  } catch (e) {
    return { estado: 0, ms: Date.now() - t0, error: e.name === "TimeoutError" ? "no respondió a tiempo" : e.message };
  }
}

const hallazgos = [];
function decir(titulo, bien, detalle, comoArreglar) {
  console.log(`  ${bien ? "✓" : "✗"} ${titulo.padEnd(22)} ${detalle}`);
  if (!bien) hallazgos.push({ titulo, detalle, comoArreglar });
}

console.log("\nSalud de producción\n");

// ── 1. Base de datos ────────────────────────────────────────────────────────
// Pedimos una fila de `organizations`. Atraviesa DNS, gateway, Postgres y RLS:
// si esto da 200, la base está viva de verdad, no solo el dominio.
{
  const r = await pedir(`${URL_BASE}/rest/v1/organizations?select=id&limit=1`, {
    headers: { apikey: LLAVE },
  });
  if (r.estado === 200) {
    decir("Base de datos", true, `responde en ${r.ms} ms`);
  } else if (r.estado === 402) {
    decir("Base de datos", false, "RESTRINGIDA POR FALTA DE PAGO (402)",
      "Paga la factura en supabase.com/dashboard/org/_/billing. Se reactiva sola en minutos.");
  } else if (r.estado === 0) {
    decir("Base de datos", false, `sin respuesta — ${r.error}`,
      "El proyecto puede estar pausado (los planes gratuitos se pausan tras una semana sin uso) o eliminado. Míralo en el dashboard de Supabase.");
  } else if (r.estado >= 500) {
    decir("Base de datos", false, `caída o degradada (${r.estado})`,
      "Revisa status.supabase.com antes de tocar nada: puede no ser tuyo.");
  } else {
    decir("Base de datos", false, `respuesta inesperada (${r.estado})`,
      "Si es 401, la llave anon cambió: actualiza FALLBACK_KEY en src/lib/supabase.js.");
  }
}

// ── 2. Login ────────────────────────────────────────────────────────────────
{
  const r = await pedir(`${URL_BASE}/auth/v1/health`, { headers: { apikey: LLAVE } });
  decir("Login", r.estado === 200, r.estado === 200 ? `responde en ${r.ms} ms` : `no responde (${r.estado || r.error})`,
    "Sin esto nadie entra, aunque la base esté viva. Revisa Authentication en el dashboard.");
}

// ── 3. La app ───────────────────────────────────────────────────────────────
{
  const r = await pedir(`${APP}/`);
  decir("App", r.estado === 200, r.estado === 200 ? `sirve en ${r.ms} ms` : `no sirve (${r.estado || r.error})`,
    "Mira el último despliegue en Vercel.");

  const sw = await pedir(`${APP}/sw.js?cb=${process.pid}`);
  if (sw.estado === 200) {
    const version = (await sw.cuerpo.text()).match(/stratos-v\d+/)?.[0];
    console.log(`  · Versión desplegada     ${version || "no la encontré en sw.js"}`);
  }
}

// ── Veredicto ───────────────────────────────────────────────────────────────
if (hallazgos.length === 0) {
  console.log("\nTodo en pie.\n");
  process.exit(0);
}

console.log(`\n${hallazgos.length === 1 ? "Un problema" : `${hallazgos.length} problemas`}:\n`);
for (const h of hallazgos) console.log(`  ${h.titulo}: ${h.detalle}\n    → ${h.comoArreglar}\n`);
process.exit(1);
