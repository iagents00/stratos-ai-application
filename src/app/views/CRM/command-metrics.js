import { STAGES, normalizeStage } from "../../../design-system/tokens.js";
import { ACTIVE_POST_ZOOM_STAGES, advisorDisplayGroup, INACTIVE_ADVISOR_GROUP, funnelEntryOf, zoomEventsOf } from "./zoom-metrics.js";
import { dateInputValue, timestampInRange, toTimestamp } from "./date-range.js";

const MANAGED_STAGES = new Set(STAGES.filter(stage => stage !== "Contáctame Ya"));
const FOLLOWING_STAGES = new Set(["Seguimiento", "Largo Plazo", "Apartó", "Visita Agendada", "Cierre", "Postventa"]);
const counter = value => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;

// Stage-based indicators do not prove a successful contact or a qualification interview.
export const INDICATOR_DEFINITIONS = [
  { key: "assigned", label: "Asignados", title: "Leads creados en el período con asesor asignado.", compute: leads => leads.filter(l => String(l.asesor || "").trim() && l.asesor !== "—").length },
  { key: "contacted", label: "Gestionados", title: "Leads del período en una etapa posterior a Contáctame Ya. Incluye intentos; no confirma contacto efectivo.", compute: leads => leads.filter(l => MANAGED_STAGES.has(normalizeStage(l.st))).length },
  { key: "qualified", label: "Seguimiento+", title: "Leads del período actualmente en Seguimiento, Largo Plazo, Apartó, Visita Agendada, Cierre o Postventa. No equivale a una calificación verificada.", compute: leads => leads.filter(l => FOLLOWING_STAGES.has(normalizeStage(l.st))).length },
  { key: "zoomScheduled", label: "Zooms Ag.", title: "Primer hito de agenda por lead, por fecha y autor del movimiento. Incluye agenda inferida si sólo consta la realización. Sin fecha: sólo Histórico.", compute: leads => leads.filter(l => funnelEntryOf(l)).length },
  { key: "zoomDone", label: "Zooms Real.", title: "Primer hito de Zoom Concretado o etapa posterior por lead, por fecha y autor del movimiento. Es evidencia del pipeline, no una asistencia verificada.", compute: leads => leads.filter(l => zoomEventsOf(l).done).length },
  { key: "activePostZoom", label: "Activos", title: "Leads creados en el período que hoy están en Zoom Concretado, Seguimiento, Apartó, Visita Agendada o Cierre.", compute: leads => leads.filter(l => ACTIVE_POST_ZOOM_STAGES.has(normalizeStage(l.st))).length },
  { key: "followUps", label: "Seguim.", title: "Seguimientos acumulados de los leads creados en el período; no son acciones realizadas exclusivamente en esas fechas.", compute: leads => leads.reduce((sum, l) => sum + counter(l.seguimientos), 0) },
];

export const computeIndicators = leads => Object.fromEntries(INDICATOR_DEFINITIONS.map(i => [i.key, i.compute(leads)]));
export const percentage = (numerator, denominator) => denominator > 0 ? Math.round(numerator / denominator * 100) : null;

export function aggregateCommandMetrics(leadsData, range) {
  const leads = leadsData.filter(l => !l.deleted_at);
  const cohort = leads.filter(l => timestampInRange(l.created_at, range));
  const people = new Map();
  const person = name => {
    const key = advisorDisplayGroup(name);
    if (!people.has(key)) people.set(key, { asesor: key, leads: [], scheduled: 0, done: 0 });
    return people.get(key);
  };
  for (const lead of cohort) person(lead.asesor).leads.push(lead);
  for (const lead of leads) {
    const entry = funnelEntryOf(lead);
    const { done } = zoomEventsOf(lead);
    if (entry && timestampInRange(entry.at, range)) person(entry.by).scheduled++;
    if (done && timestampInRange(done.at, range)) person(done.by).done++;
  }
  const rows = [...people.values()].map(p => ({
    asesor: p.asesor, count: p.leads.length,
    metrics: { ...computeIndicators(p.leads), zoomScheduled: p.scheduled, zoomDone: p.done },
  })).sort((a, b) => {
    if (a.asesor === INACTIVE_ADVISOR_GROUP) return 1;
    if (b.asesor === INACTIVE_ADVISOR_GROUP) return -1;
    return a.asesor.localeCompare(b.asesor, "es");
  });
  const totals = Object.fromEntries(INDICATOR_DEFINITIONS.map(i => [i.key, rows.reduce((sum, row) => sum + row.metrics[i.key], 0)]));
  return { cohort, rows, totals };
}

// Full historical extent, with a separate bucket for unknown dates.
export function buildMetricBuckets(granularity, range, dates = [], now = new Date()) {
  const timestamps = dates.map(toTimestamp);
  const dated = timestamps.filter(ts => ts !== null);
  const all = !range || range.fromTs === null;
  let fromTs = range?.fromTs;
  let toTs = range?.toTs;
  if (all && dated.length) {
    fromTs = dated.reduce((a, b) => Math.min(a, b), Infinity);
    const last = new Date(dated.reduce((a, b) => Math.max(a, b), -Infinity));
    toTs = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getTime();
  }
  const out = [];
  if (fromTs != null && toTs != null) {
    const first = new Date(fromTs);
    let cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    if (granularity === "month") cursor.setDate(1);
    if (granularity === "week") cursor.setDate(cursor.getDate() - (cursor.getDay() + 6) % 7);
    while (cursor.getTime() < toTs) {
      const start = new Date(cursor);
      const end = granularity === "month"
        ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + (granularity === "week" ? 7 : 1));
      const key = dateInputValue(start);
      const label = start.toLocaleDateString("es-MX", granularity === "month" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" });
      const startTs = Math.max(start.getTime(), fromTs);
      const endTs = Math.min(end.getTime(), toTs);
      out.push({ key, label, tooltipLabel: granularity === "week" ? `Semana del ${key}` : key, csvLabel: granularity === "month" ? key.slice(0, 7) : key, startTs, endTs, isCurrent: now.getTime() >= startTs && now.getTime() < endTs });
      cursor = end;
    }
  }
  if (all && timestamps.some(ts => ts === null)) out.push({ key: "undated", label: "Sin fecha", tooltipLabel: "Sin fecha registrada · sólo histórico", csvLabel: "Sin fecha", undated: true, isCurrent: false });
  return out;
}

export function buildMetricSeries(leadsData, buckets) {
  const leads = leadsData.filter(l => !l.deleted_at);
  const events = leads.map(lead => ({ scheduled: funnelEntryOf(lead), done: zoomEventsOf(lead).done }));
  return buckets.map(bucket => {
    const includes = at => bucket.undated ? toTimestamp(at) === null : timestampInRange(at, { fromTs: bucket.startTs, toTs: bucket.endTs });
    const metrics = computeIndicators(leads.filter(l => includes(l.created_at)));
    metrics.zoomScheduled = events.filter(e => e.scheduled && includes(e.scheduled.at)).length;
    metrics.zoomDone = events.filter(e => e.done && includes(e.done.at)).length;
    return { ...bucket, ...metrics };
  });
}

export function advisorReportRows(rows) {
  return rows.map(row => [row.asesor, row.count, ...INDICATOR_DEFINITIONS.map(i => row.metrics[i.key])]);
}
