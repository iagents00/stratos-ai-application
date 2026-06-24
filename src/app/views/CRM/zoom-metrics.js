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
// Set de un solo elemento para reutilizar el helper genérico milestoneOf.
const ZOOM_SCHEDULED_STAGES = new Set([ZOOM_SCHEDULED_STAGE]);

// "Entró al funnel de Zoom" = se agendó un Zoom (etapa Zoom Agendado) O ya hizo
// el Zoom (etapa posterior). Clave para el conteo de AGENDADOS del embudo: si un
// lead hizo el Zoom, necesariamente fue agendado, aunque ese paso no se haya
// marcado. Así "agendados" SIEMPRE es ≥ "realizados" y el embudo tiene sentido.
export const ZOOM_FUNNEL_ENTRY_STAGES = new Set([ZOOM_SCHEDULED_STAGE, ...ZOOM_DONE_STAGES]);

// Hitos posteriores al Zoom (funnel Realizado → Recorrido → Cierre).
export const RECORRIDO_STAGES = new Set(["Visita Agendada"]);              // visita/recorrido dado
export const CIERRE_STAGES    = new Set(["Apartó", "Cierre", "Postventa"]); // milestone de cierre

// Etapas "activas post-Zoom" (cliente que ya hizo el Zoom y sigue activo en el
// cierre, no terminal). Fuente única para que todos los paneles cuenten igual.
// INCLUYE "Zoom Concretado" (hay leads reales ahí); excluye solo "Postventa".
export const ACTIVE_POST_ZOOM_STAGES = new Set([
  "Zoom Concretado", "Seguimiento", "Apartó", "Visita Agendada", "Cierre",
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
 * Hito de un lead respecto a un conjunto de etapas: el PRIMER evento de historial
 * que lo llevó a una etapa de `stageSet`, con su autor (`by` = quién lo movió) y
 * fecha. Si no hay evento pero la etapa ACTUAL ya está en el set, se infiere
 * (`inferred:true`) y se acredita al dueño actual con la fecha de creación.
 * Devuelve { by, at, to, inferred } o null. Base común de toda la métrica de Zoom.
 */
export function milestoneOf(lead, stageSet) {
  const hist = Array.isArray(lead.actionHistory) ? lead.actionHistory : [];
  for (const e of hist) {
    if (!e || e.type !== "etapa") continue;
    const t = targetStage(e.action);
    if (t && stageSet.has(t)) {
      return { by: e.by || lead.asesor || NO_OWNER, at: e.completed_at || e.doneAt || null, to: t, inferred: false };
    }
  }
  if (stageSet.has(lead.st)) {
    return { by: lead.asesor || NO_OWNER, at: lead.created_at, to: lead.st, inferred: true };
  }
  return null;
}

/**
 * { scheduled, done } de un lead: hito de "Zoom agendado" y de "Zoom realizado"
 * (Concretado o etapa posterior). Cada uno { by, at, to, inferred } o null.
 */
export function zoomEventsOf(lead) {
  return {
    scheduled: milestoneOf(lead, ZOOM_SCHEDULED_STAGES),
    done:      milestoneOf(lead, ZOOM_DONE_STAGES),
  };
}

// Hito de "entró al funnel de Zoom" (agendado o ya realizado). Úsalo para el
// conteo de AGENDADOS del embudo, para que sea siempre ≥ realizados.
export function funnelEntryOf(lead) {
  return milestoneOf(lead, ZOOM_FUNNEL_ENTRY_STAGES);
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
