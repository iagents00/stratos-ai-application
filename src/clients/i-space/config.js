import tenantConfig from "../tenant/config";

const capabilities = [
  { id: "mi-dia", label: "Organizar mi día", icon: "BarChart3", color: "#6EE7C2", kind: "pedis", chan: "Copilot",
    tagline: "Consulta tus pendientes y decide qué atender primero.",
    prompt: "¿Qué tengo pendiente hoy?",
    how: ["Pregunta por tus pendientes de hoy.", "El asistente consulta las tareas de tu espacio y sus fechas."] },
  { id: "mis-tareas", label: "Crear y avanzar tareas", icon: "FileText", color: "#60A5FA", kind: "pedis", chan: "Copilot",
    tagline: "Convierte una idea en una acción con fecha.",
    prompt: "Ponme una tarea: ",
    how: ["Indica qué necesitas hacer y para cuándo.", "Revisa la confirmación; después puedes pedir empezar, completar o posponer la tarea."] },
  { id: "mi-recordatorio", label: "Recordar un pendiente", icon: "Bell", color: "#FBBF24", kind: "pedis", chan: "Copilot",
    tagline: "Guarda qué necesitas recordar y cuándo.",
    prompt: "Recuérdame mañana a las 10 ",
    how: ["Incluye el pendiente, la fecha y la hora.", "Comprueba la fecha que confirma el asistente. Los avisos fuera de la app requieren notificaciones habilitadas."] },
  { id: "mi-conocimiento", label: "Guardar contexto", icon: "BookOpen", color: "#A78BFA", kind: "pedis", chan: "Copilot",
    tagline: "Conserva decisiones y notas dentro de I Space.",
    prompt: "Recuerda para mis proyectos: ",
    how: ["Escribe la decisión o el contexto que quieres conservar.", "El asistente lo guarda en el conocimiento de tu organización; puedes consultarlo después."] },
];

// Registered personal tenant. Authorization remains in authenticated RLS/RPCs.
export default {
  ...tenantConfig,
  id: "i-space",
  name: "I Space",
  tagline: "Tus proyectos, pendientes e ideas en un solo lugar",
  login: {
    heroTop: "Un lugar para tus ideas.",
    heroBot: "Un plan para hacerlas realidad.",
    sub: ["Tu espacio personal de proyectos, tareas y conocimiento.", "Con Copilot y la tecnología de Stratos AI."],
    stats: [],
  },
  brand: {
    ...tenantConfig.brand,
    logoText: "I Space",
    appWordmark: "I Space",
    intelligenceCenterLabel: "I Space · Stratos AI",
    intelligenceCenterLabelMobile: "I Space",
  },
  tenant: {
    ...tenantConfig.tenant,
    clientId: "i-space",
    organizationId: "cd478b82-d2ff-4543-981d-fb9d7aa1583e",
    copilotWebhook: "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-tenant",
    copilotHelp: "Soy tu Copilot de I Space. Puedo consultar tus pendientes, crear y actualizar tareas, guardar recordatorios y conservar contexto de tus proyectos.\n\nPrueba: «¿qué tengo hoy?», «ponme una tarea: revisar mi proyecto mañana a las 10», «ya terminé revisar mi proyecto» o «recuerda que…».\n\nPara crear un proyecto y agrupar sus tareas, abre Proyectos, entra en la vista Proyectos y pulsa Nuevo proyecto. Tu agenda y documentos están en Mi Espacio. Solo trabajo con los datos de esta organización; no tengo acceso automático a tus cuentas externas.",
  },
  features: {
    ...tenantConfig.features,
    dash: false,
    team: false,
    iacrm: false,
    copilotModule: true,
    copilotBrain: "tareas",
    mktModule: true,
    projectKanban: true,
  },
  mkt: {
    ...tenantConfig.mkt,
    hideTabs: ["pipeline", "solicitudes", "equipo"],
  },
  copilot: {
    title: "Tu Copilot de I Space",
    description: "Organiza tu día, convierte ideas en tareas y guarda el contexto de tus proyectos.",
    notificationText: "Activa las notificaciones para recibir avisos de tus tareas y recordatorios aunque cierres I Space.",
    suggestions: [
      { label: "Mi día", text: "¿Qué tengo pendiente hoy?" },
      { label: "Mi actividad", text: "¿Qué reporté hoy?" },
      { label: "Mi espacio", text: "¿Cómo organizo mis proyectos en I Space?" },
      { label: "Qué puedo pedir", text: "¿Qué puedes hacer?" },
    ],
    capabilities,
  },
  intelFeatures: capabilities,
};
