/**
 * src/clients/muebleria/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del tenant MUEBLARIA (grupo Stratos Capital — mobiliario a
 * medida: diseño, producción en taller, entrega e instalación).
 *
 * ⚠️ El nombre de la marca es MUEBLARIA (organigrama del corporativo, 29-jul-2026),
 * no «Mueblería». El slug /muebleria se conserva a propósito: la URL ya estaba
 * registrada y es como la gente la escribe.
 *
 * Doctrina 11-ago-2026 (skill replicar-equipo-stratos):
 *   - Molde EQUIPO (NSG). Nada de las funciones de ventas de Duke.
 *   - El pipeline usa SUS palabras (corte, armado, laca, entrega) y es espejo
 *     EXACTO de `org_stages` en la base — si cambia uno, cambia el otro.
 *   - Gente que no vive frente a una computadora: la entrada natural es la voz
 *     y una foto. El sistema les habla claro y coloquial, sin tecnicismos.
 *
 * Activación: app.stratoscapitalgroup.com/muebleria (path-based).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const muebleriaConfig = {
  id:        "muebleria",
  name:      "Mueblaria",
  legalName: "Mueblaria",
  tagline:   "Mobiliario a medida, del taller a tu casa",

  brand: {
    logoText:                "Mueblaria",
    accent:                  "#D97706",   // ámbar madera
    accentLight:             "#F59E0B",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Mueblaria",
  },

  tenant: {
    clientId:       "muebleria",
    // UUID de "Mueblería" en `organizations` (stratos-prod). El aislamiento es
    // por organization_id + RLS, no por proyecto.
    organizationId: "e583eb98-ff00-4920-a69c-db39f3841b31",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // El «¿qué puedes hacer?» PROPIO (sin esto caía al texto de NSG o al
    // manual inmobiliario). Español neutro, sin guiones largos.
    // ⭐ ARQUITECTURA «un flujo, un cerebro por empresa» (12-ago-2026).
    // Este webhook es COMPARTIDO y genérico: no sabe a quién atiende. Lo primero
    // que hace es preguntarle a la base `fn_copilot_brief(chat_id)` quién es esta
    // empresa y qué sabe hacer, y con ESE prompt trabaja el modelo.
    // Antes, al no declarar webhook, este tenant caía en `copilot-marketing`, que
    // es el asistente del equipo de marketing de Duke: por eso no respondía bien.
    // Detalle: context/copilot-arquitectura-un-flujo.md del AIOS.
    copilotWebhook: "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-tenant",
    copilotHelp: "Esto es lo que puedo hacer por ti en la mueblería:\n\n• Tareas sin fricción: «ponme una tarea: pedir la laca mañana a las 10»\n• Repartir el trabajo: «que Juan arme el comedor de los López el jueves» (le llega el aviso y el sistema lo persigue)\n• Tu día: «¿qué tengo hoy?» o «¿qué pendientes tiene el equipo?»\n• Recordatorios que suenan: «recuérdame en 2 horas llamar al cliente del ropero»\n• El conocimiento de tu empresa: pregúntame por el manual, quién es quién, o el tablero de pedidos\n\nTodo por texto o por voz. Los avisos llegan 1 hora y 10 minutos antes, solo en tu jornada.",
  },

  // Módulos del molde EQUIPO (patrón NSG, igual que Legacy) + su CRM de pedidos.
  // Declaradas EXPLÍCITAMENTE (defensa en profundidad, patrón grupo28):
  // lo que no usa esta empresa queda apagado — un menú con módulos vacíos es
  // peor que un menú corto.
  features: {
    crm:          true,    // El pipeline de PEDIDOS (sus etapas, no las de Duke)
    dash:         false,
    erp:          false,
    team:         false,
    iacrm:        false,
    landingPages: false,
    finanzas:     false,
    rrhh:         false,
    trash:        true,
    comandoDirectivo: true,   // Tablero propio, org-scoped
    comandoOps:       true,   // Operación (pedidos/equipo/caja), no embudo de leads
    caja:             true,   // Libro de ingresos/egresos del taller (anticipos, madera, laca)
    cajaAsesores:     false,
    // Copilot con el cerebro de TAREAS (mkt_nlu_dispatch, org-scoped, molde NSG).
    // Las funciones de taller (avance con foto por pedido) llegan cuando se
    // clone el flujo copilot desde NSG (n8n, sesión local).
    copilotModule:    true,
    copilotBrain:     "tareas",
    mktModule:        true,   // Motor de tareas/proyectos (Plan Semanal · Actividades · Equipo)
    teamAdmin:        true,   // Alta de la gente del taller desde el CRM → Usuarios
    teamChat:         false,
  },

  navLabels: {
    mkt: "Proyectos",   // = meta_config.mkt.moduleLabel en la base (espejo)
  },

  // El motor mkt reusado: una mueblería no produce videos ni recibe pedidos de diseño.
  mkt: {
    hideTabs: ["pipeline", "solicitudes"],
    tabLabels: { marcas: "Proyectos" },
  },

  // ── Centro de Inteligencia PROPIO (molde NSG: tareas + agenda + tablero) ───
  intelFeatures: [
    { id: "tarea-voz", label: "Anotar por voz", icon: "Mic", color: "#D97706", kind: "pedis",
      chan: "Copilot", where: "En el módulo Copilot",
      tagline: "Dicta una tarea o un pendiente y queda en la agenda, sin formularios.",
      how: ['Abre el Copilot y escribe o dicta: "Ponme una tarea: pedir la laca mañana a las 10".',
            "Queda en tu agenda y te avisa 1 hora y 10 minutos antes."] },
    { id: "asignar", label: "Repartir el trabajo", icon: "Users", color: "#60A5FA", kind: "pedis",
      chan: "Copilot", where: "En el Copilot o en Mi Espacio → Equipo",
      tagline: "Asigna pendientes a la gente del taller y el sistema los persigue.",
      how: ['"Que Juan arme el comedor de los López el jueves."',
            "Le llega el aviso a la persona y el sistema hace el seguimiento solo."] },
    { id: "agenda-dia", label: "Tu día de un vistazo", icon: "ClipboardList", color: "#A78BFA", kind: "pedis",
      chan: "Copilot", where: "En el Copilot",
      tagline: "Pregunta qué tienes hoy y te lo enumera con horas.",
      how: ['"¿Qué tengo hoy?" o "¿qué pendientes tiene el equipo?"'] },
    { id: "recordatorio", label: "Recordatorios que suenan", icon: "BellRing", color: "#FBBF24", kind: "pedis",
      chan: "Copilot", where: "En el Copilot",
      tagline: "«Recuérdame en 2 horas» y te avisa a la hora exacta.",
      how: ['"Recuérdame mañana a las 9 confirmar la entrega del comedor."'] },
    { id: "tablero-pedidos", label: "El tablero de pedidos", icon: "Search", color: "#34D399", kind: "pedis",
      chan: "En el CRM", where: "Módulo Pedidos (CRM)",
      tagline: "Cada pedido en su etapa: de Cotización a Entrega. Se abre y se mira.",
      how: ["Sustituye el «¿cómo va el comedor de los López?»: abre el tablero y está.",
            "Sin anticipo no se corta madera: la etapa que manda es «Anticipo recibido»."] },
    { id: "avisos", label: "Avisos sin perseguir a nadie", icon: "Bell", color: "#FB923C", kind: "agente",
      chan: "Automático", where: "Solo dentro de la jornada",
      tagline: "Vencimientos y pendientes avisan solos, agrupados, sin madrugadas.",
      how: ["Si una tarea vence, el responsable recibe el aviso en su jornada.",
            "El líder recibe UN resumen, no veinte mensajes."] },
  ],

  support: { email: null, whatsapp: null, phoneLabel: null },

  crm: {
    // ⚠️ ESPEJO EXACTO de org_stages (base). El registro que se mueve es un PEDIDO.
    //
    // TRES SUB-TABLEROS, con los dueños reales del organigrama del corporativo:
    //   Pedidos (Diseño de Producto) · Taller (Supervisión de Producción) ·
    //   Entrega (Coordinación de Logística).
    // Las dos fronteras las manda el negocio, no el software:
    //   «Anticipo recibido» cierra Pedidos — sin anticipo no se corta madera.
    //   «Terminado, listo para entregar» cierra Taller — el mueble hecho que
    //   nadie fue a entregar ocupa espacio y no cobra.
    pipeline: [
      // ── Pedidos (venta) ──
      { name: "Pidió cotización",               color: "#94A3B8" },
      { name: "Cotización enviada",             color: "#CBD5E1" },
      { name: "Anticipo recibido",              color: "#4ADE80" },
      { name: "No cerró",                       color: "#F87171" },
      // ── Taller (producción) ──
      { name: "Corte",                          color: "#38BDF8" },
      { name: "Armado",                         color: "#FBBF24" },
      { name: "Laca",                           color: "#A78BFA" },
      { name: "Terminado, listo para entregar", color: "#2DD4BF" },
      // ── Entrega ──
      { name: "Entregado",                      color: "#34D399" },
      { name: "Ajustes y garantía",             color: "#64748B" },
    ],
    defaultProjects: [],
    advisorMetricsTab: false,
    discoverySimplified: true,
  },

  // El vocabulario del taller, no el de un CRM.
  labels: {
    entity:                "pedido",
    entityCap:             "Pedido",
    entityPlural:          "pedidos",
    newEntity:             "Nuevo pedido",
    priorityList:          "Pedidos en prioridad",
    emptyList:             "Sin pedidos",
    entityNamePlaceholder: "Cliente o mueble (ej. Comedor Familia López)",
    entityProfile:         "Detalle del pedido",
    deleteEntity:          "Quitar pedido (mover a papelera)",
    viewDetail:            "Ver detalle del pedido",
    openProfile:           "Abrir detalle del pedido",
    pageTitle:             "Pedidos",
    pageTitleAccent:       "",              // sin el «Asesores» de Duke al lado
    pageTitleMobile:       "Pedidos",
    discoveryTab:          "Detalle",
    discoveryTabShort:     "Detalle",
    noAdvisor:             "Sin responsable",
    advisorAll:            "Todos los responsables",
    relatedContacts:       "Contactos del pedido",
  },
};

export default muebleriaConfig;
