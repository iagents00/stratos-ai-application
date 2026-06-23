/**
 * sw.js — Service Worker de Stratos AI
 * ─────────────────────────────────────────────────────────────────────────────
 * Estrategia "offline-first" pragmática:
 *
 *   App shell (HTML, JS, CSS, fonts, JSON estáticos)
 *     → Cache-first con revalidación en background
 *     → La app carga aunque no haya internet
 *
 *   Supabase REST/Realtime (rest/v1, realtime/v1)
 *     → Network-only con timeout: si falla, la lógica de la app
 *       (offline-mode.js) toma el relevo. NO cacheamos respuestas
 *       de Supabase porque cambian constantemente.
 *
 *   Navegación (request HTML)
 *     → Network-first con fallback al cache
 *     → Si no hay red, sirve la última versión del index.html cacheada
 *
 * El SW se actualiza automáticamente al cambiar CACHE_VERSION.
 * Llamamos a self.skipWaiting() + clients.claim() para que la nueva
 * versión tome control en el siguiente refresh sin requerir interacción.
 */

// v12 — supabase.auth.getSession() se colgaba >25s al refrescar porque el
// SDK intentaba auto-refresh interno sin timeout. Eso bloqueaba el lock
// del SDK → cualquier signInWithPassword posterior quedaba en
// "Conectando con el servidor..." indefinido. Fix: timeout 3.5s a
// getSession + fallback a caché 24h. Además hidratación timer baja a 12s
// (era 25s) porque ya no hay razón para esperar tanto. También: lentitud
// al registrar leads — appendToMirror ahora defer con requestIdleCallback.
//
// v17 — fix(crm): al darle estrella, el lead va al INICIO del carrusel
//       de prioridad (antes iba al final en modo manual porque
//       priorityOrder no se actualizaba en togglePin).
// v16 — CRM list view paleta: WA/TG/FB badges con nombres completos
//       (WhatsApp, Telegram, Facebook), nombres de cliente con wrap (no
//       ellipsis), CTA "Agendar fecha" + highlight de pinned migrados de
//       dorado/ámbar a azul (T.blue) — solo el ícono ★ pinneado mantiene
//       el dorado como único toque cálido.
// v15 — CRM list view fix: presupuesto en columna propia (no flotando),
//       email/★/persona siempre visibles (no hover-reveal — más intuitivo),
//       hoveredRow state ELIMINADO → no más re-render de 80 filas al
//       pasar el mouse (causaba lag visible).
// v14 — CRM list view rediseño minimalista: pill etapa sin gradient/shadow,
//       chip cita outline sutil, email a hover, ★/persona ghost con
//       hover-reveal, más respiro vertical (14→18px).
// v13 — alta detecta duplicados (RPC find_lead_duplicate) y avisa quién
//       tiene al cliente antes de registrar.
// v12 — performance: removeEventListener cleanup + useMemo AuthContext.
// v21 — F5 instantáneo: hidratación SÍNCRONA de sesión desde caché +
//        splash en vez de LoginScreen mientras se valida sesión probable.
//        Elimina el flash a login y los 2 s de espera de los clientes.
// v20 — nueva etapa "Rotación" en el pipeline (antes de Perdido).
// v19 — quitar source badge de la fila (va a la línea de meta) +
//        centrar headers y celdas de Etapa/Seguim/Score (simetría).
// v18 — triple-redundancia de leads (IDB + LS + RPC + dead-letter) +
//        autosave de draft + chip de teléfono inline + HOT como dot.
// v11 — flowType pkce → implicit.
// v10 — limpieza de tokens legacy stratos.supabase.*.
// v9 — destrabar login: cuelgue infinito por bundle viejo cacheado.
// v8 — orden por defecto del CRM: fechaIngreso desc (nuevos arriba).
// v25 — leads cache síncrono + re-persiste en realtime + SIGNED_OUT con
//       silent refresh (fix: leads desaparecían 10s al F5; bounce a login en
//       medio de sesión por fallos transitorios de refresh de JWT).
// v24 — Pipeline Duke v2 (Mayo 2026): 12 etapas oficiales + migración de
//       legacy stages (Zoom Concretado/Negociación/Visita Concretada →
//       Seguimiento; No Show → Reactivar Zoom; Remarketing → Remarketing IA).
//       Bump obligatorio: el bundle cacheado mapea contra etapas viejas.
// v26 — kick-out de admins ("estás adentro y de la nada te saca").
// CAUSA RAÍZ: los admins ven TODOS los leads de la org (RLS) y el caché de
// leads en localStorage (~1.9 MB con 594 leads) compartía cuota con el token
// sb-<ref>-auth-token. En browsers con cuota ajustada (Safari/Mac) el SDK no
// podía PERSISTIR el token refrescado (QuotaExceededError silencioso) → al
// siguiente F5 no había sesión → logout. Los asesores no lo sufrían (solo
// cachean sus propios leads). Fix: el caché de leads se acota a 150 (App.jsx).
// Hardening adicional: en SIGNED_OUT espontáneo NO se hace clearLocalAuthState()
// (borraba el token compartido y cascada el logout a todas las pestañas).
// v27 — CRM fluido a 10k leads + reasignación masiva por grupo.
// · Lista con windowing por scroll (solo ~60 filas en DOM), búsqueda con
//   debounce, Prioridad y Kanban acotados → el CRM no se traba con miles.
// · Reasignación masiva: selección múltiple + barra de acción + 1 sola
//   escritura vía fn_bulk_reassign_leads (no N updates) → fluido en grupos grandes.
// v28 — reasignar movido a la columna de Acciones (botón por fila, a la derecha,
//   junto a destacar/ver perfil) y se quitaron los checkboxes del lado izquierdo.
//   Más simple e intuitivo; abre el mismo modal (asesor destino + Contáctame Ya).
// v29 — reasignación EN GRUPO: botón "Reasignar varios" en la barra activa
//   selección múltiple (checkboxes a la derecha) + barra para reasignar el grupo
//   de una sola vez vía fn_bulk_reassign_leads. Convive con el botón por fila.
// v30 — la fila del lead es clickeable: el avatar (inicial) y cualquier zona
//   vacía abren el Discovery del cliente. El texto editable y los controles
//   (etapa, score, destacar, perfil, reasignar) conservan su comportamiento.
// v31 — reasignación a prueba de fallos: si la RPC falla (offline o error
//   transitorio) ya NO se hace rollback; la reasignación se encola en la misma
//   cola offline que el resto (overlay + stratos_pending_sync) y el
//   auto-recovery la sincroniza al volver la conexión. Nada se pierde, ni en F5.
// v32 — fuerza la entrega del orden por Zoom en el CRM (PRs #187/#190/#191/#192):
//   fechas con palabras, tabla ordenada por proximidad, parser tolerante al texto
//   largo y agrupación de HOY como bloque arriba. El bump invalida el shell viejo
//   para que todos bajen el bundle nuevo en la próxima carga, sin limpiar caché.
// v33 — trazabilidad de reasignación: el filtro del pipeline del asesor ahora
//   está en paridad con la RLS (lead "mío" por asesor_id O por asesor_name).
//   Antes, al reasignar un lead a otro asesor el asesor_id quedaba viejo y el
//   nuevo asesor no lo veía en pipeline/buscador (ni sus notas), aunque la RLS
//   sí se lo entregaba. Además updateLead ya no arrastra el asesor_id anterior.
// v34 — fix loop de recarga en iOS ("Ocurrió un problema varias veces"): el
//   forceReload de main.jsx ahora tiene guard cross-reload (sessionStorage) para
//   no recargar en loop cuando iOS dispara controllerchange en cada carga.
// v35 — modal "Programar Zoom Agendado": campos fecha/hora separados, sin
//   "Próxima acción", y disponible también al crear cliente nuevo en esa etapa.
//   Bump para forzar que los navegadores tomen el bundle nuevo.
const CACHE_VERSION = 'stratos-v39';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Recursos críticos que precaheamos en la instalación
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
];

// ── INSTALL: precache del app shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejos + avisar a clientes para recargar ──
// Tras claim(), main.jsx escucha 'controllerchange' y hace location.reload().
// Si el JS del cliente está colgado (caso "Verificando…" infinito), el
// reload no se procesa — el usuario tendrá que cerrar y reabrir la tab.
// Para esos casos también enviamos un postMessage explícito por si algún
// listener no relacionado al controllerchange puede actuar.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    )
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ includeUncontrolled: true }))
    .then(clients => {
      for (const c of clients) {
        // SW_UPDATED → main.jsx fuerza window.location.reload()
        // PURGE_LEGACY_AUTH → main.jsx limpia tokens huérfanos antes del reload
        c.postMessage({ type: 'PURGE_LEGACY_AUTH', version: CACHE_VERSION });
        c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
      }
    })
  );
});

// ── Helper: identificar requests a Supabase ──
function isSupabaseRequest(url) {
  // Cualquier dominio supabase.co (rest/realtime/auth/storage)
  return url.hostname.endsWith('.supabase.co') ||
         url.hostname.endsWith('.supabase.in');
}

// ── Helper: identificar assets cacheables ──
function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  // Solo GET requests
  return /\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?|ttf|json|webmanifest)$/i.test(url.pathname);
}

function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

// ── FETCH: estrategias por tipo de request ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ── Supabase: network-only (no cachear; deja que la app maneje fallos) ──
  if (isSupabaseRequest(url)) {
    return;
  }

  // ── Navegación HTML: network-first con fallback al index cacheado ──
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Cachear la copia más reciente del HTML para próximos offline
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put('/index.html', copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // ── Assets estáticos: stale-while-revalidate ──
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request)
          .then(res => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then(c => c.put(request, copy)).catch(() => null);
            }
            return res;
          })
          .catch(() => cached); // sin red → sirve el cacheado
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── Default: red normal (no interceptamos) ──
});

// ── MESSAGE: permite a la app forzar la actualización del SW ──
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
