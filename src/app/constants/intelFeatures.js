/**
 * app/constants/intelFeatures.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogo de funciones del Centro de Inteligencia (Dynamic Island).
 * Alimenta el CARRUSEL de "Qué puede hacer el sistema" + el mini-TUTORIAL de cada una.
 *
 * Contenido curado a partir del manual del asistente (src/landing/manual-telegram-content.js)
 * — acá va la versión CORTA para el carrusel; el manual completo sigue siendo la fuente larga.
 *
 * Cada función:
 *   id       identificador único
 *   label    nombre corto (tarjeta)
 *   icon     nombre de ícono lucide-react (se resuelve en el componente)
 *   color    hex del acento de la tarjeta
 *   kind     'pedis'  = se lo pedís al asistente  ·  'agente' = lo hace solo
 *   tagline  una línea (qué hace)
 *   how      pasos / ejemplos de "cómo se usa" (para el tutorial)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const INTEL_FEATURES = [
  /* ─── Lo que le PEDÍS al asistente ─────────────────────────────── */
  {
    id: "registrar-voz", label: "Registrar por voz", icon: "Mic", color: "#6EE7C2", kind: "pedis",
    tagline: "Creá un cliente con un audio o un texto, sin abrir la computadora.",
    how: [
      '(audio) "Creá un cliente, Mariana López, teléfono 55 1234 5678, llamarla en 4 horas"',
      "El asistente lo registra al instante en tu CRM y te confirma.",
      "Ideal cuando vas manejando o saliendo de una reunión.",
    ],
  },
  {
    id: "actualizar-expediente", label: "Actualizar expediente", icon: "FileText", color: "#60A5FA", kind: "pedis",
    tagline: "Contale qué pasó con el cliente y lo guarda en su expediente al toque.",
    how: [
      '"Anotá en Felipe que pidió ver dos propiedades más en la zona norte"',
      "Queda en el expediente del cliente, con fecha y hora, sin que abras el CRM.",
    ],
  },
  {
    id: "agendar-zoom", label: "Agendar Zoom", icon: "Video", color: "#A78BFA", kind: "pedis",
    tagline: "Programá la videollamada; el sistema te recuerda antes de que empiece.",
    how: [
      '"Agendá el Zoom de Carlos para el viernes a las 11am"',
      "Antes del Zoom te llega un aviso + la ficha del cliente (briefing).",
    ],
  },
  {
    id: "agendar-visita", label: "Agendar visita", icon: "MapPin", color: "#F59E0B", kind: "pedis",
    tagline: "Coordiná la visita a la propiedad, con recordatorios automáticos.",
    how: [
      '"Agendá una visita con Diana el sábado 4pm en Portofino"',
      "El asistente te avisa 30, 15 y 7 días antes, y el día de la visita.",
    ],
  },
  {
    id: "mover-etapa", label: "Mover de etapa", icon: "GitBranch", color: "#34D399", kind: "pedis",
    tagline: "Avanzá al cliente en el pipeline con una sola frase.",
    how: [
      '"Pasá a Felipe a Seguimiento" · "mové a Diana a Zoom Concretado"',
      "El pipeline se actualiza solo y queda registrado.",
    ],
  },
  {
    id: "buscar-ficha", label: "Buscar ficha", icon: "Search", color: "#22D3EE", kind: "pedis",
    tagline: "Pedí la ficha, las notas y el expediente completo de cualquier cliente.",
    how: [
      '"Buscá a Diana" · "mostrame el expediente de Carlos Ruiz"',
      "Te devuelve sus datos, su etapa, su historial y su próxima acción.",
    ],
  },
  {
    id: "kpis", label: "Tus números", icon: "BarChart3", color: "#818CF8", kind: "pedis",
    tagline: "Consultá tus KPIs, tu agenda del día y tu pipeline al instante.",
    how: [
      '"¿Cuántos clientes tengo en pipeline?" · "¿Qué tengo hoy?"',
      "Respuesta directa, sin entrar al CRM ni armar reportes.",
    ],
  },
  {
    id: "recordatorio", label: "Recordatorios", icon: "Bell", color: "#FB7185", kind: "pedis",
    tagline: "Pedile que te recuerde cualquier cosa, a la hora que vos digas.",
    how: [
      '"Recordame mandarle la propuesta a Felipe mañana a las 10"',
      "Te llega el aviso puntual por Telegram. También en audio.",
    ],
  },

  /* ─── Lo que los AGENTES hacen SOLOS ───────────────────────────── */
  {
    id: "briefing", label: "Briefing pre-Zoom", icon: "Sparkles", color: "#6EE7C2", kind: "agente",
    tagline: "Antes de cada Zoom te llega la ficha del cliente para llegar preparado.",
    how: [
      "No hay que pedirlo: el sistema lo manda solo antes de la reunión.",
      "Te resume quién es el cliente, en qué está y qué conviene decirle.",
    ],
  },
  {
    id: "reactivador", label: "Reactivar dormidos", icon: "Zap", color: "#F59E0B", kind: "agente",
    tagline: "Detecta clientes fríos y te arma el mensaje para reactivarlos.",
    how: [
      "El sistema encuentra los leads sin movimiento y te propone un texto personalizado.",
      'Con un toque en "Abrir WhatsApp" se lo mandás (podés editarlo antes).',
    ],
  },
  {
    id: "score", label: "Score automático", icon: "Gauge", color: "#F43F5E", kind: "agente",
    tagline: "Cada lead se califica solo y marca los más calientes (HOT).",
    how: [
      "Se recalcula al avanzar en el pipeline (Zoom, seguimiento, presupuesto…).",
      "Priorizás sin adivinar: el sistema te dice a quién llamar primero.",
    ],
  },
  {
    id: "coach", label: "Coach de tareas", icon: "UsersRound", color: "#A78BFA", kind: "agente",
    tagline: 'El asistente te persigue: "¿ya la hiciste?" para que nada se caiga.',
    how: [
      "Te recuerda tus acciones pendientes y las de equipo hasta que las cierres.",
      "Si algo queda sin hacer, escala al admin (para los que son admin).",
    ],
  },
];

/** Íconos lucide-react usados por el carrusel (para importar solo lo necesario). */
export const INTEL_ICON_NAMES = [
  "Mic", "FileText", "Video", "MapPin", "GitBranch", "Search",
  "BarChart3", "Bell", "Sparkles", "Zap", "Gauge", "UsersRound",
];
