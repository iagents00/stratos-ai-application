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
// v112 — feat(zooms): la tabla se usa como el sheet del director comercial:
//   vista completa por default (próximos y HOY arriba, histórico abajo),
//   columna Comentarios visible con tooltip y pill HOY en los zooms del día.
//   La migración 085 (staged) sincroniza el CRM → Control de Zooms por
//   trigger en leads; pendiente de autorización para aplicar a prod.
// v113 — feat(zooms): ajustes finos pedidos por el director comercial:
//   separadores por día en la tabla (lectura agrupada como su sheet, con
//   conteo y marca HOY), alcance Quincena en Resumen y PDF, export CSV con
//   las columnas exactas del sheet (Semana ISO/Mes/Día/¿Zoom hoy? derivadas
//   sin errores) y tooltip con la fecha en que se agendó cada Zoom.
// v114 — feat(zooms): tabla con las MISMAS columnas y nombres del sheet del
//   director (Fecha en que se agendó, Fecha del Zoom, Hora, Liner, Presentador
//   principal/apoyo, Cliente, Desarrollo/Proyecto, Estatus, Comentarios,
//   Semana, Mes, Día del Zoom, ¿Zoom hoy?, Discovery) para adopción inmediata,
//   y encabezado + banda del día FIJADOS (sticky) al hacer scroll.
// v115 — feat(zooms): el "excel" hasta arriba — al abrir Indicadores · Zooms
//   lo primero es la tabla del director (toolbar + tabla), y debajo los KPIs,
//   el Resumen automático y la métrica del pipeline (ZoomBoard).
// v116 — feat(zooms): los días de la semana y de "Próximos 7" son BOTONES:
//   click en un día → despliega la lista de sus Zooms (hora, cliente, liner,
//   presentador, estatus, calentito) y cada Zoom abre su modal de edición.
//   Antes parecían botones y no hacían nada (feedback de Ivan).
// v117 — feat(zooms): apartados bajo el excel con navegación tipo Apple
//   (segmented control): Resumen · Gráficas · Calentitos · Reactivación —
//   los apartados del sheet de Ema, uno a la vez. Gráficas nuevas (skill
//   dataviz): tendencia semanal apilada por resultado, dona del mes con
//   total al centro, barras por Liner y Presentador en un solo tono con
//   etiquetas directas; leyendas con nombre (identidad nunca por color
//   solo), gaps de 2px entre segmentos, tooltips y tema claro/oscuro.
// v118 — feat(zooms): sync v2 en vivo — el panel de Control de Zooms se
//   refresca SOLO vía realtime cuando los triggers del CRM (migración 087)
//   escriben: rebooking de cita, regresión de etapa → Cancelado, brinco a
//   Concretado → Asistió, papelera/borrado → Cancelado. Todo automático.
// v119 — feat(zooms): Discovery con espacio propio — la celda es un botón
//   pill (Sí / + Añadir) que despliega un panel elegante bajo la fila del
//   Zoom (acento verde, textarea, Guardar/Cancelar). Cerrado no ocupa nada;
//   solo se ve completo al hacer click. Pedido de Ivan.
// v120 — fix(crítico): app en blanco al abrir con la pestaña en segundo
//   plano. La capa data-hidden de mobile-perf.css (v108) pausaba TODAS las
//   animaciones → las de ENTRADA (fadeIn del contenedor de vistas) quedaban
//   congeladas en opacity 0 y la app entera se veía vacía aunque el DOM
//   estuviera completo. Ahora solo se pausan las animaciones INFINITAS
//   (mismo criterio que la capa móvil); el beneficio anti-crash de iOS se
//   conserva. Diagnóstico en vivo con el navegador de Ivan.
// v121 — feat(zooms): "Calentitos" → "Alta intención" (nombre profesional,
//   pedido de Ivan) en chip, apartado, modal, tooltips y CSV; el marcado
//   pasa a ROJO real como el sheet del director: fila teñida rojo + barra
//   lateral 3px + flama roja (#DC2626) en tabla, listas y detalle del día.
// v122 — fix(crítico): "Algo salió mal — cannot add postgres_changes
//   callbacks for realtime:zoom-agendados-live after subscribe()" al volver
//   a entrar a Indicadores·Zooms. El canal realtime usaba nombre FIJO y
//   supabase.channel() reutiliza la instancia ya suscrita → throw en el
//   effect → error boundary. Fix: nombre único por montaje + try/catch
//   (el realtime nunca puede tumbar el panel).
// v124 — style(zooms): editor de Discovery rediseñado (tarjeta Apple-style,
//   textarea que crece con el texto, ⌘↵/Esc, Copiar para el presentador,
//   Guardar sólo cuando hay cambios) + pill "Añadir/Sí" refinado.
// v131 — feat(móvil/app): bottom-nav estilo Apple Music (4 módulos grandes +
//   botón "+" que abre un cuadro centrado con TODAS las opciones, Centro de
//   Inteligencia, tema y salir — antes el Centro era inaccesible en móvil);
//   PDFs vía puente nativo Capacitor (en la APK doc.save no descargaba nada);
//   notificaciones nativas de WhatsApp en la app (Notification API no existe
//   en el WebView) + permiso al entrar; Gestión de Usuarios responsive
//   (tarjetas en móvil, botones full-width).
// v134 — fix(móvil/tema claro): el MODO SEGURO anti-crash (data-lowfx)
//   forzaba fondo azul-oscuro a todas las tarjetas con blur sin importar el
//   tema → en claro quedaban tarjetas oscuras con texto oscuro (capturas de
//   Ángel en BlueStacks). Ahora el fondo respeta data-theme. Además el
//   detector de crash ya NO cuenta cierres normales de la app como intentos
//   fallidos (abrir/cerrar 3 veces probando una APK activaba el modo seguro
//   48h) y las claves pasan a _v2 para liberar a los dispositivos atascados.
// v135 — fix(app Android): la parte de arriba salía CORTADA en el celular
//   (el título "CRM" bajo el header). Android 15+/16 fuerza edge-to-edge y en
//   algunos WebView env(safe-area-inset-*) queda en 0 aunque la app dibuje
//   bajo la barra de estado. Capacitor 8 SIEMPRE inyecta las variables CSS
//   --safe-area-inset-* correctas → todos los usos pasan al patrón
//   var(--safe-area-inset-X, env(safe-area-inset-X, 0px)). En navegador no
//   cambia nada (la var no existe → cae a env como siempre).
// v136 — fix(móvil): "algo tapa la parte de arriba SOLO en tema claro"
//   (reporte de Ángel en la app): al alternar el tema, el re-render completo
//   puede dejar el scroll del contenido corrido unos px por el anclaje de
//   scroll del WebView → el título de la vista queda bajo el header. Fix:
//   overflow-anchor:none en .stratos-content-area + scroll a tope al cambiar
//   de tema. (La app además se renombra "Stratos CRM AI" — cambio nativo.)
const CACHE_VERSION = 'stratos-v251'; // v251: 4 arreglos de las pruebas de Ángel — (1) el Copilot del ADMIN de marketing (Alex) YA no cae en el cerebro de VENTAS (leads/brokers/emojis): telegram.js rutea al cerebro de marketing también por profiles.is_marketing_admin (Alex=true, migración 113); ningún admin de ventas cambia (default false). (2) "mi día" del Copilot de marketing es CONSCIENTE DEL ROL: super_admin/admin ven el día de TODO el equipo con el nombre de cada responsable, el rol marketing sigue viendo lo suyo (fn_mkt_my_day, mig 113). (3) EVIDENCIA foto/video DESDE el Copilot (solo rol marketing): botón cámara en el composer → sube al bucket "evidencia" (mkt/<org>/copilot/) → RPC mkt_attach_evidence la vincula a la última tarea completada del usuario; asesores sin cambio (control gateado a rol marketing). (4) MÓVIL del módulo Marketing: tabs a lo ancho con scroll limpio + apilado bajo la identidad, kanban con scroll-snap y columnas legibles (82vw), form "nuevo proyecto" ya no se desborda, tarjetas de Equipo con las 4 stats parejas en su propia fila, y clip anti-scroll-horizontal en el contenedor. // v250: 3 fixes por pruebas de Ángel — (1) selects del módulo Marketing con colorScheme por tema (antes el desplegable nativo salía con fondo blanco/texto claro ilegible en modo oscuro); (2) el Copilot de marketing tiene 30s de timeout (antes 15s cortaban al crear solicitudes con "intenta de nuevo"); (3) admins de MARKETING (Alex) ya NO reciben alertas de VENTAS (Zoom sin plan, tareas de equipo, etc.) — bandera profiles.receives_sales_alerts respetada en las 4 funciones proactivas (migración 112, atómica; los demás admins intactos). // v249: MARKETING estilo mockup + copilot con alcance claro — (1) encabezado del módulo como el mockup aprobado: fila "Mi Espacio · {nombre} · Marketing" + TABS SEGMENTADOS tipo pastilla (activo elevado) a la derecha, y título grande por sección con SUBTÍTULO QUE EXPLICA EN SIMPLE qué es cada cosa (pipeline = "el tablero de los videos de propiedades…"); (2) cerebro de marketing: tool nueva buscar_drive (catálogo con links Drive vía bot_buscar_proyectos, solo lectura, sin emojis — migración 111) + prompt n8n v e1061215 con sinónimos NO técnicos ("cómo van los videos" = pipeline) y regla de FUERA DE ALCANCE (clientes/ventas → redirige al CRM, prohibido inventar "no tengo acceso"). // v248: PULIDO VISUAL marketing (feedback de Ángel con capturas) — (1) CERO emojis y cero markdown crudo en las respuestas del Copilot de marketing (funciones fn_mkt_* reescritas con viñetas tipográficas — migración 110 — + prompt del flujo n8n con estilo prohibiendo emojis/markdown, versión activa 4ec04afa) y en el texto de capacidades del frontend; (2) prompt de evidencia sin emojis y con ícono Camera; (3) ícono de "Mi Día" ahora es calendario con check (el sol se veía pobre a 20px). // v247: MARKETING pulido — (1) íconos PROPIOS en el sidebar del rol marketing (sol=Mi Día, etiqueta=Marcas, columnas kanban=Pipeline, burbuja+=Solicitudes, megáfono=Marketing) en ios-icons.jsx; antes caían al fallback de los 4 cuadrados; (2) la evidencia al completar tarea ahora acepta FOTO/VIDEO subidos desde la web (bucket evidencia, carpeta mkt/<org>/, migración 109) además del link — siempre opcional y amigable. // v246: MARKETING refinado por la llamada Iván↔Ángel 21-jul — (1) el rol `marketing` ahora tiene las 4 secciones EN EL SIDEBAR (Mi Día · Marcas · Pipeline · Solicitudes, ids mkt_dia/mkt_marcas/mkt_pipe/mkt_sol) además de los tabs ("en ambas"); los admin siguen viendo el módulo único "Marketing"; (2) al completar una tarea se pide EVIDENCIA amigable y OPCIONAL (link → mkt_tasks.evidencia_url) — "suma a tu reporte". // v245: COPILOT DE MARKETING (F3) — el rol `marketing` habla con su PROPIO flujo n8n (webhook copilot-marketing → agente gpt-4o → RPC mkt_nlu_dispatch, migraciones 107/108) en vez del cerebro de asesores. telegram.js rutea por rol y saltea las capas CRM (quick commands/callbacks proactivos/awaiting-plan) para marketing; "¿qué puedes hacer?" responde las capacidades de marketing. Flujo de asesores INTACTO (se duplicó a propósito, decisión de Ángel). // v244: rol `marketing` con set de módulos completo — se le abre PROYECTOS (catálogo con drives/documentos/fichas, RLS de projects ya es org-only) además de Marketing/Copilot/Perfil; la pantalla "Acceso restringido" ahora es role-aware (a marketing le dice "Ir a mi espacio" y lo manda al módulo Marketing, no al CRM que no puede ver). // v243: MÓDULO MARKETING nuevo (id 'mkt') — ERP de actividades del equipo de marketing de Duke (rol `marketing` + super_admin/admin): tabs Mi Día · Marcas · Pipeline (kanban 7 etapas con drag&drop nativo y botones en móvil) · Solicitudes (complejidad A/AA/AAA) · Equipo (solo admin). El rol marketing ahora arranca en 'mkt' (antes caía en Copilot). Tablas mkt_projects/mkt_pipeline_items/mkt_requests + columnas project_id/depends_on/drive_url en mkt_tasks (migración 106, RLS org-scoped + is_marketing_or_above, sin DELETE). Nada cambia para asesores/tenants externos. // v242: MÓDULO WHATSAPP con chat ABIERTO ahora es PANTALLA COMPLETA idéntica al Copilot (pedido de Ángel, IMG_8547 vs 8548). Antes el hilo abierto se veía "entrecortado" dentro de un recuadro: el chatPane tenía marco de tarjeta (borderRadius+border+boxShadow) + padding lateral, y el contenedor del módulo metía 14px lateral. Ahora, en móvil con un chat abierto: el módulo va SIN padding (borde a borde), el chatPane pierde el marco (fondo del área de chat + overflow hidden como el Copilot), el header interno trae su propio padding + safe-area-top + fondo de barra, y el envoltorio del hilo/composer lleva insets suaves + safe-area-bottom (el aviso/composer queda sobre el home indicator). Todo gateado a móvil: escritorio y la vista de LISTA quedan intactos. // v241: módulo PROYECTOS (ERP inmobiliario, id 'e') habilitado para TODOS los asesores de Duke (antes solo super_admin/admin/director/ceo). Pedido de Ángel: que el asesor vea el catálogo de proyectos para asesorar/recomendar a sus leads. El aislamiento por org sigue bloqueando a tenants externos (Grupo28/Vega). // v240: módulo CREATE (Create Studio / landings-portafolios, id 'lp') habilitado para TODOS los asesores de Duke (antes solo super_admin/admin/director/ceo). Pedido de Ángel: que cada asesor arme sus propias landings. El aislamiento por org sigue bloqueando a tenants externos (Grupo28/Vega). El módulo ya maneja asesor vs admin (el asesor no ve 'Otros datos'). // v239: 3 fixes de las capturas de Ángel — (1) COPILOT ahora LLENA la pantalla: la regla CSS .stratos-content-area{padding !important} le ganaba al padding:0 inline → metía ~20px arriba y ~118px abajo (hueco negro, no llenaba); ahora en inmersivo el content-area va a padding:0 → chat borde a borde con el composer pegado abajo. (2) MÓDULO WHATSAPP también INMERSIVO estilo WhatsApp: oculta header de la app + barra inferior, header propio con flecha '‹ volver' (blanca oscuro / verde claro) + nº de chats al lado + safe-area-top (lista y chat). (3) Mi Espacio: la X de cerrar estaba mal ubicada (usaba justifySelf que no aplica en flex) → ahora con marginLeft:auto va a la esquina superior derecha + safe-area-top. // v238: (1) COPILOT PANTALLA COMPLETA estilo WhatsApp — en móvil oculta el header de la app Y la barra inferior (chat inmersivo); header propio con flecha '‹ volver' (blanca en oscuro, verde de marca en claro) + SCORE del asesor (promedio del score de su cartera, badge tipo el '180' de WhatsApp) + estado 'En línea'; se quitó el '@Strato_sasistente_crm_bot' feo. (2) EL COPILOT NUNCA SE GATEA POR TELEGRAM — se eliminó el muro 'Conecta tu Telegram para activar': apenas se crea el usuario del asesor la DB le asigna identidad sintética sola (trigger trg_assign_copilot_identity, verificado: 41/41 asesores con identidad) → el Copilot ya funciona; conectar Telegram es OPCIONAL y vive en Perfil (para avisos ahí y usar el asistente desde ahí). Ahora se renderiza SIEMPRE el chat. (3) MENÚ 'Todas las opciones': 'Plan Estratégico' → 'Mi Espacio · <nombre>'; se quitó la tarjeta 'Intelligence' (su acceso sigue en la pastilla del header + campanita). (4) Se quitó del CRM el 'Centro de Agentes IA' del fondo (no se usa aún; oculto reversible, no borrado). // v237: AUDITORÍA ANDROID (pantallas angostas 360px, DPI variable). En Android típico (360px CSS, más angosto que el iPhone de 390px) 2 filas de botones del header se DESBORDABAN y se cortaban (capturas de Ángel): (1) iAgents — los chips WhatsApp/Telegram + botón 'Estado del equipo' no cabían junto al título → se cortaba 'Estado del equip…'; ahora en móvil la fila de acciones ocupa el 100%, envuelve, y 'Estado del equipo' va full-width. (2) Finanzas — 'Actualizar/Exportar CSV/Nuevo movimiento' se cortaba a 'Nue movin'; ahora los 3 botones se reparten a lo ancho (2+1) y envuelven. Mismo patrón responsivo ya aprobado en RRHH. Verificado: 0 scroll horizontal de página a 360px + modal Menú impecable. APK Android reconstruido (v2.8) para que el binario quede fresco. // v236: consistencia de idioma en el Centro de Inteligencia — la etiqueta de las tarjetas del carrusel decía 'Vos pedís' (voseo) mientras el detalle/lista decía 'Tú pides'; ahora ambas dicen 'Tú pides' (español neutro). + bump versionCode del APK a 17 (v2.6→v2.7) para reconstruir el binario Android con todo lo del día (logo SC, barra al borde, íconos de Inteligencia). // v235: barra inferior aprovecha más el borde — el relleno EXTRA sobre el home indicator baja 10→3px (pedido de Ángel: como Mercado Libre; la franja del home indicator/safe-area se RESPETA completa para no chocar con el gesto de iOS) + top de la barra 8→6px + holgura del contenido 92→84px. // v234: (1) REVERTIDO el experimento APP-FS-COMP de v232 — estirar el lienzo empujaba la barra fuera del área visible (IMG_8507): la franja inferior está FUERA del WKWebView (iOS la pinta él) y NADA dentro de la página puede usarla. (2) FIX REAL del recorte: apple-mobile-web-app-status-bar-style pasa de black-translucent a BLACK (opaca) — el translúcido tiene un bug conocido de iOS standalone que deja ~90pt muertos abajo; con la barra opaca el lienzo llega al borde. iOS captura esto al AGREGAR a inicio → hay que quitar y re-agregar el ícono UNA vez. (3) Íconos del Centro de Inteligencia con relación real a cada función (pedido de Ángel, IMG_8508-8509): Mover de etapa GitBranch→TrendingUp · Briefing pre-Zoom Sparkles→ClipboardList · Avisos al teléfono Smartphone→BellRing · Coach de tareas UsersRound→ListChecks · Score automático Gauge→Flame (los HOT). (4) Barra del preview de landing con safe-area-top: la fila 'Vista Previa' ya no queda debajo de la hora del iPhone (IMG_8510). // v233: CREATE STUDIO MÓVIL + LINKS CON NOMBRE. (1) Links de portafolio PERSONALIZADOS: /p/oscar-galvez en vez de /p/a6901463 — la RPC create_portfolio_link acepta p_slug (nombre del cliente normalizado: minúsculas, sin acentos, guiones); mismo cliente+mismo portafolio reusa el link (idempotente), mismo nombre con portafolio distinto suma -2, -3…; sin nombre sigue el código de 8 (migración portfolio_links_custom_slug, probada con rollback). (2) Paso 2 'Seleccionar Propiedades' en móvil: el botón Generar Landing Page baja a su propia fila full-width (antes trituraba el título en una columna angosta, IMG_8503) y el footer sticky '1 propiedad seleccionada' pone el CTA full-width. (3) Barra del preview 'Vista Previa' en móvil a 2 filas: título con elipsis + X arriba, Copiar enlace / Enviar al cliente repartidos a lo ancho abajo (antes Enviar al cliente quedaba CORTADO fuera de pantalla, IMG_8504); el contenido arranca bajo la barra (104px). // v232: (1) SESIÓN QUE NO SE CAE — la app instalada ya no manda al login "a cada rato": caché de sesión de 24h→30 DÍAS (con red lenta + caché vencida caía al login aunque el token siguiera válido) y un refresh fallido por red móvil ya NO borra la sesión (solo el logout explícito SIGNED_OUT limpia; si el token sb-*-auth-token sigue guardado se restaura de caché y el SDK reintenta en background). (2) BARRA AL BORDE — PLAN B DEFINITIVO [guard:APP-FS-COMP]: en instalaciones iOS donde el web-clip deja el lienzo 60-100pt más corto que la pantalla (franja muerta bajo la barra aun tras re-agregar el ícono, IMG_8501-8502), se MIDE el recorte en vivo (screen.height-innerHeight) y se estira el lienzo esa cantidad: la barra baja al borde físico y el contenido usa el espacio muerto. Gateado a iOS+standalone+recorte detectado; instalaciones sanas no cambian. // v231: LOGO OFICIAL de Ángel TAL CUAL en todas las superficies — los bytes EXACTOS del archivo que mandó (extraídos del registro de la conversación; el canal de uploads no entregaba el archivo), solo recorte cuadrado, cero edición: favicon 16/32/48+.ico, apple-touch-icon, icon-192/512+maskable, mipmaps Android (legacy+round+adaptive). APK versionCode 16 (v2.5). Recordatorio iPhone: quitar y volver a agregar la app a inicio para ver el ícono nuevo (y de paso renovar el web-clip = fix del letterbox). // v230: (1) BARRA INFERIOR pegada al borde DE VERDAD [guard:APP-VIEWPORT-PIN] — en la PWA de iOS, al usar el teclado (login, buscar, notas) WebKit desplaza la VENTANA para mostrar el input y al cerrar el teclado ese corrimiento a veces QUEDA PEGADO (window.scrollY>0): toda la app corrida hacia arriba = franja muerta bajo la barra inferior ("los botones no están pegados abajo", capturas de Ángel IMG_8491-8494 aun en v229) + contenido metido bajo el reloj. Ahora, en la app instalada, cuando NO hay un input enfocado la ventana se re-ancla sola a (0,0) (scroll/pageshow/focusout/visualViewport.resize); mientras se escribe no se toca (iOS necesita ese pan). La web en navegador queda intacta. (2) iOS además ASEGURA viewport-fit=cover en el meta (se añade si un HTML viejo cacheado no lo trae; nunca se reescribe). (3) LOGO NUEVO "SC" en TODAS las superficies: favicon (16/32/48 + .ico), apple-touch-icon (iPhone "Agregar a inicio"), manifest icon-192/512 + maskable, e ícono del APK Android (mipmaps legacy + round + adaptive foreground). Nota: el iPhone captura el ícono al AGREGAR a inicio → para ver el logo nuevo hay que quitar la app de la pantalla de inicio y volver a agregarla (eso también refresca la config del web-clip). // v229: 4 fixes de capturas de Ángel — (1) LETTERBOX iOS RESUELTO: la app instalada ya usa TODA la pantalla (la reescritura del meta viewport en iOS le hacía perder viewport-fit=cover → franja negra bajo la barra; ahora iOS no toca el meta — el pinch se bloquea por eventos — y solo Android/Capacitor lo reescribe). La barra inferior queda pegada de verdad al borde. (2) Mi Espacio ya no se encima con la hora del iPhone (topbar con safe-area-top). (3) Planes full-bleed: el pricing ocupa toda la pantalla (antes era un bloque negro flotando con márgenes sobre el lienzo claro). (4) Ícono del Copilot = ANILLO HEXAGONAL verde de marca (el correcto según Ángel; ni robot, ni triángulo, ni lazo). // v228: 3 fixes de las capturas de Ángel — (1) iAgents: las tarjetas de agentes (Calificador/Reactivador/Seguimiento/Briefing) ya NO enciman el subtítulo con las métricas en móvil: las métricas bajan a su propia fila repartida a lo ancho. (2) Stratos RH: los botones del encabezado (Analizar CV / Portal / Nueva Vacante) llenan el ancho en filas parejas en móvil (antes quedaban sueltos pegados a la derecha). (3) Papelera: se veía con tarjetas BLANCAS en modo oscuro — la detección de tema comparaba contra fondos viejos hardcodeados (#060A11) y el token real es #030810; ahora detecta por luminancia.  // v227: (1) BARRA INFERIOR DOCKEADA estilo Instagram/apps nativas — pegada a bottom:0, full-width, con el safe-area (home indicator) relleno por la propia barra; tabs repartidos a lo ancho (flex) y el botón + integrado a la barra (antes la píldora flotaba con aire abajo). (2) El ícono del Copilot VUELVE al LAZO verde original (∞/cinta de marca) — el triángulo de esta mañana no fue pedido; se conserva la técnica de giro estable nueva, solo volvió la forma. Pedidos de Ángel con capturas (Instagram como referencia). // v226: Centro de Inteligencia SOLO con datos reales — fuera las 4 notificaciones DEMO de fallback (Familia Rodríguez / Portofino +32% / Cecilia y Alexia / James Mitchell) que aparecían como reales cuando el asesor no tenía novedades; ahora sin novedades se muestra un estado vacío honesto (el equipo IA monitoreando la cartera). Requisito del video: nada de humo en pantalla. // v225: APP MÓVIL — CRM + todos los módulos refinados. CRM: carrusel de prioridad full-bleed con snap alineado y peek limpio (86vw); ×/selects/Tomar acción/seguimientos a 40-44px; strip de etapas con labels legibles a 2 líneas (antes 8px cortados) + fade al borde derecho (se LEE que hay más al deslizar); chips teléfono/correo y pill SCORE con tap cómodo; buscador/limpiar 44px; form Nuevo cliente con inputs 44px, presupuesto 2 col, Canal de origen en grid que llena el ancho, footer STICKY con Registrar siempre a mano (48px); fuera el doble padding fantasma (~214px muertos al final de la lista). Módulos: IACRM (header ya no se corta + KPIs/planes auto-fit), Finanzas (KPIs auto-fit + resumen apila + detalle mensual con scroll propio), Dash (KPIs/acciones/agentes auto-fit), RRHH (directorio: columnas Score/Estado eran INALCANZABLES — el minWidth vivía en el mismo elemento del scroll; ahora scrollea de verdad), Gestión de Usuarios (acciones 40px, incluye borrar), WhatsApp (filtros 40px), Copilot (rebote contenido). // v224 // v224: APP MÓVIL — Indicadores·Zooms en TARJETAS. La tabla de 16 columnas (1720px, scroll en 2 ejes) ahora en móvil es una lista de tarjetas nativas: hora+fecha · cliente · proyecto · liner→presentador · comentarios · estatus editable · acciones (alta intención/editar/eliminar, hit 40px) · Discovery inline compacto (textarea 16px + Guardar/Cancelar 44px). Desktop conserva la tabla completa. ZoomLista (Alta intención/Reactivación): filas apiladas (antes 6 campos trituraban el texto a 1-2 letras). Resumen: la semana L-D envuelve (auto-fit) y se ve entera sin scroll lateral. ZoomBoard: historial de movimientos en tarjetas + tabla por-presentador sin minWidth + toggles 44px. Tap targets de filtros/botones del panel Zoom a ≥44px en móvil. // v223: (1) APP ESTABLE de verdad [APP-NO-ZOOM v2]: en la app INSTALADA el documento queda CLAVADO (html/body position:fixed + overflow:hidden + overscroll none) → se acaba el rebote y la "franja blanca" abajo; el fondo del html respeta el tema (nunca más blanco); pinch bloqueado también por touchmove.scale (iOS ignora user-scalable=no). La web en navegador sigue intacta. (2) Ícono del Copilot en el menú "Todas las opciones" = la marca VERDE real (CopilotMark), ya no el robot; el sello del pie ahora dice la versión real (estaba clavado en v175 desde hacía semanas → confundía el diagnóstico; mantener en sync con CACHE_VERSION). (3) LINKS CORTOS de portafolios: "Enviar al cliente" ahora comparte https://…/p/<código de 8> (tabla portfolio_links + RPCs create/resolve en Supabase; el payload guardado es el MISMO base64 del link largo → misma landing; el largo queda de fallback). /p/<code> con preview OG (rewrite a og-landing). // v222: APP MÓVIL — módulo COMANDO refinado (paso 2). Pestañas = segmented control nativo con labels cortos (Leads/Zooms/Productividad) que llenan el ancho y NO se cortan + tap target 44px. Embudo de conversión ya no se parte en el iPhone (stack: etiqueta arriba, barra + % abajo; % sin romperse). Chips de la leyenda del gráfico = grid 2-up que llena el ancho + tap ≥42px. Botones del "Rango global" (Hoy/Semana/Mes/30d/Histórico/Personalizado) = grid 3-up edge-to-edge + 44px (DateRangeControl, aplica también a CRM/ZoomBoard) + popover del calendario ya no se sale. "Generar PDF" a 44px, full-width en móvil. Productividad: nombres largos con elipsis + sin divisor sobrante. // v221: APP MÓVIL — base nativa (paso 1). (1) [APP-NO-ZOOM] en la app INSTALADA (PWA en inicio del iPhone / Capacitor) se bloquea el zoom (pinch + doble-tap + user-scalable=no) para que se sienta app nativa y deje de sentirse web; el NAVEGADOR web queda INTACTO (100% zoomeable). Detección por standalone/display-mode/Capacitor en index.html. (2) La barra flotante ya no tapa el contenido: padding-bottom del scroller 96→118px. (3) Gutter horizontal 14→16px (mínimo pedido por Iván; textos ya no tan pegados al borde). (4) Ícono del Copilot en el menú/nav = el triángulo de MARCA real (antes un robot con carita). // v220: BOTONES DE PROACTIVOS en el Copilot — paridad TOTAL con Telegram. Antes solo "Ya estudié, este es mi plan" (proact_plan) estaba cableado; el resto de botones de recordatorios (Ya lo contacté, Ver ficha del cliente, Reagendar, Sí listo/Posponer/Cancelar, tareas de equipo) caía al webhook de audio, que leía la ETIQUETA como texto libre → "Ya lo contacté" salía "expediente de : ." (sin cliente) → "No encontré ese cliente", y "Ver ficha del cliente" caía en el catálogo de proyectos. Fix: despachador único en DB copilot_handle_callback(callback_data) que resuelve la identidad del asesor (auth.uid()→profiles, patrón de copilot_plan_start) y llama a las RPCs que ya existen (fn_proactive_inact_action / fn_proactive_next_action_action / fn_proactive_reschedule_start / fn_proactive_plan_start / fn_team_action_respond); devuelve {text, buttons} y telegram.js rutea TODOS los proact_*/team_action: por ahí. copilot_handle_pending extendido para capturar también la FECHA en reagendar/próxima-acción (antes solo el plan). Multi-tenant: fn_proactive_inact_action/reschedule_* aceptan organization_id del payload (fallback Duke 0001) → funciona para Duke, Stratos Sales/NSG y cualquier tenant, sin tocar Telegram. // v219: elimina el reload INNECESARIO en la PRIMERA carga — el SW reclama la página nueva y disparaba window.location.reload(), lo que se veía como un "recorte" a los ~3s en la primera visita/incógnito (se reiniciaba todo, ícono incluido). Ahora solo recarga en un UPDATE real (página ya controlada por un SW viejo). No toca auth ni el guard anti-loop de iOS. // v218: robustez del giro del ícono de Copilot — @keyframes inyectados UNA sola vez en <head> (no por instancia, no se re-evalúa al montar/desmontar marcas) + bump para FORZAR que un navegador con el bundle viejo cacheado (el "cometa" que daba una vuelta cada ~2s y se recortaba) baje el nuevo. El giro nuevo es transform puro (verificado fluido, 0 resets en navegador real). // v217: motion del ícono de Copilot igualado al "átomo" del header — giro FLUIDO por transform (se quitó el cometa/stroke-dashoffset que se veía turbio y con recortes en móvil), 20s lineal + data-brand-motion (no se congela en el celular) + glow suave con drop-shadow. Bump para bajar el bundle. // v216: giro ESTABLE del ícono de Copilot: la rotación pasa a un ENVOLTORIO HTML (.cp-rotor, pivote fijo 50% 50%); antes el <g> del SVG con transform-box hacía que el triángulo "bailara"/se saliera de centro. Bump para bajar el bundle con el giro corregido. // v215: la marca del Copilot pasa de "infinito"/lazo a un TRIÁNGULO de puntas redondeadas con movimiento PERPETUO (cometa que orbita el trazo + giro lento continuo + halo que respira; loops seamless, respeta prefers-reduced-motion); en el chat el motion vive solo en la ÚLTIMA respuesta del asistente. Bump para bajar el bundle con el ícono nuevo. // v214: "Familiares o Socios" — agregar/editar/borrar allegados es SOLO admin (candado real en la RLS, migración 105: escritura = is_admin_or_above; el asesor solo LEE). El panel solo vive en el EXPEDIENTE (nunca en la tabla del pipeline). Para el asesor sin allegados, la sección se oculta. // v213: NUEVO en el expediente (sección Discovery, debajo del Perfilamiento IA) — "Familiares o Socios": el asesor puede agregar/editar/borrar personas allegadas al contacto (esposa/o, socio, familiar) con su teléfono/email. Tabla nueva lead_related_contacts (migración 103), RLS org-scoped + lead visible (igual que discovery_data). Editable; funciona también en modo demo (local). // v212: robustez ante deploys — al entrar a una vista lazy (Create/ERP/etc.) con la pestaña vieja, el chunk cambiaba de hash tras un deploy → fallaba el import → el ErrorBoundary RAÍZ recargaba TODA la app → parpadeo de login. Fix: (1) PREFETCH de los chunks de todas las vistas apenas la app queda ociosa (contra el bundle actual → navegar es instantáneo y a prueba de deploys); (2) ErrorBoundary LOCAL alrededor del área de vistas (el contenedor ya tiene key={v}) → si una vista falla, queda contenida en el panel y la sesión + el menú siguen vivos (nunca te saca al login). // v211: candado también en el ALTA normal (RPC create_lead, migración 102): un asesor no puede registrar un cliente que ya está en el CRM a nombre de otro asesor NI por la vía normal (antes solo se frenaba el override "Registrar de todas formas"). Cubre duplicado por email y la carrera de la detección. El front ahora quita el lead optimista y muestra "No se puede registrar: ya está a nombre de otro asesor. Pídeselo a un admin" en vez de "guardado, reintentando". // v210: fix(CRM) — la fecha de la "Visita Agendada" ahora SÍ se ve en la tabla (pill de la fila) y en el expediente. El modal "Programar Visita Agendada" solo guardaba visita_at (avisos −1mes/−15d/−7d); ahora además puebla nextActionDate/next_action_date/next_action_at (igual que el modal de Zoom), que es lo que la UI renderea y lo que normalizeLeads formatea al recargar (Visita Agendada ∈ STAGES_CON_CITA). No toca los avisos ni infla métricas de Zoom (Visita Agendada ∉ ZOOM_CITA_STAGES). // v209: registrar/reasignar un cliente que YA está en el CRM a nombre de OTRO asesor es SOLO para admin (super_admin/admin/ceo/director). El asesor sigue viendo el aviso de duplicado, pero ya NO puede "quedárselo" con "Registrar de todas formas" (ese botón ahora solo lo ve el admin; para el asesor sale un aviso de que se lo pida a un administrador). Candado REAL en la RPC fn_claim_lead (SECURITY DEFINER, migración 101): rechaza a cualquier no-admin aunque llame el RPC directo. // v208: manual del asistente actualizado — Telegram deja de presentarse como obligatorio; ahora dice claro que el Copilot funciona sin Telegram (con tu login) y Telegram es un PLUS opcional. // // v207: flujo "Ya estudié, este es mi plan" en el Copilot (paridad con Telegram). Al tocar el botón (callback proact_plan) el asistente queda "en escucha" (copilot_plan_start) y el próximo mensaje se captura como el plan (copilot_handle_pending → fn_proactive_log_plan) en vez de tratarse como nota. Sirve para el plan de Zoom y el de próxima acción. fn_proactive_log_plan ahora es org-aware (antes solo Duke). // v206: suscripción push AUTO-SANADORA — si un device tenía una suscripción con una VAPID key vieja (formato DER, ya no sirve), subscribeToPush la descarta y re-suscribe con la key correcta. Antes un device con suscripción vieja nunca recibía push (el servidor no podía firmarla). Sin esto, un iPhone con la PWA instalada de antes del fix quedaba pegado. (El backend de push está verificado: send-push entrega a endpoints reales de Apple/FCM, sent:1.) // v205: Copilot ENCENDIDO para Stratos Sales (tenant NSG) — features.copilotModule:true en su config. El equipo NSG (Ángel, Admin NSG) ya tiene identidad sintética + push global, así que con el flag ya operan su cartera desde el Copilot sin Telegram. // v204: Centro de Inteligencia — todas las funciones ahora dicen "Copilot" (antes "Telegram") porque todo funciona en el Copilot sin obligar a Telegram; + 5 funciones nuevas (recomendar propiedades, catálogo/drives, tomar/reasignar lead, cartera de asesor para admins, avisos al teléfono). Manual del CRM actualizado (el Copilot anda sin Telegram; Telegram opcional; cómo activar notificaciones al teléfono). Banner de notificaciones: en desktop/Android muestra "Activar" (antes pedía instalar, que solo aplica a iOS). // v203: PUSH REAL al teléfono + desacople de Telegram. (1) VAPID regenerada en formato RAW correcto (la vieja estaba en DER → pushManager.subscribe() fallaba → push_subscriptions quedaba VACÍA → jamás llegaba un push con la app cerrada) y send-push lee la clave PRIVADA de la DB (push_secure_config, nunca en git). (2) App.jsx AUTO-suscribe al abrir si el permiso ya está concedido (antes solo inicializaba el contexto y NUNCA llamaba subscribe) + banner "Activar notificaciones" en el Copilot para el caso permiso='default'. (3) Trigger DB en proactive_reminders (status→sent) dispara UN web-push por asesor vía pg_net→send-push: choke-point único que cubre TODOS los flujos/tenants (real + sintético) sin tocar n8n. Resultado: las alertas del Copilot (Zoom, tareas, recordatorios) llegan al iPhone con la app cerrada, como Telegram. (4) Desacople Telegram: identidad sintética (chat<0) para que el Copilot ande sin obligar a conectar Telegram; Perfil distingue Telegram real (chat>0) del sintético y deja conectar Telegram como opcional; al conectar/desconectar el historial migra solo. // v202: pulido UI — (1) notificaciones (campana) a portal + fondo opaco (ya no se sobrepone con botones/KPIs; fix stacking en Safari); (2) ícono de Copilot ANIMADO de marca (lazo estilo remolino, verde menta/emerald, con movimiento) en sidebar/móvil/header/burbujas/campana; (3) reproductor de voz custom en Copilot (waveform + play/pausa; sin la caja blanca nativa; transcripción intacta); (4) reloj custom "Hora exacta" en MetaPanel (steppers HH:MM + chips de minutos; sin el picker nativo del browser). // v201: rol `marketing` (equipo de Duke: Yazz/Luis/Emmanuel) — NO ve CRM ni leads (verificado: 0 leads); su casa es el Copilot. Accesos: copilot+perfil. resolveInitialView manda a `copilot` (antes caia en CRM = pantalla sin permiso). DB: mkt_brands/mkt_work_types/mkt_tasks/mkt_daily_reports + is_marketing_or_above() + RLS; profiles_role_check ampliado con 'marketing'. // // v200: Copilot — al preguntar "¿qué puedes hacer?" (o "qué haces", "para qué sirves", "en qué me ayudas") responde un resumen de capacidades + botón "Abrir Manual Completo" de forma inmediata y determinista (antes solo detectaba la palabra "manual/guía/ayuda"). Paridad: el bot de Telegram y el Copilot ya lo resolvían server-side (bot_render_capabilities incluye el link del manual); esto agrega el atajo rápido con botón en el Copilot. // v199: Copilot PERSISTENCIA — ahora guarda SIEMPRE cada mensaje (user + respuesta) en tg_bot_activity vía RPC copilot_log_msg; antes no guardaba nada propio y el historial del Copilot se borraba al cerrar/reabrir la app (solo quedaba lo del bot de Telegram, mismo chat_id). + links [texto](url) clicables en las burbujas del Copilot (Drive del catálogo/recomendación). + dedup de seguridad en la lectura. // v198: Copilot — carga solo los últimos 50 mensajes (rápido, no se sobrecarga aunque haya mucho historial) + se refresca al volver a la pestaña/ventana (sincroniza celular↔PC: si hablaste en el cel, al mirar la PC trae lo último). // v197: manuales actualizados (/manual-asistente-telegram y /manual-crm): catálogo por presupuesto+zona, recomendar propiedades a un cliente, ver la cartera de otro asesor (admin), y el asistente ahora también en el CRM (Copilot, mismo cerebro). // v196: Gestión de Usuarios (AdminPanel) tema-aware — en modo claro los nombres/textos ya no salían en blanco (#FFFFFF) sobre lienzo claro → ilegibles; ahora recibe la paleta activa T (LP en claro) e usa wTxt/cardBg; tarjeta (G), modales, <option>, hover y sombras respetan el tema. Solo modo claro; oscuro intacto. // v195: Web Push API — sistema de notificaciones push reales para la PWA (iPhone/Android). El SW ahora recibe eventos push del navegador, muestra la notificación nativa, y al tocarla abre el CRM en la vista correcta. Sin esto las notificaciones solo funcionan con la app abierta (new Notification() en vivo). // v194: NUEVO módulo "Copilot" — chat con el asistente IA (mismo cerebro que el bot de Telegram @Strato_sasistente_crm_bot) embebido en el CRM. El asesor conecta su Telegram y opera sus leads desde el chat del CRM: envía → RPC copilot_send → bot_nlu_dispatch_gvintell (responde + loguea); lee → RPC get_my_copilot_activity → tg_bot_activity (conversación limpia). Nav+view+flag copilotModule (ON para Duke). v1: comandos deterministas (mis clientes/agenda/kpis/pipeline/menu/buscar); free-form NLU + fotos + audio vienen después. // v193: identidad — se reemplaza el rayo morado por el nuevo logo "S" metálico de Stratos en TODAS las superficies: favicon (favicon.ico + png 16/32), apple-touch-icon (PWA / iPhone "Agregar a inicio"), manifest (icon-192/512 + maskable-512) e ícono del APK Android (mipmaps legacy ic_launcher/_round + adaptive foreground). El favicon.svg (rayo morado) queda sin referenciar. // v192: rediseño integral del entregable (landing del cliente) nivel Apple: alto contraste (blancos crisp #F6F8FB sobre negros #0A0B0D), sistema de márgenes/ritmo con clamp, hero con jerarquía fuerte, cada propiedad como tarjeta editorial (numerada, cover de gradiente refinado, FICHA TÉCNICA en grid claro, highlights y amenidades), botones píldora con gloss, mercado y CTA con alto contraste y hairlines. // v191: tipografia UNIFICADA de botones — todos los botones de la app a Inter semibold (600 !important) + tracking -0.014em via una sola regla global en index.css, para que se lean como botones de verdad (con presencia, pro) y no como texto delgado. El enfasis activo lo dan el fill/color, no el peso. Cohesivo (todo Inter), sin fuentes nuevas. // v190: rediseño Apple del entregable (landing del cliente): negros más profundos y consistentes, tipografía refinada y responsiva (clamp), tarjetas con elevación suave + brillo especular sutil, botones tipo píldora con gloss, hero con halo de acento y stats con divisores hairline, más aire; footer con fecha dinámica. // v189: Create — asesor/WhatsApp desde la cuenta (no se piden); sin campo ni marca de 'agencia' en form y entregable (solo admin ve 'Otros datos'); landing responsiva con tag 'Portafolio Privado'; link /p con imagen de preview OG 'Portafolio Personalizado' (Vercel /api/og-landing). // v188: Comando Directivo — el calendario "Personalizado" (RangeCalendar) ahora FLOTA como popover absoluto sobre el contenido (antes empujaba el layout y dejaba la derecha vacia) con backdrop para cerrar al clic afuera, y es TEMA-AWARE: claro (panel blanco, texto oscuro, verde #0D9A76) en tema claro y oscuro en tema oscuro (antes siempre oscuro). // // v187: tipografia refinada estilo 'Create Studio' en TODO el sistema (no solo Mi Espacio): 971 pesos remapeados a escala 500 (enfasis/titulos/numeros) / 400 (secundario) en vez del 800/700 dominante. Solo literales fontWeight (los pesos condicionales/ternarios se conservan). Afecta a todos los clientes Stratos. // // v186: Mi Espacio — (1) tipografia refinada estilo Create Studio en TODO el panel (escala 500/400 en vez de 800/700; mas fina y pro). (2) navegacion independiente: al abrir Mi Espacio desde el widget AVANCE, el menu deja de marcar la vista anterior (Create) y se marca el widget; tocar cualquier item del menu cierra Mi Espacio; se quito la X en escritorio (se conserva en movil). // // v185: Mi Espacio — el titulo ('Agenda personal y profesional' / 'Documentos del Equipo'), su subtitulo y el encabezado de seccion adoptan la tipografia moderna delgada y amplia (peso 800->500/600, tracking abierto), igual que los botones Fecha/Hora. // // v184: Mi Espacio — rediseno de la tarjeta Fecha/Hora (se veia vacia tras alinearla 50/50): distribuye su contenido para llenar el alto (botones arriba, atajos abajo), los chips rapidos van en 2 columnas centradas bajo cada boton y con cuerpo de pastilla (fill sutil), botones un poco mas altos. // // v183: Mi Espacio — el compositor (accion + fecha/hora) ahora usa el MISMO grid 50/50 que las tarjetas 'Mi agenda / Equipo completo' (columnas alineadas, margenes perfectos) y la tipografia de los botones Fecha/Hora es mas delgada (peso 500) y amplia (tracking +0.02em) para un look mas moderno. // // v182: Mi Espacio — el boton verde 'Agregar' ahora usa el estilo estandar de Stratos (mismo que 'Nuevo cliente'): texto BLANCO sobre verde en tema claro, y menta sobre verde translucido en oscuro (antes texto negro). // v181: Manual del CRM (/manual-crm) — nueva sección "Instalar Stratos como app en tu celular" (categoría Empezar): pasos simples para asesores no técnicos, Android (descargar el APK del release android-latest) e iPhone (Safari → Compartir → "Agregar a inicio"). // v180: Catálogo de Proyectos (ERP) — filtros a medida para el asesor: (1) input "Otra zona…" para escribir una zona fuera de los botones (filtra por ubicación/zona), (2) botón "A mi medida" que abre 2 sliders (Desde / Hasta) para fijar el rango de presupuesto propio (0–$2M, con "Sin límite" al tope); el buscador de texto pasa a nombre/masterbroker/contacto (la zona ya tiene su filtro). // v179: Mi Espacio (MetaPanel) — se quitó el botón "Agregar" de columna fija; ahora una barra de acción aparece bajo el compositor al escribir: "Agregar" se habilita solo con acción + fecha (+ responsable en equipo) y hay una opción "Registrar sin fecha" que guarda la acción sin fecha/hora (due_at nullable en team_actions, migración 095). // v178: CRM Asesores — el botón "Indicadores" ahora lleva al COMANDO DIRECTIVO (dashboard ejecutivo que ya incluye la tabla de indicadores por asesor + evolución + PDF) en vez de mostrar la tabla suelta inline. Solo aplica a clientes con Comando Directivo (Duke); los demás conservan la tabla inline. // v177: Catálogo de Proyectos (ERP) — buscador simple para un asesor NO técnico: se quitaron los ~21 chips de precio crudos ("3.8 A 4.5MDP", "13K -44"…) y se reemplazaron por 2 filtros claros — Zona (Cancún/Playa del Carmen/Tulum/Puerto Morelos/Costa Mujeres/Country Club, normalizadas: los typos CANUCN/CANNCUN→Cancún) + Presupuesto (rangos USD: Hasta $250k, $250k–$500k, $500k–$1M, +$1M, Terrenos; el "ticket" en MDP/USD se parsea y agrupa). Zona también corrige el display en tarjetas/tabla y el KPI de zonas. // v176: MetaPanel — (1) la fecha de cada accion ya NO se recorta (pill fecha+prioridad de ancho fijo que no encoge; la columna central hace wrap). (2) encabezado arriba-izquierda = "Mi Espacio" + el nombre del usuario (antes el nombre de la org). (3) el lanzador "Aplicaciones" (Apps) se sobrepone POR ENCIMA del panel al abrirlo estando el panel activo (z-index 700/701 > 601). // v175: rotulo del pill de Inteligencia (Duke) RESPONSIVE: escritorio 'Centro de Inteligencia', movil 'Intelligence' (intelligenceCenterLabelMobile + toggle CSS en DynIsland). (rebase sobre v174) // v174: encabezado de Create renombrado 'Marketing Studio' → 'Create Studio'. // v173: Create — el 'Catálogo de Propiedades' del dashboard lista los 263 desarrollos reales (con Drive) con buscador y botón 'Crear landing' por desarrollo; status pills de Campañas Recientes ya no se estiran (abrazan su contenido); botón 'Nueva Landing Page' sin ícono (más limpio). // v172: el pill del Centro de Inteligencia (Duke) se rotula 'Intelligence' (antes 'Inteligencia'). (rebase sobre v171) // v171: Create — el selector de landings usa el CATÁLOGO real de desarrollos (mismo del ERP, con Drive) y el link 'Enviar al cliente' es AUTO-CONTENIDO (/p#d=...): abre el portafolio del cliente SIN login. Preview blindado para propiedades sin ROI/amenidades. // v170: en movil el acceso a Inteligencia va al CENTRO del header (DynIsland, pill del Centro de Inteligencia con sus funciones), rotulado 'Inteligencia' (Duke); la pill IAOS izquierda se oculta en movil (se revirtio el chip v168). (rebase sobre v169) // v169: Landing — WhatsApp real por default para Gael Velasco, Carlos Ayala, Ken Lugo Ríos y Cecilia Mendoza (Oscar/Emmanuel/Alex siguen placeholder hasta cargarlos). // v168: en la app movil la pill IAOS del header (con el ticker rotativo 'Protocolo Duke activo'...) se colapsa a un chip compacto 'Inteligencia' (sparkles) que abre el Centro de Inteligencia. En escritorio queda igual (IAOS + ticker). Solo movil. // v167: contenedor de la barra inferior movil = misma capsula que el sidebar de PC (rect redondeado radio 20, gradiente + biseles, gap 4). Solo estilos moviles. (rebase sobre v166) // v166: Landing — roster de asesores actualizado (agrega Gael Velasco + Carlos Ayala, quita Alexia) + botón "Seleccionar Propiedades" flex-centrado (flecha ya no descolgada). // v165: Create/Landing Pages — legibilidad en tema CLARO al seleccionar propiedades: el nombre del desarrollo iba en texto oscuro sobre el gradiente oscuro del header (negro sobre negro); ahora blanco con sombra suave y el precio 'Desde' con más contraste en claro. // v164: la barra inferior + hoja "Menu" de la app movil calcan EXACTO el sidebar de PC (mismos iconos y tamanos por modulo, mismo radio 14, misma pastilla activa neutra + bordes/sombra). Solo estilos moviles. (rebase sobre v163 #366) // v163: (1) Catálogo de Proyectos (ERP): rediseño Apple — solo se muestran desarrollos con carpeta Drive disponible, tarjetas con elevación en hover y contador "N de M". (2) Centro de Inteligencia: el panel expandido ahora respeta el tema CLARO (antes quedaba en negro) — fondo/bordes/textos/CTA tema-aware manteniendo el look oscuro intacto. // v162: (1) MetaPanel (Plan Estratégico) ya NO ocupa toda la pantalla: en escritorio es una SECCIÓN dentro del contenido (deja header arriba + menú izquierdo a la vista; top:52/left:72), y se cierra solo al navegar a otra vista. En móvil (sin sidebar) sigue a pantalla completa. (2) Safari: en focus/pageshow se FUERZA quitar data-hidden sin confiar en document.hidden (que Safari deja stale) — endurece el fix de las animaciones congeladas (átomo/Live/Centro de Inteligencia). // v158: MetaPanel (Plan Estratégico) — pantalla completa como una vista del CRM + rediseño ERP×Apple: barra superior sticky translúcida, edición discreta en hover/focus, filas con hover elevado; Lista de Acción a ancho completo con tipografía más grande, responsable a la izquierda y prioridad/fecha en columnas alineadas (borrar flotante), y layout móvil dedicado con el check a la derecha (sin gutter izquierdo). (v157: fix "Importing a module script failed" — recuperación escalonada de chunk viejo tras deploy, se conserva.)
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

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
  const options = {
    body:  payload.body  || '',
    icon:  payload.icon  || '/icon-192.png',
    badge: payload.badge || '/favicon-32.png',
    tag:   payload.tag   || 'stratos-notif',
    data:  {
      url:   payload.url   || '/',
      view:  payload.view  || 'c',
      leadId: payload.lead_id || null,
    },
    requireInteraction: !!payload.requireInteraction,
    vibrate: payload.vibrate || [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── NOTIFICATIONCLICK: cuando el usuario toca la notificación ──
// Abre el CRM (o lo enfoca si ya está abierto) y navega a la vista correcta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

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
