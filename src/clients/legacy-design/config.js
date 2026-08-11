/**
 * src/clients/legacy-design/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del tenant LEGACY DESIGN (corporativo Duke — arquitectura y
 * desarrollo inmobiliario: diseño y construcción de casas).
 *
 * Doctrina 11-ago-2026 (skill replicar-equipo-stratos):
 *   - Molde EQUIPO (NSG). Sus funciones NO son las de ventas de Duke.
 *   - El registro que se mueve es una CASA (cada fila de la hoja de Shadai).
 *   - El pipeline es espejo EXACTO de `org_stages` en la base, derivado de los
 *     procesos reales de su hoja de control de proyectos (11 casas).
 *
 * Activación: app.stratoscapitalgroup.com/legacy-design (path-based).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const legacyDesignConfig = {
  id:        "legacy-design",
  name:      "Legacy Design",
  legalName: "Legacy Design",
  tagline:   "Arquitectura y desarrollo — cada casa, a la vista",

  brand: {
    logoText:                "Legacy Design",
    accent:                  "#0EA5E9",   // azul plano/proyecto
    accentLight:             "#38BDF8",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Legacy Design",
  },

  tenant: {
    clientId:       "legacy-design",
    organizationId: "281caa01-7414-4eef-b3b6-afa1e7623ab3",
    supabaseRef:    "glulgyhkrqpykxmujodb",
  },

  // Módulos según la reunión del 11-ago (CRM · plan semanal · copiloto ·
  // proyectos · actividades · equipo · comando · caja · Mi Espacio), patrón NSG.
  features: {
    crm:              true,   // El pipeline de CASAS (sus etapas, no las de Duke)
    dash:             false,
    erp:              false,
    team:             false,
    iacrm:            false,
    landingPages:     false,
    finanzas:         false,
    rrhh:             false,
    trash:            true,
    comandoDirectivo: true,   // Tablero propio, org-scoped
    comandoOps:       true,   // Operación (casas/equipo/caja), no embudo de leads
    caja:             true,   // Libro de ingresos/egresos de Legacy
    cajaAsesores:     false,
    // Copilot FUNCIONANDO HOY: cerebro de TAREAS (mkt_nlu_dispatch, org-scoped,
    // el molde madre NSG): «ponme una tarea…», «¿qué tengo hoy?», recordatorios.
    // Las funciones de OBRA (avance con foto, estado de una casa) llegan cuando
    // se clone el flujo copilot desde NSG (n8n, sesión local).
    copilotModule:    true,
    copilotBrain:     "tareas",
    mktModule:        true,   // Motor de tareas/proyectos (Plan Semanal · Actividades · Equipo)
    teamAdmin:        true,   // Alta de Shadai y Mario Coria desde el CRM → Usuarios
    teamChat:         false,
  },

  navLabels: {
    mkt: "Proyectos",
  },

  // El motor mkt reusado: Legacy no produce videos ni recibe pedidos de diseño.
  mkt: {
    hideTabs: ["pipeline", "solicitudes"],
    tabLabels: { marcas: "Proyectos" },
  },

  // ── Centro de Inteligencia PROPIO (11-ago) ─────────────────────────────────
  // Antes mostraba las 17 funciones de VENTAS de Duke («Recomendar propiedades»
  // en un despacho de arquitectura). Estas son las de Legacy, sobre el molde
  // NSG (tareas + agenda); mismas claves que INTEL_FEATURES.
  intelFeatures: [
    { id: "tarea-voz", label: "Anotar por voz", icon: "Mic", color: "#6EE7C2", kind: "pedis",
      chan: "Copilot", where: "En el módulo Copilot",
      tagline: "Dicta una tarea o un pendiente y queda en la agenda, sin formularios.",
      how: ['Abrí el Copilot y escribí o dictá: "Ponme una tarea: llamar al notario de Casa Ágata mañana a las 10".',
            "Queda en tu agenda y te avisa 1 hora y 10 minutos antes."] },
    { id: "asignar", label: "Repartir el trabajo", icon: "Users", color: "#60A5FA", kind: "pedis",
      chan: "Copilot", where: "En el Copilot o en Mi Espacio → Equipo",
      tagline: "Asigná pendientes a la gente del despacho y el sistema los persigue.",
      how: ['"Que Mario revise los planos de Casa Sol y Luna el jueves."',
            "Le llega el aviso a la persona y el sistema hace el seguimiento solo."] },
    { id: "agenda-dia", label: "Tu día de un vistazo", icon: "ClipboardList", color: "#A78BFA", kind: "pedis",
      chan: "Copilot", where: "En el Copilot",
      tagline: "Preguntá qué tenés hoy y te lo enumera con horas.",
      how: ['"¿Qué tengo hoy?" o "¿qué pendientes tiene el equipo?"'] },
    { id: "recordatorio", label: "Recordatorios que suenan", icon: "BellRing", color: "#FBBF24", kind: "pedis",
      chan: "Copilot", where: "En el Copilot",
      tagline: "«Recuérdame en 2 horas» y te avisa a la hora exacta.",
      how: ['"Recuérdame mañana a las 9 pedir la licencia de tala de Sol y Luna."'] },
    { id: "tablero-casas", label: "El tablero de casas", icon: "Search", color: "#34D399", kind: "pedis",
      chan: "En el CRM", where: "Módulo Proyectos (CRM)",
      tagline: "Cada casa en su etapa: de Terreno y contrato a Postventa. Se abre y se mira.",
      how: ["Sustituye el «¿cuándo se entrega Casa Ágata?»: abrí el tablero y está.",
            "El proceso real de cada casa vive en su próxima acción."] },
    { id: "avisos-obra", label: "Avisos sin perseguir a nadie", icon: "Bell", color: "#FB923C", kind: "agente",
      chan: "Automático", where: "Solo dentro de la jornada (10:00–21:00)",
      tagline: "Vencimientos y pendientes avisan solos, agrupados, sin madrugadas.",
      how: ["Si una tarea vence, el responsable recibe el aviso en su jornada.",
            "El líder recibe UN resumen, no veinte mensajes."] },
  ],

  support: { email: null, whatsapp: null, phoneLabel: null },

  crm: {
    // ⚠️ ESPEJO de org_stages (base). Sustituye el «¿cuándo se entrega Casa
    // Ágata?» por abrir y mirar. El Modelo de NEGOCIO del cliente (Venta ·
    // Retiro · Renta vacacional), el arquitecto y el link a Drive van como
    // campos del expediente, no como etapas.
    pipeline: [
      // «Terreno y contrato» nació de cargar las 11 casas REALES de la hoja de
      // Shadai: 5 estaban ANTES del diseño (selección de terreno, cierre de
      // compra, contrato con el arquitecto). La hoja manda, no el catálogo.
      { name: "Terreno y contrato",          color: "#A8A29E" },
      { name: "Diseño y proyecto ejecutivo", color: "#94A3B8" },
      { name: "Licencias y permisos",        color: "#38BDF8" },
      { name: "Cimientos",                   color: "#FBBF24" },
      { name: "Obra gris",                   color: "#FB923C" },
      { name: "Acabados",                    color: "#A78BFA" },
      { name: "Entrega",                     color: "#34D399" },
      { name: "Postventa",                   color: "#64748B" },
    ],
    defaultProjects: [],
    advisorMetricsTab: false,
    discoverySimplified: true,
    // Tarjetas de arriba del CRM en el idioma de la obra (nada de Zooms/Score).
    kpis: [
      { label: "Casas en el tablero",  value: { type: "total" },
        sub: { type: "count", stage: "Terreno y contrato", suffix: "en terreno y contrato" },
        icon: "Building2", color: "blue" },
      { label: "En diseño",            value: { type: "count", stage: "Diseño y proyecto ejecutivo" },
        sub: { type: "count", stage: "Licencias y permisos", suffix: "en licencias" },
        icon: "Search", color: "cyan" },
      { label: "En obra",              value: { type: "count", stage: "Cimientos" },
        sub: { type: "count", stage: "Obra gris", suffix: "en obra gris" },
        icon: "Trophy", color: "accent" },
      { label: "Entregadas",           value: { type: "count", stage: "Entrega" },
        sub: { type: "count", stage: "Postventa", suffix: "en postventa" },
        icon: "DollarSign", color: "emerald" },
    ],
  },

  labels: {
    entity:                "casa",
    entityCap:             "Casa",
    entityPlural:          "casas",
    newEntity:             "Nueva casa",
    priorityList:          "Casas en prioridad",
    emptyList:             "Sin casas",
    entityNamePlaceholder: "Nombre del proyecto (ej. Casa Ágata)",
    entityProfile:         "Expediente de la casa",
    deleteEntity:          "Quitar casa (mover a papelera)",
    viewDetail:            "Ver expediente de la casa",
    openProfile:           "Abrir expediente de la casa",
    pageTitle:             "Proyectos",
    pageTitleMobile:       "Proyectos",
  },
};

export default legacyDesignConfig;
