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
import AdvisorMetrics, { INDICATORS } from "./CRM/AdvisorMetrics";
import { useClient } from "../../hooks/useClient";
import { buildExecutivePdf, evolutionCols, asesorCols } from "./ComandoDirectivo.pdf";
import ZoomControl from "./ZoomControl";
import ZoomBoard from "./CRM/ZoomBoard";
import ProductividadTab from "./ProductividadTab";
import { useZoomAgendados } from "../../hooks/useZoomAgendados";
import { milestoneOf, RECORRIDO_STAGES, CIERRE_STAGES } from "./CRM/zoom-metrics";

const ICONS_BY_KEY = {
  assigned:       Users,
  contacted:      Phone,
  qualified:      BadgeCheck,
  zoomScheduled:  CalendarDays,
  zoomDone:       CheckCircle2,
  activePostZoom: Activity,
  followUps:      RefreshCw,
};

const FULL_LABELS = {
  assigned:       "Leads asignados",
  contacted:      "Leads contactados",
  qualified:      "Leads calificados",
  zoomScheduled:  "Zooms agendados",
  zoomDone:       "Zooms realizados",
  activePostZoom: "Clientes activos post-Zoom",
  followUps:      "Seguimientos realizados",
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

const MES_ABBR     = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MES_FULL     = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIA_SEM_ABBR = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// ── Generación de buckets temporales ────────────────────────────────────────
// Cada bucket: { key, label (eje X), csvLabel, startTs, endTs }.
// Los buckets están ordenados de más antiguo a más reciente (izq → der).
// El parámetro `count` controla cuántos buckets generar (configurable por el
// usuario desde los chips de rango), permitiendo zoom in/out sobre el período.
function buildBuckets(granularityId, count) {
  const now = new Date();
  const buckets = [];
  const n = Math.max(1, count | 0);

  if (granularityId === "day") {
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        // Eje X: número de día + abbr mes. En rangos cortos también añadimos
        // día de la semana ("Mar 14") para que se entienda al instante.
        label: n <= 14
          ? `${DIA_SEM_ABBR[d.getDay()]} ${d.getDate()}`
          : `${d.getDate()} ${MES_ABBR[d.getMonth()]}`,
        tooltipLabel: `${DIA_SEM_ABBR[d.getDay()]} ${d.getDate()} ${MES_FULL[d.getMonth()]}`,
        csvLabel: d.toISOString().slice(0, 10),
        startTs: d.getTime(),
        endTs:   next.getTime(),
        isCurrent: i === 0,
      });
    }
    return buckets;
  }

  if (granularityId === "week") {
    // Semana ISO (lunes 00:00 — domingo 23:59:59).
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7);
      const end   = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      const endVisible = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: `${start.getDate()} ${MES_ABBR[start.getMonth()]}`,
        tooltipLabel: `Sem. ${start.getDate()} ${MES_ABBR[start.getMonth()]} – ${endVisible.getDate()} ${MES_ABBR[endVisible.getMonth()]}`,
        csvLabel: `Semana ${start.toISOString().slice(0, 10)}`,
        startTs: start.getTime(),
        endTs:   end.getTime(),
        isCurrent: i === 0,
      });
    }
    return buckets;
  }

  // month
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: `${MES_ABBR[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`,
      tooltipLabel: `${MES_FULL[start.getMonth()]} ${start.getFullYear()}`,
      csvLabel: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      startTs: start.getTime(),
      endTs:   end.getTime(),
      isCurrent: i === 0,
    });
  }
  return buckets;
}

function leadsInBucket(leads, bucket) {
  return leads.filter(l => {
    if (!l.created_at) return false;
    const t = new Date(l.created_at).getTime();
    return !Number.isNaN(t) && t >= bucket.startTs && t < bucket.endTs;
  });
}

// ── Utilidades de export ────────────────────────────────────────────────────
function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function htmlEscape(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadFile(filename, content, mimeType = "text/html;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 200);
}

// ── Componente principal ────────────────────────────────────────────────────
const ComandoDirectivo = ({ leadsData = [], T: _T, theme = "dark" }) => {
  const isLight = theme === "light";
  const T = _T || (isLight ? LP : P);
  const { config: clientConfig } = useClient();
  const clientDisplayName = clientConfig?.legalName || clientConfig?.name || "Stratos";
  const [granularityId, setGranularityId] = useState("week");
  // Cantidad de buckets por granularidad — independiente para cada tab.
  // Permite que el usuario haga zoom in/out sin perder el contexto al cambiar
  // de tab. Default = "lo del día/semana/mes" actual + un poco de contexto.
  const [bucketCounts, setBucketCounts] = useState({ day: 7, week: 4, month: 3 });
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
  const [tab, setTab] = useState("indicadores");

  // El panel CRUD operativo (ZoomControl) solo tiene sentido si la tabla
  // zoom_agendados existe (migración 027). Mientras no esté aplicada en este
  // proyecto, lo ocultamos: el tablero ZoomBoard ya da la métrica real desde el
  // pipeline, así que un panel vacío + aviso de migración solo confunde.
  const { error: zoomTableError } = useZoomAgendados();
  const zoomTableMissing = zoomTableError === "missing_table";

  const granularity = GRANULARITIES.find(g => g.id === granularityId) || GRANULARITIES[1];
  const bucketCount = bucketCounts[granularityId] ?? granularity.defaultCount;
  const setBucketCount = (n) => setBucketCounts(b => ({ ...b, [granularityId]: n }));

  // Buckets temporales del período seleccionado.
  const buckets = useMemo(
    () => buildBuckets(granularityId, bucketCount),
    [granularityId, bucketCount],
  );

  // Para cada bucket: leads filtrados + 7 indicadores ya computados.
  const series = useMemo(() => {
    return buckets.map(b => {
      const inB = leadsInBucket(leadsData, b);
      const row = {
        label: b.label,
        tooltipLabel: b.tooltipLabel,
        csvLabel: b.csvLabel,
        isCurrent: b.isCurrent,
      };
      for (const ind of INDICATORS) row[ind.key] = ind.compute(inB);
      return row;
    });
  }, [buckets, leadsData]);

  // Leads creados dentro del rango temporal visible.
  const rangeLeads = useMemo(() => {
    const firstStart = buckets[0]?.startTs ?? null;
    const lastEnd    = buckets[buckets.length - 1]?.endTs ?? null;
    if (firstStart === null || lastEnd === null) return leadsData;
    return leadsData.filter(l => {
      if (!l.created_at) return false;
      const t = new Date(l.created_at).getTime();
      return !Number.isNaN(t) && t >= firstStart && t < lastEnd;
    });
  }, [buckets, leadsData]);

  // ── Dos vistas de totales, ambas reales y coordinadas con el CRM ──────────
  //
  // 1) `snapshotTotals` — ESTADO ACTUAL del pipeline completo. Coincide con
  //    los KPIs del CRM (Pipeline por Etapa, Zooms Totales) porque corre sobre
  //    TODOS los leads de leadsData sin filtro temporal. Es lo que dirección
  //    quiere ver al entrar al Comando Directivo.
  //
  // 2) `rangeTotals` — FLUJO del período seleccionado. Cuenta solo leads
  //    creados dentro del rango temporal visible. Equivale a la suma de las
  //    barras del chart (un lead cae en exactamente un bucket). Esto alimenta
  //    el footer "Total del rango" de la tabla de evolución y la tabla por
  //    asesor.
  //
  // Las KPI cards muestran el snapshot (estado actual) para que el número de
  // "Zooms agendados" en el dashboard coincida con el chip "Zoom Agendado 14"
  // del CRM. El chart y la tabla siguen siendo flow-based porque su propósito
  // es mostrar evolución temporal.
  const snapshotTotals = useMemo(() => {
    const t = {};
    for (const ind of INDICATORS) t[ind.key] = ind.compute(leadsData);
    return t;
  }, [leadsData]);

  // Embudo de conversión comercial: del lead al cierre. Etapas anidadas (cada
  // una es subconjunto de la anterior), así el embudo SIEMPRE desciende y se lee
  // de un vistazo dónde se caen los clientes. Recorridos/Cierres se calculan aquí
  // (no están en INDICATORS); agendados/realizados vienen del snapshot (funnel-entry).
  const funnel = useMemo(() => {
    let rec = 0, cie = 0;
    for (const l of leadsData) {
      if (milestoneOf(l, RECORRIDO_STAGES)) rec++;
      if (milestoneOf(l, CIERRE_STAGES)) cie++;
    }
    const total = leadsData.length;
    const stages = [
      { label: "Leads totales",      value: total,                       color: "#64748B", icon: Users },
      { label: "Zoom agendado",      value: snapshotTotals.zoomScheduled, color: "#2563EB", icon: CalendarDays },
      { label: "Zoom realizado",     value: snapshotTotals.zoomDone,      color: "#10B981", icon: CheckCircle2 },
      { label: "Recorrido / visita", value: rec,                          color: "#06B6D4", icon: MapPin },
      { label: "Apartó / Cierre",    value: cie,                          color: T.accent,  icon: Handshake },
    ];
    const max = Math.max(1, ...stages.map(s => s.value));
    return { stages, max };
  }, [leadsData, snapshotTotals, T.accent]);

  const rangeTotals = useMemo(() => {
    const t = {};
    for (const ind of INDICATORS) t[ind.key] = ind.compute(rangeLeads);
    return t;
  }, [rangeLeads]);

  // ── Export — Reporte ejecutivo en PDF (vectorial, jsPDF) ──────────────────
  // Construye el PDF dibujando texto/tablas con jsPDF (ver ComandoDirectivo.pdf
  // .js): texto seleccionable, peso mínimo y márgenes A4 correctos por
  // construcción — el contenido nunca toca el borde ni se parte entre páginas.
  // El `html` que se arma abajo queda SOLO como fallback imprimible por si el
  // import de jsPDF fallara en algún navegador exótico.
  const handleExport = async () => {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const hhmm  = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const periodSpan = buckets.length > 0
      ? `${buckets[0].csvLabel} → ${buckets[buckets.length - 1].csvLabel}`
      : "—";

    const asesores = [...new Set(rangeLeads.map(l => l.asesor).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"));

    // KPIs derivados — útiles para dirección.
    const totalLeads     = rangeLeads.length;
    const tasaCalif      = totalLeads ? Math.round((rangeTotals.qualified / totalLeads) * 100) : 0;
    const tasaZoomSobreCal = rangeTotals.qualified
      ? Math.round((rangeTotals.zoomDone / rangeTotals.qualified) * 100)
      : 0;
    const promedioSeguim = totalLeads
      ? (rangeTotals.followUps / totalLeads).toFixed(1)
      : "0.0";

    const maxIndVal = Math.max(1, ...INDICATORS.map(i => snapshotTotals[i.key] || 0));

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
    font-size: 22px; font-weight: 700; letter-spacing: -0.022em;
    color: var(--ink); line-height: 1.1;
  }
  .brand .badge {
    display: inline-block;
    background: linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%);
    color: #fff;
    font-size: 9.5px; font-weight: 700; padding: 4px 10px; border-radius: 99px;
    margin-left: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    vertical-align: middle; box-shadow: 0 1px 2px rgba(16,185,129,0.25);
  }
  .meta {
    font-size: 10.5px; color: var(--ink3); text-align: right;
    line-height: 1.65; letter-spacing: 0.005em;
  }
  .meta strong { color: var(--ink); font-weight: 600; }
  h1 {
    font-size: 28px; font-weight: 700; margin: 6px 0 8px;
    letter-spacing: -0.028em; color: var(--ink);
  }
  .subtitle {
    font-size: 12.5px; color: var(--ink2); margin: 0 0 32px;
    line-height: 1.55;
  }
  .subtitle strong { color: var(--ink); font-weight: 600; }
  h2 {
    font-size: 11.5px; font-weight: 700; text-transform: uppercase;
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
    font-size: 9.5px; font-weight: 700; color: var(--ink3);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .stat .value {
    font-size: 30px; font-weight: 700; color: var(--ink);
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
    font-size: 14px; font-weight: 700; color: var(--ink);
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
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--ink2);
    background: var(--line3); border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  table th:first-child, table td:first-child { text-align: left; font-weight: 500; }
  table tbody tr:nth-child(even) { background: #FCFDFE; }
  table tbody tr:hover { background: var(--green-soft); }
  table tfoot td {
    font-weight: 800; background: var(--green-soft); color: var(--green-deep);
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
    color: #fff; font-weight: 700;
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
      Pipeline en vivo: <strong>${leadsData.length}</strong> leads totales ·
      ${asesores.length} asesores activos en el rango ·
      Rango analizado: <strong>${htmlEscape(periodSpan)}</strong>
    </p>

    <h2>Pipeline actual</h2>
    <div class="summary">
      <div class="stat">
        <div class="label">Pipeline total</div>
        <div class="value">${leadsData.length}</div>
        <div class="sub">leads en el CRM</div>
      </div>
      <div class="stat">
        <div class="label">Zooms agendados</div>
        <div class="value">${snapshotTotals.zoomScheduled}</div>
        <div class="sub">estado actual</div>
      </div>
      <div class="stat">
        <div class="label">Zooms realizados</div>
        <div class="value">${snapshotTotals.zoomDone}</div>
        <div class="sub">estado actual</div>
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
        <div class="label">Tasa de calificación</div>
        <div class="value">${tasaCalif}%</div>
        <div class="sub">${rangeTotals.qualified} de ${totalLeads || 0}</div>
      </div>
      <div class="stat">
        <div class="label">Conversión a Zoom</div>
        <div class="value">${tasaZoomSobreCal}%</div>
        <div class="sub">zooms realizados / calificados</div>
      </div>
      <div class="stat">
        <div class="label">Seguim. por lead</div>
        <div class="value">${promedioSeguim}</div>
        <div class="sub">promedio del rango</div>
      </div>
    </div>

    <h2>Indicadores clave — estado actual del CRM</h2>
    <div class="ind-grid">
      ${INDICATORS.map(ind => {
        const val = snapshotTotals[ind.key] || 0;
        const w = Math.max(2, Math.round((val / maxIndVal) * 100));
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
            const leadsOf = rangeLeads.filter(l => l.asesor === ases);
            return `
            <tr>
              <td>${htmlEscape(ases)}</td>
              <td>${leadsOf.length}</td>
              ${INDICATORS.map(i => `<td>${i.compute(leadsOf)}</td>`).join("")}
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
    const dailyNote = granularityId === "day"
      ? '"Asignados" = leads registrados ese día. Las demás columnas reflejan el estado actual de esos leads en el pipeline, no una acción puntual del día.'
      : '"Asignados" = leads registrados en el periodo. Las demás columnas reflejan el estado actual de esos leads en el pipeline.';

    const model = {
      meta: {
        clientName: clientDisplayName,
        stamp, hhmm,
        granularityLabel: granularity.label,
        periodsCount: buckets.length,
        periodSpan,
        totalLeadsPipeline: leadsData.length,
        asesoresCount: asesores.length,
      },
      pipelineCards: [
        { label: "Pipeline total",    value: String(leadsData.length),             sub: "leads en el CRM", color: "#10B981" },
        { label: "Zooms agendados",   value: String(snapshotTotals.zoomScheduled),  sub: "estado actual",   color: COLORS_BY_KEY.zoomScheduled },
        { label: "Zooms realizados",  value: String(snapshotTotals.zoomDone),       sub: "estado actual",   color: COLORS_BY_KEY.zoomDone },
        { label: "Activos post-Zoom", value: String(snapshotTotals.activePostZoom), sub: "estado actual",   color: COLORS_BY_KEY.activePostZoom },
      ],
      rangeCards: [
        { label: "Leads nuevos",         value: String(totalLeads),     sub: "creados en el rango",        color: "#6EE7C2" },
        { label: "Tasa de calificación", value: `${tasaCalif}%`,        sub: `${rangeTotals.qualified} de ${totalLeads || 0}`, color: "#0EA5E9" },
        { label: "Conversión a Zoom",    value: `${tasaZoomSobreCal}%`, sub: "realizados / calificados",   color: "#2563EB" },
        { label: "Seguim. por lead",     value: String(promedioSeguim), sub: "promedio del rango",         color: "#EA580C" },
      ],
      indicators: INDICATORS.map(ind => ({
        label: FULL_LABELS[ind.key] || ind.label,
        value: snapshotTotals[ind.key] || 0,
        color: COLORS_BY_KEY[ind.key] || "#10B981",
      })),
      evolution: {
        title: `Evolución temporal  -  ${granularity.label}`,
        note: dailyNote,
        cols: evolutionCols(INDICATORS.length),
        headers: ["Período", ...INDICATORS.map(i => i.label)],
        rows: series.map(r => [r.csvLabel, ...INDICATORS.map(i => r[i.key] || 0)]),
        totals: ["Total del rango", ...INDICATORS.map(i => rangeTotals[i.key] || 0)],
      },
      asesores: {
        cols: asesorCols(INDICATORS.length),
        headers: ["Asesor", "Leads", ...INDICATORS.map(i => i.label)],
        rows: asesores.map(ases => {
          const leadsOf = rangeLeads.filter(l => l.asesor === ases);
          return [ases, leadsOf.length, ...INDICATORS.map(i => i.compute(leadsOf))];
        }),
      },
    };

    const filenameBase = `comando-directivo_${granularity.label.toLowerCase()}_${stamp}`;
    try {
      const { default: JsPDF } = await import("jspdf");
      const doc = buildExecutivePdf(JsPDF, model);
      doc.save(`${filenameBase}.pdf`);
    } catch (err) {
      // Navegador donde jsPDF no cargó: descargamos el HTML imprimible.
      console.warn("[Comando Directivo] PDF directo falló — fallback a HTML imprimible:", err);
      downloadFile(`${filenameBase}.html`, html);
    }
  };

  // ── Export de la tabla — CSV plano con los indicadores por período ──────
  const handleExportTable = () => {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const header = ["Período", ...INDICATORS.map(i => FULL_LABELS[i.key] || i.label)];
    const rows = series.map(r => [r.csvLabel, ...INDICATORS.map(i => r[i.key] || 0)]);
    const totalsRow = ["Total del rango", ...INDICATORS.map(i => rangeTotals[i.key] || 0)];
    const csv = [header, ...rows, totalsRow].map(r => r.map(csvEscape).join(",")).join("\n");
    // BOM UTF-8 — Excel/Numbers reconocen acentos sin pelearse.
    const filename = `indicadores_${granularity.label.toLowerCase()}_${stamp}.csv`;
    downloadFile(filename, "﻿" + csv, "text/csv;charset=utf-8");
  };

  // ── Chart helpers ─────────────────────────────────────────────────────────
  const toggleSeries = (key) => setHiddenSeries(h => ({ ...h, [key]: !h[key] }));
  const visibleIndicators = INDICATORS.filter(i => !hiddenSeries[i.key]);

  const accent = T.accent;
  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Pestañas: Indicadores / Control de Zooms (solo si zoomControl) ─── */}
      {showZoomTab && (
        <div style={{
          display: "inline-flex", gap: 4, padding: 4, borderRadius: 14,
          background: headerBg, border: `1px solid ${rowBorder}`, alignSelf: "flex-start",
        }}>
          {[
            { id: "indicadores", label: "Indicadores · Leads" },
            { id: "zooms", label: "Indicadores · Zooms" },
            { id: "productividad", label: "Indicadores · Productividad" },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: active ? 700 : 600, fontFamily: fontDisp,
                background: active ? (isLight ? T.accent : `${T.accent}22`) : "transparent",
                color: active ? (isLight ? "#06080F" : T.accent) : T.txt2,
                transition: "all 0.15s",
              }}>{t.label}</button>
            );
          })}
        </div>
      )}

      {(!showZoomTab || tab === "indicadores") && (
      <>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
            {showZoomTab ? "Filtro 1 · Control de Leads" : "Comando Directivo"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
            {showZoomTab
              ? <>Primer filtro comercial · del lead al Zoom (entrada → contacto → calificación → Zoom) · vista <strong style={{ color: T.txt2 }}>{granularity.label}</strong> · {rangeLeads.length} leads en el rango</>
              : <>Indicadores ejecutivos del equipo · vista <strong style={{ color: T.txt2 }}>{granularity.label}</strong> · {rangeLeads.length} leads en el rango</>}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div role="tablist" aria-label="Granularidad" style={{
            display: "flex", gap: 4, padding: 3, borderRadius: 10,
            background: headerBg, border: `1px solid ${rowBorder}`,
          }}>
            {GRANULARITIES.map(g => {
              const active = g.id === granularityId;
              return (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setGranularityId(g.id)}
                  style={{
                    padding: "7px 16px", borderRadius: 7,
                    background: active ? accent : "transparent",
                    color: active ? (isLight ? "#0B1220" : "#06080F") : T.txt2,
                    border: "none",
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    fontFamily: fontDisp, cursor: "pointer",
                    transition: "background 0.14s, color 0.14s",
                  }}
                >{g.label}</button>
              );
            })}
          </div>

          <button
            onClick={handleExport}
            title="Descarga el reporte ejecutivo como PDF — listo para enviar a dirección"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 14px", borderRadius: 9,
              background: isLight
                ? `linear-gradient(135deg, ${accent} 0%, ${accent}DD 100%)`
                : `${accent}18`,
              color: isLight ? "#06080F" : accent,
              border: `1px solid ${isLight ? "transparent" : `${accent}55`}`,
              fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
              letterSpacing: "-0.01em", cursor: "pointer",
              boxShadow: isLight ? `0 2px 8px ${accent}40` : "none",
              transition: "all 0.15s",
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
            Generar PDF
          </button>
        </div>
      </div>

      {/* ── 0) Embudo de conversión — el visual principal, claro de un vistazo ── */}
      <G T={T}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.014em" }}>
            Embudo de conversión
          </p>
          <p style={{ fontSize: 11, color: T.txt3, fontFamily: font, margin: "3px 0 0", lineHeight: 1.5 }}>
            Del lead al cierre · cuántos avanzan en cada etapa y dónde se caen. Cada barra es proporcional al total de leads.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {funnel.stages.map((s, i) => {
            const Icon = s.icon;
            const widthPct = Math.max(4, Math.round((s.value / funnel.max) * 100));
            const prev = i > 0 ? funnel.stages[i - 1].value : null;
            const conv = prev ? Math.round((s.value / prev) * 100) : null;
            return (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 150, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", padding: 6, borderRadius: 8, background: `${s.color}1A`, flexShrink: 0 }}>
                    <Icon size={14} color={s.color} strokeWidth={2.2} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.txt2, fontFamily: font, lineHeight: 1.2 }}>{s.label}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, height: 34, borderRadius: 8, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <div style={{
                      width: `${widthPct}%`, height: "100%", borderRadius: 8,
                      background: s.color, display: "flex", alignItems: "center", paddingLeft: 12,
                      transition: "width 0.3s ease",
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#06080F", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{s.value.toLocaleString("es-MX")}</span>
                    </div>
                  </div>
                  <span style={{ width: 84, flexShrink: 0, fontSize: 11, color: T.txt3, fontFamily: font, textAlign: "right" }}>
                    {conv !== null ? <><strong style={{ color: T.txt2 }}>{conv}%</strong> del previo</> : "100%"}
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
            <p style={{ fontSize: 14.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.014em" }}>
              Evolución de indicadores
            </p>
            <p style={{ fontSize: 11, color: T.txt3, fontFamily: font, margin: "3px 0 0", lineHeight: 1.5 }}>
              {granularityId === "day"
                ? <>Mostrando <strong style={{ color: T.txt2 }}>{bucketCount === 1 ? "hoy" : `los últimos ${bucketCount} días`}</strong> — granularidad diaria.</>
                : granularityId === "week"
                ? <>Mostrando <strong style={{ color: T.txt2 }}>{bucketCount === 1 ? "esta semana" : `las últimas ${bucketCount} semanas`}</strong> — granularidad semanal.</>
                : <>Mostrando <strong style={{ color: T.txt2 }}>{bucketCount === 1 ? "este mes" : `los últimos ${bucketCount} meses`}</strong> — granularidad mensual.</>
              }
              {" "}Por defecto muestra <strong style={{ color: T.txt2 }}>Zooms agendados y realizados</strong>; prende más series con los chips de la leyenda.
            </p>
          </div>

          {/* Selector de rango — chips por granularidad activa */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Rango
            </span>
            <div role="radiogroup" aria-label="Rango temporal" style={{
              display: "inline-flex", gap: 2, padding: 2, borderRadius: 9,
              background: headerBg, border: `1px solid ${rowBorder}`,
            }}>
              {granularity.ranges.map(n => {
                const active = n === bucketCount;
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBucketCount(n)}
                    style={{
                      padding: "5px 11px", borderRadius: 7,
                      background: active ? accent : "transparent",
                      color: active ? (isLight ? "#0B1220" : "#06080F") : T.txt2,
                      border: "none",
                      fontSize: 11, fontWeight: active ? 700 : 600,
                      fontFamily: fontDisp, cursor: "pointer",
                      letterSpacing: "-0.005em",
                      fontVariantNumeric: "tabular-nums",
                      transition: "background 0.14s, color 0.14s",
                    }}
                  >{n} {granularity.unit}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Leyenda interactiva — chips toggleables */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {INDICATORS.map(ind => {
            const c = COLORS_BY_KEY[ind.key] || accent;
            const hidden = !!hiddenSeries[ind.key];
            return (
              <button
                key={ind.key}
                onClick={() => toggleSeries(ind.key)}
                title={hidden ? "Mostrar serie" : "Ocultar serie"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 99,
                  background: hidden
                    ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)")
                    : (isLight ? `${c}14` : `${c}22`),
                  border: `1px solid ${hidden
                    ? (isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)")
                    : `${c}55`}`,
                  color: hidden ? T.txt3 : (isLight ? `color-mix(in srgb, ${c} 60%, #0B1220)` : c),
                  fontSize: 11, fontWeight: 600, fontFamily: fontDisp,
                  letterSpacing: "0.005em", cursor: "pointer",
                  transition: "all 0.14s",
                  opacity: hidden ? 0.55 : 1,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: hidden ? T.txt3 : c,
                  boxShadow: hidden ? "none" : `0 0 6px ${c}88`,
                }} />
                {FULL_LABELS[ind.key] || ind.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
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
                tick={{ fill: T.txt3, fontSize: 10.5, fontFamily: fontDisp, fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)" }}
                interval={bucketCount > 20 ? "preserveStartEnd" : 0}
                minTickGap={6}
                angle={granularityId === "day" && bucketCount > 14 ? -28 : 0}
                dy={granularityId === "day" && bucketCount > 14 ? 8 : 4}
                height={granularityId === "day" && bucketCount > 14 ? 54 : 32}
              />
              <YAxis
                allowDecimals={false}
                stroke={T.txt3}
                tick={{ fill: T.txt3, fontSize: 10.5, fontFamily: fontDisp, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              {/* Marca "Hoy" — solo cuando hay más de un bucket, para
                  no taparlo cuando bucketCount = 1. */}
              {series.length > 1 && (
                <ReferenceLine
                  x={series[series.length - 1].label}
                  stroke={isLight ? "rgba(15,23,42,0.30)" : "rgba(255,255,255,0.25)"}
                  strokeDasharray="2 4"
                  strokeWidth={1}
                  label={{
                    value: "Hoy", position: "top",
                    fill: T.txt2, fontSize: 10, fontWeight: 700,
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

      {/* ── 2) Tabla de indicadores por período ──────────────────────────── */}
      <G T={T}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.012em" }}>
              Tabla de indicadores
            </p>
            <p style={{ fontSize: 11, color: T.txt3, fontFamily: font, margin: "2px 0 0" }}>
              Vista <strong style={{ color: T.txt2 }}>{granularity.label.toLowerCase()}</strong> · {series.length} períodos · cambia con las tabs de arriba.
            </p>
          </div>
          <button
            onClick={handleExportTable}
            title="Descargar la tabla como CSV (abre en Excel / Numbers / Google Sheets)"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "7px 12px", borderRadius: 8,
              background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
              color: T.txt2,
              border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
              fontSize: 11.5, fontWeight: 600, fontFamily: fontDisp,
              letterSpacing: "-0.005em", cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = isLight ? `${accent}14` : `${accent}22`;
              e.currentTarget.style.borderColor = `${accent}55`;
              e.currentTarget.style.color = isLight ? T.accentDark || accent : accent;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)";
              e.currentTarget.style.color = T.txt2;
            }}
          >
            <Download size={12} strokeWidth={2.4} />
            Descargar tabla (CSV)
          </button>
        </div>

        <div style={{
          overflowX: "auto",
          border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: 12,
          background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.015)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ background: isLight ? "rgba(15,23,42,0.035)" : "rgba(255,255,255,0.035)" }}>
                <th style={tableHeadStyle(T, "left")}>Período</th>
                {INDICATORS.map(ind => {
                  const c = COLORS_BY_KEY[ind.key] || accent;
                  return (
                    <th key={ind.key} title={ind.title} style={tableHeadStyle(T, "right")}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
                        {FULL_LABELS[ind.key] || ind.label}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {series.length === 0 && (
                <tr>
                  <td colSpan={INDICATORS.length + 1} style={{ padding: 24, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 12.5 }}>
                    No hay datos en el rango seleccionado.
                  </td>
                </tr>
              )}
              {series.map((r, idx) => {
                const isLastFew = idx >= series.length - (granularityId === "day" ? 3 : granularityId === "week" ? 2 : 1);
                return (
                  <tr key={r.csvLabel} style={{
                    borderTop: idx === 0 ? "none" : `1px solid ${isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.04)"}`,
                    background: isLastFew
                      ? (isLight ? `${accent}07` : `${accent}0E`)
                      : "transparent",
                    transition: "background 0.14s",
                  }}>
                    <td style={tableCellStyle(T, "left", true)}>
                      {r.csvLabel}
                    </td>
                    {INDICATORS.map(ind => (
                      <td key={ind.key} style={tableCellStyle(T, "right")}>
                        {r[ind.key] || 0}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            {series.length > 0 && (
              <tfoot>
                <tr style={{
                  borderTop: `2px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)"}`,
                  background: isLight ? `${accent}10` : `${accent}1A`,
                }}>
                  <td style={{ ...tableCellStyle(T, "left", true), fontWeight: 800, color: isLight ? T.accentDark || accent : accent, textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.05em" }}>
                    Total del rango
                  </td>
                  {INDICATORS.map(ind => (
                    <td key={ind.key} style={{ ...tableCellStyle(T, "right"), fontWeight: 800, color: isLight ? T.accentDark || accent : accent }}>
                      {rangeTotals[ind.key] || 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p style={{ margin: "10px 4px 0", fontSize: 10.5, color: T.txt3, fontFamily: font, lineHeight: 1.55 }}>
          <strong style={{ color: T.txt2, fontFamily: fontDisp, fontWeight: 700 }}>Cómo leer cada {granularity.label.toLowerCase()}:</strong>{" "}
          <strong style={{ color: T.txt2 }}>Leads asignados</strong> = lo que se registró ese {granularity.label.toLowerCase()} (leads nuevos creados). Las demás columnas muestran el <strong style={{ color: T.txt2 }}>estado actual</strong> en el pipeline de esos mismos leads, no una acción puntual del {granularity.label.toLowerCase()}.
        </p>
      </G>

      {/* ── 3) KPI cards — snapshot del pipeline actual (coordina con CRM) ── */}
      <div>
        <p style={{ fontSize: 11, color: T.txt3, fontFamily: font, margin: "0 0 8px 4px", letterSpacing: "0.01em" }}>
          <strong style={{ color: T.txt2, fontFamily: fontDisp, fontWeight: 700 }}>Pipeline actual</strong> · sobre el total de {leadsData.length} leads del CRM en vivo
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))",
          gap: 12,
        }}>
        {INDICATORS.map(ind => {
          const Icon = ICONS_BY_KEY[ind.key] || Activity;
          const c = COLORS_BY_KEY[ind.key] || accent;
          const val = snapshotTotals[ind.key];
          const rangeVal = rangeTotals[ind.key];
          return (
            <div
              key={ind.key}
              title={ind.title}
              style={{
                borderRadius: 14,
                padding: "14px 16px",
                background: isLight
                  ? "linear-gradient(160deg, #FFFFFF 0%, rgba(255,255,255,0.85) 100%)"
                  : "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)"}`,
                boxShadow: isLight
                  ? "0 1px 3px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.9)"
                  : "0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
                display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Subtle top-color accent strip */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, ${c}, ${c}88, transparent)`,
                opacity: 0.85,
              }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  color: T.txt3, fontFamily: fontDisp,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{FULL_LABELS[ind.key] || ind.label}</span>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${c}1F`, border: `1px solid ${c}40`,
                }}>
                  <Icon size={13} color={c} strokeWidth={2.2} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {val}
              </div>
              <span style={{
                fontSize: 10, color: T.txt3, fontFamily: font,
                letterSpacing: "0.01em",
              }}>
                <strong style={{ color: c, fontWeight: 700 }}>+{rangeVal}</strong> en {granularity.label.toLowerCase()}
              </span>
            </div>
          );
        })}
        </div>
      </div>

      {/* ── 4) Desglose por asesor (coordinado con CRM) ─────────────────── */}
      <AdvisorMetrics leadsData={leadsData} theme={isLight ? "light" : "dark"} />
      </>
      )}

      {showZoomTab && tab === "zooms" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Métrica real de Zooms (pipeline + historial) — siempre con datos. */}
          <ZoomBoard leadsData={leadsData} theme={isLight ? "light" : "dark"} />
          {/* Panel operativo CRUD sobre zoom_agendados — solo si la tabla existe
              (migración 027 aplicada). Si no, no lo mostramos: el ZoomBoard de
              arriba ya cubre la métrica desde el pipeline. */}
          {!zoomTableMissing && <ZoomControl theme={isLight ? "light" : "dark"} />}
        </div>
      )}

      {showZoomTab && tab === "productividad" && (
        <ProductividadTab T={T} isLight={isLight} />
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
  const total = items.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: isLight ? "#FFFFFF" : "#0E1320",
      border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
      borderRadius: 12,
      padding: "10px 14px",
      fontFamily: font, fontSize: 12,
      boxShadow: "0 12px 32px rgba(0,0,0,0.20)",
      minWidth: 200,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.txt, fontFamily: fontDisp,
        letterSpacing: "-0.005em",
        marginBottom: 8, paddingBottom: 7,
        borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.07)"}`,
      }}>{fullLabel}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map(p => (
          <div key={p.dataKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: T.txt2, fontFamily: fontDisp, fontSize: 11.5, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
              {FULL_LABELS[p.dataKey] || p.dataKey}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontVariantNumeric: "tabular-nums", fontFamily: fontDisp }}>
              {p.value || 0}
            </span>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.07)"}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Total
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.txt, fontVariantNumeric: "tabular-nums", fontFamily: fontDisp }}>
            {total}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Estilos de tabla compartidos ─────────────────────────────────────────────
function tableHeadStyle(T, align = "right") {
  return {
    padding: "11px 14px",
    textAlign: align,
    fontSize: 10.5, fontWeight: 700,
    color: T.txt2, fontFamily: fontDisp,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${T.bg === "#060A11" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
  };
}

function tableCellStyle(T, align = "right", bold = false) {
  return {
    padding: "10px 14px",
    textAlign: align,
    fontSize: 12.5,
    fontWeight: bold ? 600 : 500,
    color: T.txt,
    fontFamily: fontDisp,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };
}

export default ComandoDirectivo;
