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
const CACHE_VERSION = 'stratos-v23';
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
