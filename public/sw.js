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
// v42 — (PR #226) Manual público del Asistente de Telegram en /manual-asistente-telegram.
// v43 — Indicadores · Productividad: desplegable por asesor con el detalle de
//   sus acciones (Pendientes vs Completadas), estado (Pendiente/En proceso/
//   Completada/No la hice), fecha y nota. Forward-compatible con la columna
//   `status` de team_actions (cuando exista, enciende En proceso / No la hice).
// v77 — fix(iOS): crash de Safari en iPhone ("Ocurrió un problema varias veces").
//   WebKit mata la pestaña por memoria de compositing (muchas capas con
//   backdrop-filter: blur(32px) de GlassCard + animaciones infinitas). En móvil
//   se baja el blur a 4px y se frenan las animaciones continuas (mobile-perf.css);
//   un detector de loop de crash en index.html activa un "modo seguro" (sin blur
//   ni animaciones) si aún así recarga en loop. Bump para bajar el fix a iPhones
//   con el bundle viejo cacheado.
// v79 — fix(comando): métricas de Zoom correctas. next_action_at ya no fabrica
//   "Zoom agendado" (todos los leads nuevos lo traen por la llamada de rescate),
//   milestoneOf toma el hito MÁS ANTIGUO del historial (se guarda newest-first,
//   antes re-fechaba el Zoom en cada avance de etapa), etapas legacy
//   normalizadas en los conteos, y gráfica/totales del Comando cuentan Zooms
//   por fecha real del evento (cuadran con embudo, ZoomBoard y tabla asesor).
// v80 — fix(comando): los totales del Comando cuadran con el pipeline del CRM.
//   Las cuentas ocultas (ex-asesores, prueba/sistema) ya NO se excluyen de los
//   cálculos: sus leads/Zooms cuentan en totales, embudo y gráfica, y en las
//   tablas por asesor se colapsan en una fila "Cuentas inactivas". Antes el
//   cliente veía 1485 en el pipeline y menos en el Comando (Histórico).
// v81 — feat(meta): pestaña "Documentos" en el panel de la meta (links a Google
//   Docs/Drive/Notion etc., guardados en organizations.meta_config.documents)
//   y Lista de Acción rediseñada: tipografía más grande y legible, checkboxes
//   redondos, más aire. Bump para que el bundle nuevo baje a todos.
// v82 — HOTFIX: crear landing pages crasheaba (pantalla en blanco al dar
//   "Nueva Landing Page"): ArrowRight/CheckCircle2/ChevronUp usados sin
//   importar en LandingPages/index.jsx y CheckCircle2/StratosAtom en
//   LandingPagePreview.jsx. Solo imports, cero cambios de lógica.
// v83 — feat(ui): el widget del plan (barra lateral) muestra la etiqueta
//   "ACT hechas/total" (Lista de Acción) arriba del % de avance, en vez del
//   valor de pipeline + score. Compacta y centrada para no salirse del ancho.
// v84 — feat(caja): módulo "Caja" en el menú lateral (feature flag `caja`, hoy
//   solo Vega): cuentas, ingresos y egresos sobre team_expenses. Los gastos
//   registrados por Telegram aparecen ahí solos; cualquier rol registra desde
//   la web. Migraciones 066-069 (tipo+account, source web, aviso a admins).
// v85 — feat(whatsapp): chat de WhatsApp EN VIVO en el expediente del lead
//   (tab Chat): hilo real espejado desde Chatwoot (whatsapp_messages) +
//   composer para responder desde el CRM (whatsapp_outbox → n8n → Chatwoot).
//   Feature flag `whatsappChat` (solo Duke). Ventana 24h de Meta respetada.
// v86 — fix(whatsapp): el chat en vivo también se monta en el panel de notas
//   (NotesModal) — Duke usa discoverySimplified, así que el click en el lead
//   abre ESE panel y no el LeadPanel con tabs; el chat no se veía.
// v87 — feat(caja): módulo Caja disponible para TODOS los clientes por defecto
//   (Duke, Grupo 28, …) para roles de mando; rediseño visual (glass + tokens
//   del theme). Vega conserva acceso de asesores vía `cajaAsesores`.
// v88 — feat(whatsapp): módulo "WhatsApp" en el sidebar (bandeja con todos los
//   chats + no-leídos por conversación) + notificaciones en la campanita
//   cuando un cliente escribe. Multimedia: enviar/recibir imágenes, audios,
//   video y archivos (whatsapp_messages.media + bucket wa-outbound).
// v89 — fix(ui): el widget del plan (barra lateral) cuenta lo MISMO que el panel
//   "Acciones del Equipo" (metaActions: derivadas de leads + creadas a mano en
//   team_actions), no solo la tabla team_actions. Así "ACT hechas/total" y el %
//   de AVANCE cuadran con las "N pendientes · M completadas" del panel.
// v90 — feat(whatsapp): nota de voz grabada desde el chat (micrófono, como
//   WhatsApp: grabar → preview → enviar) + gestión del lead desde la bandeja
//   (cambiar etapa y reasignar asesor sin salir del chat) + click en el nombre
//   abre el expediente completo en el CRM + notificaciones (contador en el
//   título de la pestaña y notificación nativa del navegador). Leads de
//   campaña entran frescos y MUY visibles (migs 078/079: sin texto placeholder
//   legacy, captura solo al vincular la conversación, revival de etapas
//   tempranas a Contáctame Ya — caso Camila).
// v91 — pulido UI: nombres de adjuntos de WhatsApp limpios (se cortaba la fuga
//   del header Content-Disposition, ej. "archivo.jpg-filename*=") + detección de
//   imagen/audio/video por extensión del nombre; "Próxima acción" en un solo
//   renglón en todos los dispositivos (texto completo en el tooltip); Caja
//   muestra la foto del comprobante (bucket evidencia, URL firmada al abrir).
// v92 — feat(whatsapp): la nota de voz del CRM llega como NOTA DE VOZ NATIVA
//   de WhatsApp (burbuja con onda). Se graba directo en OGG/OPUS (el formato
//   de voz de Meta) vía opus-recorder (wasm en un Worker, carga perezosa de
//   ~380KB SOLO al presionar el micrófono; cero costo al boot). Si el encoder
//   no carga, respaldo automático al camino anterior (m4a → documento).
// v93 — fix(whatsapp): las notas de voz ahora VIAJAN DIRECTO a la API de Meta
//   (upload + send por media_id) porque el envío de audio por link de Chatwoot
//   falla con 131053 en cualquier formato. En el CRM, la nota de voz enviada
//   se sigue mostrando en el hilo (la fila del outbox es el registro — no hay
//   espejo de Chatwoot para estos mensajes).
// v94 — fix(crm): la tabla vuelve a ordenar por "Más recientes" (created_at
//   desc) por defecto: los leads que llegaron más recientemente SIEMPRE
//   arriba. Los usuarios que quedaron en el default viejo 'proxZoom' migran
//   solos; "Próximo Zoom" sigue disponible en el selector como orden de
//   sesión (al recargar vuelve a "Más recientes").
// v95 — fix(crm): el orden de la tabla ya NO se lee de prefs guardadas.
//   La v94 migraba solo los defaults viejos ('sc'/'proxZoom' desc) pero
//   respetaba órdenes explícitos (nombre, presupuesto, seguimientos, score)
//   guardados en server o localStorage → esas cuentas seguían sin ver los
//   recientes arriba. Ahora la tabla SIEMPRE carga "Más recientes"
//   (created_at desc) en toda cuenta y dispositivo; el selector funciona
//   como orden de sesión.
// v96 — fix(boot): auto-recovery de "chunk viejo tras deploy". Una pestaña
//   abierta durante un deploy lazy-importaba un asset con hash viejo (ya
//   inexistente en Vercel) y el usuario veía "⚠️ Algo salió mal / Importing a
//   module script failed". Ahora: listener vite:preloadError en main.jsx +
//   detección en ErrorBoundary → recarga automática (1 vez/min máx) que toma
//   el index.html nuevo. "Reintentar" también recarga en ese caso.
// v97 — fix(crm): "Más recientes" es orden ESTRICTO por llegada. Antes los
//   grupos isNew (nuevo sin abrir) y pinned (estrella) brincaban arriba de la
//   tabla aunque fueran más viejos, tapando a los recién llegados. Ahora con
//   el orden default la tabla es puro created_at desc (halo y estrella siguen
//   visibles; los pins conservan su efecto en el carrusel y en los otros
//   órdenes del selector).
// v98 — fix(crm): los filtros de etapa/asesor tampoco se restauran al abrir.
//   Una cuenta con filtro guardado (etapa "Contáctame Ya" + asesor "Cecilia")
//   solo veía ese subconjunto y los leads de hoy (de otros asesores) quedaban
//   ocultos → el CRM parecía "desordenado" aunque el orden era correcto.
//   Abrir el CRM = ver TODO con lo más nuevo arriba, siempre.
// v99 — perf(whatsapp): la bandeja carga al instante. (1) fn_wa_conversations
//   reescrita (mig 081): permisos evaluados UNA vez + últimos mensajes por
//   índice — ~5ms aunque haya miles de conversaciones (antes la RLS corría por
//   cada mensaje). (2) Caché local POR USUARIO: la lista pinta de inmediato y
//   la red refresca detrás. Permisos confirmados: super_admin/admin/director
//   ven todas; el asesor SOLO sus leads (listo para multi-canal por asesor).
// v100 — fix DEFINITIVO del crash de iPhone ("Ocurrió un problema varias
//   veces"): (1) en móvil el backdrop-filter se APAGA por completo con selector
//   universal (bajar el radio no alcanzaba: el costo es LA CAPA de compositing,
//   y la app creció) — cubre también cualquier blur futuro; (2) el modo seguro
//   ahora es PEGAJOSO 48h y detecta crashes aunque recargues a mano (contador
//   de arranques fallidos en localStorage, no solo el loop rápido); (3) nuevo
//   GUARDIÁN DE BUILD (tools/check_mobile_perf.mjs, prebuild): ningún PR futuro
//   puede borrar/aflojar estas defensas ni meter animaciones infinitas por
//   clase — el build falla con la explicación.
// v101 — rediseño del módulo WhatsApp: (1) el chat ocupa TODA la pantalla y el
//   composer queda FIJO abajo (PC y móvil; ya no se pierde al hacer scroll —
//   solo el hilo scrollea) + shell en 100dvh (la barra de Safari iOS ya no tapa
//   el borde inferior); (2) conversaciones PINEABLES (fijar arriba, por
//   usuario; mig 082) + filtro por etapa del pipeline + toggle "No leídos";
//   (3) cada fila muestra la etapa (pill de color) y el asesor (para mando).
// v107 — WhatsApp OCULTO temporalmente para el equipo de Duke: el módulo del
//   sidebar y el chat del expediente quedan **solo super_admin** (nosotros),
//   los asesores no lo ven. La funcionalidad está COMPLETA e intacta — solo se
//   esconde mientras los números se conectan por coexistencia directo a Meta.
//   Reversible: quitar el gate de super_admin en navigation.js (`wa`) y en
//   LeadWhatsAppChat (`enabled`). No toca datos ni backend.
// v108 — RESPONSIVE MÓVIL integral (360-430px, para la app y el navegador del
//   celular; desktop INTACTO, verificado con capturas 1440px): (1) header sin
//   encimados — pill IAOS compresible con ellipsis, teléfono oculto en móvil,
//   toggle de tema oculto <430px, wordmark truncable, dropdown campana a lo
//   ancho; (2) KPI compartido responsive (ícono ya no pisa el label, número
//   28px con ellipsis) + grids 4→2 col por auto-fit en Create/ERP/proyecciones;
//   (3) tabla Campañas con scroll propio; (4) Perfil ya no desborda (width
//   100% + minWidth 0 + email quebrable); (5) CRM: FAB se aparta del carrusel
//   (IntersectionObserver), flechas solo desktop, clearance inferior; (6)
//   pestañas Comando scrolleables + embudo envolvente; (7) bottom nav 4
//   primarios + Más (resto al sheet) + safe-areas iPhone/Android en header,
//   nav, sheet y contenido; overflow-x global bloqueado en móvil.
// v109 — feat(zooms): Control de Zooms v2 según reunión con el director
//   comercial (09-jul): Resumen automático (KPIs de hoy por estatus, semana
//   L-D con 7 días, tablas por Liner hoy/semana y por Presentador, próximos
//   7 días) con PDF propio para los socios; campo Discovery con indicador
//   Sí/No; flag "calentito" (señal de cierre) con filtro y toggle en tabla.
//   Requiere migración 083 (discovery/calentito); sin ella el panel funciona
//   igual que antes (feature-detect de columnas).
// v110 — feat(zooms): alcance Mes en el Resumen (toggle Hoy|Semana|Mes por
//   Liner, columna Mes en Presentador, seccion mensual en el PDF). Bump para
//   que los SW con v109 pre-Mes tomen el bundle nuevo.
// v111 — style(zooms): legibilidad del Control de Zooms — números y letras
//   más grandes y con más tinta (KPIs 28px, tablas 13.5px, headers 11.5px,
//   grises tenues promovidos a txt2/txt), tarjetas de día de la semana más
//   presentes. Pedido de Ivan: "letras y números que no se batallen para ver".
const CACHE_VERSION = 'stratos-v111';
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
