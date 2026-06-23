/**
 * CRM/zoom-metrics.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fuente ÚNICA de verdad para la métrica de Zooms del CRM. La consumen tanto
 * AdvisorMetrics (tabla de indicadores + lista Filtro 2) como ZoomBoard (espacio
 * "Control de Zooms" del Comando Directivo).
 *
 * Por qué pipeline + historial y no la tabla `zoom_agendados`: esa tabla
 * (migración 027) y los campos de Cal.com NO existen / están vacíos en
 * producción (Jun 2026). La única señal real de Zoom es `leads.stage` +
 * `leads.action_history`.
 *
 * Definición de "realizó Zoom": el lead entró ALGUNA VEZ a Zoom Concretado o a
 * una etapa posterior (Seguimiento/Apartó/Visita Agendada/Cierre/Postventa) —
 * NO solo los que hoy siguen en esa etapa. La mayoría de los que pasaron por
 * Zoom avanzan a etapas posteriores; otros retroceden o se reasignan. Contamos
 * el historial, no la foto actual, y el crédito va a QUIÉN dio el Zoom (campo
 * `by` del evento de etapa), así no se pierde con las reasignaciones.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Etapas que implican "el Zoom ya se realizó".
export const ZOOM_DONE_STAGES = new Set([
  "Zoom Concretado", "Seguimiento", "Apartó", "Visita Agendada", "Cierre", "Postventa",
]);
export const ZOOM_SCHEDULED_STAGE = "Zoom Agendado";

// Extrae la etapa destino de un evento "Etapa: X → Y".
function targetStage(action) {
  if (typeof action !== "string") return null;
  const parts = action.split("→");
  return parts.length > 1 ? parts[parts.length - 1].trim() : null;
}

/**
 * Para un lead, el PRIMER evento de historial que lo llevó a Zoom Agendado y a
 * una etapa post-Zoom, con su autor (`by` = quién lo dio) y fecha. Si no hay
 * historial pero la etapa ACTUAL ya es de Zoom (leads sembrados o pre-historial),
 * cae al dueño actual con la fecha de creación.
 */
export function zoomEventsOf(lead) {
  const hist = Array.isArray(lead.actionHistory) ? lead.actionHistory : [];
  let scheduled = null, done = null;
  for (const e of hist) {
    if (!e || e.type !== "etapa") continue;
    const t = targetStage(e.action);
    if (!t) continue;
    const at = e.completed_at || e.doneAt || null;
    if (t === ZOOM_SCHEDULED_STAGE && !scheduled) scheduled = { by: e.by || lead.asesor, at };
    if (ZOOM_DONE_STAGES.has(t) && !done)          done      = { by: e.by || lead.asesor, at };
  }
  if (!scheduled && lead.st === ZOOM_SCHEDULED_STAGE) scheduled = { by: lead.asesor, at: lead.created_at };
  if (!done && ZOOM_DONE_STAGES.has(lead.st))         done      = { by: lead.asesor, at: lead.created_at };
  return { scheduled, done };
}

// ¿El evento (por su fecha) cae dentro del período seleccionado?
export function eventInPeriod(at, startTs) {
  if (startTs === null) return true;
  if (!at) return false;
  const t = new Date(at).getTime();
  return !Number.isNaN(t) && t >= startTs;
}
