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

const CACHE_VERSION = 'stratos-v3';
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

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
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
