import tenantConfig from "../tenant/config";

// Enable only after a live model turn and write/readback pass (provider balance required).
const PROJECT_COPILOT_ENABLED = false;

const capabilities = [
  { id: "mi-dia", label: "Organizar mi día", icon: "BarChart3", color: "#6EE7C2", kind: "pedis", chan: "Copilot",
    tagline: "Consulta tus pendientes y decide qué atender primero.",
    prompt: "¿Qué tengo pendiente hoy?",
    how: ["Pregunta por tus pendientes de hoy.", "El asistente consulta las tareas de tu espacio y sus fechas."] },
  { id: "mis-tareas", label: "Crear y avanzar tareas", icon: "FileText", color: "#60A5FA", kind: "pedis", chan: "Copilot",
    tagline: "Desglosa una idea en tarjetas separadas con criterios de aceptación.",
    prompt: "Ponme una tarea: ",
    how: ["Indica qué necesitas hacer y para cuándo.", "Revisa la confirmación; después puedes pedir empezar, completar o posponer la tarea."] },
  { id: "mi-recordatorio", label: "Recordar un pendiente", icon: "Bell", color: "#FBBF24", kind: "pedis", chan: "Copilot",
    tagline: "Guarda qué necesitas recordar y cuándo.",
    prompt: "Recuérdame mañana a las 10 ",
    how: ["Incluye el pendiente, la fecha y la hora.", "Comprueba la fecha que confirma el asistente. Los avisos fuera de la app requieren notificaciones habilitadas."] },
  { id: "mi-conocimiento", label: "Proyectos y contexto", icon: "BookOpen", color: "#A78BFA", kind: "pedis", chan: "Copilot",
    tagline: "Crea y organiza proyectos; conserva sus decisiones y resultados.",
    prompt: "Recuerda para mis proyectos: ",
    how: ["Escribe la decisión o el contexto que quieres conservar.", "El asistente guarda el contexto en el proyecto o tarea correspondiente; puedes consultarlo después."] },
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
    copilotHelp: PROJECT_COPILOT_ENABLED ? "Puedo leer y organizar tus proyectos de I Space, crear y editar tarjetas separadas, checklists de aceptación, responsables existentes, fechas, prioridades y dependencias. También preparo prompts completos para pegar en Codex. Solo confirmo guardado cuando la base lo confirma. La ejecución en Codex y los sistemas externos todavía requieren que lleves allí la instrucción." : "Soy tu Copilot de I Space. El motor actual permite consultar pendientes y trabajar con tareas. Para preparar una instrucción completa para Codex, abre una tarjeta en Proyectos y elige Preparar prompt para Codex. El nuevo motor de planificación está pendiente de activar; no tengo conexión automática con tus chats de Codex ni con IAOS.",
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
    projectCopilot: PROJECT_COPILOT_ENABLED,
  },
  mkt: {
    ...tenantConfig.mkt,
    hideTabs: ["pipeline", "solicitudes", "equipo"],
  },
  copilot: {
    title: "Tu Copilot de I Space",
    description: PROJECT_COPILOT_ENABLED ? "Organiza proyectos completos, actualiza su Kanban y prepara instrucciones para trabajar en Codex." : "Consulta tus pendientes. Los prompts para Codex están disponibles al abrir cada tarjeta del Kanban.",
    notificationText: "Activa las notificaciones para recibir avisos de tus tareas y recordatorios aunque cierres I Space.",
    suggestions: PROJECT_COPILOT_ENABLED ? [
      { label: "Mi día", text: "¿Qué tengo pendiente hoy?" },
      { label: "Prompts para Codex", text: "Revisa mis proyectos y propón tres tareas listas para trabajar en Codex, con un prompt completo para cada una. No cambies sus estados." },
      { label: "Siguiente paso", text: "Revisa todos mis proyectos, dependencias y foco semanal. ¿Cuáles son las tres siguientes acciones que puedo hacer ahora?" },
      { label: "Qué puedo pedir", text: "¿Qué puedes hacer?" },
    ] : [{ label: "Mi día", text: "¿Qué tengo pendiente hoy?" }, { label: "Ayuda y Codex", text: "¿Qué puedes hacer?" }],
    capabilities: PROJECT_COPILOT_ENABLED ? capabilities : capabilities.filter(x => ["mi-dia", "mi-recordatorio"].includes(x.id)),
  },
  intelFeatures: PROJECT_COPILOT_ENABLED ? capabilities : capabilities.filter(x => ["mi-dia", "mi-recordatorio"].includes(x.id)),
};
