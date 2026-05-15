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
  RefreshCw, Download,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G } from "../SharedComponents";
import AdvisorMetrics, { INDICATORS } from "./CRM/AdvisorMetrics";
import { useClient } from "../../hooks/useClient";

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

// Paleta para cada serie — alto contraste, accesible y consistente con el
// design system. Se usan tanto en la gráfica como en los chips de leyenda.
const COLORS_BY_KEY = {
  assigned:       "#6EE7C2",
  contacted:      "#38BDF8",
  qualified:      "#A78BFA",
  zoomScheduled:  "#60A5FA",
  zoomDone:       "#34D399",
  activePostZoom: "#FACC15",
  followUps:      "#F472B6",
};

const GRANULARITIES = [
  { id: "day",   label: "Día",    buckets: 14, fmtCsv: "yyyy-mm-dd" },
  { id: "week",  label: "Semana", buckets: 8,  fmtCsv: "yyyy-mm-dd" },
  { id: "month", label: "Mes",    buckets: 6,  fmtCsv: "yyyy-mm"    },
];

const MES_ABBR = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Generación de buckets temporales ────────────────────────────────────────
// Cada bucket: { key, label (eje X), csvLabel, startTs, endTs }.
// Los buckets están ordenados de más antiguo a más reciente (izq → der).
function buildBuckets(granularityId) {
  const now = new Date();
  const buckets = [];

  if (granularityId === "day") {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: `${d.getDate()} ${MES_ABBR[d.getMonth()]}`,
        csvLabel: d.toISOString().slice(0, 10),
        startTs: d.getTime(),
        endTs:   next.getTime(),
      });
    }
    return buckets;
  }

  if (granularityId === "week") {
    // Semana ISO (lunes 00:00 — domingo 23:59:59).
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7);
      const end   = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: `${start.getDate()} ${MES_ABBR[start.getMonth()]}`,
        csvLabel: `Semana ${start.toISOString().slice(0, 10)}`,
        startTs: start.getTime(),
        endTs:   end.getTime(),
      });
    }
    return buckets;
  }

  // month
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: `${MES_ABBR[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`,
      csvLabel: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      startTs: start.getTime(),
      endTs:   end.getTime(),
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
  // Visibilidad por serie — toggleable desde la leyenda.
  const [hiddenSeries, setHiddenSeries] = useState({});

  const granularity = GRANULARITIES.find(g => g.id === granularityId) || GRANULARITIES[1];

  // Buckets temporales del período seleccionado.
  const buckets = useMemo(() => buildBuckets(granularityId), [granularityId]);

  // Para cada bucket: leads filtrados + 7 indicadores ya computados.
  const series = useMemo(() => {
    return buckets.map(b => {
      const inB = leadsInBucket(leadsData, b);
      const row = { label: b.label, csvLabel: b.csvLabel };
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

  // Totales del rango — semántica unificada y coordinada con AdvisorMetrics:
  // "leads creados dentro del rango que satisfacen el indicador". Equivale a
  // sumar las barras del chart (bucket sum), pero lo calculamos directo en
  // rangeLeads para garantizar consistencia entre KPI cards, footer de tabla
  // y la tabla por asesor (que también opera sobre leadsOfAsesor en período).
  const rangeTotals = useMemo(() => {
    const t = {};
    for (const ind of INDICATORS) t[ind.key] = ind.compute(rangeLeads);
    return t;
  }, [rangeLeads]);

  // ── Export — Reporte ejecutivo HTML (imprimible / convertible a PDF) ──────
  // Genera un documento self-contained con fondo blanco, tipografía limpia y
  // todas las secciones ejecutivas. El archivo se descarga como .html y el
  // usuario puede:
  //   1) Abrirlo en cualquier navegador (incluso offline) → ver el reporte.
  //   2) Imprimirlo / Guardar como PDF (Ctrl/Cmd+P) — el CSS @media print
  //      ya está optimizado: márgenes consistentes, page-break-inside: avoid
  //      en tablas, sin botones imprimibles, branding intacto.
  const handleExport = () => {
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
    --bg: #FFFFFF;
    --ink: #0B1220;
    --ink2: #475569;
    --ink3: #94A3B8;
    --line: #E2E8F0;
    --line2: #F1F5F9;
    --accent: #0D9A76;
    --accent-soft: #ECFDF5;
  }
  html, body { background: var(--bg); color: var(--ink); }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Text", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page {
    max-width: 920px; margin: 0 auto; padding: 40px 48px 56px;
  }
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid var(--ink); padding-bottom: 14px; margin-bottom: 28px;
  }
  .brand { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
  .brand .badge {
    display: inline-block; background: var(--accent); color: #fff;
    font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 99px;
    margin-left: 8px; letter-spacing: 0.04em; text-transform: uppercase; vertical-align: middle;
  }
  .meta { font-size: 11px; color: var(--ink2); text-align: right; }
  .meta strong { color: var(--ink); font-weight: 600; }
  h1 {
    font-size: 26px; font-weight: 700; margin: 4px 0 8px;
    letter-spacing: -0.025em;
  }
  .subtitle {
    font-size: 13px; color: var(--ink2); margin: 0 0 28px;
  }
  h2 {
    font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--ink2);
    margin: 32px 0 12px; padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
  }
  .summary {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; margin-bottom: 8px;
  }
  .stat {
    border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px;
    background: #FFFFFF;
  }
  .stat .label {
    font-size: 10px; font-weight: 700; color: var(--ink3);
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .stat .value {
    font-size: 26px; font-weight: 700; color: var(--ink);
    margin-top: 6px; letter-spacing: -0.025em; line-height: 1;
  }
  .stat .sub {
    font-size: 10.5px; color: var(--ink2); margin-top: 6px;
  }
  .ind-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px 24px; margin: 8px 0 0;
  }
  .ind {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 9px 0;
    border-bottom: 1px solid var(--line2);
  }
  .ind:last-child { border-bottom: none; }
  .ind .name { font-size: 12.5px; color: var(--ink); font-weight: 500; }
  .ind .bar-wrap { flex: 1; height: 6px; border-radius: 99px; background: var(--line2); overflow: hidden; }
  .ind .bar { height: 100%; border-radius: 99px; background: var(--accent); }
  .ind .val {
    font-size: 14px; font-weight: 700; color: var(--ink);
    min-width: 36px; text-align: right; font-variant-numeric: tabular-nums;
  }
  table {
    width: 100%; border-collapse: collapse; margin-top: 6px;
    font-size: 11.5px;
  }
  table th, table td {
    padding: 8px 10px; text-align: right;
    border-bottom: 1px solid var(--line2);
    font-variant-numeric: tabular-nums;
  }
  table th {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--ink2);
    background: var(--line2); border-bottom: 1px solid var(--line);
  }
  table th:first-child, table td:first-child { text-align: left; }
  table tbody tr:hover { background: #FAFCFE; }
  table tfoot td {
    font-weight: 700; background: var(--accent-soft); color: var(--ink);
    border-top: 2px solid var(--accent); border-bottom: none;
  }
  .footer {
    margin-top: 40px; padding-top: 14px;
    border-top: 1px solid var(--line);
    font-size: 10px; color: var(--ink3);
    display: flex; justify-content: space-between; gap: 12px;
  }
  .actions {
    position: fixed; top: 16px; right: 16px;
    display: flex; gap: 8px; z-index: 10;
  }
  .btn {
    padding: 8px 14px; border-radius: 8px; border: none;
    background: var(--accent); color: #fff; font-weight: 700;
    font-size: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(13,154,118,0.30);
  }
  .btn.secondary { background: #fff; color: var(--ink); border: 1px solid var(--line); box-shadow: none; }
  @media print {
    .actions { display: none !important; }
    .page { max-width: none; padding: 0 12mm; }
    h2 { page-break-after: avoid; }
    table, .ind-grid, .summary { page-break-inside: avoid; }
    body { font-size: 11.5px; }
    .stat .value { font-size: 22px; }
    h1 { font-size: 22px; }
  }
  @page { size: A4 portrait; margin: 16mm 0; }
</style>
</head>
<body>
  <div class="actions">
    <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
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
      Rango analizado: <strong>${htmlEscape(periodSpan)}</strong> ·
      ${totalLeads} leads creados ·
      ${asesores.length} asesores activos
    </p>

    <h2>Resumen ejecutivo</h2>
    <div class="summary">
      <div class="stat">
        <div class="label">Leads totales</div>
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
        <div class="sub">de leads calificados</div>
      </div>
      <div class="stat">
        <div class="label">Seguim. por lead</div>
        <div class="value">${promedioSeguim}</div>
        <div class="sub">promedio del rango</div>
      </div>
    </div>

    <h2>Indicadores clave</h2>
    <div class="ind-grid">
      ${INDICATORS.map(ind => {
        const val = rangeTotals[ind.key] || 0;
        const w = Math.round((val / maxIndVal) * 100);
        return `
        <div class="ind">
          <div class="name">${htmlEscape(FULL_LABELS[ind.key] || ind.label)}</div>
          <div class="bar-wrap"><div class="bar" style="width: ${w}%"></div></div>
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

    const filename = `comando-directivo_${granularity.label.toLowerCase()}_${stamp}.html`;
    downloadFile(filename, html);
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
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
            Comando Directivo
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
            Indicadores ejecutivos del equipo · vista <strong style={{ color: T.txt2 }}>{granularity.label}</strong> · {rangeLeads.length} leads en el rango
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
            title="Descargar reporte ejecutivo (HTML) — listo para imprimir o guardar como PDF y enviar a dirección"
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
            Descargar reporte
          </button>
        </div>
      </div>

      {/* ── 1) Gráfica grande — evolución en el tiempo ─────────────────────── */}
      <G T={T}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.012em" }}>
              Evolución de indicadores
            </p>
            <p style={{ fontSize: 11, color: T.txt3, fontFamily: font, margin: "2px 0 0" }}>
              {granularityId === "day"   && "Últimos 14 días, granularidad diaria."}
              {granularityId === "week"  && "Últimas 8 semanas, granularidad semanal."}
              {granularityId === "month" && "Últimos 6 meses, granularidad mensual."}
              {" "}Click en la leyenda para enfocar series.
            </p>
          </div>
        </div>

        {/* Leyenda interactiva personalizada — chips toggleables */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
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

        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 4" stroke={isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.05)"} vertical={false} />
              <XAxis
                dataKey="label"
                stroke={T.txt3}
                tick={{ fill: T.txt3, fontSize: 11, fontFamily: fontDisp }}
                tickLine={false}
                axisLine={{ stroke: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.05)" }}
                interval={0}
                minTickGap={4}
                angle={granularityId === "day" ? -20 : 0}
                dy={granularityId === "day" ? 6 : 2}
                height={granularityId === "day" ? 48 : 28}
              />
              <YAxis
                allowDecimals={false}
                stroke={T.txt3}
                tick={{ fill: T.txt3, fontSize: 11, fontFamily: fontDisp }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ stroke: T.txt3, strokeWidth: 1, strokeDasharray: "3 3" }}
                contentStyle={{
                  background: isLight ? "#FFFFFF" : "#0E1320",
                  border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
                  borderRadius: 10,
                  fontFamily: font, fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                  padding: "8px 12px",
                }}
                labelStyle={{ color: T.txt, fontWeight: 700, fontFamily: fontDisp, marginBottom: 4 }}
                itemStyle={{ color: T.txt2, padding: "1px 0" }}
                formatter={(value, _name, entry) => {
                  const k = entry?.dataKey;
                  return [value, FULL_LABELS[k] || k];
                }}
              />
              {visibleIndicators.map(ind => (
                <Line
                  key={ind.key}
                  type="monotone"
                  dataKey={ind.key}
                  stroke={COLORS_BY_KEY[ind.key] || accent}
                  strokeWidth={2.2}
                  dot={{ r: 2.5, strokeWidth: 0, fill: COLORS_BY_KEY[ind.key] || accent }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: isLight ? "#FFFFFF" : "#0E1320" }}
                  isAnimationActive={true}
                  animationDuration={420}
                />
              ))}
            </LineChart>
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
      </G>

      {/* ── 3) KPI cards — totales del rango ─────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))",
        gap: 12,
      }}>
        {INDICATORS.map(ind => {
          const Icon = ICONS_BY_KEY[ind.key] || Activity;
          const c = COLORS_BY_KEY[ind.key] || accent;
          const val = rangeTotals[ind.key];
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
                En este rango · {granularity.label.toLowerCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── 4) Desglose por asesor (coordinado con CRM) ─────────────────── */}
      <AdvisorMetrics leadsData={leadsData} theme={isLight ? "light" : "dark"} />
    </div>
  );
};

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
