# Stratos AI — Guía para Desarrolladores

Este archivo es leído automáticamente por Claude Code al abrir el proyecto.
Es el punto de entrada oficial para cualquier dev que trabaje aquí.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite |
| Estilos | CSS-in-JS (inline styles) — NO Tailwind |
| Iconos | Lucide React |
| Gráficas | Recharts |
| Auth actual | localStorage (demo/prototipo) |
| Auth producción | Supabase (plan listo, pendiente de implementar) |
| Base de datos | Supabase PostgreSQL (pendiente) |

---

## Estructura de Archivos

```
src/
├── main.jsx                     ← Entry point: AuthProvider + routing por hostname
├── index.css                    ← Reset global
│
├── design-system/               ← FUENTE ÚNICA DE VERDAD para diseño
│   ├── tokens.js                ← Colores (P, PL), tipografías, spacing, STAGES
│   └── primitives.jsx           ← Componentes atómicos: GlassCard, Pill, IconBox, KPICard
│
├── contexts/
│   └── AuthContext.jsx          ← Estado global de auth (user, login, logout, etc.)
│
├── hooks/
│   └── useAuth.js               ← Hook: const { user, login, logout } = useAuth()
│
├── lib/
│   ├── supabase.js              ← Cliente Supabase (listo para activar)
│   └── auth.js                  ← Capa auth: signIn/signUp/signOut (localStorage→Supabase)
│
├── data/
│   ├── leads.js                 ← Datos mock CRM
│   └── constants.js             ← Re-exporta desde design-system/tokens
│
├── assets/
│   └── hero.png
│
├── landing/                     ← Sitio público (stratoscapitalgroup.com)
│   ├── LandingMarketing.jsx     ← Página principal de marketing
│   ├── PricingScreen.jsx        ← Planes y precios
│   └── LoginScreen.jsx          ← Login / Registro / Forgot password
│
└── app/                         ← Plataforma autenticada (app.stratoscapitalgroup.com)
    ├── App.jsx                  ← Shell: sidebar + nav + todas las vistas
    └── App.css                  ← Animaciones y estilos de la plataforma

CLAUDE.md                 ← Este archivo (léelo primero)
DESIGN_SYSTEM.md          ← Referencia visual completa
DEVELOPMENT.md            ← Patrones de código y convenciones
QUICK_REFERENCE.md        ← Componentes copy-paste
CHANGELOG.md              ← Historial de versiones
```

---

## Cómo Correr el Proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Correr en desarrollo
npm run dev
# → http://localhost:5173

# 3. Build de producción
npm run build

# 4. Preview del build
npm run preview
```

---

## Flujo de Autenticación (Estado Actual)

El auth vive en `AuthContext` como estado React global:

```
main.jsx
  └── <AuthProvider>          ← Provee user, login, logout a TODA la app
       ├── isApp = true  → <App />              (plataforma)
       └── isApp = false → <LandingMarketing />  (marketing)

App.jsx (app/App.jsx)
  └── const { user, login, logout } = useAuth()
       ├── !user → <LoginScreen onLogin={login} />
       └── user  → render de la plataforma completa
```

### Cómo funciona el login/registro ahora

**Capa de datos:** `src/lib/auth.js`
- `signIn(email, password)` → verifica en localStorage
- `signUp(name, email, password)` → crea usuario en localStorage
- `signOut()` → borra sesión
- Todas retornan `{ data, error }` — igual que Supabase Auth

**Almacenamiento:**
- `localStorage["stratos_users"]` → array de todos los usuarios registrados
- `localStorage["stratos_user"]`  → usuario activo de la sesión

**Para consumir auth en cualquier componente:**
```js
import { useAuth } from "../hooks/useAuth";
const { user, login, logout, loading, error } = useAuth();
```

### Cuenta demo pre-sembrada

```
Email:      demo@stratos.ai
Password:   demo2027
```

Se crea automáticamente en `AuthContext` al iniciar la app si no existe.

---

## Cómo Migrar a Supabase (PENDIENTE — siguiente sprint)

El plan completo está en `.claude/plans/glittery-doodling-avalanche.md`.

### Pasos resumidos:

1. **Crear proyecto en Supabase** (manual en supabase.com)
2. **Instalar SDK**: `npm install @supabase/supabase-js`
3. **Crear `src/lib/supabase.js`**:
```js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```
4. **Crear `.env.local`** (NO subir a Git):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```
5. **Reemplazar el auth de localStorage** en `main.jsx` y `LandingMarketing.jsx`
   con llamadas a `supabase.auth.signIn()` / `signUp()` / `resetPasswordForEmail()`

Con Supabase, el envío de emails (verificación y recuperación) funciona automáticamente.

---

## Design System — Reglas Críticas

### Piso tipográfico (Jul 2026 — pedido de Ángel: que la letra no desgaste la vista)

Toda la plataforma usa UNA escala de tamaños. **NO escribas `fontSize` menor a 9.5**
(única excepción: micro-etiquetas decorativas del carril lateral, 7–9).
Escala: 9.5–10 micro-etiquetas · 10.5–11.5 metadatos/chips · **12–12.5 texto corriente**
· 13–14 cuerpo destacado · 15+ títulos. Se aplicó con un barrido global (1318 tamaños
subidos en 56 archivos). Si copias código viejo con `fontSize: 9/10/11`, súbelo a la escala.

Lee `DESIGN_SYSTEM.md` completo. Resumen ejecutivo:

```js
// Paleta — App.jsx (P)
const P = {
  bg: "#060A11",       // Fondo principal
  accent: "#6EE7C2",   // Verde menta — usar con moderación
  txt: "#E2E8F0",      // Texto principal
  border: "rgba(255,255,255,0.07)",
}

// Paleta — LandingMarketing.jsx (P)
const P = {
  bg: "#04080F",
  accent: "#52D9B8",
  // ... ligeramente distinta (landing vs app)
}

// Tipografías
fontDisp = "SF Pro Display, Segoe UI, sans-serif"  // Títulos
font     = "SF Pro Text, Segoe UI, sans-serif"     // Cuerpo

// Espaciado — múltiplos de 8px
// 4, 8, 12, 16, 24, 32, 48, 64
```

**NUNCA** usar colores hardcodeados. Siempre usar `P.color`.
**NUNCA** usar Tailwind — todo es inline styles.
**NUNCA** instalar nuevas librerías sin confirmar con el cliente.

---

## ¿Dónde está cada cosa?

**No lo busques a mano ni confíes en tablas escritas a mano — envejecen.**
Este archivo tenía una tabla que decía que `Dash` estaba en `App.jsx:260` y
`CRM` en `App.jsx:549`. Ambas vistas se movieron a `src/app/views/` hace meses
y la tabla siguió ahí, mandando a todo el mundo al lugar equivocado.

En su lugar:

- **`MAPA.md`** — qué pantalla vive en qué archivo, qué hace cada archivo, y un
  índice de los textos visibles de la app. Lo genera `scripts/generar-mapa.mjs`
  leyendo el código, y el CI lo regenera en cada push a `main`: no puede mentir.

- **`npm run buscar "texto"`** — para cuando alguien dice "cambiá el botón que
  dice Generar PDF". Devuelve archivo y línea al instante.

```bash
npm run mapa                    # regenerar el mapa
npm run buscar "generar pdf"    # ¿dónde está este texto?
```

---

## Cómo Agregar una Vista Nueva

1. Crear función `const MiVista = ({ oc }) => { ... }` en `App.jsx`
2. Agregar al array `nav` en `App.jsx`:
```js
{ id: "mv", l: "Mi Vista", i: IconName }
```
3. Agregar render en el switch de vistas:
```jsx
{v === "mv" && <MiVista oc={oc} />}
```

---

## Roles de Usuario (Para cuando se integre Supabase)

```
super_admin  → Ve y controla todo
ceo          → Dashboard, CRM, ERP, Finanzas, Team
director     → Su equipo, su CRM, su pipeline
asesor       → Solo sus leads y sus registros
```

---

## Git & Colaboración

```bash
# Rama principal
main

# Flujo recomendado
git checkout -b feat/nombre-feature
# ... cambios ...
git commit -m "feat: descripción clara"
git push origin feat/nombre-feature
# → Pull Request → Review → Merge
```

### Convenciones de commits
```
feat:     Nueva funcionalidad
fix:      Corrección de bug
style:    Solo cambios visuales/CSS
perf:     Mejora de performance
refactor: Cambio interno sin afectar UX
docs:     Solo documentación
```

---

## Variables de Entorno

```bash
# .env.local (crear localmente, NO subir a git)
VITE_SUPABASE_URL=         # URL de tu proyecto Supabase
VITE_SUPABASE_ANON_KEY=    # Anon key de Supabase

# .env.example (ya existe en repo, como referencia)
```

---

## Lo Que NO Hay Que Tocar Sin Consultar

- `DESIGN_SYSTEM.md` — es la referencia de diseño del cliente
- La paleta de colores `P` — cualquier cambio afecta toda la app
- El sistema de auth en `main.jsx` — es el punto central
- Los datos mock en `App.jsx` — serán reemplazados por Supabase queries

---

## ⚠️ ZONA CRÍTICA — CONFIG DE AUTH ESTABLE (SW v12, Mayo 2026)

Esta config se logró después de **MUCHAS** iteraciones para resolver:
- "Se sale al F5 y no puedo re-loguear, queda en Conectando con el servidor…"
- "Lento al registrar cliente"
- "Sale 'Sin conexión' aunque mi internet está bien"

**Estado actual estable**: F5 muestra LoginScreen brevemente (~2s) y restaura sesión desde caché 24h sin requerir login. Funciona en Chrome, Brave, Safari, Edge. Sin POST 400 automáticos a `/auth/v1/token`.

### Valores que NO se deben cambiar sin entender el porqué

| Archivo | Línea aprox. | Config | Razón |
|---|---|---|---|
| `src/lib/supabase.js` | `flowType` | **`'implicit'`** — NO `'pkce'` | PKCE es para OAuth (Google/GitHub/Magic Links). Con `signInWithPassword` rompe la sesión: escribe `code_verifier` extra y al F5 el SDK intenta completar un OAuth callback que nunca existió → invalida sesión + retry POST 400 |
| `src/lib/supabase.js` | `FALLBACK_URL` / `FALLBACK_KEY` | hardcoded | Vercel no tiene `VITE_SUPABASE_URL` configurado; sin fallback el bundle apunta a `placeholder.supabase.co` → DNS fail → login se cuelga |
| `src/lib/auth.js` | `GETSESSION_TIMEOUT = 3500` | 3.5s con fallback a caché | `supabase.auth.getSession()` puede colgarse >25s por auto-refresh interno → bloquea el **lock del SDK** → `signInWithPassword` posterior queda en "Conectando…". Si subes este timeout vuelve el bug |
| `src/lib/auth.js` | `PROFILE_TIMEOUT = 5000` | 5s | Igual razón. Antes era 30s y bloqueaba |
| `src/contexts/AuthContext.jsx` | `HYDRATION_TIMEOUT_MS = 12000` | 12s, **SUAVE** (no destructivo) | Si tarda, muestra login pero **NO** llama signOut ni clearLocalAuthState — eso destruía sesiones legítimas |
| `src/contexts/AuthContext.jsx` | `onAuthStateChange` listener | Limpia storage **SOLO** en `SIGNED_OUT` o `USER_DELETED` | Versiones anteriores limpiaban en cualquier evento sin sesión → mataba sesiones durante `TOKEN_REFRESHED` transitorios |
| `src/main.jsx` | boot guard que limpia keys | Borra `stratos.supabase.*`, `*-code-verifier`, `sb-*-pkce*` | Restos de versiones viejas con PKCE/storageKey custom. **NO** tocar `sb-<projectref>-auth-token` (es la sesión real) |
| `src/lib/lead-save.js` | espejo local con `appendEntrySync` (`lead-storage.js`) | Síncrono, NO deferred | El defer con `requestIdleCallback` perdía entries al cerrar el tab. NO volver al patrón viejo (`LOCAL_MIRROR_LIMIT`/idle ya no existen). _(Fila actualizada 2026-06-10 al código real.)_ |
| `src/lib/lead-save.js` | `INSERT_TIMEOUT_MS = 12000` | 12s | Supabase paid plan no tiene cold-start; 25s era exagerado |
| `public/sw.js` | `CACHE_VERSION` | bump cada vez que cambies auth/schema | Sin bump, navegadores con SW viejo siguen sirviendo bundle pre-fix |
| `src/lib/auth.js` | `signOut({ scope: 'local' })` | **NO volver al default `global`** | El default de Supabase revoca las sesiones de TODOS los dispositivos del usuario: salir en la PC botaba también al teléfono (y sus notificaciones). 2026-07-29 |

### Duración de sesiones (2026-07-29) — la llave está en el DASHBOARD, no en el código

El síntoma «se cierra la sesión a cada rato» NO es del frontend (la caché local dura 30 días y el
contexto ya reintenta 2 veces antes de botar): es la **rotación del refresh token + la detección de
reutilización** de Supabase. Una PWA/teléfono que se suspende a mitad de una renovación reintenta con
el token viejo → Supabase lo trata como robo → revoca la familia entera → login forzado. Para que las
sesiones duren MESES (hasta cambio de contraseña o logout explícito), en el **Dashboard de Supabase**
(`glulgyhkrqpykxmujodb` → Authentication → Sessions):
1. **Refresh token reuse interval**: subirlo a `86400` (o desactivar «Detect compromised refresh
   tokens» si la opción existe en el plan) — es lo que mata sesiones legítimas de PWA/multi-pestaña.
2. **Access token (JWT) expiry**: subir de 3600 a `43200` (12 h) — menos renovaciones = menos
   oportunidades de choque.
3. NO activar «Time-box user sessions» ni «Inactivity timeout» (hoy están apagados — verificado:
   `auth.sessions.not_after` es null en todas).
Cambiar la contraseña sigue revocando todas las sesiones (comportamiento pedido por Ángel).

### Cómo se logró cada parte (debugging history)

1. **Login real fallaba**: env vars `VITE_SUPABASE_URL` faltantes en Vercel → bundle con `placeholder.supabase.co`. Fix: hardcoded fallback en `supabase.js`.
2. **F5 cerraba sesión + "Conectando…" colgado**: `flowType: 'pkce'` rompía `signInWithPassword`. Fix: cambiar a `'implicit'` + limpiar `*-code-verifier` legacy.
3. **F5 mostraba "Hidratación tardando >25s"**: `supabase.auth.getSession()` se colgaba esperando auto-refresh interno. Fix: timeout 3.5s + fallback a caché 24h.
4. **Lentitud al registrar lead**: `writeMirror` síncrono con `JSON.stringify` de 500 entries. Fix: `requestIdleCallback` + límite 150.

### Si trabajas en auth: TEST OBLIGATORIO antes de mergear

1. Login con cuenta real (no demo) en pestaña **normal** (no incógnito) de Chrome.
2. F5 al menos 3 veces seguidas → debe restaurar sesión en <5s sin pedir login.
3. Cerrar y reabrir pestaña → sesión debe persistir.
4. Registrar 3 leads seguidos → UI debe responder al instante.
5. Console **no debe** tener:
   - "Hidratación tardando >25s"
   - POST 400 a `/auth/v1/token?grant_type=password` automático
   - Error de `code_verifier`

### Referencia rápida

- PRs relevantes: [#48](https://github.com/iagents00/stratos-ai-application/pull/48), [#49](https://github.com/iagents00/stratos-ai-application/pull/49), [#50](https://github.com/iagents00/stratos-ai-application/pull/50), [#51](https://github.com/iagents00/stratos-ai-application/pull/51).
- SW estable: `stratos-v12`.
- Proyecto Supabase: `glulgyhkrqpykxmujodb` (Stratos Capital Group).

---

## ⚠️ ZONA CRÍTICA — PERFORMANCE ESTABLE (SW v12, Mayo 2026)

Tras la auditoría de performance y los fixes del [PR #54](https://github.com/iagents00/stratos-ai-application/pull/54), la app va **fluida en cualquier PC** (verificado por el cliente: *"está super veloz"*). Esta es la versión más óptima a la fecha — **NO la rompas sin necesidad**.

### Valores que NO se deben cambiar

| Archivo | Línea aprox. | Patrón | Razón |
|---|---|---|---|
| `src/app/App.jsx` | `useEffect` del `visibilitychange` | **Función nombrada** `onVisibilityChange` + `removeEventListener` en cleanup | Antes era función anónima inline y el cleanup solo removía `focus`. Cada re-render acumulaba un listener huérfano → 100+ listeners en 5 min → mouse stutters. **Si vuelves a poner función anónima, regresa el bug.** |
| `src/contexts/AuthContext.jsx` | `value` del `AuthContext.Provider` | **`useMemo`** con deps explícitas | Sin `useMemo`, el objeto `value` se crea nuevo en cada render → React.Context dispara re-render de TODOS los consumers (App, CRM, Dash, Sidebar, KPIs). Era una cascada masiva. **No quitar el useMemo ni dejar deps vacías.** |
| `src/main.jsx` | Boot guard | Limpieza síncrona de `stratos.supabase.*`, `*-code-verifier`, `sb-*-pkce*` | Mantiene navegadores libres de basura legacy. NO tocar `sb-<projectref>-auth-token`. |
| `public/sw.js` | `CACHE_VERSION` | Bumpear cuando se cambia auth/schema/perf crítico | Sin bump, navegadores con SW viejo siguen sirviendo bundle pre-fix. |

### Reglas generales de performance que ya están aplicadas

1. **`useEffect` con event listeners**: SIEMPRE extraer el handler como función nombrada y removerlo en cleanup.
2. **`Context.Provider value`**: SIEMPRE envolver en `useMemo` cuando el árbol consumidor es grande.
3. **`useCallback` en callbacks expuestas**: SIEMPRE que se pasen como prop o se incluyan en `value` de un Context.
4. **`setInterval` que dispara `setState`**: SIEMPRE limpiar con `clearInterval` en cleanup + considerar pausar cuando `document.hidden`.
5. **Realtime subscriptions** (`supabase.channel`): SIEMPRE hacer `supabase.removeChannel(ch)` en cleanup del `useEffect`.

### Optimizaciones futuras pendientes (orden recomendado, no urgente)

Si en algún momento la app vuelve a sentirse lenta tras agregar features:

1. **Pausar polling de 5s cuando `document.hidden`** — `App.jsx:376` (10 min, cero riesgo).
2. **Debounce 200ms al input de búsqueda del CRM** — `CRM/index.jsx` (10 min, cero riesgo).
3. **Memoizar `<G>`, `<KPI>`, `<Pill>` con `React.memo`** — `SharedComponents.jsx` (15 min, cero riesgo).
4. **Reemplazar animaciones de `box-shadow` por `opacity` en `priorityBreathe` y `stratosNewLeadPulse`** — `App.css:164-185` (30 min, bajo riesgo visual).
5. **Reducir `backdrop-filter: blur(32px)` → `blur(16px)` en `GlassCard`** — `primitives.jsx:46` (10 min, casi imperceptible).
6. **Virtualizar lista de leads con `react-window`** — `CRM/index.jsx:2747` (2-3 horas, requiere testing del realtime).

**NUNCA hagas estas optimizaciones sin haber identificado un problema concreto.** El estado actual ya es fluido en PC normal.

---

## ⚠️ ZONA CRÍTICA — ARRANQUE DE LA APP (SW v356, Agosto 2026)

Síntoma que se cerró: *«la abro en la Mac o en el iPhone y se recarga varias veces sola, como lageada, y después ya entra»*. Eran **cinco causas encadenadas**, no una. El detalle completo está en `SW-VERSIONES.md` → v356. Las reglas que quedan:

### Las 5 reglas del arranque (romper una y vuelve el bug)

| # | Regla | Por qué |
|---|---|---|
| 1 | **NADIE recarga la página sin pasar por `window.__stratosReload(motivo, duro, forzada)`** (`[guard:RELOAD-ARBITER]` en `index.html`) | Había 3 sistemas de auto-recarga con contadores separados: "una recarga" para cada uno eran 3 seguidas para el usuario. El presupuesto (2 en 90s) es **compartido** y vive en `localStorage`, no en `sessionStorage`: la PWA de iPhone abre sesión nueva en cada apertura y el freno se perdía justo donde hacía falta |
| 2 | **El SW NO le pide a la app que recargue.** No revivir `SW_UPDATED` / `controllerchange → location.reload()` en `main.jsx` | La navegación es network-first ⇒ el HTML en pantalla YA es el nuevo. Esa recarga no aportaba nada y era el primer eslabón de la cascada (se disparaba en CADA deploy, y desplegamos ~3/día) |
| 3 | **`RUNTIME_CACHE` tiene nombre ESTABLE** (`'stratos-runtime'`, sin `CACHE_VERSION`) y `activate` NO lo borra | Los `/assets/` llevan el hash del contenido en el nombre ⇒ lo cacheado nunca está viejo. Cuando se versionaba, cada deploy obligaba a rebajar ~1.3 MB de librerías sin cambios. Se poda por cantidad (`RUNTIME_MAX`) |
| 4 | **`/assets/*` va con `Cache-Control: immutable`** en `vercel.json` | Vercel por defecto los servía `max-age=0, must-revalidate` ⇒ ~25 idas al servidor antes de pintar. En un iPhone son varios segundos de pantalla muerta. Es seguro **porque el nombre lleva el hash** |
| 5 | **Para saber si la app arrancó se mira `window.__STRATOS_BOOT__`, NUNCA si `#root` tiene hijos** | `#root` está vacío **a propósito** mientras baja el chunk de la app (`<Suspense fallback={null}>`): "cargando" y "muerta" se veían idénticas, y el vigilante recargaba apps sanas. La señal la emite `<BootSignal/>` en `main.jsx` |

### Otras dos cosas que NO hay que deshacer

- **`public/sw.js` se queda CHICO.** El navegador se lo baja entero en cada navegación. El historial de versiones va en `SW-VERSIONES.md`, **no** comentado dentro del archivo (llegó a pesar 271 KB, 97% comentarios). En `sw.js` queda la línea `CACHE_VERSION` con UNA línea de descripción.
- **El detector de crash usa claves `_v3`** y no cuenta las recargas propias (`window.__stratosRecargaPropia`). Contaba nuestras propias recargas como crash-loop de Safari y clavaba el modo seguro (sin blur ni animaciones) por 48h.

### Si tocás el arranque: TEST OBLIGATORIO

1. Abrir la app con caché vacío → **una sola carga**, splash visible, sin parpadeos.
2. Desplegar con la pestaña abierta → recargar a mano → entra sin cascada.
3. DevTools → Network: los `/assets/*` deben salir de `disk cache`, no con `200`/`304`.
4. `localStorage.stratos_reload_budget_v1` no debe quedar con `n>0` tras un arranque sano.

---

## ⚠️ ZONA CRÍTICA — ARQUITECTURA MULTI-CLIENTE (Mayo 2026)

A partir de Mayo 2026 el proyecto sirve a múltiples clientes desde el mismo
código. **NO ES un fork — es un solo bundle con config por cliente.**

### Routing

`src/main.jsx` resuelve el cliente activo al boot vía `resolveClientFromLocation()`:

| URL | Cliente | Comportamiento |
|---|---|---|
| `app.stratoscapitalgroup.com` (sin path) | `duke` | Cliente original (producción Duke del Caribe) |
| `app.stratoscapitalgroup.com/grupo28` | `grupo28` | Cliente nuevo (Grupo 28) |
| `grupo28.stratoscapitalgroup.com` (fase 2) | `grupo28` | Mismo cliente, subdomain |
| `localhost:5173/?app&client=grupo28` | `grupo28` | Override de QA en dev |

El cliente queda disponible en toda la app vía `useClient()`:

```js
import { useClient } from "../hooks/useClient";
const { config, clientId, isFeatureEnabled } = useClient();
// → config.name, config.brand.logoText, config.tenant.clientId, etc.
// → isFeatureEnabled("rrhh") devuelve false si grupo28 lo apagó
```

### Estructura de archivos

```
src/clients/
├── _shared/defaults.js   ← config base que todos heredan
├── index.js              ← resolver + registry
├── duke/config.js        ← cliente original (zona protegida, solo owner)
└── grupo28/config.js     ← cliente nuevo (zona del dev externo)
```

### Reglas inviolables para el dev externo de Grupo 28

1. **SOLO puede modificar archivos dentro de `src/clients/grupo28/`** sin esperar review.
2. Cualquier mejora al **CRM compartido** (`src/app/`, `src/contexts/`,
   `src/lib/`, `src/design-system/`, `src/main.jsx`) requiere PR + review del
   owner. Esto está enforced por:
   - `.github/CODEOWNERS` — asigna automáticamente al owner
   - Branch protection en `main` con `require_code_owner_reviews: true`
3. **Datos:** Grupo 28 NO debe leer/escribir registros del cliente `duke` en
   Supabase. Filtrado obligatorio por `client_id = "grupo28"` o proyecto
   Supabase separado.
4. **Branch:** trabajar SIEMPRE en `feature/grupo28-*`, nunca commit directo a `main`.

### Promover mejoras de Grupo 28 al core (y a Duke)

Si el dev de Grupo 28 mejora algo del CRM compartido (ej: optimiza el módulo
de clientes), el flujo es:

1. Dev abre PR con cambios en `src/app/...` → GitHub asigna al owner.
2. Owner revisa que la mejora sea **gated por feature flag** o **agnóstica de
   cliente** (no rompe Duke).
3. Si la mejora es opt-in, agregar bandera en `_shared/defaults.js`:
   `features.nuevoModulo: false` (default off, Grupo 28 lo prende en su config).
4. Cuando se valide con Grupo 28, prender la bandera para Duke en
   `clients/duke/config.js`.

### Aislamiento de datos (Supabase)

**Implementado vía `organization_id` + RLS** en el proyecto Supabase principal
(`glulgyhkrqpykxmujodb`). PR #90 y #93 ya tienen el aislamiento end-to-end:

- Cada `profiles` tiene `organization_id`. `organizations` es la tabla de orgs.
- `STRATOS_ORG_ID = "00000000-0000-0000-0000-000000000001"` (Stratos / Duke).
- `Grupo 28` organizationId = `"9afe40d2-7163-4407-a4cd-5346799ecd3c"`.
- `canAccessModule(moduleId, user)` en `src/app/constants/navigation.js`:
  clientes externos solo ven CRM, Perfil, Papelera (independiente del rol).
- RLS de Supabase filtra registros por `organization_id` automáticamente.

### Conexión: clientId (URL) ↔ organizationId (Supabase)

Cada config en `src/clients/<id>/config.js` declara su `tenant.organizationId`.
El componente `ClientOrgGuard` (montado en `main.jsx` cuando `isApp=true`)
chequea post-login: si la org del user logueado no matchea con el cliente
del path, redirige al path correcto con `window.location.replace()`.

Ejemplos:
- User Grupo 28 entra a `/` → se redirige a `/grupo28`.
- User Stratos entra a `/grupo28` → se redirige a `/`.
- Usuarios de orgs no registradas en `src/clients/` → no se redirige (cubre
  el caso de clientes nuevos sin config aún).

Helpers expuestos en `src/clients/index.js`:
- `getClientIdByOrgId(orgId)` → clientId conocido o null.
- `getOrgIdByClientId(clientId)` → UUID de Supabase o null.
- `resolveRedirectForUser(user, currentClientId, location)` → URL absoluta a la
  que redirigir, o null.

### Documentos relacionados

- `SETUP_DEV_GRUPO28.md` — guía paso a paso para el dev externo.
- `src/clients/_shared/defaults.js` — campos disponibles para customizar por cliente.

---

## Contacto del Proyecto

- **Cliente**: Ivan Rodriguez Ruelas
- **Claude Code**: disponible para hacer cambios vía sesión
- **Desarrollador externo**: usar este archivo + DEVELOPMENT.md como referencia completa

---

*Última actualización: Mayo 2026 — SW v12, auth flow estabilizado + performance optimizado (PR #54) + arquitectura multi-cliente (PR #55).*
