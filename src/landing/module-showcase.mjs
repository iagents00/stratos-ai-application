export const MODULE_ROTATION_MS = 2800;

export const moduleScreenshotSrc = id => id === "copilot"
  ? "/marketing/modules/copilot-closeup-20261016/copilot.webp"
  : `/marketing/modules/framed-20261016/${id}.webp`;

export const SHOWCASE_MODULES = [
  {
    id: "copilot", name: "Copilot", title: "El contexto de tu operación, a una pregunta.",
    description: "Un asistente para consultar información y preparar el trabajo que sigue.",
    capabilities: [
      ["Consulta con contexto", "Encuentra clientes, pendientes y próximos pasos de tu empresa."],
      ["Prepara el seguimiento", "Reúne la información que necesitas antes de una conversación."],
      ["Organiza tu trabajo", "Consulta y registra tareas desde el mismo espacio."],
    ],
  },
  {
    id: "crm", name: "CRM", title: "Cada cliente, con un siguiente paso claro.",
    description: "Mantén la cartera y su seguimiento en un solo lugar.",
    capabilities: [
      ["Cartera organizada", "Busca clientes y consulta su información de contacto."],
      ["Proceso comercial", "Da seguimiento por etapas y asigna responsables."],
      ["Expediente y agenda", "Conserva notas, actividad y la próxima acción de cada cliente."],
    ],
  },
  {
    id: "mi-espacio", name: "Mi Espacio", title: "Tu agenda y el contexto para avanzar.",
    description: "Reúne tus actividades, documentos y la guía de trabajo de tu empresa.",
    capabilities: [
      ["Agenda personal y profesional", "Organiza tus actividades y próximas acciones."],
      ["Documentos del equipo", "Accede al material de trabajo disponible para tu área."],
      ["Plan estratégico y protocolo", "Consulta los objetivos y la guía de trabajo de tu empresa."],
    ],
  },
  {
    id: "metricas", name: "Métricas", title: "Entiende qué está avanzando.",
    description: "Consulta la actividad y los resultados de tu operación por periodo.",
    capabilities: [
      ["Actividad del equipo", "Revisa el seguimiento registrado por tus asesores."],
      ["Actividad por etapas", "Observa la cartera y sus hitos registrados."],
      ["Histórico por periodo", "Revisa los registros y avances del rango que elijas."],
    ],
  },
  {
    id: "comando", name: "Comando", title: "Una vista para decidir por dónde seguir.",
    description: "Reúne la información comercial que necesita la dirección.",
    capabilities: [
      ["Panorama de la cartera", "Consulta el estado de los clientes y oportunidades."],
      ["Prioridades del equipo", "Identifica el trabajo pendiente y los siguientes pasos."],
      ["Seguimiento del desempeño", "Revisa la actividad y evolución del proceso comercial."],
    ],
  },
  {
    id: "iagents", name: "iAgents", title: "Explora agentes para cada parte del proceso.",
    description: "Conoce el catálogo de agentes y las tareas contempladas para tu equipo.",
    capabilities: [
      ["Agentes por tarea", "Explora funciones de calificación, seguimiento y preparación."],
      ["Canales de atención", "Revisa los canales contemplados para tu operación."],
      ["Seguimiento de actividad", "Consulta el contexto de trabajo de cada agente."],
    ],
  },
];

export function moduleIndexForKey(current, key, count) {
  if (count < 1) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  return null;
}

// The same controller drives the browser and clock-based tests. Every resume
// begins a full 2.8-second interval; hidden time never creates a catch-up jump.
export function createModuleRotation({ count, onUpdate, initialIndex = 0, pauseReasons = [], reducedMotion = false, timers = globalThis }) {
  let index = initialIndex;
  let timer = null;
  let destroyed = false;
  let motionReduced = !!reducedMotion;
  const reasons = new Set(pauseReasons);
  const snapshot = () => ({ index, paused: reasons.size > 0, reducedMotion: motionReduced });
  const emit = () => { if (!destroyed) onUpdate(snapshot()); };
  const schedule = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    if (destroyed || count < 2 || reasons.size) return;
    timer = timers.setTimeout(() => {
      timer = null;
      if (destroyed || reasons.size) return;
      index = (index + 1) % count;
      emit(); schedule();
    }, MODULE_ROTATION_MS);
  };
  const setPaused = (reason, paused) => {
    if (destroyed || reasons.has(reason) === paused) return;
    if (paused) reasons.add(reason); else reasons.delete(reason);
    emit(); schedule();
  };
  emit(); schedule();
  return {
    setPaused,
    setReducedMotion(value) {
      if (destroyed || motionReduced === !!value) return;
      motionReduced = !!value;
      emit();
    },
    select(nextIndex) {
      if (destroyed || !Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= count) return;
      // A selection restarts the interval without overriding independent
      // interaction or environment pauses; there is no sticky manual mode.
      index = nextIndex; emit(); schedule();
    },
    snapshot,
    destroy() { destroyed = true; if (timer !== null) timers.clearTimeout(timer); timer = null; },
  };
}
