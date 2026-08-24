/**
 * scripts/verificar-rpc-permisos.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Cada pantalla del CRM le pide datos a la base llamando una función por
 * `supabase.rpc('...')`. Para que eso funcione, esa función tiene que tener el
 * permiso de ejecución para la persona logueada. Si no lo tiene, la pantalla
 * muestra «permission denied» y se queda vacía.
 *
 * EL 24-ago-2026 eso pasó con 18 funciones a la vez. El Copilot dejó de guardar
 * las conversaciones, Comando salía con un error rojo, y Documentos, Informes,
 * Caja y el chat del equipo estaban mudos. Nadie se enteró durante días: la app
 * no se cae, simplemente deja de traer datos, y ninguna prueba miraba eso.
 *
 * La red de seguridad tiene dos mitades y esta es la del repo:
 *   · Acá  → que toda RPC que el código llama esté REGISTRADA.
 *   · Base → `select * from fn_qa_rpc_del_front() where estado <> 'OK'`
 *            dice cuáles están cerradas para la app o abiertas a anónimos.
 *
 * Si agregás una llamada nueva a `supabase.rpc(...)`, este chequeo falla hasta
 * que la registres en la migración 241 y le des el `grant execute`. Es a
 * propósito: es exactamente el paso que se olvidó.
 *
 *   npm run verificar-rpc
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── 1. Qué RPC llama el código, de verdad ──────────────────────────────────
const fuentes = [];
(function recorrer(dir) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.(js|jsx|ts|tsx)$/.test(e)) fuentes.push(p);
  }
})(join(RAIZ, "src"));

const enElCodigo = new Map(); // nombre -> archivo donde aparece primero
for (const f of fuentes) {
  const txt = readFileSync(f, "utf8");
  for (const m of txt.matchAll(/\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g)) {
    if (!enElCodigo.has(m[1])) enElCodigo.set(m[1], f.replace(RAIZ + "/", ""));
  }
}

// ── 2. Qué RPC están registradas (la migración es la fuente única) ─────────
const DIR_MIG = join(RAIZ, "supabase", "migrations");
const migRegistro = readdirSync(DIR_MIG).find((f) => f.includes("centinela_permisos_rpc"));

if (!migRegistro) {
  // Un chequeo que no pudo correr tiene que DECIRLO. Pasar callado es peor que
  // fallar: te deja creyendo que alguien revisó.
  console.error("  ✗ No encuentro la migración del registro (…centinela_permisos_rpc….sql).");
  console.error("    Sin ella no puedo saber qué está registrado. Revisá supabase/migrations/.");
  process.exit(1);
}

const sql = readFileSync(join(DIR_MIG, migRegistro), "utf8");
const bloque = sql.slice(sql.indexOf("insert into public.front_rpc_registry"));
const registradas = new Set([...bloque.matchAll(/^\s*\('([a-z0-9_]+)'/gim)].map((m) => m[1]));

if (registradas.size === 0) {
  console.error(`  ✗ No pude leer ninguna RPC del registro en ${migRegistro}.`);
  process.exit(1);
}

// ── 3. Comparar ────────────────────────────────────────────────────────────
let fallos = 0;
const sinRegistrar = [...enElCodigo.keys()].filter((n) => !registradas.has(n)).sort();
const huerfanas = [...registradas].filter((n) => !enElCodigo.has(n)).sort();

for (const n of sinRegistrar) {
  console.error(`  ✗ ${n}() — la llama ${enElCodigo.get(n)} y NO está registrada.`);
  fallos++;
}

if (fallos) {
  console.error(
    `\n  ${fallos} RPC sin registrar. Agregalas a la migración del registro y dales permiso:\n` +
    `      grant execute on function public.<nombre>(<args>) to authenticated;\n` +
    `  Y comprobá en la base:  select * from fn_qa_rpc_del_front() where estado <> 'OK';\n` +
    `  ⚠️  Si la función recibe un identificador de persona DESDE el navegador, no la abras\n` +
    `      tal cual: la identidad tiene que salir de auth.uid() (ver migración 240).`
  );
  process.exit(1);
}

console.log(`  ${enElCodigo.size} RPC llamadas desde el front · todas registradas.`);
if (huerfanas.length) {
  console.log(`  (${huerfanas.length} registradas que ya nadie llama: ${huerfanas.join(", ")})`);
}
console.log(`  Falta la otra mitad, contra la base: select * from fn_qa_rpc_del_front() where estado <> 'OK';`);
