/**
 * app/views/ComandoDirectivo.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard ejecutivo (Comando Directivo) para clientes con
 * `features.comandoDirectivo`. Hoy: Grupo 28.
 *
 * Layout:
 *   1) Header — título, descripción del período, tabs Día/Semana/Mes,
 *      botón "Descargar reporte" (CSV listo para dirección).
 *   2) Gráfica grande de evolución (line chart) con los 7 indicadores
 *      a lo largo del tiempo — leyenda toggleable para enfocar series.
 *   3) Grid de KPI cards con totales del rango visible.
 *   4) Tabla por asesor (AdvisorMetrics) coordinada con CRM y asesores.
 *
 * Todas las series se calculan en memoria a partir de `leadsData`, el mismo
 * array que consume el CRM — el dashboard refleja el estado real del pipeline
 * sin queries adicionales. Cada bucket = un calendario (día/semana/mes)
 * y dentro del bucket aplicamos los `INDICATORS` ya existentes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import { descargarArchivo } from "../../lib/native";
import {
  Users, Phone, BadgeCheck, CalendarDays, CheckCircle2, Activity,
  RefreshCw, Download, MapPin, Handshake,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G } from "../SharedComponents";
import AdvisorMetrics from "./CRM/AdvisorMetrics";
import { INDICATORS } from "./CRM/indicators.js";
import { useIsMobile } from "../../hooks/useViewport";
import { useClient } from "../../hooks/useClient";
import { buildExecutivePdf } from "./ComandoDirectivo.pdf";
import ZoomControl from "./ZoomControl";
import ZoomBoard from "./CRM/ZoomBoard";
import ProductividadTab from "./ProductividadTab";
import { useZoomAgendados } from "../../hooks/useZoomAgendados";
import { milestoneOf, funnelEntryOf, zoomEventsOf, RECORRIDO_STAGES, CIERRE_STAGES } from "./CRM/zoom-metrics";
import DateRangeControl from "./CRM/DateRangeControl";
import { savePdfDoc, isNativeApp } from "../../lib/native";
import { createDefaultDateFilter, resolveDateRange, timestampInRange, dateRangeLabel } from "./CRM/date-range";

import { aggregateCommandMetrics, buildMetricBuckets, buildMetricSeries, percentage } from "./CRM/command-metrics.js";

import { createCommandReport } from "./CRM/command-report.js";

const FULL_LABELS = {
  assigned:       "Leads asignados",
  contacted:      "Leads gestionados",
  qualified:      "Leads en seguimiento o posteriores",
  zoomScheduled:  "Zooms agendados",
  zoomDone:       "Zooms realizados",
  activePostZoom: "Clientes activos post-Zoom",
  followUps:      "Seguimientos acumulados",
};

// Paleta unificada — SOLO derivados de azul / verde / naranja. Sin rosas,
// violetas ni amarillos puros. Hierarquía: greens para etapas iniciales,
// blues para el embudo de calificación/zoom, oranges para acciones activas.
const COLORS_BY_KEY = {
  assigned:       "#6EE7C2",   // mint green — primer toque
  contacted:      "#38BDF8",   // sky blue — entrando al embudo
  qualified:      "#0EA5E9",   // deeper blue — calificado
  zoomScheduled:  "#2563EB",   // navy blue — zoom programado
  zoomDone:       "#10B981",   // emerald green — zoom hecho
  activePostZoom: "#F59E0B",   // amber orange — activos en cierre
  followUps:      "#EA580C",   // deep orange — seguimientos
};

const GRANULARITIES = [
  { id: "day",   label: "Día",    defaultCount: 7,  ranges: [7, 14, 30, 60],  unit: "días" },
  { id: "week",  label: "Semana", defaultCount: 4,  ranges: [4, 8, 12, 26],   unit: "semanas" },
  { id: "month", label: "Mes",    defaultCount: 3,  ranges: [3, 6, 12, 24],   unit: "meses" },
];

function automaticGranularity(range) {
  if (!range || range.fromTs === null) return GRANULARITIES[2];
  const days = Math.max(1, Math.ceil((range.toTs - range.fromTs) / 86400000));
  if (days <= 31) return GRANULARITIES[0];
  if (days <= 180) return GRANULARITIES[1];
  return GRANULARITIES[2];
}

function htmlEscape(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Delega en descargarArchivo: dentro de la app el <a download> de siempre lo
// ignora el WebView y el boton no hace NADA, sin error. Ver native.js.
function downloadFile(filename, content, mimeType = "text/html;charset=utf-8") {
  descargarArchivo(filename, content, mimeType);
}

// ── Componente principal ────────────────────────────────────────────────────
const ComandoDirectivo = ({ leadsData = [], T: _T, theme = "dark", loading = false, loadError = null, onRetry = null }) => {
  const isLight = theme === "light";
  const baseTheme = _T || (isLight ? LP : P);
  const T = isLight ? baseTheme : { ...baseTheme, txt3: baseTheme.txt2 };
  const accent = T.accent;
  const { config: clientConfig } = useClient();
  const clientDisplayName = clientConfig?.legalName || clientConfig?.name || "Stratos";
  // Cantidad de buckets por granularidad — independiente para cada tab.
  // Permite que el usuario haga zoom in/out sin perder el contexto al cambiar
  // de tab. Default = "lo del día/semana/mes" actual + un poco de contexto.
  // Visibilidad por serie — toggleable desde la leyenda.
  // Por defecto la gráfica de líneas muestra SOLO 2 series (agendados +
  // realizados) para que no sea un spaghetti de 7 líneas. El resto se prende
  // con los chips de la leyenda. El embudo de arriba es el visual principal.
  const [hiddenSeries, setHiddenSeries] = useState({
    assigned: true, contacted: true, qualified: true, activePostZoom: true, followUps: true,
  });

  // Pestañas de nivel superior: Indicadores (vista histórica) vs Control de
  // Zooms (panel operativo sobre zoom_agendados). La pestaña de Zooms solo
  // aparece para clientes con features.zoomControl (hoy: Duke); el resto ve el
  // Comando Directivo igual que siempre, sin barra de pestañas.
  const showZoomTab = !!clientConfig?.features?.zoomControl;
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("indicadores");
  const [exporting, setExporting] = useState(false);
  const [dateFilter, setDateFilter] = useState(createDefaultDateFilter);
  const activeDateRange = useMemo(
    () => resolveDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo),
    [dateFilter],
  );

  // El panel CRUD operativo (ZoomControl) solo tiene sentido si la tabla
  // zoom_agendados existe (migración 027). Mientras no esté aplicada en este
  // proyecto, lo ocultamos: el tablero ZoomBoard ya da la métrica real desde el
  // pipeline, así que un panel vacío + aviso de migración solo confunde.
  const zoomData = useZoomAgendados({ enabled: showZoomTab });
  const zoomTableError = zoomData.error;
  const zoomTableMissing = zoomTableError === "missing_table";

  const granularity = useMemo(() => automaticGranularity(activeDateRange), [activeDateRange]);
  const granularityId = granularity.id;

  const visibleLeads = useMemo(() => leadsData.filter(l => !l.deleted_at), [leadsData]);
  const metrics = useMemo(() => aggregateCommandMetrics(visibleLeads, activeDateRange), [visibleLeads, activeDateRange]);
  const rangeLeads = metrics.cohort;
  const rangeTotals = metrics.totals;
  const snapshotTotals = useMemo(() => aggregateCommandMetrics(visibleLeads, null).totals, [visibleLeads]);
  const metricDates = useMemo(() => visibleLeads.flatMap(l => {
    const dates = [l.created_at];
    const scheduled = funnelEntryOf(l);
    const done = zoomEventsOf(l).done;
    if (scheduled) dates.push(scheduled.at);
    if (done) dates.push(done.at);
    return dates;
  }), [visibleLeads]);
  const buckets = useMemo(() => buildMetricBuckets(granularityId, activeDateRange, metricDates), [granularityId, activeDateRange, metricDates]);
  const series = useMemo(() => buildMetricSeries(visibleLeads, buckets), [visibleLeads, buckets]);

  // Embudo de conversión comercial: del lead al cierre. Los hitos de Zoom
  // (agendado/realizado/recorrido/cierre) se cuentan POR FECHA REAL DEL EVENTO
  // dentro del rango — exactamente el mismo criterio que ZoomBoard (Filtro 2) y
  // que la tabla por asesor, para que "Zoom realizado" sea EL MISMO número en
  // todos los paneles. `timestampInRange` incluye los inferidos solo en
  // "Histórico" (no tienen fecha) y los excluye en rangos con fecha. "Leads
  // totales" es la cohorte creada en el rango (entrada del embudo).
  const funnel = useMemo(() => {
    let rec = 0, cie = 0;
    const zsch = rangeTotals.zoomScheduled;
    const zdone = rangeTotals.zoomDone;
    for (const l of visibleLeads) {
      const r = milestoneOf(l, RECORRIDO_STAGES);
      if (r && timestampInRange(r.at, activeDateRange)) rec++;
      const c = milestoneOf(l, CIERRE_STAGES);
      if (c && timestampInRange(c.at, activeDateRange)) cie++;
    }
    const total = rangeLeads.length;
    const stages = [
      { label: "Leads nuevos",      value: total, color: "#64748B", icon: Users },
      { label: "Zoom agendado",      value: zsch,  color: "#2563EB", icon: CalendarDays },
      { label: "Zoom realizado",     value: zdone, color: "#10B981", icon: CheckCircle2 },
      { label: "Visitas agendadas", value: rec,   color: "#06B6D4", icon: MapPin },
      { label: "Apartó / Cierre",    value: cie,   color: accent,    icon: Handshake },
    ];
    const max = Math.max(1, ...stages.map(s => s.value));
    return { stages, max };
  }, [visibleLeads, rangeLeads, activeDateRange, accent, rangeTotals.zoomScheduled, rangeTotals.zoomDone]);

  // ── Export — Reporte ejecutivo en PDF (vectorial, jsPDF) ──────────────────
  // Construye el PDF dibujando texto/tablas con jsPDF (ver ComandoDirectivo.pdf
  // .js): texto seleccionable, peso mínimo y márgenes A4 correctos por
  // construcción — el contenido nunca toca el borde ni se parte entre páginas.
  // El `html` que se arma abajo queda SOLO como fallback imprimible por si el
  // import de jsPDF fallara en algún navegador exótico.
  const handleExport = async () => {
    if (loading || loadError || exporting) return;
    setExporting(true);
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const hhmm  = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const periodSpan = dateRangeLabel(activeDateRange);
    const asesores = metrics.rows.map(row => row.asesor);

    // KPIs derivados — útiles para dirección.
    const totalLeads     = rangeLeads.length;
    const tasaCalif = percentage(rangeTotals.qualified, totalLeads);
    const tasaZoomSobreCal = percentage(INDICATORS.find(i => i.key === "zoomDone").compute(rangeLeads), totalLeads);
    const formatRate = value => value === null ? "—" : value + "%";
    const promedioSeguim = totalLeads
      ? (rangeTotals.followUps / totalLeads).toFixed(1)
      : "—";

    const maxIndVal = Math.max(1, ...INDICATORS.map(i => rangeTotals[i.key] || 0));

    // ── Construcción del HTML ──────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${htmlEscape(clientDisplayName)} — Comando Directivo · ${stamp}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --bg:           #FFFFFF;
    --ink:          #0B1220;
    --ink2:         #334155;
    --ink3:         #64748B;
    --ink4:         #94A3B8;
    --line:         #E2E8F0;
    --line2:        #F1F5F9;
    --line3:        #F8FAFC;
    /* Paleta — solo derivados de azul / verde / naranja */
    --green:        #10B981;
    --green-soft:   #ECFDF5;
    --green-deep:   #047857;
    --blue:         #2563EB;
    --blue-soft:    #EFF6FF;
    --orange:       #EA580C;
    --orange-soft:  #FFF7ED;
    /* Acentos por indicador — alineados con el chart en la app */
    --c-assigned:       #6EE7C2;
    --c-contacted:      #38BDF8;
    --c-qualified:      #0EA5E9;
    --c-zoom-sched:     #2563EB;
    --c-zoom-done:      #10B981;
    --c-active:         #F59E0B;
    --c-followups:      #EA580C;
  }
  html, body { background: var(--bg); color: var(--ink); }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Display", "SF Pro Text", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12.5px; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  }
  .page {
    max-width: 960px; margin: 0 auto; padding: 44px 52px 60px;
  }
  .topbar {
    display: flex; align-items: flex-start; justify-content: space-between;
    border-bottom: 1.5px solid var(--ink); padding-bottom: 16px; margin-bottom: 28px;
    gap: 24px;
  }
  .brand {
    font-size: 22px; font-weight: 500; letter-spacing: -0.022em;
    color: var(--ink); line-height: 1.1;
  }
  .brand .badge {
    display: inline-block;
    background: linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%);
    color: #fff;
    font-size: 9.5px; font-weight: 500; padding: 4px 10px; border-radius: 99px;
    margin-left: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    vertical-align: middle; box-shadow: 0 1px 2px rgba(16,185,129,0.25);
  }
  .meta {
    font-size: 10.5px; color: var(--ink3); text-align: right;
    line-height: 1.65; letter-spacing: 0.005em;
  }
  .meta strong { color: var(--ink); font-weight: 400; }
  h1 {
    font-size: 28px; font-weight: 500; margin: 6px 0 8px;
    letter-spacing: -0.028em; color: var(--ink);
  }
  .subtitle {
    font-size: 12.5px; color: var(--ink2); margin: 0 0 32px;
    line-height: 1.55;
  }
  .subtitle strong { color: var(--ink); font-weight: 400; }
  h2 {
    font-size: 11.5px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.10em; color: var(--ink3);
    margin: 36px 0 14px; padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
    display: flex; align-items: center; gap: 10px;
  }
  h2::before {
    content: ""; display: inline-block; width: 3px; height: 14px;
    background: var(--green); border-radius: 2px;
  }
  .summary {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 10px; margin-bottom: 4px;
  }
  .stat {
    border: 1px solid var(--line);
    border-radius: 12px; padding: 16px 18px;
    background: #FFFFFF;
    position: relative; overflow: hidden;
  }
  .stat::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--green), var(--green) 60%, transparent);
  }
  .stat .label {
    font-size: 9.5px; font-weight: 500; color: var(--ink3);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .stat .value {
    font-size: 30px; font-weight: 500; color: var(--ink);
    margin-top: 8px; letter-spacing: -0.028em; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .stat .sub {
    font-size: 10px; color: var(--ink3); margin-top: 8px;
    letter-spacing: 0.005em;
  }
  .ind-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 4px 28px; margin: 6px 0 0;
  }
  .ind {
    display: flex; align-items: center; justify-content: space-between;
    gap: 14px; padding: 11px 0;
    border-bottom: 1px solid var(--line2);
  }
  .ind:last-child, .ind:nth-last-child(2) { border-bottom: none; }
  .ind .name {
    font-size: 12px; color: var(--ink); font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px;
    min-width: 0; flex-shrink: 1;
  }
  .ind .dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .ind .bar-wrap {
    flex: 1; height: 6px; border-radius: 99px;
    background: var(--line2); overflow: hidden; min-width: 60px;
  }
  .ind .bar {
    height: 100%; border-radius: 99px;
    transition: width 0.3s ease;
  }
  .ind .val {
    font-size: 14px; font-weight: 500; color: var(--ink);
    min-width: 40px; text-align: right; font-variant-numeric: tabular-nums;
  }
  table {
    width: 100%; border-collapse: collapse; margin-top: 4px;
    font-size: 11px;
    border: 1px solid var(--line); border-radius: 10px;
    overflow: hidden;
  }
  table th, table td {
    padding: 9px 12px; text-align: right;
    border-bottom: 1px solid var(--line2);
    font-variant-numeric: tabular-nums;
  }
  table th {
    font-size: 9.5px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--ink2);
    background: var(--line3); border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  table th:first-child, table td:first-child { text-align: left; font-weight: 500; }
  table tbody tr:nth-child(even) { background: #FCFDFE; }
  table tbody tr:hover { background: var(--green-soft); }
  table tfoot td {
    font-weight: 500; background: var(--green-soft); color: var(--green-deep);
    border-top: 2px solid var(--green); border-bottom: none;
    text-transform: uppercase; letter-spacing: 0.04em; font-size: 10.5px;
  }
  .footer {
    margin-top: 48px; padding-top: 16px;
    border-top: 1px solid var(--line);
    font-size: 10px; color: var(--ink4);
    display: flex; justify-content: space-between; gap: 12px;
    letter-spacing: 0.01em;
  }
  .actions {
    position: fixed; top: 18px; right: 18px;
    display: flex; gap: 8px; z-index: 10;
  }
  .btn {
    padding: 9px 16px; border-radius: 9px; border: none;
    background: linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%);
    color: #fff; font-weight: 500;
    font-size: 12px; cursor: pointer;
    box-shadow: 0 2px 8px rgba(16,185,129,0.32);
    letter-spacing: 0.005em;
  }
  .btn:hover { box-shadow: 0 4px 12px rgba(16,185,129,0.42); }
  @media print {
    .actions { display: none !important; }
    .page { max-width: none; padding: 0 14mm; }
    h2 { page-break-after: avoid; break-after: avoid; }
    table, .ind-grid, .summary, .stat { page-break-inside: avoid; break-inside: avoid; }
    body { font-size: 10.5px; }
    .stat .value { font-size: 24px; }
    h1 { font-size: 22px; }
    .topbar { margin-bottom: 18px; }
    .footer { margin-top: 32px; }
  }
  @page { size: A4 portrait; margin: 14mm 0; }
</style>
</head>
<body>
  <div class="page">

    <div class="topbar">
      <div class="brand">${htmlEscape(clientDisplayName)} <span class="badge">Comando Directivo</span></div>
      <div class="meta">
        Generado: <strong>${stamp}</strong> · ${hhmm}<br/>
        Granularidad: <strong>${htmlEscape(granularity.label)}</strong> · ${buckets.length} períodos
      </div>
    </div>

    <h1>Reporte ejecutivo de pipeline</h1>
    <p class="subtitle">
      Pipeline en vivo: <strong>${visibleLeads.length}</strong> leads totales ·
      ${asesores.length} asesores activos en el rango ·
      Rango analizado: <strong>${htmlEscape(periodSpan)}</strong>
    </p>

    <h2>Pipeline actual</h2>
    <div class="summary">
      <div class="stat">
        <div class="label">Pipeline total</div>
        <div class="value">${visibleLeads.length}</div>
        <div class="sub">leads en el CRM</div>
      </div>
      <div class="stat">
        <div class="label">Zooms agendados</div>
        <div class="value">${snapshotTotals.zoomScheduled}</div>
        <div class="sub">histórico del pipeline</div>
      </div>
      <div class="stat">
        <div class="label">Zooms realizados</div>
        <div class="value">${snapshotTotals.zoomDone}</div>
        <div class="sub">histórico del pipeline</div>
      </div>
      <div class="stat">
        <div class="label">Activos post-Zoom</div>
        <div class="value">${snapshotTotals.activePostZoom}</div>
        <div class="sub">estado actual</div>
      </div>
    </div>

    <h2>Resumen del rango — ${htmlEscape(granularity.label)}</h2>
    <div class="summary">
      <div class="stat">
        <div class="label">Leads nuevos</div>
        <div class="value">${totalLeads}</div>
        <div class="sub">creados en el rango</div>
      </div>
      <div class="stat">
        <div class="label">En seguimiento+</div>
        <div class="value">${formatRate(tasaCalif)}</div>
        <div class="sub">${rangeTotals.qualified} de ${totalLeads || 0}</div>
      </div>
      <div class="stat">
        <div class="label">Cohorte con Zoom</div>
        <div class="value">${formatRate(tasaZoomSobreCal)}</div>
        <div class="sub">leads nuevos con hito de Zoom / leads nuevos</div>
      </div>
      <div class="stat">
        <div class="label">Seguim. por lead</div>
        <div class="value">${promedioSeguim}</div>
        <div class="sub">acumulado de la cohorte</div>
      </div>
    </div>

    <h2>Indicadores clave — del rango</h2>
    <div class="ind-grid">
      ${INDICATORS.map(ind => {
        const val = rangeTotals[ind.key] || 0;
        const w = (val / maxIndVal) * 100;
        const color = COLORS_BY_KEY[ind.key] || "#10B981";
        return `
        <div class="ind">
          <div class="name">
            <span class="dot" style="background:${color}"></span>
            ${htmlEscape(FULL_LABELS[ind.key] || ind.label)}
          </div>
          <div class="bar-wrap"><div class="bar" style="width:${w}%;background:${color}"></div></div>
          <div class="val">${val}</div>
        </div>`;
      }).join("")}
    </div>

    <h2>Evolución temporal — ${htmlEscape(granularity.label)}</h2>
    <table>
      <thead>
        <tr>
          <th>Período</th>
          ${INDICATORS.map(i => `<th>${htmlEscape(i.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${series.map(r => `
          <tr>
            <td>${htmlEscape(r.csvLabel)}</td>
            ${INDICATORS.map(i => `<td>${r[i.key] || 0}</td>`).join("")}
          </tr>`).join("")}
      </tbody>
      <tfoot>
        <tr>
          <td>Total del rango</td>
          ${INDICATORS.map(i => `<td>${rangeTotals[i.key] || 0}</td>`).join("")}
        </tr>
      </tfoot>
    </table>

    <h2>Desglose por asesor</h2>
    ${asesores.length === 0
      ? `<p style="color: var(--ink3); font-size: 12px; margin: 8px 0;">Sin asesores con leads en el rango analizado.</p>`
      : `<table>
        <thead>
          <tr>
            <th>Asesor</th>
            <th>Leads</th>
            ${INDICATORS.map(i => `<th>${htmlEscape(i.label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${asesores.map(ases => {
            const advisorRow = metrics.rows.find(row => row.asesor === ases);
            return `
            <tr>
              <td>${htmlEscape(ases)}</td>
              <td>${advisorRow.count}</td>
              ${INDICATORS.map(i => `<td>${advisorRow.metrics[i.key]}</td>`).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>`
    }

    <div class="footer">
      <span>Reporte generado automáticamente desde el Comando Directivo.</span>
      <span>${htmlEscape(clientDisplayName)} · ${stamp}</span>
    </div>
  </div>
</body>
</html>`;

    // ── Modelo del reporte — datos planos derivados de leadsData (el mismo
    //    array del CRM). El builder vectorial (ComandoDirectivo.pdf.js) lo
    //    dibuja con jsPDF: márgenes correctos, tablas paginadas sin cortar
    //    filas, texto seleccionable. Caracteres dentro de cp1252 (sin "→").
    const model = createCommandReport({
      leads: visibleLeads, range: activeDateRange, series, buckets,
      clientName: clientDisplayName, granularityLabel: granularity.label,
      labels: FULL_LABELS, colors: COLORS_BY_KEY, now,
    });

    const filenameBase = `comando-directivo_${granularity.label.toLowerCase()}_${stamp}`;
    try {
      const { default: JsPDF } = await import("jspdf");
      const doc = buildExecutivePdf(JsPDF, model);
      // savePdfDoc: en la APP nativa escribe el PDF al caché y abre la hoja
      // de compartir del sistema (doc.save por <a download>/blob no hace NADA
      // en el WebView — era el bug "Generar PDF no funciona en la app").
      await savePdfDoc(doc, `${filenameBase}.pdf`);
    } catch (err) {
      console.warn("[Comando Directivo] PDF directo falló:", err);
      if (isNativeApp()) {
        // En la app el fallback de <a download> no hace nada: avisar en vez
        // de dejar el botón "muerto" en silencio.
        window.alert("No se pudo generar el PDF en la app. Prueba de nuevo; si sigue, genéralo desde el navegador.");
      } else {
        // Navegador donde jsPDF no cargó: descargamos el HTML imprimible.
        downloadFile(`${filenameBase}.html`, html);
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Chart helpers ─────────────────────────────────────────────────────────
  const toggleSeries = (key) => setHiddenSeries(h => ({ ...h, [key]: !h[key] }));
  const visibleIndicators = INDICATORS.filter(i => !hiddenSeries[i.key]);

  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Pestañas: Indicadores / Control de Zooms (solo si zoomControl) ─── */}
      {showZoomTab && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center" }}>
        {/* Segmented control nativo: labels cortos (el título ya dice "Indicadores")
            → los 3 caben sin cortarse; en móvil cada tab es flex:1 y llena el ancho. */}
        <div style={{
          display: "flex", gap: 4, padding: 4, borderRadius: 14,
          background: headerBg, border: `1px solid ${rowBorder}`,
          width: isMobile ? "100%" : "auto",
        }}>
          {[
            { id: "indicadores", label: "Leads" },
            { id: "zooms", label: "Zooms" },
            { id: "productividad", label: "Productividad" },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: isMobile ? 1 : "0 0 auto", minWidth: 0, minHeight: 44,
                padding: "0 16px", borderRadius: 10, border: "none", cursor: "pointer",
                whiteSpace: "nowrap",
                fontSize: 13, fontWeight: active ? 700 : 600, fontFamily: fontDisp,
                background: active ? (isLight ? T.accent : `${T.accent}22`) : "transparent",
                color: active ? (isLight ? "#FFFFFF" : T.accent) : T.txt2,
                transition: "all 0.15s", WebkitTapHighlightColor: "transparent",
              }}>{t.label}</button>
            );
          })}
        </div>
        <button onClick={handleExport} disabled={loading || !!loadError || exporting} title="Descarga el reporte ejecutivo como PDF" style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"8px 14px", borderRadius:9, background: isLight ? `linear-gradient(135deg, ${accent} 0%, ${accent}DD 100%)` : `${accent}18`, color: isLight ? "#FFFFFF" : accent, border:`1px solid ${isLight ? "transparent" : `${accent}55`}`, fontSize:12, fontWeight:500, fontFamily:fontDisp, cursor:"pointer", boxShadow: isLight ? `0 2px 8px ${accent}40` : "none" }}>
          <Download size={13} strokeWidth={2.4} /> {exporting ? "Generando…" : "Generar PDF de Leads"}
        </button>
        </div>
      )}

      {loading && <p role="status" style={{ color: T.txt2, fontFamily: font }}>Cargando la cartera completa… Los indicadores son provisionales.</p>}
      {loadError && <p role="alert" style={{ color: T.txt2, fontFamily: font }}>No se pudo actualizar la cartera. {onRetry && <button onClick={onRetry}>Reintentar</button>}</p>}
      <DateRangeControl
        T={T}
        isLight={isLight}
        value={dateFilter}
        onChange={setDateFilter}
        label="Rango global del Comando"
        allowFuture={showZoomTab}
      />

      {(!showZoomTab || tab === "indicadores") && (
      <>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
            {showZoomTab ? "Filtro 1 · Control de Leads" : "Comando Directivo"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
            {showZoomTab
              ? <>Actividad de leads e hitos del pipeline · vista <strong style={{ color: T.txt2 }}>{granularity.label}</strong> · {rangeLeads.length} leads en el rango</>
              : <>Indicadores ejecutivos del equipo · vista <strong style={{ color: T.txt2 }}>{granularity.label}</strong> · {rangeLeads.length} leads en el rango</>}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            padding: "7px 11px", borderRadius: 9,
            background: headerBg, border: `1px solid ${rowBorder}`,
            color: T.txt3, fontSize: 12, fontFamily: font,
          }}>
            Vista automática: <strong style={{ color: T.txt2 }}>{granularity.label}</strong>
          </span>
          {!showZoomTab && (
          <button
            onClick={handleExport} disabled={loading || !!loadError || exporting}
            title="Descarga el reporte ejecutivo como PDF — listo para enviar a dirección"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              minHeight: 44, padding: "0 16px", borderRadius: 11,
              width: isMobile ? "100%" : "auto",
              background: isLight
                ? `linear-gradient(135deg, ${accent} 0%, ${accent}DD 100%)`
                : `${accent}18`,
              color: isLight ? "#FFFFFF" : accent,
              border: `1px solid ${isLight ? "transparent" : `${accent}55`}`,
              fontSize: 13, fontWeight: 600, fontFamily: fontDisp,
              letterSpacing: "-0.01em", cursor: "pointer",
              boxShadow: isLight ? `0 2px 8px ${accent}40` : "none",
              transition: "all 0.15s", WebkitTapHighlightColor: "transparent",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = isLight ? `0 4px 12px ${accent}55` : `0 0 0 3px ${accent}1A`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = isLight ? `0 2px 8px ${accent}40` : "none";
            }}
          >
            <Download size={13} strokeWidth={2.4} />
            {exporting ? "Generando…" : "Generar PDF de Leads"}
          </button>
          )}
        </div>
      </div>

      {/* ── 0) Embudo de conversión — el visual principal, claro de un vistazo ── */}
      <G T={T}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14.5, fontWeight: 500, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.014em" }}>
            Actividad comercial del período
          </p>
          <p style={{ fontSize: 11, color: T.txt3, fontFamily: font, margin: "3px 0 0", lineHeight: 1.5 }}>
            Leads por fecha de creación; hitos por fecha del primer movimiento. Son poblaciones distintas: estas barras no representan tasas de conversión.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {funnel.stages.map((s) => {
            const Icon = s.icon;
            const widthPct = (s.value / funnel.max) * 100;
            return (
              <div key={s.label} style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 6 : 12 }}>
                <div style={{ width: isMobile ? "auto" : 150, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", padding: 6, borderRadius: 8, background: `${s.color}1A`, flexShrink: 0 }}>
                    <Icon size={14} color={s.color} strokeWidth={2.2} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 400, color: T.txt2, fontFamily: font, lineHeight: 1.2 }}>{s.label}</span>
                </div>
                <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, height: 34, borderRadius: 8, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <div style={{
                      width: `${widthPct}%`, height: "100%", borderRadius: 8,
                      background: s.color, display: "flex", alignItems: "center",
                    }}>

                    </div>
                  </div>
                  <span style={{ width: 84, flexShrink: 0, fontSize: 11, color: T.txt3, fontFamily: font, textAlign: "right" }}>
                    <strong style={{ color: T.txt, fontSize: 14 }}>{s.value.toLocaleString("es-MX")}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </G>

      {/* ── 1) Gráfica grande — evolución en el tiempo ─────────────────────── */}
      <G T={T}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 500, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.014em" }}>
              Evolución de indicadores
            </p>
            <p style={{ fontSize: 12, color: T.txt3, fontFamily: font, margin: "3px 0 0", lineHeight: 1.5 }}>
              Agrupación <strong style={{ color: T.txt2 }}>{granularity.label.toLowerCase()}</strong> dentro del rango global seleccionado.
              {" "}Por defecto muestra <strong style={{ color: T.txt2 }}>Zooms agendados y realizados</strong>; prende más series con los chips de la leyenda.
            </p>
          </div>
        </div>

        {/* Leyenda interactiva — chips toggleables. En móvil: grid 2-up que llena
            el ancho (sin fila despareja) + tap target ≥40px. En desktop: flex-wrap. */}
        <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : undefined, flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {INDICATORS.map(ind => {
            const c = COLORS_BY_KEY[ind.key] || accent;
            const hidden = !!hiddenSeries[ind.key];
            return (
              <button
                key={ind.key}
                onClick={() => toggleSeries(ind.key)}
                aria-pressed={!hidden}
                title={hidden ? "Mostrar serie" : "Ocultar serie"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  width: isMobile ? "100%" : "auto", minWidth: 0, minHeight: isMobile ? 42 : 30,
                  justifyContent: "flex-start",
                  padding: isMobile ? "9px 12px" : "5px 10px", borderRadius: isMobile ? 12 : 99,
                  background: hidden
                    ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)")
                    : (isLight ? `${c}14` : `${c}22`),
                  border: `1px solid ${hidden
                    ? (isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)")
                    : `${c}55`}`,
                  color: hidden ? T.txt3 : (isLight ? `color-mix(in srgb, ${c} 60%, #0B1220)` : c),
                  fontSize: 12, fontWeight: 400, fontFamily: fontDisp,
                  letterSpacing: "0.005em", cursor: "pointer",
                  transition: "all 0.14s", WebkitTapHighlightColor: "transparent",
                  opacity: hidden ? 0.55 : 1,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: hidden ? T.txt3 : c,
                  boxShadow: hidden ? "none" : `0 0 6px ${c}88`,
                }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{FULL_LABELS[ind.key] || ind.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <AreaChart data={series} margin={{ top: 12, right: 18, bottom: 10, left: -6 }}>
              <defs>
                {INDICATORS.map(ind => {
                  const c = COLORS_BY_KEY[ind.key] || accent;
                  return (
                    <linearGradient key={ind.key} id={`grad-${ind.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={c} stopOpacity={visibleIndicators.length <= 2 ? 0.30 : 0.14} />
                      <stop offset="100%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid
                strokeDasharray="3 5"
                stroke={isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)"}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke={T.txt3}
                tick={{ fill: T.txt3, fontSize: 11.5, fontFamily: fontDisp, fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)" }}
                interval={series.length > 20 ? "preserveStartEnd" : 0}
                minTickGap={6}
                angle={granularityId === "day" && series.length > 14 ? -28 : 0}
                dy={granularityId === "day" && series.length > 14 ? 8 : 4}
                height={granularityId === "day" && series.length > 14 ? 54 : 32}
              />
              <YAxis
                allowDecimals={false}
                stroke={T.txt3}
                tick={{ fill: T.txt3, fontSize: 11.5, fontFamily: fontDisp, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              {/* Marca "Hoy" — solo cuando hay más de un bucket. */}
              {series.length > 1 && series.some(row => row.isCurrent) && (
                <ReferenceLine
                  x={series.find(row => row.isCurrent)?.label}
                  stroke={isLight ? "rgba(15,23,42,0.30)" : "rgba(255,255,255,0.25)"}
                  strokeDasharray="2 4"
                  strokeWidth={1}
                  label={{
                    value: "Hoy", position: "top",
                    fill: T.txt2, fontSize: 11, fontWeight: 500,
                    fontFamily: fontDisp,
                    dy: -2,
                  }}
                />
              )}
              <Tooltip
                cursor={{ stroke: isLight ? "rgba(15,23,42,0.18)" : "rgba(255,255,255,0.18)", strokeWidth: 1, strokeDasharray: "3 4" }}
                content={(props) => (
                  <ChartTooltip {...props} isLight={isLight} T={T} hiddenSeries={hiddenSeries} />
                )}
              />
              {visibleIndicators.map(ind => {
                const c = COLORS_BY_KEY[ind.key] || accent;
                return (
                  <Area
                    key={ind.key}
                    type="monotone"
                    dataKey={ind.key}
                    stroke={c}
                    strokeWidth={2.4}
                    fill={`url(#grad-${ind.key})`}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: isLight ? "#FFFFFF" : "#0E1320", fill: c }}
                    isAnimationActive={true}
                    animationDuration={520}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </G>

      {/* ── 4) Desglose por asesor (coordinado con CRM) ─────────────────── */}
      <AdvisorMetrics
        leadsData={visibleLeads}
        theme={isLight ? "light" : "dark"}
        dateFilter={dateFilter}
      />
      </>
      )}

      {showZoomTab && tab === "zooms" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* El "excel" del director comercial va HASTA ARRIBA (pedido de Ivan):
              al abrir la pestaña aterriza directo en su tabla de Zooms. Solo si
              la tabla zoom_agendados existe (migración 027/083). */}
          {!zoomTableMissing && <ZoomControl theme={isLight ? "light" : "dark"} dateFilter={dateFilter} data={zoomData} />}
          {/* Métrica de Zooms del pipeline (histórico por etapas) — debajo. */}
          <ZoomBoard
            leadsData={visibleLeads}
            theme={isLight ? "light" : "dark"}
            dateFilter={dateFilter}
          />
        </div>
      )}

      {showZoomTab && tab === "productividad" && (
        <ProductividadTab T={T} isLight={isLight} dateFilter={dateFilter} />
      )}
    </div>
  );
};

// ── Custom chart tooltip — agrupado, con dots y total ──────────────────────
function ChartTooltip({ active, payload, label, isLight, T, hiddenSeries }) {
  if (!active || !payload || payload.length === 0) return null;
  const firstRow = payload[0]?.payload || {};
  const fullLabel = firstRow.tooltipLabel || label;
  // Filtramos las series ocultas (Recharts las omite, pero por defensa).
  const items = payload
    .filter(p => !hiddenSeries?.[p.dataKey])
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div style={{
      background: isLight ? "#FFFFFF" : "#0E1320",
      border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
      borderRadius: 12,
      padding: "10px 14px",
      fontFamily: font, fontSize: 12.5,
      boxShadow: "0 12px 32px rgba(0,0,0,0.20)",
      minWidth: 200,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 500, color: T.txt, fontFamily: fontDisp,
        letterSpacing: "-0.005em",
        marginBottom: 8, paddingBottom: 7,
        borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.07)"}`,
      }}>{fullLabel}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map(p => (
          <div key={p.dataKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: T.txt2, fontFamily: fontDisp, fontSize: 12, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
              {FULL_LABELS[p.dataKey] || p.dataKey}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: T.txt, fontVariantNumeric: "tabular-nums", fontFamily: fontDisp }}>
              {p.value || 0}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}

export default ComandoDirectivo;
