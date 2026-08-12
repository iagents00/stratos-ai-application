/**
 * src/clients/brasa-y-piedra/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del tenant BRASA Y PIEDRA (corporativo Duke — restaurante).
 *
 * Doctrina 11-ago-2026 (skill replicar-equipo-stratos):
 *   - Molde EQUIPO (NSG) puro. ⛔ SIN pipeline de ventas: un restaurante no
 *     persigue leads — sus actividades son cortas y entre ellos (pedidos y
 *     proteínas, mandar algo a marketing, un platillo nuevo, buscar cocinero
 *     o mesero). Lo suyo son tareas rápidas, recordatorios y el chat.
 *     (Decidido en plan-replicacion-corporativo, de lo que describió Iván.)
 *   - Un menú con módulos vacíos es peor que un menú corto: CRM apagado.
 *   - Tono: rústico, cercano y sin tecnicismos — que lo entienda cualquiera.
 *   - El módulo de trabajo se llama ACTIVIDADES (decisión de Ángel, 11-ago).
 *   - La CAJA va encendida y adaptada a ellos: un restaurante mueve dinero
 *     todos los días (compras a proveedores, venta del día).
 *
 * Activación: app.stratoscapitalgroup.com/brasa-y-piedra (path-based).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const brasaYPiedraConfig = {
  id:        "brasa-y-piedra",
  name:      "Brasa y Piedra",
  legalName: "Brasa y Piedra",
  tagline:   "El equipo del restaurante, en orden",

  brand: {
    logoText:                "Brasa y Piedra",
    accent:                  "#DC2626",   // rojo brasa
    accentLight:             "#EF4444",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Brasa y Piedra",
  },

  tenant: {
    clientId:       "brasa-y-piedra",
    organizationId: "ea74b69a-6904-4c65-a0ca-e0af58f1473a",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // El «¿qué puedes hacer?» PROPIO de Brasa (telegram.js lo responde al
    // instante). Tono cercano de cocina, cero tecnicismos.
    // ⭐ ARQUITECTURA «un flujo, un cerebro por empresa» (12-ago-2026).
    // Este webhook es COMPARTIDO y genérico: no sabe a quién atiende. Lo primero
    // que hace es preguntarle a la base `fn_copilot_brief(chat_id)` quién es esta
    // empresa y qué sabe hacer, y con ESE prompt trabaja el modelo.
    // Antes, al no declarar webhook, este tenant caía en `copilot-marketing`, que
    // es el asistente del equipo de marketing de Duke: por eso no respondía bien.
    // Detalle: context/copilot-arquitectura-un-flujo.md del AIOS.
    copilotWebhook: "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-tenant",
    copilotHelp: "Esto es lo que puedo hacer por ti en Brasa y Piedra:\n\n• Tareas al vuelo: «ponme una tarea: pedir la proteína al proveedor mañana antes de las 10»\n• Repartir el trabajo: «que Carlos consiga cotización del cocinero nuevo el viernes» (le llega el aviso y el sistema lo persigue)\n• Tu día: «¿qué tengo hoy?» o «¿qué pendientes tiene el equipo?»\n• Recordatorios que suenan: «recuérdame a las 5 sacar el pan del congelador»\n• Lo que sabe tu restaurante: pregúntame por los pedidos de proteína, el manual o quién tiene cuenta\n\nTodo por texto o por voz. Los avisos llegan 1 hora y 10 minutos antes, solo en tu jornada (10:00 a 21:00).",
  },

  // Módulos del molde EQUIPO (patrón NSG/Legacy, sin CRM):
  // Actividades (motor de tareas) · Plan Semanal · Copilot · Caja · Usuarios ·
  // Comando · Mi Espacio (global). CRM apagado a propósito — si algún día
  // venden EVENTOS, hay un pipeline corto de 5 etapas ya diseñado
  // (context/plan-pipelines-por-industria.md del AIOS).
  features: {
    crm:              false,
    dash:             false,
    erp:              false,
    team:             false,
    iacrm:            false,
    landingPages:     false,
    finanzas:         false,
    rrhh:             false,
    trash:            true,
    comandoDirectivo: true,   // Tablero propio, org-scoped
    comandoOps:       true,   // Operación (equipo/caja), sin embudo de leads
    caja:             true,   // El dinero del día: compras a proveedores, venta
    cajaAsesores:     false,
    // Copilot con el cerebro de TAREAS org-scoped (molde madre NSG) en modo
    // puente (fn_org_copilot_responder v6). El cerebro definitivo llega al
    // clonar el flujo copilot-nsg (n8n, sesión local) con su tono rústico.
    copilotModule:    true,
    copilotBrain:     "tareas",
    mktModule:        true,   // El motor de tareas — acá se llama ACTIVIDADES
    teamAdmin:        true,   // Alta del equipo desde Usuarios
    teamChat:         false,
  },

  navLabels: {
    mkt: "Actividades",
  },

  // El motor reusado: un restaurante no produce videos ni pide diseños.
  mkt: {
    hideTabs: ["pipeline", "solicitudes"],
    tabLabels: { marcas: "Áreas" },
  },

  // ── Centro de Inteligencia PROPIO — frases de restaurante ──────────────────
  intelFeatures: [
    { id: "tarea-voz", label: "Anotar al vuelo", icon: "Mic", color: "#F87171", kind: "pedis",
      chan: "Copilot", where: "En el módulo Copilot",
      tagline: "Dicta un pedido o un pendiente y queda anotado, sin papeles.",
      how: ['Abre el Copilot y escribe o dicta: "Ponme una tarea: pedir la proteína al proveedor mañana antes de las 10".',
            "Queda en tu agenda y te avisa 1 hora y 10 minutos antes."] },
    { id: "asignar", label: "Repartir el trabajo", icon: "Users", color: "#60A5FA", kind: "pedis",
      chan: "Copilot", where: "En el Copilot o en Mi Espacio → Equipo",
      tagline: "Asigna pendientes a la gente del restaurante y el sistema los persigue.",
      how: ['"Que Carlos consiga la cotización del cocinero nuevo para el viernes."',
            "Le llega el aviso a la persona y el sistema hace el seguimiento solo."] },
    { id: "agenda-dia", label: "Tu día de un vistazo", icon: "ClipboardList", color: "#A78BFA", kind: "pedis",
      chan: "Copilot", where: "En el Copilot",
      tagline: "Pregunta qué tienes hoy y te lo enumera con horas.",
      how: ['"¿Qué tengo hoy?" o "¿qué pendientes tiene el equipo?"'] },
    { id: "recordatorio", label: "Recordatorios que suenan", icon: "BellRing", color: "#FBBF24", kind: "pedis",
      chan: "Copilot", where: "En el Copilot",
      tagline: "«Recuérdame a las 5» y te avisa a la hora exacta.",
      how: ['"Recuérdame mañana a las 9 llamar al proveedor de carbón."'] },
    { id: "caja-dia", label: "La caja del día", icon: "Search", color: "#34D399", kind: "pedis",
      chan: "En el sistema", where: "Módulo Caja",
      tagline: "Lo que entra y lo que sale, anotado el mismo día: compras, proveedores, venta.",
      how: ["Registra cada compra y cada entrada en el momento — al final del mes la historia completa está ahí sola."] },
    { id: "avisos", label: "Avisos sin perseguir a nadie", icon: "Bell", color: "#FB923C", kind: "agente",
      chan: "Automático", where: "Solo dentro de la jornada (10:00–21:00)",
      tagline: "Los pendientes que vencen avisan solos, sin madrugadas.",
      how: ["Si una tarea vence, el responsable recibe el aviso en su jornada.",
            "El encargado recibe UN resumen, no veinte mensajes."] },
  ],

  support: { email: null, whatsapp: null, phoneLabel: null },

  // Vocabulario (CRM apagado, pero varias pantallas comparten estas etiquetas).
  labels: {
    entity:                "actividad",
    entityCap:             "Actividad",
    entityPlural:          "actividades",
    noAdvisor:             "Sin responsable",
    advisorAll:            "Todos los responsables",
    relatedContacts:       "Contactos",
    pageTitle:             "Actividades",
    pageTitleAccent:       "",
    pageTitleMobile:       "Actividades",
  },
};

export default brasaYPiedraConfig;
