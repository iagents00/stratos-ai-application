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

// Etapas "activas post-Zoom" (cliente en proceso de cierre, ya pasó el Zoom y no
// es terminal). Fuente única para que todos los paneles cuenten lo mismo. Excluye
// "Zoom Concretado" (se consolidó en Seguimiento post-Mayo 2026) y "Postventa".
export const ACTIVE_POST_ZOOM_STAGES = new Set([
  "Seguimiento", "Apartó", "Visita Agendada", "Cierre",
]);

// Crédito por defecto cuando no hay autor ni dueño (evita divergencias de conteo
// entre paneles: unos descartaban el evento y otros lo contaban bajo "—").
const NO_OWNER = "—";

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
    if (t === ZOOM_SCHEDULED_STAGE && !scheduled) scheduled = { by: e.by || lead.asesor || NO_OWNER, at, to: t, inferred: false };
    if (ZOOM_DONE_STAGES.has(t) && !done)          done      = { by: e.by || lead.asesor || NO_OWNER, at, to: t, inferred: false };
  }
  // Inferencia: la etapa ACTUAL ya es de Zoom pero no hay movimiento registrado
  // (el asesor no marcó el paso). Lo deducimos y lo señalamos como `inferred`,
  // para recuperar los Zooms mal registrados sin inventar datos.
  if (!scheduled && lead.st === ZOOM_SCHEDULED_STAGE) scheduled = { by: lead.asesor || NO_OWNER, at: lead.created_at, to: lead.st, inferred: true };
  if (!done && ZOOM_DONE_STAGES.has(lead.st))         done      = { by: lead.asesor || NO_OWNER, at: lead.created_at, to: lead.st, inferred: true };
  return { scheduled, done };
}

/**
 * Aplana el historial de movimientos de Zoom de toda la cartera: una fila por
 * hito (agendado y/o realizado) por lead. Cada fila trae el lead, el tipo, quién
 * lo dio, la fecha y si fue inferido (etapa actual implica Zoom, sin movimiento
 * registrado). Es la evidencia cruda para visualizar TODOS los que pasaron por
 * Zoom agendado o realizado, aunque hoy estén en una etapa posterior.
 */
export function zoomMovements(leadsData) {
  const out = [];
  for (const l of leadsData) {
    const { scheduled, done } = zoomEventsOf(l);
    if (scheduled) out.push({ lead: l, kind: "scheduled", by: scheduled.by, at: scheduled.at, inferred: scheduled.inferred });
    if (done)      out.push({ lead: l, kind: "done",      by: done.by,      at: done.at,      inferred: done.inferred });
  }
  return out;
}

// ¿El evento (por su fecha) cae dentro del período seleccionado?
export function eventInPeriod(at, startTs) {
  if (startTs === null) return true;
  if (!at) return false;
  const t = new Date(at).getTime();
  return !Number.isNaN(t) && t >= startTs;
}
