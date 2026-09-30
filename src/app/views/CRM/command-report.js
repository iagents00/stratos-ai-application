import { INDICATOR_DEFINITIONS as INDICATORS, aggregateCommandMetrics, advisorReportRows, percentage } from "./command-metrics.js";
import { dateRangeLabel, dateInputValue } from "./date-range.js";
import { evolutionCols, asesorCols } from "../ComandoDirectivo.pdf.js";

export function createCommandReport({ leads, range, series, buckets, clientName, granularityLabel, labels, colors, now = new Date() }) {
  const visibleLeads = leads.filter(l => !l.deleted_at);
  const metrics = aggregateCommandMetrics(visibleLeads, range);
  const rangeTotals = metrics.totals;
  const snapshotTotals = aggregateCommandMetrics(visibleLeads, null).totals;
  const totalLeads = metrics.cohort.length;
  const asesores = metrics.rows.map(row => row.asesor);
  const tasaCalif = percentage(rangeTotals.qualified, totalLeads);
  const tasaZoomSobreCal = percentage(INDICATORS.find(i => i.key === "zoomDone").compute(metrics.cohort), totalLeads);
  const formatRate = value => value === null ? "—" : value + "%";
  const promedioSeguim = totalLeads ? (rangeTotals.followUps / totalLeads).toFixed(1) : "—";
  const stamp = dateInputValue(now);
  const hhmm = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
  const periodSpan = dateRangeLabel(range);
  const dailyNote = "Leads por fecha de creación. Zooms: primer hito por lead, fecha y autor del movimiento; sin fecha, sólo Histórico. Las otras columnas son el estado actual de esa cohorte. Seguimientos: acumulados. Cohorte con Zoom: leads nuevos con hito de realización / leads nuevos.";
  return {
      meta: {
        clientName: clientName,
        stamp, hhmm,
        granularityLabel: granularityLabel,
        periodsCount: buckets.length,
        periodSpan,
        totalLeadsPipeline: visibleLeads.length,
        asesoresCount: asesores.length,
      },
      pipelineCards: [
        { label: "Pipeline total",    value: String(visibleLeads.length),             sub: "leads en el CRM", color: "#10B981" },
        { label: "Zooms agendados",   value: String(snapshotTotals.zoomScheduled),  sub: "histórico del pipeline", color: colors.zoomScheduled },
        { label: "Zooms realizados",  value: String(snapshotTotals.zoomDone),       sub: "histórico del pipeline", color: colors.zoomDone },
        { label: "Activos post-Zoom", value: String(snapshotTotals.activePostZoom), sub: "estado actual",   color: colors.activePostZoom },
      ],
      rangeCards: [
        { label: "Leads nuevos",         value: String(totalLeads),     sub: "creados en el rango",        color: "#6EE7C2" },
        { label: "En seguimiento+", value: `${formatRate(tasaCalif)}`,        sub: `${rangeTotals.qualified} de ${totalLeads || 0}`, color: "#0EA5E9" },
        { label: "Cohorte con Zoom",    value: `${formatRate(tasaZoomSobreCal)}`, sub: "sobre leads nuevos",   color: "#2563EB" },
        { label: "Seguim. por lead",     value: String(promedioSeguim), sub: "acumulado de la cohorte",         color: "#EA580C" },
      ],
      indicators: INDICATORS.map(ind => ({
        label: labels[ind.key] || ind.label,
        value: rangeTotals[ind.key] || 0,
        color: colors[ind.key] || "#10B981",
      })),
      evolution: {
        title: `Evolución temporal  -  ${granularityLabel}`,
        note: dailyNote,
        cols: evolutionCols(INDICATORS.length),
        headers: ["Período", ...INDICATORS.map(i => i.label)],
        rows: series.map(r => [r.csvLabel, ...INDICATORS.map(i => r[i.key] || 0)]),
        totals: ["Total del rango", ...INDICATORS.map(i => rangeTotals[i.key] || 0)],
      },
      asesores: {
        cols: asesorCols(INDICATORS.length),
        headers: ["Asesor", "Leads", ...INDICATORS.map(i => i.label)],
        rows: advisorReportRows(metrics.rows),
      },
    };

}
