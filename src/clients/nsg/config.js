/**
 * src/clients/nsg/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente NSG — el espacio de OPERACIÓN interno de NSG
 * (la empresa paraguas de Iván y Ángel), servido como white-label del CRM Stratos.
 *
 * Qué es (y qué NO es):
 *   - NSG            = la empresa paraguas. ESTE tenant es su centro de operación.
 *   - Stratos Sales  = OTRO tenant (slug 'stratos-sales', org b1145073-…) que
 *                      vende el producto. NO es éste. Son dos orgs distintas a
 *                      propósito (decisión de Ángel 2026-07-24: camino B).
 *   - Stratos AI     = el producto que se vende.
 *
 * Para qué sirve /nsg (v1 — "Stratos Ops" dogfooding, somos el primer cliente):
 *   - CRM reusado como PIPELINE DE ADQUISICIÓN: cada registro es una inmobiliaria
 *     prospecto, en su camino hacia "usando Stratos" (northstar: 100 al 31-dic).
 *   - Comando Directivo = el tablero/pulso de NSG (qué hay en curso por persona).
 *   - Copilot = la puerta del chat (a futuro conectado al segundo cerebro / AIOS).
 *
 * Aislamiento: comparte código y proyecto Supabase (glulgyhkrqpykxmujodb) pero sus
 * datos viven bajo su propia organization_id (4a17b181-…) + RLS. Como su org NO es
 * STRATOS_ORG_ID, canAccessModule() la limita automáticamente a CRM + Perfil +
 * Papelera (+ Comando + Copilot + Caja porque esta config los prende). Los módulos
 * internos de Stratos (Finanzas/RRHH/ERP/iAgents/Campañas) quedan bloqueados —
 * usan datos mock horneados en el bundle. No se toca el control de acceso.
 *
 * Nivel 2 (24-jul): el módulo "Proyectos" (motor de tareas mkt_* org-scoped, con
 * Mi Día · proyectos · tareas · equipo) quedó VIVO vía features.mktModule +
 * navLabels, y el Copilot habla con el motor de tareas sin fricción
 * (copilotBrain:"tareas" → mkt_nlu_dispatch: crear/empezar/terminar/posponer +
 * persecución 1h/10min en la jornada de cada quien). Falta del plan: módulo
 * Documentos y la conexión del Copilot al segundo cerebro/AIOS (Nivel 3) —
 * ver context/nsg-stratos-ops-plan en el AIOS.
 *
 * Activación:
 *   - localhost:5173/?app&client=nsg          (dev / QA)
 *   - app.stratoscapitalgroup.com/nsg         (prod, path-based)
 *   - nsg.stratoscapitalgroup.com             (prod, subdomain — fase 2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const nsgConfig = {
  id:        "nsg",
  name:      "NSG",
  legalName: "NSG Intelligence",
  tagline:   "Centro de operación — adquisición y desarrollo",

  brand: {
    logoText:                "NSG",
    // Muestra "NSG" en el header (en vez del legacy "Stratos AI").
    appWordmark:             "NSG",
    // Rosa NSG (ya es el color de marca de NSG en el sistema — BRAND_HEX.nsg).
    accent:                  "#F472B6",
    accentLight:             "#F9A8D4",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · NSG",
    // Rótulo CORTO para el celular: la pill del centro es position:absolute (no
    // reserva espacio) y con el rótulo largo se montaba ENCIMA del botón 📞
    // Llamar del header (reporte de Ángel 24-jul). Mismo mecanismo que Duke
    // ("Intelligence" en móvil) — DynIsland.jsx elige este en pantallas chicas.
    intelligenceCenterLabelMobile: "NSG",
  },

  tenant: {
    clientId:       "nsg",
    // UUID de la org "NSG" en la tabla `organizations` (creada en migración 123).
    // Con esto, ClientOrgGuard auto-redirige a los usuarios de NSG a /nsg tras el
    // login, y RLS aísla sus datos.
    organizationId: "4a17b181-35d2-41b3-b639-6e0bd4c38acc",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Sin bot propio todavía.
    botUsername:    "",
    telegramManualPairing: false,
    // Flujo n8n PROPIO del Copilot de NSG (24-jul): agente CLAUDE con memoria y
    // 2 herramientas — el motor de tareas sin fricción Y el SEGUNDO CEREBRO
    // (espejo aios_docs, refrescado por brain-sync.yml del repo iagents-aios).
    // telegram.js lo usa cuando copilotBrain="tareas" (ruteo por ORG del usuario).
    copilotWebhook: "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-nsg-c4d81e2f",
  },

  // Set mínimo y aislado (mismo patrón que Vega / Grupo 28). Los módulos internos
  // de Stratos quedan apagados: además de esta config, canAccessModule() ya los
  // bloquea por no ser la org de Stratos (defensa en profundidad).
  features: {
    crm:              true,   // Reusado como Pipeline de Adquisición (las 100)
    dash:             false,  // Dash de Stratos (mock) — NSG usa Comando Directivo
    erp:              false,  // Catálogo inmobiliario de Duke (mock)
    team:             false,  // datos mock de Stratos
    iacrm:            false,  // iAgents internos de Stratos
    landingPages:     false,  // Campañas internas de Stratos
    finanzas:         false,  // datos mock de Stratos
    rrhh:             false,  // datos mock de Stratos
    trash:            true,   // Papelera del propio CRM
    comandoDirectivo: true,   // Tablero/pulso de NSG (org-scoped, seguro)
    // El Comando original está hecho para una inmobiliaria (embudo de leads,
    // Zoom agendado, recorrido, apartó/cierre) — en NSG eso no dice nada porque
    // no vendemos propiedades, entregamos sistemas. Con esta bandera el módulo
    // muestra el tablero de OPERACIÓN: clientes con sus objetivos y avance real,
    // el trabajo del equipo, los proyectos y la caja con los saldos de nómina.
    comandoOps:       true,
    // Caja: libro de ingresos/egresos de NSG (los gastos que se carguen por
    // Telegram aparecen solos). Lo ve el mando (Ángel/Iván).
    caja:             true,
    cajaAsesores:     false,
    // Copilot ON: la puerta del chat. Con copilotBrain:"tareas" habla con el
    // motor de tareas sin fricción (mkt_nlu_dispatch): "ponme una tarea…",
    // "ya empecé…", "pospón… para mañana a las 3", "¿qué tengo hoy?". La
    // conexión al segundo cerebro / AIOS y documentos sigue siendo Nivel 3.
    copilotModule:    true,
    copilotBrain:     "tareas",
    // Botón de adjuntar en el Copilot: mandás la captura de un pago y te pregunta
    // si entró o salió plata; queda registrado en la Caja CON la captura de
    // soporte (pedido de Ángel 27-jul, igual que en Vega). A propósito NO se lee
    // el monto de la imagen: se pregunta, porque inventar una cifra es peor que
    // pedirla.
    copilotGastoFoto: true,
    // Módulo de tareas/proyectos (motor mkt_* org-scoped) — en el nav se llama
    // "Proyectos" (navLabels). Persecución activa: organizations.meta_config
    // .mkt_persecucion = 'on' para la org NSG (avisos 1h/10min + "¿ya pudiste
    // comenzar?", entregados en la jornada de cada quien).
    mktModule:        true,
    // Botón "Llamar" en el header: toca → avisa a los compañeros de la org
    // "📞 X te está llamando" (campanita + push al teléfono), dispara la
    // grabación de tl;dv y abre el Meet fijo. Todo por la RPC fn_start_team_call
    // (el webhook secreto vive en organizations.meta_config, no en este bundle).
    reunionButton:    true,
    callRingtone:     true,   // NSG: suena timbre en la llamada entrante (app abierta)
    // Chat del equipo DENTRO de Stratos (27-jul). El punto no es tener un chat
    // más: es que Iván deje de mandar el plan del día, los documentos y las
    // capturas por WhatsApp, y que esa conversación quede donde el Copilot y el
    // cerebro la pueden ver. Nace con canales porque cuando entren más
    // desarrolladores un hilo único no sirve. Las @menciones avisan por la
    // campanita. Solo NSG por ahora.
    teamChat:         true,
    // Módulo "Usuarios": dar de alta gente del equipo. Pedido de Ángel (27-jul):
    // «yo puedo agregar ahí en el grupo otro desarrollador, que va a tener otro
    // perfil». Sin esto el chat del equipo se queda en dos personas para siempre.
    // Es org-scoped: un admin de NSG no ve ni toca gente de Duke.
    teamAdmin:        true,
  },

  // Renombres de módulos en el nav para NSG (mecanismo ya existente en App.jsx:
  // clientConfig?.navLabels?.[id] ?? label). El motor es el mismo; el nombre
  // habla el idioma de NSG.
  navLabels: {
    mkt: "Proyectos",
  },

  // Ajustes del módulo Proyectos (motor mkt reusado): NSG no produce videos →
  // fuera la pestaña "Pipeline" (kanban de videos de marketing); la pestaña
  // "Marcas" acá se llama "Proyectos" (marca NSG → proyectos → tareas).
  mkt: {
    hideTabs: ["pipeline"],
    tabLabels: { marcas: "Proyectos" },
  },

  // ── Quién emite las cuentas de cobro ────────────────────────────────────────
  // Se usa en el .docx que se descarga desde Caja → Cuentas de cobro, para que
  // Ángel lo firme a mano (pedido explícito: en Word, no en PDF).
  // ⚠️ El NIT de NSG y la cédula de quien firma están en null A PROPÓSITO: no los
  // sabemos y NO se inventan. Mientras estén vacíos el documento sale sin esas
  // líneas y la pantalla lo avisa. Cuando Ángel los pase, se escriben acá.
  facturacion: {
    nombre:                  "NSG Intelligence",
    identificacion:          null,   // ej: "NIT 900.123.456-7"
    firmante:                "Ángel Garzón",
    identificacionFirmante:  null,   // ej: "C.C. 1.234.567.890"
    ciudad:                  "Bogotá",
  },

  support: {
    email:    null,   // cae al soporte de Stratos hasta definir el de NSG
    whatsapp: null,
  },

  crm: {
    // "Proyectos" del dropdown "Nueva inmobiliaria" = las modalidades de la oferta
    // NSG (para etiquetar por qué camino entra cada prospecto).
    defaultProjects: [
      "Partner (50/50)",
      "Full ($12k)",
      "Implementación base ($3k)",
      "Diagnóstico sin costo",
    ],
    // Métricas por persona (Iván / Ángel) — apoya "roles y responsabilidades".
    advisorMetricsTab: true,
    // Discovery simplificado (patrón validado en Duke/Grupo28/TGenius/Vega).
    discoverySimplified: true,
    // Oculta el "Centro de Agentes IA" de venta de Stratos (mock). Se puede
    // prender más adelante si conectamos el call center a la adquisición.
    aiAgentsPanel: false,
    // Expediente como drawer lateral (igual que Duke).
    expedienteCentered: false,
    // El "cliente" del CRM ES una inmobiliaria prospecto (con contacto/teléfono),
    // así que NO usamos projectMode: queremos los datos de contacto para el outreach.
    projectMode: false,

    // ── Pipeline de ADQUISICIÓN (las 100 inmobiliarias) — solo NSG ─────────────
    // El camino real de un prospecto hasta "usando Stratos". La última etapa
    // (Activa) es la que cuenta para el northstar. "Descartada" = no cuadra o no
    // respondió.
    //
    // ⚠️ CONTRATO CON n8n: estos `name` son los strings EXACTOS que van a
    // leads.stage. Un flujo de adquisición que dé de alta prospectos debe escribir
    // "Prospecto" (primera etapa). Si el string no coincide, el registro no cae en
    // ninguna columna del kanban.
    pipeline: [
      { name: "Prospecto",       color: "#94A3B8" }, // detectado, aún sin contactar
      { name: "Contactado",      color: "#38BDF8" }, // primer toque (LinkedIn/WhatsApp/email)
      { name: "En conversación", color: "#FBBF24" }, // respondió, hay diálogo
      { name: "Diagnóstico",     color: "#A78BFA" }, // llamada de diagnóstico/auditoría
      { name: "Propuesta",       color: "#FB923C" }, // oferta presentada
      { name: "Cierre",          color: "#F472B6" }, // firmó / arranque
      { name: "Onboarding",      color: "#22D3EE" }, // montándole su Stratos
      { name: "Activa",          color: "#34D399" }, // usando Stratos (cuenta para las 100)
      { name: "Descartada",      color: "#F87171" }, // no cuadra / no respondió
    ],

    // ── Vocabulario del CRM — solo NSG ────────────────────────────────────────
    // Cada "cliente" es una inmobiliaria prospecto.
    labels: {
      entity:                "inmobiliaria",
      entityCap:             "Inmobiliaria",
      entityPlural:          "inmobiliarias",
      newEntity:             "Nueva inmobiliaria",
      priorityList:          "Inmobiliarias en prioridad",
      emptyList:             "Sin inmobiliarias",
      entityNamePlaceholder: "Nombre de la inmobiliaria",
      entityProfile:         "Detalle de la inmobiliaria",
      deleteEntity:          "Eliminar inmobiliaria (mover a papelera)",
      viewDetail:            "Ver detalle de la inmobiliaria",
      openProfile:           "Abrir detalle de la inmobiliaria",
      pageTitle:             "Pipeline",
      pageTitleAccent:       "NSG",
      pageTitleMobile:       "Pipeline NSG",
    },

    // ── KPIs de arriba del CRM — solo NSG ─────────────────────────────────────
    // Hacen visible el avance hacia los 100. Solo íconos ya importados en el CRM
    // (Building2 · Search · Trophy · DollarSign), como Vega.
    kpis: [
      { label: "Inmobiliarias en pipeline", value: { type: "total" },
        sub: { type: "count", stage: "En conversación", suffix: "en conversación" },
        icon: "Building2",  color: "blue" },
      { label: "En diagnóstico",            value: { type: "count", stage: "Diagnóstico" },
        sub: { type: "count", stage: "Propuesta", suffix: "con propuesta" },
        icon: "Search",     color: "cyan" },
      { label: "En cierre / onboarding",    value: { type: "count", stage: "Cierre" },
        sub: { type: "count", stage: "Onboarding", suffix: "en onboarding" },
        icon: "Trophy",     color: "accent" },
      { label: "Activas usando Stratos",    value: { type: "count", stage: "Activa" },
        sub: { type: "total", suffix: "en pipeline · meta 100" },
        icon: "DollarSign", color: "emerald" },
    ],
  },
};

export default nsgConfig;
