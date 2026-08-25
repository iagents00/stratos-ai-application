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

/**
 * ¿El nombre existe de verdad, o solo tu computadora cree que no?
 *
 * Cuando un proyecto de Supabase está pausado su subdominio deja de resolver, y
 * tu resolvedor guarda ese "no existe" un rato. Al reactivarse, el mundo lo ve
 * volver y tú sigues viendo el error viejo — durante minutos.
 *
 * Nos pasó el 25-ago-2026: producción llevaba media hora arriba y desde aquí
 * seguía dando "Could not resolve host". Media hora de diagnóstico contra un
 * problema que ya no existía.
 *
 * Le preguntamos a un resolvedor público por HTTPS, que no pasa por la caché
 * local, y así distinguimos las dos cosas.
 */
async function existeElNombre(host) {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${host}&type=A`, {
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    return Array.isArray(j.Answer) && j.Answer.some((a) => a.type === 1);
  } catch {
    return null; // sin internet para preguntar: no sabemos, y no vamos a inventar
  }
}

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
let baseCaida = false;
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
    baseCaida = true;
    decir("Base de datos", false, "RESTRINGIDA POR FALTA DE PAGO (402)",
      "Paga la factura en supabase.com/dashboard/org/_/billing. Se reactiva sola en minutos.");
  } else if (r.estado === 0) {
    const host = new URL(URL_BASE).hostname;
    const existe = await existeElNombre(host);
    if (existe === true) {
      baseCaida = true;
      decir("Base de datos", false, "tu computadora no la encuentra, pero SÍ existe",
        `El proyecto está arriba: un resolvedor público resuelve ${host}. Lo que falla es la caché de DNS de tu máquina, que guardó un "no existe" de cuando estaba pausado. Límpiala:\n      sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder\n      Los usuarios en otras redes ya lo ven bien.`);
    } else if (existe === false) {
      baseCaida = true;
      decir("Base de datos", false, "el proyecto no existe para nadie",
        `Ningún resolvedor conoce ${host}. Está pausado o eliminado. Pausado no pierde datos: se restaura desde el dashboard. Los planes gratuitos se pausan tras una semana sin uso, y una factura sin pagar también lo baja.`);
    } else {
      baseCaida = true;
      decir("Base de datos", false, `sin respuesta — ${r.error}`,
        "Tampoco pude preguntarle a un resolvedor público, así que puede ser tu conexión. Revisa que tengas internet antes de culpar a Supabase.");
    }
  } else if (r.estado >= 500) {
    baseCaida = true;
    decir("Base de datos", false, `caída o degradada (${r.estado})`,
      "Revisa status.supabase.com antes de tocar nada: puede no ser tuyo.");
  } else {
    baseCaida = true;
    decir("Base de datos", false, `respuesta inesperada (${r.estado})`,
      "Si es 401, la llave anon cambió: actualiza FALLBACK_KEY en src/lib/supabase.js.");
  }
}

// ── 2. Login ────────────────────────────────────────────────────────────────
{
  const r = await pedir(`${URL_BASE}/auth/v1/health`, { headers: { apikey: LLAVE } });
  if (r.estado === 200) {
    decir("Login", true, `responde en ${r.ms} ms`);
  } else if (baseCaida) {
    // Vive en el mismo dominio que la base. Si la base no se alcanza, esto
    // tampoco — y es la MISMA causa. Contarlo aparte inventa un segundo
    // problema y manda a revisar Authentication, que no tiene nada que ver.
    console.log("  · Login                  no se puede saber hasta que vuelva la base");
  } else {
    decir("Login", false, `no responde (${r.estado || r.error})`,
      "La base sí responde, así que es Authentication en particular. Míralo en el dashboard.");
  }
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
