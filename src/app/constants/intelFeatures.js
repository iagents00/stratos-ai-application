/**
 * app/constants/intelFeatures.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogo de funciones del Centro de Inteligencia (Dynamic Island).
 * Alimenta el CARRUSEL de "Qué puede hacer el sistema" + el mini-TUTORIAL de cada una.
 *
 * ⭐ Desde 16-jul TODO funciona en el COPILOT del CRM (módulo "Copilot"), sin
 * obligar a conectar Telegram. Telegram queda como un PLUS opcional: quien lo
 * conecta recibe además por ahí. Por eso el canal principal de cada función es
 * el Copilot; "Telegram" solo se menciona como opción.
 *
 * Cada función:
 *   id       identificador único
 *   label    nombre corto (tarjeta)
 *   icon     nombre de ícono lucide-react (se resuelve en FEATURE_ICONS de DynIsland)
 *   color    hex del acento
 *   kind     'pedis'  = se lo pedís al asistente  ·  'agente' = lo hace solo
 *   chan     etiqueta de canal que se muestra en el chip (Copilot / Copilot · CRM / En el CRM / Automático)
 *   where    DÓNDE se usa (frase legible en el detalle)
 *   tagline  una línea (qué hace)
 *   how      pasos / ejemplos de "cómo se usa"
 * ─────────────────────────────────────────────────────────────────────────────
 */

// El bot de Telegram del asistente (Duke). Es OPCIONAL — el Copilot hace lo mismo.
export const ASSISTANT_BOT = "@Strato_sasistente_crm_bot";

export const INTEL_FEATURES = [
  /* ─── Lo que tú le PIDES al asistente (Copilot; Telegram opcional) ─────────── */
  {
    id: "registrar-voz", label: "Registrar por voz", icon: "Mic", color: "#6EE7C2", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Crea un cliente con un audio o un texto, sin llenar formularios.",
    how: [
      "Abrí el módulo Copilot en el CRM y escribile —o dictale por voz con el micrófono.",
      'Ejemplo: "Crea un cliente, Mariana López, teléfono 55 1234 5678, llamarla en 4 horas".',
      "Lo registra al instante y te confirma. Si conectaste Telegram, también podés hacerlo desde ahí.",
    ],
  },
  {
    id: "actualizar-expediente", label: "Actualizar expediente", icon: "FileText", color: "#60A5FA", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Cuéntale qué pasó con el cliente y lo guarda en su expediente al instante.",
    how: [
      "En el Copilot, escribí o mandá un audio con la novedad.",
      'Ejemplo: "Anota en Felipe que pidió ver dos propiedades más en la zona norte".',
      "Queda en el expediente del cliente, con fecha y hora.",
    ],
  },
  {
    id: "recomendar", label: "Recomendar propiedades", icon: "Home", color: "#34D399", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Te sugiere propiedades para un cliente según su presupuesto y su zona.",
    how: [
      'En el Copilot: "¿Qué le recomiendo a Ana?" o "propiedades para Diana".',
      "Cruza el presupuesto y la zona del cliente con el catálogo y te devuelve las mejores opciones con su Drive.",
    ],
  },
  {
    id: "catalogo", label: "Catálogo y drives", icon: "FolderOpen", color: "#22D3EE", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Pide el catálogo o el Drive de un desarrollo por presupuesto o ubicación.",
    how: [
      'En el Copilot: "el drive de Tulum Country Club" · "catálogo de 300 mil" · "qué hay en Playa del Carmen".',
      "Te manda los links de las carpetas/desarrollos que aplican, listos para compartir con el cliente.",
    ],
  },
  {
    id: "agendar-zoom", label: "Agendar Zoom", icon: "Video", color: "#A78BFA", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Programa la videollamada; el sistema te recuerda antes de que empiece.",
    how: [
      'En el Copilot: "Agenda el Zoom de Carlos para el viernes a las 11am".',
      "Antes del Zoom te llega el aviso + la ficha del cliente (briefing) para llegar preparado.",
    ],
  },
  {
    id: "agendar-visita", label: "Agendar visita", icon: "MapPin", color: "#F59E0B", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Coordina la visita a la propiedad, con recordatorios automáticos.",
    how: [
      'En el Copilot: "Agenda una visita con Diana el sábado 4pm en Portofino".',
      "El asistente te avisa 30, 15 y 7 días antes, y el día de la visita.",
    ],
  },
  {
    id: "mover-etapa", label: "Mover de etapa", icon: "GitBranch", color: "#34D399", kind: "pedis",
    chan: "Copilot · CRM",
    where: "En el Copilot, o arrastrando la tarjeta en el CRM",
    tagline: "Avanza al cliente en el pipeline con una frase (o desde el tablero).",
    how: [
      'En el Copilot: "Pasa a Felipe a Seguimiento" · "mueve a Diana a Zoom Concretado".',
      "O en el CRM web: arrastra la tarjeta del cliente a la columna nueva. Queda registrado igual.",
    ],
  },
  {
    id: "reasignar", label: "Tomar / reasignar un lead", icon: "UserPlus", color: "#818CF8", kind: "pedis",
    chan: "Copilot · CRM",
    where: "En el Copilot (o reasignando desde el CRM)",
    tagline: "Pasa un cliente a otro asesor — o tómalo tú con una frase.",
    how: [
      'En el Copilot: "pasá a Juan y asignámelo a mí" · "ponlo en mi cartera".',
      "Lo reasigna y, si tenía recordatorios pendientes, los mueve al nuevo asesor para que el aviso llegue a quien lo tiene.",
    ],
  },
  {
    id: "buscar-ficha", label: "Buscar ficha", icon: "Search", color: "#22D3EE", kind: "pedis",
    chan: "Copilot · CRM",
    where: "En el Copilot, o con la lupa del CRM",
    tagline: "Pide la ficha, las notas y el expediente completo de cualquier cliente.",
    how: [
      'En el Copilot: "Busca a Diana" · "muéstrame el expediente de Carlos Ruiz".',
      "Si hay dos con nombre parecido, te muestra botones para elegir. También podés usar la lupa del CRM web.",
    ],
  },
  {
    id: "kpis", label: "Tus números", icon: "BarChart3", color: "#818CF8", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Consulta tus KPIs, tu agenda del día y tu pipeline al instante.",
    how: [
      'En el Copilot: "¿Cuántos clientes tengo en pipeline?" · "¿Qué tengo hoy?" · "¿cómo voy?".',
      "Respuesta directa, sin armar reportes.",
    ],
  },
  {
    id: "cartera-asesor", label: "Cartera de un asesor (admin)", icon: "Users", color: "#60A5FA", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot — solo para admins",
    tagline: "Si eres admin, consulta la cartera y los números de cualquier asesor.",
    how: [
      'En el Copilot: "clientes de Cecilia" · "¿cómo va Gael?" · "cartera de Carlos".',
      "Te devuelve sus leads, etapa y actividad. (Un asesor normal solo ve lo suyo.)",
    ],
  },
  {
    id: "recordatorio", label: "Recordatorios", icon: "Bell", color: "#FB7185", kind: "pedis",
    chan: "Copilot",
    where: "En el Copilot del CRM (o en Telegram, si lo conectás)",
    tagline: "Pídele que te recuerde cualquier cosa, a la hora que tú pidas.",
    how: [
      'En el Copilot: "Recuérdame enviarle la propuesta a Felipe mañana a las 10".',
      "Te llega el aviso puntual (al Copilot y al teléfono). También podés pedirlo por audio.",
    ],
  },

  /* ─── Lo que los AGENTES hacen SOLOS ─────────────────────────────────────── */
  {
    id: "avisos-telefono", label: "Avisos al teléfono", icon: "Smartphone", color: "#6EE7C2", kind: "agente",
    chan: "Automático",
    where: "Automático → notificación al teléfono (con la app cerrada)",
    tagline: "Los avisos del asistente te llegan al celular aunque tengas la app cerrada.",
    how: [
      "Instalá la app en tu teléfono (en iPhone: Compartir → Agregar a inicio) y activá las notificaciones.",
      "Desde ahí, los Zooms, tareas y recordatorios te llegan como notificación del teléfono — igual que un chat.",
    ],
  },
  {
    id: "briefing", label: "Briefing pre-Zoom", icon: "Sparkles", color: "#6EE7C2", kind: "agente",
    chan: "Automático",
    where: "Automático → te llega al Copilot y al teléfono",
    tagline: "Antes de cada Zoom te llega la ficha del cliente para llegar preparado.",
    how: [
      "No hay que pedirlo: el sistema lo manda solo antes de la reunión.",
      "Te resume quién es el cliente, en qué está y qué conviene decirle.",
    ],
  },
  {
    id: "reactivador", label: "Reactivar dormidos", icon: "Zap", color: "#F59E0B", kind: "agente",
    chan: "Automático",
    where: "Automático → aviso al Copilot y al teléfono",
    tagline: "Detecta clientes fríos y te arma el mensaje para reactivarlos.",
    how: [
      "El sistema encuentra los leads sin movimiento y te avisa con un texto ya redactado.",
      'Tocás "Abrir WhatsApp" y puedes enviárselo (o editarlo antes de enviar).',
    ],
  },
  {
    id: "score", label: "Score automático", icon: "Gauge", color: "#F43F5E", kind: "agente",
    chan: "En el CRM",
    where: "Automático → lo ves en el CRM",
    tagline: "Cada lead se califica solo y marca los más calientes (HOT).",
    how: [
      "En el CRM web, cada tarjeta muestra el SCORE y la etiqueta HOT — se calculan solos.",
      "Se recalcula al avanzar (Zoom, seguimiento, presupuesto). Priorizas sin adivinar.",
    ],
  },
  {
    id: "coach", label: "Coach de tareas", icon: "UsersRound", color: "#A78BFA", kind: "agente",
    chan: "Automático",
    where: "Automático → aviso al Copilot y al teléfono",
    tagline: 'El asistente te persigue: "¿ya la hiciste?" para que nada se caiga.',
    how: [
      "Te recuerda tus acciones pendientes y las de equipo hasta que las cierres.",
      "Si algo queda sin hacer, escala al admin (para los que son admin).",
    ],
  },
];

/** Íconos lucide-react usados por el carrusel (para importar solo lo necesario). */
export const INTEL_ICON_NAMES = [
  "Mic", "FileText", "Home", "FolderOpen", "Video", "MapPin", "GitBranch", "UserPlus",
  "Search", "BarChart3", "Users", "Bell", "Smartphone", "Sparkles", "Zap", "Gauge", "UsersRound",
];
