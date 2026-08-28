/**
 * sw.js — Service Worker de Stratos AI
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ESTE ARCHIVO SE BAJA ENTERO EN CADA NAVEGACIÓN. El navegador lo re-pide
 * para ver si cambió, en cada apertura de la app, en celular incluido. Por eso
 * tiene que quedarse CHICO: el historial de versiones va en `SW-VERSIONES.md`,
 * NO acá. (El 05-ago-2026 este archivo pesaba 271 KB — 9 KB de código y 262 KB
 * de comentarios de versiones viejas.)
 *
 * Estrategia:
 *
 *   Navegación (HTML)          → network-first, fallback al index cacheado.
 *   Assets con hash (/assets/) → cache-first (el hash ES la versión).
 *   Assets sin hash (iconos…)  → stale-while-revalidate.
 *   Supabase (rest/realtime)   → no se toca (network puro).
 *
 * ── DOS CACHÉS, Y SE PORTAN DISTINTO (clave para que un deploy no duela) ──
 *   STATIC_CACHE  → versionado por CACHE_VERSION. Guarda URLs SIN hash
 *                   (`/index.html`, iconos). Un deploy lo renueva.
 *   RUNTIME_CACHE → nombre ESTABLE, sobrevive a los deploys. Guarda
 *                   `/assets/*`, cuyo nombre YA lleva el hash del contenido:
 *                   dos versiones nunca chocan. Antes este caché se borraba en
 *                   cada deploy y el usuario tenía que rebajar ~1.3 MB de
 *                   librerías que NO habían cambiado (react, supabase,
 *                   recharts…). Eso era buena parte del "se abre lageado".
 *                   Se poda por cantidad para que no crezca sin fin.
 *
 * ── EL SW NO RECARGA LA PÁGINA. NUNCA. ──
 *   Hasta ago-2026 el SW avisaba `SW_UPDATED` y `main.jsx` hacía
 *   `location.reload()`. Como la navegación es network-first, el HTML que el
 *   usuario acababa de bajar YA era el nuevo: esa recarga no aportaba nada y
 *   sí disparaba la cascada de recargas al abrir la app. La versión nueva entra
 *   sola en la próxima navegación. Ver `main.jsx` → SERVICE WORKER.
 */

const CACHE_VERSION = 'stratos-v423'; // v423: pipeline de Google Play (AAB firmado, target 36)

const STATIC_CACHE  = `${CACHE_VERSION}-static`;
// Nombre ESTABLE a propósito: no lleva CACHE_VERSION (ver cabecera).
const RUNTIME_CACHE = 'stratos-runtime';
// Tope de entradas del runtime. Una versión completa de la app son ~70 chunks;
// 260 deja aire para ~3 deploys antes de podar los más viejos.
const RUNTIME_MAX = 260;

// Recursos críticos que precaheamos en la instalación
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
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

// Poda del runtime: `cache.keys()` devuelve las entradas en orden de inserción,
// así que borrar desde el principio saca las más viejas.
async function podarRuntime() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    if (keys.length <= RUNTIME_MAX) return;
    const sobran = keys.slice(0, keys.length - RUNTIME_MAX);
    await Promise.all(sobran.map(k => cache.delete(k)));
  } catch (_) { /* noop */ }
}

// ── ACTIVATE: limpiar cachés viejas y tomar control ──
// NO se le avisa a la página para que recargue (ver cabecera). El único mensaje
// que se manda es PURGE_LEGACY_AUTH, que limpia tokens huérfanos sin recargar.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          // se conservan: el static de ESTA versión y el runtime estable
          .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(podarRuntime)
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true }))
      .then(clients => {
        for (const c of clients) {
          c.postMessage({ type: 'PURGE_LEGACY_AUTH', version: CACHE_VERSION });
        }
      })
      .catch(() => null)
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

// Los que Vite emite en /assets/ llevan el hash del contenido en el nombre:
// si el archivo existe en caché, ES el correcto — no hace falta revalidarlo.
function isHashedAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/assets/');
}

function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

// Landings estáticas de campaña: son archivos HTML propios servidos desde
// public/, NO rutas del SPA. Sin esto el SW guardaba la landing de Duke como
// '/index.html' y se la servía como shell de la app a quien abriera sin red.
const LANDINGS_ESTATICAS = ['/mondrian', '/bayview', '/duke-100k', '/desarrollos-97k', '/duke-97k'];

function isStandaloneLanding(url) {
  return url.pathname.startsWith('/duke/') || LANDINGS_ESTATICAS.includes(url.pathname.replace(/\/$/, ''));
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

  // ── Landings de campaña: no las tocamos. Son HTML propio, no el SPA, y
  //    cachearlas como '/index.html' rompía el shell de la app. Además nos
  //    interesa que lleguen frescas: son el destino de anuncios pagados. ──
  if (isStandaloneLanding(url)) {
    return;
  }

  // ── Navegación HTML: network-first con fallback al index cacheado ──
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Solo se guarda una respuesta SANA. Sin este chequeo, una página de
          // error de Vercel (404/500) quedaba cacheada COMO index.html y se le
          // servía al usuario la próxima vez que se quedara sin red.
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put('/index.html', copy)).catch(() => null);
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // ── Assets con hash (/assets/): cache-first ──
  // El nombre lleva el hash del contenido ⇒ lo cacheado nunca está "viejo".
  // Sirve al instante y evita la revalidación por red de ~25 archivos en cada
  // apertura (lo que se sentía como "lageado" al abrir).
  if (isHashedAsset(url) && isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(request, copy)).catch(() => null);
          }
          return res;
        });
      })
    );
    return;
  }

  // ── Assets sin hash (iconos, manifest…): stale-while-revalidate ──
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

// ── PUSH: recibe notificaciones push del servidor y las muestra ──
// Esto es lo que FALTABA para que las notificaciones lleguen con la app CERRADA
// en iPhone (PWA "Agregar a inicio") y Android. Sin este handler, el navegador
// recibe el push pero no sabe qué hacer con él → no se muestra nada.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    try {
      payload = { title: 'Stratos AI', body: event.data.text() };
    } catch { return; }
  }

  const title = payload.title || 'Stratos AI';
  // LLAMADAS (kind='llamada', botón "Llamar" del equipo): notificación tipo
  // teléfono — se queda en pantalla, vibra largo y (donde el SO lo soporta,
  // Android/Chrome) trae botones Contestar/Rechazar. En iPhone no hay botones
  // custom: TOCARLA es contestar (notificationclick abre directo el Meet).
  const isCall = payload.kind === 'llamada';
  const options = {
    body:  payload.body  || '',
    icon:  payload.icon  || '/icon-192.png',
    badge: payload.badge || '/favicon-32.png',
    tag:   isCall ? 'stratos-llamada' : (payload.tag || 'stratos-notif'),
    renotify: isCall || undefined,
    data:  {
      url:   payload.url   || '/',
      view:  payload.view  || 'c',
      leadId: payload.lead_id || null,
      kind:  payload.kind || null,
    },
    requireInteraction: isCall ? true : !!payload.requireInteraction,
    vibrate: isCall ? [300, 120, 300, 120, 300, 120, 300] : (payload.vibrate || [200, 100, 200]),
    actions: isCall
      ? [{ action: 'answer', title: '📞 Contestar' }, { action: 'dismiss', title: 'Rechazar' }]
      : undefined,
    timestamp: Date.now(),
  };

  // Con la app ABIERTA, además de la notificación del sistema (que da UN solo
  // sonido) le avisamos a la pestaña para que muestre la pantalla de llamada y
  // suene el timbre continuo estilo WhatsApp.
  //
  // ⚠️ POR QUÉ POR AQUÍ Y NO POR REALTIME (bug real 27-jul, reporte de Ángel):
  // la app se suscribe a INSERTs de `proactive_reminders`, pero esa tabla NO
  // está en la publicación `supabase_realtime` → el evento NUNCA llega y el
  // timbre jamás arrancaba. Publicarla arreglaría el camino pero inundaría a
  // los tenants grandes (Duke inserta ~1.4k filas/día y useCopilotInbox escucha
  // esa tabla con event:'*' SIN filtro) → regresión de performance en producción.
  // El push ya funciona y es NSG-only (nadie más manda kind='llamada').
  event.waitUntil((async () => {
    if (isCall) {
      const caller = payload.caller
        || String(title).replace(/^📞\s*/, '').replace(/\s+te est[áa] llamando\s*$/i, '').trim()
        || 'Alguien';
      try {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of wins) {
          c.postMessage({ type: 'INCOMING_CALL', caller, meet: options.data.url });
        }
      } catch (_) { /* sin pestañas abiertas → queda solo la notificación */ }
    }
    await self.registration.showNotification(title, options);
  })());
});

// ── NOTIFICATIONCLICK: cuando el usuario toca la notificación ──
// Abre el CRM (o lo enfoca si ya está abierto) y navega a la vista correcta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  // LLAMADA: contestar = abrir el Meet DIRECTO (es un dominio externo — acá no
  // aplica el focus del CRM). "Rechazar" solo cierra la notificación.
  if (data.kind === 'llamada') {
    if (event.action === 'dismiss') return;
    event.waitUntil(clients.openWindow(targetUrl));
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Si ya hay una ventana abierta del CRM, la enfoca y navega
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              view: data.view,
              leadId: data.leadId,
              url: targetUrl,
            });
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abre una nueva
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── PUSHSUBSCRIPTIONCHANGE: detecta cuando la suscripción expira ──
// Envía el nuevo endpoint al backend para mantenerlo actualizado.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(subscription => {
        // Notificar al backend con la nueva suscripción
        return fetch('/api/push/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription?.endpoint,
            newSubscription: subscription.toJSON(),
          }),
        });
      })
      .catch(() => { /* no hacer nada si falla */ })
  );
});
