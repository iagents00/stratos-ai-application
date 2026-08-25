#!/usr/bin/env node
/**
 * scripts/generar-plano.mjs — Genera PLANO.md
 * ─────────────────────────────────────────────────────────────────────────────
 * MAPA.md es el plano arquitectónico: dónde está cada cuarto.
 * PLANO.md es el plano de instalaciones: por dónde pasan las tuberías y el
 * cableado. De dónde viene un lead, dónde se escribe, qué se rompe si tocás
 * algo, y dónde está la llave de paso cuando algo revienta en producción.
 *
 * Igual que el mapa, se GENERA leyendo el código. Y los flujos narrados —lo
 * único escrito a mano— llevan referencias a archivos que el script VERIFICA
 * que existan: si algo se movió, el plano lo marca en rojo en vez de mentir.
 *
 *   npm run plano            → reescribe PLANO.md
 *   npm run plano -- --check → falla si está desactualizado (lo usa el CI)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(RAIZ, "src");
// Misma razón que en generar-mapa.mjs: sin normalizar CRLF, generar desde
// Windows da un resultado distinto al de Linux y el plano deja de coincidir
// con lo que verifica el CI.
const leer = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// Misma razón que en generar-mapa.mjs: sin normalizar, una generación desde
// Windows escribe las rutas con barras invertidas y el plano deja de servir
// fuera de esa máquina.
const rel  = (p) => relative(RAIZ, p).split("\\").join("/");

function archivos(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.jsx?$/.test(n)) acc.push(p);
  }
  return acc;
}
const TODOS = archivos(SRC);

/* ── Escaneos ───────────────────────────────────────────────────────────── */

/** Agrupa coincidencias de un regex por captura, guardando en qué archivos aparece. */
function agrupar(re) {
  const mapa = new Map();
  for (const p of TODOS) {
    for (const m of leer(p).matchAll(re)) {
      const k = m[1];
      if (!mapa.has(k)) mapa.set(k, new Set());
      mapa.get(k).add(rel(p));
    }
  }
  return [...mapa.entries()]
    .map(([k, v]) => ({ k, archivos: [...v].sort() }))
    .sort((a, b) => b.archivos.length - a.archivos.length || a.k.localeCompare(b.k));
}

const tablas = agrupar(/\.from\("([a-z_]+)"/g);
const rpcs   = agrupar(/\.rpc\("([a-z_]+)"/g);
const envs   = agrupar(/import\.meta\.env\.(VITE_[A-Z_]+)/g);
const hosts  = agrupar(/https:\/\/([a-zA-Z0-9.-]+\.(?:com|host|co|io|mx|app|dev))/g);

/** Radio de impacto: quién importa a quién. */
function radioDeImpacto() {
  const dependientes = new Map();
  for (const p of TODOS) {
    for (const m of leer(p).matchAll(/from\s+"(\.[^"]+)"/g)) {
      const nombre = basename(m[1]).replace(/\.jsx?$/, "");
      if (!dependientes.has(nombre)) dependientes.set(nombre, new Set());
      dependientes.get(nombre).add(rel(p));
    }
  }
  // Resolver el nombre al archivo real, para poder enlazarlo.
  const resolver = (nombre) => {
    const cands = TODOS.filter(p => basename(p).replace(/\.jsx?$/, "") === nombre);
    return cands.length ? rel(cands[0]) : null;
  };
  return [...dependientes.entries()]
    .map(([nombre, v]) => ({ nombre, ruta: resolver(nombre), n: v.size }))
    .filter(x => x.ruta && x.n >= 4)
    .sort((a, b) => b.n - a.n);
}
const impacto = radioDeImpacto();

/* ── Lo único escrito a mano: los flujos y las llaves de paso ───────────── */
/* Cada referencia a un archivo se verifica contra el disco más abajo.       */

const LLAVES = [
  { f: "src/lib/supabase.js",            que: "Cliente de Supabase. `flowType` debe seguir en `implicit`: con `pkce` se rompe el login. Trae URL y key hardcodeadas como respaldo porque Vercel no siempre tiene las variables." },
  { f: "src/lib/auth.js",                que: "Login, sesión y timeouts. Los valores de `GETSESSION_TIMEOUT` y `PROFILE_TIMEOUT` están calibrados: subirlos revive el bug de «Conectando con el servidor…»." },
  { f: "src/contexts/AuthContext.jsx",   que: "Estado global de sesión. Solo limpia storage en `SIGNED_OUT`; limpiar en otros eventos mataba sesiones vivas." },
  { f: "src/lib/lead-save.js",           que: "Guardado de leads con triple respaldo. Es el camino por el que entra el dinero: si falla, se pierden leads." },
  { f: "public/sw.js",                   que: "Service Worker. `CACHE_VERSION` se sube en cada merge a main; es el marcador para verificar que el deploy salió." },
  { f: "src/app/constants/navigation.js",que: "Qué módulo ve cada rol y cada cliente. Un error acá le abre módulos a quien no debe." },
  { f: "mobile/capacitor.config.json",   que: "Shell de la app móvil. `webDir` apunta a `../dist`: el CRM va EMPAQUETADO en el binario. Volver a poner `server.url` haría que cargue remoto y se pierde el offline." },
];

const FLUJOS = [
  {
    titulo: "Cómo entra un lead y dónde queda",
    pasos: [
      { t: "Meta Ads dispara el formulario", d: "El anuncio capta al prospecto.", f: null },
      { t: "n8n recibe el webhook y reparte", d: "Asigna asesor por round-robin.", f: "n8n/workflows/duke-meta-lead-ads-trigger.json" },
      { t: "Se escribe en Supabase", d: "Tabla `leads`, con `asesor_name` para que RLS lo filtre.", f: null },
      { t: "El CRM lo lee y lo pinta", d: "El asesor lo ve en su pipeline.", f: "src/app/views/CRM/index.jsx" },
      { t: "Alta manual desde el CRM", d: "Cuando el asesor lo carga a mano, pasa por acá, no directo a Supabase.", f: "src/lib/lead-save.js" },
    ],
  },
  {
    titulo: "Cómo se inicia sesión",
    pasos: [
      { t: "El usuario escribe correo y contraseña", d: "Pantalla de login.", f: "src/landing/LoginScreen.jsx" },
      { t: "signInWithPassword contra Supabase", d: "Sin OAuth ni magic links: por eso no hay redirects que whitelistear.", f: "src/lib/auth.js" },
      { t: "La sesión queda en localStorage", d: "Con la key por defecto del SDK. No sobreescribirla.", f: "src/lib/supabase.js" },
      { t: "AuthContext la hidrata al abrir", d: "Con timeout suave: si tarda, muestra login pero NO borra la sesión.", f: "src/contexts/AuthContext.jsx" },
      { t: "Se resuelve a qué cliente pertenece", d: "Por `organization_id`, y redirige si entró por el path equivocado.", f: "src/contexts/ClientOrgGuard.jsx" },
    ],
  },
  {
    titulo: "Cómo alguien borra su propia cuenta",
    pasos: [
      { t: "Lo exige Apple", d: "Guideline 5.1.1(v): una app que permite crear cuentas tiene que permitir borrarlas desde adentro.", f: null },
      { t: "El panel en el Perfil", d: "Pide escribir el correo completo. Un botón de 'confirmar' a secas se toca sin leer.", f: "src/app/views/Profile.jsx" },
      { t: "La Edge Function decide, no el navegador", d: "A quién se borra sale del JWT de quien llama. Desplegada y activa en producción.", f: "supabase/functions/delete-my-account/index.ts" },
      { t: "Guarda contra dejar la org huérfana", d: "Si es el único admin de su organización, se rechaza: nadie podría volver a dar de alta a nadie.", f: null },
      { t: "Los leads NO se borran", d: "Son registros de la empresa, no de la persona. La interfaz lo dice explícitamente.", f: null },
    ],
  },
  {
    titulo: "Cómo cobra Stratos, y dónde NO cobra",
    pasos: [
      { t: "La pantalla de Planes muestra precios", d: "Es presentación: muestra los planes y un botón de Apple Pay.", f: "src/landing/PricingScreen.jsx" },
      { t: "⚠️ El botón de pago NO cobra nada", d: "`handlePay` espera 2.2 segundos con setTimeout y muestra «pago exitoso». No hay Stripe, MercadoPago, Conekta ni ninguna pasarela en el repo. Es una maqueta. Si un cliente real le da clic, cree que pagó y no se cobró nada.", f: "src/landing/PricingScreen.jsx" },
      { t: "El plan Enterprise manda a un correo", d: "Muestra un alert con ventas@stratoscapitalgroup.com.", f: "src/landing/PricingScreen.jsx" },
      { t: "El cobro real es manual, fuera del sistema", d: "Se acuerda por fuera y se registra a mano.", f: null },
      { t: "Cuentas de cobro internas", d: "Para facturar a clientes y personas del equipo. Es contabilidad interna, no cobro al cliente final.", f: "src/app/views/CuentasCobro.jsx" },
      { t: "Caja: ingresos y egresos", d: "Libro de movimientos sobre `team_expenses`. Los gastos entran por Telegram.", f: "src/app/views/Caja.jsx" },
    ],
  },
  {
    titulo: "Cómo funciona el Copilot (tiene DOS caminos)",
    pasos: [
      { t: "Camino determinista: va directo a Supabase", d: "Aprobar evidencia, adjuntarla, comentar. Son RPCs (`mkt_approve_evidence`, `mkt_attach_evidence_to`, `mkt_comment_evidence`). NO pasan por la IA, así que si esto falla el problema está en Postgres o en RLS.", f: "src/app/views/Copilot.jsx" },
      { t: "Camino del cerebro: webhook a n8n con GPT-4o", d: "Lo conversacional. El prompt y el modelo viven en n8n, NO en este repo: si el Copilot responde raro, el cambio se hace allá.", f: "src/app/views/Copilot.jsx" },
      { t: "Lector de comprobantes (OCR)", d: "Otro webhook de n8n donde Claude lee la imagen y saca el monto.", f: "src/app/views/Copilot.jsx" },
      { t: "Todo queda registrado", d: "`copilot_log_msg` y `copilot_log_msg_media` guardan la conversación en Supabase.", f: null },
    ],
  },
  {
    titulo: "Cómo llega un cambio a producción",
    pasos: [
      { t: "Rama, commit y PR", d: "`main` está protegida por CODEOWNERS.", f: null },
      { t: "Subir CACHE_VERSION", d: "Es el marcador para verificar el deploy después.", f: "public/sw.js" },
      { t: "Merge a main", d: "Vercel despliega solo.", f: null },
      { t: "Verificar", d: "`curl app.stratoscapitalgroup.com/sw.js` y confirmar la versión nueva.", f: null },
      { t: "La app móvil NO se entera sola", d: "Desde ago-2026 empaqueta el CRM dentro del binario, así que abre sin red. Los datos siguen en vivo, pero un cambio de interfaz necesita un release nuevo por TestFlight o Play.", f: "mobile/capacitor.config.json" },
    ],
  },
];

/* ── Verificación: ningún archivo citado puede no existir ───────────────── */
const faltantes = [];
const verificar = (f) => {
  if (!f) return null;
  if (existsSync(join(RAIZ, f))) return f;
  faltantes.push(f);
  return null;
};

/* ── Documento ──────────────────────────────────────────────────────────── */

const tabla = (filas, cab) =>
  `| ${cab.join(" | ")} |\n|${cab.map(() => "---").join("|")}|\n${filas.join("\n")}`;

let md = `# PLANO DE INSTALACIONES

> **Generado automáticamente. No lo edites a mano.**
> Lo produce \`scripts/generar-plano.mjs\` leyendo el código.
>
> \`MAPA.md\` es el plano arquitectónico: dónde está cada cuarto.
> **Este es el de instalaciones: por dónde pasan las tuberías y el cableado.**
> De dónde viene un lead, dónde se escribe, qué se rompe si tocás algo, y dónde
> está la llave de paso cuando algo revienta.

---

## 1. Dónde vive todo en producción

Antes que nada: las direcciones. Si algo falla, es en alguno de estos lugares.

| Qué | Dónde | Para qué |
|---|---|---|
| Código | GitHub \`iagents00/stratos-ai-application\` | Rama \`main\` = producción |
| Web | Vercel → \`app.stratoscapitalgroup.com\` | Despliega solo al mergear a \`main\` |
| Sitio público | \`stratoscapitalgroup.com\` | Landing de marketing |
| Base de datos | Supabase \`glulgyhkrqpykxmujodb\` | Postgres + Auth + RLS |
| Automatizaciones | n8n \`personal-n8n.suwsiw.easypanel.host\` | Entrada de leads, bots, recordatorios |
| App Android | GitHub Releases → \`android-latest\` | Se compila sola al tocar \`mobile/\` |
| App iOS | GitHub Actions → \`iOS TestFlight\` | Manual, con "Run workflow" |

---

## 2. Llaves de paso

Los archivos donde un error no rompe una pantalla: rompe **todo**. Si vas a
tocar alguno, leé primero la sección de ZONAS CRÍTICAS de \`CLAUDE.md\`.

${LLAVES.map(l => {
  const ok = verificar(l.f);
  return `- ${ok ? `\`${l.f}\`` : `~~\`${l.f}\`~~ ⚠️ **ya no existe — actualizar el plano**`}\n  ${l.que}`;
}).join("\n")}

---

## 3. Instalación eléctrica — por dónde corren los datos

Cada tabla de Supabase que el código toca, y desde qué archivos. Si cambiás una
columna, estos son los archivos que hay que revisar.

${tabla(
  tablas.map(t => `| \`${t.k}\` | ${t.archivos.length} | ${t.archivos.slice(0, 3).map(a => `\`${a.replace("src/", "")}\``).join(" · ")}${t.archivos.length > 3 ? ` _+${t.archivos.length - 3}_` : ""} |`),
  ["Tabla", "Archivos", "Dónde se usa"]
)}

### Funciones del servidor (RPC)

Lógica que corre **dentro** de Postgres, no en el navegador. Si una falla, el
error no está en el frontend.

${tabla(
  rpcs.map(r => `| \`${r.k}\` | ${r.archivos.map(a => `\`${a.replace("src/", "")}\``).join(" · ")} |`),
  ["Función", "Llamada desde"]
)}

---

## 4. Instalación hidráulica — qué entra y sale de la casa

Servicios de terceros con los que habla el código.

${tabla(
  hosts.filter(h => !/stratoscapitalgroup/.test(h.k)).slice(0, 12)
    .map(h => `| \`${h.k}\` | ${h.archivos.length} archivo${h.archivos.length > 1 ? "s" : ""} |`),
  ["Servicio", "Usado en"]
)}

---

## 5. Muros de carga — radio de impacto

Cuántos archivos dependen de cada uno. Tocar los de arriba se siente en toda la
casa; por eso mismo son los que más cuidado piden.

${tabla(
  impacto.slice(0, 15).map(i => `| \`${i.ruta.replace("src/", "")}\` | **${i.n}** |`),
  ["Archivo", "Archivos que lo importan"]
)}

---

## 6. El tablero eléctrico — variables de entorno

${tabla(
  envs.map(e => `| \`${e.k}\` | ${e.archivos.map(a => `\`${a.replace("src/", "")}\``).join(" · ")} |`),
  ["Variable", "Consumida en"]
)}

> \`VITE_SUPABASE_URL\` y \`VITE_SUPABASE_ANON_KEY\` tienen valores de respaldo
> escritos en \`src/lib/supabase.js\`. Es a propósito: sin ellos, un deploy sin
> variables configuradas apuntaba a un dominio inexistente y el login se colgaba.

---

## 7. Flujos críticos

Los tres caminos que hay que entender. Todo lo demás se deduce de estos.

${FLUJOS.map((f, i) => `### 7.${i + 1} ${f.titulo}

${f.pasos.map((p, j) => {
  const ok = p.f ? verificar(p.f) : null;
  const ref = p.f ? (ok ? ` → \`${p.f}\`` : ` → ⚠️ \`${p.f}\` **ya no existe**`) : "";
  return `${j + 1}. **${p.t}**${ref}\n   ${p.d}`;
}).join("\n")}`).join("\n\n")}

---

## 8. Cuándo algo se rompe

| Síntoma | Dónde mirar primero |
|---|---|
| Nadie puede entrar | \`src/lib/supabase.js\` y \`src/lib/auth.js\`. Revisar que Supabase esté arriba. |
| Entra pero se sale al recargar | \`src/contexts/AuthContext.jsx\`. Casi siempre es un timeout mal calibrado. |
| Dejaron de llegar leads | n8n primero, no el CRM. El webhook de Meta es el sospechoso. |
| Un usuario ve una versión vieja | \`CACHE_VERSION\` en \`public/sw.js\` no se subió en el último merge. |
| La app móvil no abre | El bundle va dentro del binario, así que abrir siempre abre. Si carga pero sin datos, el problema es Supabase, no Vercel. |
| Un módulo se le abrió a quien no debe | \`src/app/constants/navigation.js\` y las políticas RLS de Supabase. |
| El Copilot responde raro o no responde | ¿Falló una acción concreta (aprobar, comentar)? Es RPC de Supabase. ¿Falló lo conversacional? El prompt vive en n8n, no en este repo. |
| Un cliente dice que pagó y no le llegó | Revisar la sección 9: el botón de pago no cobra. El cobro real es manual. |
| Alguien reporta un error y no hay rastro | No hay registro de errores en producción. Pedirle captura de la consola del navegador. |

---

## 9. Riesgos abiertos

Cosas que hoy están así y conviene decidir qué hacer con ellas.

| Riesgo | Dónde | Por qué importa |
|---|---|---|
| **El botón de pago no cobra** | \`src/landing/PricingScreen.jsx\` | \`handlePay\` simula con \`setTimeout\` y muestra «pago exitoso». Un cliente puede creer que pagó. Además, Apple exige In-App Purchase para bienes digitales: un botón de pago falso es motivo de rechazo. |
| **Sin registro de errores en producción** | — | No hay Sentry ni equivalente. Cuando algo falla en el teléfono de un asesor, no queda rastro: la única fuente es que alguien avise. |

---

## 10. Cómo pedir un arreglo para que salga a la primera

Cuando algo se rompe, esto es lo que hace la diferencia entre arreglarlo en un
intento o en cinco. Al reportar, incluí:

1. **Qué pantalla.** Mirá \`MAPA.md\` sección 1, o el texto que ves en el menú.
2. **Qué decía el botón o el texto.** Con eso, \`npm run buscar "texto"\` da el
   archivo y la línea exactos.
3. **Qué esperabas y qué pasó.** «Le di a Generar PDF y no pasó nada» es
   suficiente; «no funciona» no lo es.
4. **A quién le pasa.** ¿A todos, a un rol, a un cliente? Si es a uno solo,
   suele ser permisos (\`navigation.js\` o RLS), no un bug de código.
5. **Si es en el teléfono o en la computadora.** El WebView de iOS se comporta
   distinto: ahí no hay Service Worker, y los \`<a download>\` no abren nada.

Con esos cinco datos, la sección 8 de este plano casi siempre dice dónde mirar
antes de abrir un solo archivo.

---

${faltantes.length ? `## ⚠️ El plano quedó desactualizado

Estos archivos se citan arriba pero ya no existen. Hay que corregir
\`scripts/generar-plano.mjs\`:

${[...new Set(faltantes)].map(f => `- \`${f}\``).join("\n")}
` : "_Todas las referencias de este plano fueron verificadas contra el disco._"}
`;

const destino = join(RAIZ, "PLANO.md");
if (process.argv.includes("--check")) {
  const actual = existsSync(destino) ? readFileSync(destino, "utf8") : "";
  if (actual !== md) { console.error("PLANO.md está desactualizado. Corré: npm run plano"); process.exit(1); }
  console.log("PLANO.md está al día.");
} else {
  writeFileSync(destino, md);
  console.log(`PLANO.md generado — ${tablas.length} tablas, ${rpcs.length} RPCs, ${impacto.length} archivos con dependientes.`);
  if (faltantes.length) console.log(`OJO: ${[...new Set(faltantes)].length} referencia(s) rota(s), quedaron marcadas en el documento.`);
}
