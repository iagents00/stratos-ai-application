/**
 * app/constants/intelFeatures.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogo de funciones del Centro de Inteligencia (Dynamic Island).
 * Alimenta el CARRUSEL de "Qué puede hacer el sistema" + el mini-TUTORIAL de cada una.
 *
 * Contenido curado a partir del manual del asistente (src/landing/manual-telegram-content.js).
 *
 * Cada función:
 *   id       identificador único
 *   label    nombre corto (tarjeta)
 *   icon     nombre de ícono lucide-react (se resuelve en el componente)
 *   color    hex del acento
 *   kind     'pedis'  = se lo pedís al asistente  ·  'agente' = lo hace solo
 *   where    DÓNDE se usa (canal) — lo más importante para el asesor
 *   tagline  una línea (qué hace)
 *   how      pasos / ejemplos de "cómo se usa"
 * ─────────────────────────────────────────────────────────────────────────────
 */

// El bot de Telegram del asistente (Duke). Si un cliente usa otro, cambiar acá.
export const ASSISTANT_BOT = "@Strato_sasistente_crm_bot";

export const INTEL_FEATURES = [
  /* ─── Lo que tú le PIDES al asistente (por Telegram) ─────────────── */
  {
    id: "registrar-voz", label: "Registrar por voz", icon: "Mic", color: "#6EE7C2", kind: "pedis",
    where: "Desde el chat del bot en Telegram",
    tagline: "Crea un cliente con un audio o un texto, sin abrir la computadora.",
    how: [
      `Abre el chat del bot (${ASSISTANT_BOT}) en Telegram.`,
      'Envíale un audio o texto: "Crea un cliente, Mariana López, teléfono 55 1234 5678, llamarla en 4 horas".',
      "El asistente lo registra al instante en el CRM y te confirma. Ideal manejando o saliendo de una reunión.",
    ],
  },
  {
    id: "actualizar-expediente", label: "Actualizar expediente", icon: "FileText", color: "#60A5FA", kind: "pedis",
    where: "Desde el chat del bot en Telegram",
    tagline: "Cuéntale qué pasó con el cliente y lo guarda en su expediente al instante.",
    how: [
      "En el chat del bot en Telegram, escribe o envía un audio con la novedad.",
      'Ejemplo: "Anota en Felipe que pidió ver dos propiedades más en la zona norte".',
      "Queda en el expediente del cliente, con fecha y hora — sin abrir el CRM.",
    ],
  },
  {
    id: "agendar-zoom", label: "Agendar Zoom", icon: "Video", color: "#A78BFA", kind: "pedis",
    where: "Desde el chat del bot en Telegram",
    tagline: "Programa la videollamada; el sistema te recuerda antes de que empiece.",
    how: [
      'En el chat del bot, dile: "Agenda el Zoom de Carlos para el viernes a las 11am".',
      "Antes del Zoom te llega un aviso al Telegram + la ficha del cliente (briefing).",
    ],
  },
  {
    id: "agendar-visita", label: "Agendar visita", icon: "MapPin", color: "#F59E0B", kind: "pedis",
    where: "Desde el chat del bot en Telegram",
    tagline: "Coordina la visita a la propiedad, con recordatorios automáticos.",
    how: [
      'En el chat del bot: "Agenda una visita con Diana el sábado 4pm en Portofino".',
      "El asistente te avisa 30, 15 y 7 días antes, y el día de la visita.",
    ],
  },
  {
    id: "mover-etapa", label: "Mover de etapa", icon: "GitBranch", color: "#34D399", kind: "pedis",
    where: "Desde Telegram o arrastrando en el CRM",
    tagline: "Avanza al cliente en el pipeline con una frase (o desde el tablero).",
    how: [
      'Por Telegram: "Pasa a Felipe a Seguimiento" · "mueve a Diana a Zoom Concretado".',
      "O en el CRM web: arrastra la tarjeta del cliente a la columna nueva. Queda registrado igual.",
    ],
  },
  {
    id: "buscar-ficha", label: "Buscar ficha", icon: "Search", color: "#22D3EE", kind: "pedis",
    where: "Desde Telegram o el buscador del CRM",
    tagline: "Pide la ficha, las notas y el expediente completo de cualquier cliente.",
    how: [
      'Por Telegram: "Busca a Diana" · "muéstrame el expediente de Carlos Ruiz".',
      "O usa la lupa del CRM web. Te devuelve sus datos, etapa, historial y próxima acción.",
    ],
  },
  {
    id: "kpis", label: "Tus números", icon: "BarChart3", color: "#818CF8", kind: "pedis",
    where: "Desde el chat del bot en Telegram",
    tagline: "Consulta tus KPIs, tu agenda del día y tu pipeline al instante.",
    how: [
      'En el chat del bot: "¿Cuántos clientes tengo en pipeline?" · "¿Qué tengo hoy?".',
      "Respuesta directa en el chat, sin entrar al CRM ni armar reportes.",
    ],
  },
  {
    id: "recordatorio", label: "Recordatorios", icon: "Bell", color: "#FB7185", kind: "pedis",
    where: "Desde el chat del bot en Telegram",
    tagline: "Pídele que te recuerde cualquier cosa, a la hora que tú pidas.",
    how: [
      'En el chat del bot: "Recuérdame enviarle la propuesta a Felipe mañana a las 10".',
      "Te llega el aviso puntual por Telegram. También puedes pedirlo por audio.",
    ],
  },

  /* ─── Lo que los AGENTES hacen SOLOS ───────────────────────────── */
  {
    id: "briefing", label: "Briefing pre-Zoom", icon: "Sparkles", color: "#6EE7C2", kind: "agente",
    where: "Automático → te llega al Telegram",
    tagline: "Antes de cada Zoom te llega la ficha del cliente para llegar preparado.",
    how: [
      "No hay que pedirlo: el sistema lo manda solo a tu Telegram antes de la reunión.",
      "Te resume quién es el cliente, en qué está y qué conviene decirle.",
    ],
  },
  {
    id: "reactivador", label: "Reactivar dormidos", icon: "Zap", color: "#F59E0B", kind: "agente",
    where: "Automático → aviso al Telegram",
    tagline: "Detecta clientes fríos y te arma el mensaje para reactivarlos.",
    how: [
      "El sistema encuentra los leads sin movimiento y te avisa por Telegram con un texto ya redactado.",
      'Haces clic en "Abrir WhatsApp" y puedes enviárselo (o editarlo antes de enviar).',
    ],
  },
  {
    id: "score", label: "Score automático", icon: "Gauge", color: "#F43F5E", kind: "agente",
    where: "Automático → lo ves en el CRM",
    tagline: "Cada lead se califica solo y marca los más calientes (HOT).",
    how: [
      "En el CRM web, cada tarjeta muestra el SCORE y la etiqueta HOT — se calculan solos.",
      "Se recalcula al avanzar (Zoom, seguimiento, presupuesto). Priorizas sin adivinar.",
    ],
  },
  {
    id: "coach", label: "Coach de tareas", icon: "UsersRound", color: "#A78BFA", kind: "agente",
    where: "Automático → aviso al Telegram",
    tagline: 'El asistente te persigue: "¿ya la hiciste?" para que nada se caiga.',
    how: [
      "Te recuerda por Telegram tus acciones pendientes y las de equipo hasta que las cierres.",
      "Si algo queda sin hacer, escala al admin (para los que son admin).",
    ],
  },
];

/** Íconos lucide-react usados por el carrusel (para importar solo lo necesario). */
export const INTEL_ICON_NAMES = [
  "Mic", "FileText", "Video", "MapPin", "GitBranch", "Search",
  "BarChart3", "Bell", "Sparkles", "Zap", "Gauge", "UsersRound",
];
