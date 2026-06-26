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
import { normalizeStage } from "../../../design-system/tokens";

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

// Cuentas de prueba / sistema / inactivas que NO deben aparecer en los tableros
// de métricas del Comando (ni como filas ni en los totales). Se comparan
// normalizadas (sin acentos, minúsculas), tolerando sufijos: "Ken Lugo" cubre
// "Ken Lugo Ríos"; "iAgents" cubre "iAgents00".
const HIDDEN_ADVISORS = ["ken lugo", "iagents", "daniel pavon", "asesor prueba", "araceli oneto"];
function normAdvisor(s) {
  return (s == null ? "" : String(s))
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}
export function isHiddenAdvisor(name) {
  const n = normAdvisor(name);
  if (!n) return false;
  return HIDDEN_ADVISORS.some(h =>
    n === h || n.startsWith(h + " ") || (!h.includes(" ") && n.startsWith(h)),
  );
}

// Extrae la etapa destino de un evento "Etapa: X → Y", normalizada al nombre
// canónico (etiquetas viejas como "Visita Concretada"/"Negociación" → "Seguimiento")
// para no perder Zooms registrados con labels legacy.
function targetStage(action) {
  if (typeof action !== "string") return null;
  const parts = action.split("→");
  if (parts.length < 2) return null;
  return normalizeStage(parts[parts.length - 1].trim());
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
      return {
        by: e.by || lead.asesor || NO_OWNER,
        at: e.completed_at || e.doneAt || e.done_at || e.created_at || null,
        to: t,
        inferred: false,
        confidence: "confirmed",
      };
    }
  }
  const currentStage = normalizeStage(lead.st);
  if (stageSet.has(currentStage)) {
    return {
      by: lead.asesor || NO_OWNER,
      at: null,
      to: currentStage,
      inferred: true,
      confidence: "inferred",
    };
  }
  return null;
}

/**
 * { scheduled, done } de un lead: hito de "Zoom agendado" y de "Zoom realizado"
 * (Concretado o etapa posterior). Cada uno { by, at, to, inferred } o null.
 */
export function zoomEventsOf(lead) {
  const stageScheduled = milestoneOf(lead, ZOOM_SCHEDULED_STAGES);
  const stageDone = milestoneOf(lead, ZOOM_DONE_STAGES);
  const scheduledAt = lead.selected_time || lead.next_action_at || stageScheduled?.at || null;
  const scheduled = scheduledAt
    ? {
        by: stageScheduled?.by || lead.asesor || NO_OWNER,
        at: scheduledAt,
        to: ZOOM_SCHEDULED_STAGE,
        inferred: false,
        confidence: lead.selected_time || lead.next_action_at ? "appointment" : "confirmed",
      }
    : stageScheduled;

  return {
    scheduled,
    done: stageDone,
  };
}

// Hito de "entró al funnel de Zoom" (agendado o ya realizado). Úsalo para el
// conteo de AGENDADOS del embudo, para que sea siempre ≥ realizados.
export function funnelEntryOf(lead) {
  const { scheduled, done } = zoomEventsOf(lead);
  return scheduled || (done ? { ...done, inferred: true, confidence: "inferred_schedule" } : null);
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

export function eventInDateRange(event, range) {
  if (!event) return false;
  if (!range || range.fromTs === null) return true;
  if (event.inferred || !event.at) return false;
  const timestamp = new Date(event.at).getTime();
  return !Number.isNaN(timestamp) && timestamp >= range.fromTs && timestamp < range.toTs;
}

export function zoomDataQuality(leadsData) {
  let confirmedDone = 0;
  let inferredDone = 0;
  let scheduledWithDate = 0;
  let scheduledWithoutDate = 0;
  let completedWithoutNotes = 0;

  for (const lead of leadsData) {
    const { scheduled, done } = zoomEventsOf(lead);
    if (scheduled?.at && !scheduled.inferred) scheduledWithDate++;
    else if (scheduled) scheduledWithoutDate++;

    if (done?.inferred || !done?.at) inferredDone++;
    else if (done) confirmedDone++;

    if (done && !(lead.notas || "").trim()) completedWithoutNotes++;
  }

  return {
    confirmedDone,
    inferredDone,
    scheduledWithDate,
    scheduledWithoutDate,
    completedWithoutNotes,
  };
}
