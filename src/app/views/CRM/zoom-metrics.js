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
// Etapas que implican "hubo un Zoom agendado": la etapa de agenda y el no-show
// (Reactivar Zoom = se agendó pero el cliente no asistió; sin este set el
// no-show desaparecía del conteo de agendados).
const ZOOM_SCHEDULED_STAGES = new Set([ZOOM_SCHEDULED_STAGE, "Reactivar Zoom"]);

// "Entró al funnel de Zoom" = se agendó un Zoom (etapa Zoom Agendado) O ya hizo
// el Zoom (etapa posterior). Clave para el conteo de AGENDADOS del embudo: si un
// lead hizo el Zoom, necesariamente fue agendado, aunque ese paso no se haya
// marcado. Así "agendados" SIEMPRE es ≥ "realizados" y el embudo tiene sentido.
export const ZOOM_FUNNEL_ENTRY_STAGES = new Set([...ZOOM_SCHEDULED_STAGES, ...ZOOM_DONE_STAGES]);

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

// Etiqueta bajo la que se AGRUPAN las cuentas ocultas en las tablas por asesor.
// Sus leads y Zooms SÍ cuentan en todos los totales (si no, el "Leads totales"
// del Comando no cuadra con el "Clientes en Pipeline" del CRM — el cliente vio
// 1485 en el pipeline y menos en el Comando); solo se colapsan como una fila
// para no ensuciar la tabla con nombres de ex-asesores / cuentas de prueba.
export const INACTIVE_ADVISOR_GROUP = "Cuentas inactivas";
export function advisorDisplayGroup(name) {
  return isHiddenAdvisor(name) ? INACTIVE_ADVISOR_GROUP : name;
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
  // OJO: el historial se guarda con lo MÁS RECIENTE arriba (el CRM hace
  // prepend de eventos nuevos), así que NO basta tomar el primer match del
  // array — ese es el último movimiento, no el hito original. Nos quedamos
  // con el evento de fecha MÁS ANTIGUA; si no, cada movimiento posterior
  // dentro del set (ej. Seguimiento → Apartó) re-fecha el Zoom al presente,
  // infla los conteos del período actual y acredita al asesor equivocado.
  let earliest = null;
  let earliestTs = Infinity;
  let undated = null;
  for (const e of hist) {
    if (!e || e.type !== "etapa") continue;
    const t = targetStage(e.action);
    if (!t || !stageSet.has(t)) continue;
    const at = e.completed_at || e.doneAt || e.done_at || e.created_at || null;
    const hit = {
      by: e.by || lead.asesor || NO_OWNER,
      at,
      to: t,
      inferred: false,
      confidence: "confirmed",
    };
    const ts = at ? new Date(at).getTime() : NaN;
    if (Number.isFinite(ts)) {
      if (ts < earliestTs) { earliestTs = ts; earliest = hit; }
    } else {
      // Sin fecha parseable: respaldo. Con prepend, el último match del
      // recorrido es el más antiguo del historial.
      undated = hit;
    }
  }
  if (earliest || undated) return earliest || undated;
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

// Etapas donde la "próxima acción" del lead ES la cita de Zoom: solo en ellas
// selected_time (Cal.com) / next_action_at representan la fecha del Zoom. En
// cualquier otra etapa esos campos son recordatorios genéricos — p.ej. la
// llamada de rescate a +5 min que el flujo de entrada setea en TODOS los leads
// nuevos, o la fecha de una visita — y NO deben tocar la métrica de Zooms.
const ZOOM_CITA_STAGES = new Set(["Zoom Agendado", "Reactivar Zoom", "Zoom Concretado"]);

/**
 * { scheduled, done } de un lead: hito de "Zoom agendado" y de "Zoom realizado"
 * (Concretado o etapa posterior). Cada uno { by, at, to, inferred } o null.
 *
 * La cita real (selected_time / next_action_at) solo REFINA la fecha de un
 * hito que ya existe por etapa/historial — nunca lo crea. La versión anterior
 * contaba como "Zoom agendado" a cualquier lead con next_action_at seteado,
 * aunque jamás pisara el funnel de Zoom: eso inflaba los agendados hasta casi
 * igualar el total de leads registrados.
 */
export function zoomEventsOf(lead) {
  const stageScheduled = milestoneOf(lead, ZOOM_SCHEDULED_STAGES);
  const stageDone = milestoneOf(lead, ZOOM_DONE_STAGES);

  let scheduled = stageScheduled;
  if (stageScheduled) {
    const current = normalizeStage(lead.st);
    const apptAt = ZOOM_CITA_STAGES.has(current)
      ? (lead.selected_time || lead.next_action_at || null)
      : null;
    if (apptAt) {
      scheduled = { ...stageScheduled, at: apptAt, inferred: false, confidence: "appointment" };
    }
  }

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

