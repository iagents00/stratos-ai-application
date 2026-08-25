#!/usr/bin/env node
/**
 * scripts/generar-mapa.mjs — Genera MAPA.md
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 * La tabla "Componentes Principales" de CLAUDE.md decía que Dash estaba en
 * App.jsx:260 y CRM en App.jsx:549. Ambas vistas se movieron a src/app/views/
 * hace meses. Un mapa escrito a mano envejece y termina mandándote al lugar
 * equivocado, que es peor que no tener mapa.
 *
 * Este script LEE el código y escribe MAPA.md. Si algo se mueve, el mapa se
 * mueve con él. No se edita a mano: se regenera.
 *
 *   npm run mapa          → reescribe MAPA.md
 *   npm run mapa -- --check → falla si está desactualizado (lo usa el CI)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(RAIZ, "src");

/* ── utilidades ─────────────────────────────────────────────────────────── */

function archivos(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.(jsx?|css)$/.test(n)) acc.push(p);
  }
  return acc;
}

// Se normalizan los finales de línea al leer. En Windows git deja los archivos
// con CRLF (core.autocrlf), o sea un byte más por línea, y este generador busca
// el componente de cada pantalla dentro de una VENTANA FIJA de 600 caracteres:
// con CRLF esa ventana alcanza menos líneas y algunas vistas quedaban sin
// resolver. El síntoma era que al regenerar desde Windows, pantallas que sí
// tienen archivo (Copilot, entre otras) aparecían como "sin vista propia".
const leer  = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// relative() de Node devuelve el separador del sistema: en Windows salen barras
// invertidas (src\app\views\...). Si el MAPA se genera desde una máquina Windows
// queda con rutas que no existen para el CI ni para nadie en Mac o Linux, y el
// diff se vuelve ilegible porque cambian las 900 rutas a la vez. Se normaliza acá
// para que el archivo salga igual sin importar quién lo genere.
const rel   = (p) => relative(RAIZ, p).split("\\").join("/");
const lineas = (t) => t.split("\n").length;

/**
 * Saca la descripción del comentario de cabecera. Convención del repo: el
 * bloque abre con la ruta del archivo y la línea siguiente ya lo explica.
 */
function descripcion(texto) {
  const bloque = texto.match(/^\s*\/\*\*([\s\S]{0,900}?)\*\//);
  if (!bloque) return null;
  const filas = bloque[1]
    .split("\n")
    .map(l => l.replace(/^\s*\*\s?/, "").trim())
    .filter(l => l && !/^[─—=-]{3,}$/.test(l));
  if (!filas.length) return null;
  // La primera fila suele ser "ruta/archivo.jsx" o "ruta — descripción".
  const primera = filas[0];
  const guion = primera.match(/\s[—-]\s(.+)$/);
  if (guion) return guion[1].trim();
  if (/^[\w./-]+\.(jsx?|css)$/.test(primera)) return filas[1] || null;
  return primera;
}

/* ── 1. Pantallas: navigation.js → switch de App.jsx → import → archivo ──── */

function pantallas() {
  const nav = leer(join(SRC, "app/constants/navigation.js"));
  const items = [...nav.matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*l:\s*"([^"]+)"/g)]
    .map(m => ({ id: m[1], etiqueta: m[2] }));

  const app = leer(join(SRC, "app/App.jsx"));

  // Los renders no tienen una sola forma. En App.jsx conviven:
  //   {v === "c"    && <CRM .../>}                            simple
  //   {v === "wa"   && canAccessModule(...) && <Inbox .../>}   con guarda
  //   {(v === "mkt" || v === "mkt_dia") && <Mkt .../>}         varios ids
  //   {v === "d"    && (flag ? <A/> : <B/>)}                   ternario
  // Y además hay lógica que NO es render: `if (v === "wa") return;`
  //
  // Regla: desde cada `v === "id"` miramos 400 caracteres adelante y tomamos
  // el primer <Componente>. Si antes aparece un `;` es código, no JSX, y se
  // descarta. Eso separa render de lógica sin tener que parsear JavaScript.
  const porId = {};
  for (const m of app.matchAll(/v === "([a-z_]+)"/g)) {
    const id = m[1];
    if (porId[id]) continue;
    const ventana = app.slice(m.index, m.index + 600);
    const jsx = ventana.split(";")[0];   // lo que sigue a un ";" ya es código, no render
    // PermissionGate y Suspense envuelven a la vista real: no son la respuesta
    // a "¿dónde está esta pantalla?".
    const ENVOLTORIOS = new Set(["PermissionGate", "Suspense", "ErrorBoundary", "Fragment"]);
    const encontrados = [...jsx.matchAll(/<([A-Z]\w+)/g)]
      .map(x => x[1])
      .filter(c => !ENVOLTORIOS.has(c));
    if (!encontrados.length) continue;
    // Ternario por feature flag (ej. Comando): guardamos las dos ramas.
    const esTernario = /\?[\s\S]{0,40}?<[A-Z]/.test(jsx) && encontrados.length > 1;
    porId[id] = esTernario ? encontrados.slice(0, 2) : [encontrados[0]];
  }

  // const CRM = lazy(() => import("./views/CRM"))  |  import CRM from "./views/CRM"
  const porComponente = {};
  for (const m of app.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\)/g)) {
    porComponente[m[1]] = m[2];
  }
  for (const m of app.matchAll(/import\s+(\w+)\s+from\s+"([^"]+)"/g)) {
    if (!porComponente[m[1]]) porComponente[m[1]] = m[2];
  }

  const resolver = (esp) => {
    if (!esp || !esp.startsWith(".")) return null;
    const base = join(SRC, "app", esp.replace(/^\.\//, ""));
    for (const cand of [base, base + ".jsx", base + ".js", join(base, "index.jsx"), join(base, "index.js")]) {
      if (existsSync(cand) && statSync(cand).isFile()) return cand;
    }
    return null;
  };

  return items.map(it => {
    const comps = porId[it.id] || [];
    const rutas = comps.map(c => resolver(porComponente[c])).filter(Boolean);
    return {
      ...it,
      componente: comps.join(" / ") || "—",
      archivos: rutas.map(r => ({ ruta: rel(r), lineas: lineas(leer(r)) })),
    };
  });
}

/* ── 2. Páginas públicas: constantes de rutas en main.jsx ────────────────── */

function paginasPublicas() {
  const main = leer(join(SRC, "main.jsx"));
  const out = [];
  for (const m of main.matchAll(/const\s+([A-Z_]+_PATHS)\s*=\s*\[([^\]]+)\]/g)) {
    const rutas = [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1]);
    const clave = m[1].replace(/_PATHS$/, "");
    // is<Clave> ? <Componente />
    const pascal = clave.charAt(0) + clave.slice(1).toLowerCase();
    const re = new RegExp(`is${pascal}[\\s\\S]{0,40}?<(\\w+)\\s*/>`, "i");
    const comp = main.match(re);
    out.push({ rutas, componente: comp ? comp[1] : "—" });
  }
  return out;
}

/* ── 3. Índice de textos visibles ───────────────────────────────────────── */

const RUIDO = /^(true|false|null|undefined|px|em|rem|auto|none|flex|grid|center|bold|solid|https?|POST|GET)$/i;

function textosVisibles(lista) {
  const idx = new Map();
  const guardar = (txt, archivo, linea) => {
    const t = txt.trim();
    if (t.length < 4 || t.length > 44) return;
    if (RUIDO.test(t)) return;
    if (/[{}<>$\\|=]/.test(t)) return;
    if (!/[a-záéíóúñ]/i.test(t)) return;
    if (!/^[A-ZÁÉÍÓÚÑ¿¡]/.test(t)) return;      // solo copy que arranca como frase
    if (!/[aeiouáéíóú]/i.test(t)) return;
    const k = t.toLowerCase();
    if (!idx.has(k)) idx.set(k, { txt: t, donde: `${archivo}:${linea}` });
  };

  for (const p of lista) {
    if (!/\.jsx?$/.test(p)) continue;
    const r = rel(p);
    if (r.includes("/landing/")) continue;       // marketing, no es la app
    leer(p).split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/>([^<>{}\n]{4,44})</g))                guardar(m[1], r, i + 1);
      for (const m of l.matchAll(/(?:title|aria-label|placeholder)="([^"]{4,44})"/g)) guardar(m[1], r, i + 1);
    });
  }
  return [...idx.values()].sort((a, b) => a.txt.localeCompare(b.txt, "es"));
}

/* ── Armado del documento ───────────────────────────────────────────────── */

const todos = archivos(SRC);
const pant  = pantallas();
const pubs  = paginasPublicas();
const txts  = textosVisibles(todos);

const porCarpeta = {};
for (const p of todos) {
  const r = rel(p);
  const carpeta = r.split("/").slice(0, 3).join("/").replace(/\/[^/]+\.\w+$/, "") || "src";
  (porCarpeta[carpeta] ||= []).push({
    ruta: r,
    lineas: lineas(leer(p)),
    desc: descripcion(leer(p)),
  });
}

const sinDescribir = Object.values(porCarpeta).flat()
  .filter(f => !f.desc && f.lineas > 60)
  .sort((a, b) => b.lineas - a.lineas);

let md = `# MAPA — dónde está cada cosa

> **Generado automáticamente. No lo edites a mano.**
> Lo produce \`scripts/generar-mapa.mjs\` leyendo el código, así que no puede
> quedar desactualizado. Si moviste algo, corré \`npm run mapa\`.
>
> ¿Buscás un botón o un texto y no está acá? \`npm run buscar "texto"\`

**${todos.length} archivos · ${todos.reduce((s, p) => s + lineas(leer(p)), 0).toLocaleString("es")} líneas**

---

## 1. Pantallas de la app

Lo que ves en el menú lateral, y el archivo que lo dibuja.

| En el menú dice | Archivo | Líneas |
|---|---|---|
${pant.map(p => p.archivos.length
  ? `| **${p.etiqueta}** | ${p.archivos.map(a => `\`${a.ruta}\``).join("<br>")} | ${p.archivos.map(a => a.lineas).join("<br>")} |`
  : `| **${p.etiqueta}** | _sin vista propia (redirige a otra)_ | — |`).join("\n")}

---

## 2. Páginas públicas (sin login)

| URL | Componente |
|---|---|
${pubs.map(p => `| ${p.rutas.map(r => `\`${r}\``).join(" · ")} | ${p.componente} |`).join("\n")}

---

## 3. Todos los archivos, por carpeta

`;

for (const carpeta of Object.keys(porCarpeta).sort()) {
  const fs = porCarpeta[carpeta].sort((a, b) => b.lineas - a.lineas);
  md += `### \`${carpeta}/\`\n\n| Archivo | Líneas | Qué hace |\n|---|---|---|\n`;
  md += fs.map(f => `| \`${f.ruta.split("/").pop()}\` | ${f.lineas} | ${f.desc || "_sin describir_"} |`).join("\n");
  md += "\n\n";
}

md += `---

## 4. ¿Dónde está el texto "..."?

Textos visibles de la app y el archivo donde viven. Útil cuando alguien te
dice "cambiá el botón que dice X" y no sabés por dónde empezar.

| Texto | Archivo |
|---|---|
${txts.slice(0, 250).map(t => `| ${t.txt} | \`${t.donde}\` |`).join("\n")}

${txts.length > 250 ? `\n_(${txts.length - 250} textos más — usá \`npm run buscar "texto"\`)_\n` : ""}
---

## 5. Archivos grandes sin describir

Estos no tienen comentario de cabecera, así que el mapa no puede explicar qué
hacen. Agregarles un bloque \`/** ... */\` arriba los hace aparecer solos acá.

${sinDescribir.length
  ? sinDescribir.map(f => `- \`${f.ruta}\` (${f.lineas} líneas)`).join("\n")
  : "_Ninguno. Todos los archivos grandes están descritos._"}
`;

const destino = join(RAIZ, "MAPA.md");

if (process.argv.includes("--check")) {
  const actual = existsSync(destino) ? readFileSync(destino, "utf8") : "";
  if (actual !== md) {
    console.error("MAPA.md está desactualizado. Corré: npm run mapa");
    process.exit(1);
  }
  console.log("MAPA.md está al día.");
} else {
  writeFileSync(destino, md);
  console.log(`MAPA.md generado — ${pant.length} pantallas, ${todos.length} archivos, ${txts.length} textos.`);
}
