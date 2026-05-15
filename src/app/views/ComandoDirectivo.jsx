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
  CartesianGrid, Legend,
} from "recharts";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G } from "../SharedComponents";
import AdvisorMetrics, { INDICATORS } from "./CRM/AdvisorMetrics";

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

// ── CSV utilities ───────────────────────────────────────────────────────────
function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFile(filename, content, mimeType = "text/csv;charset=utf-8") {
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

  // Totales del rango visible (suma de cada serie). Para "activePostZoom"
  // y zooms agendados/realizados que reflejan estado actual, mostramos el
  // último bucket (= valor actual) en vez de la suma — es lo que realmente
  // interesa ver al director.
  const rangeTotals = useMemo(() => {
    const t = {};
    const last = series[series.length - 1] || {};
    for (const ind of INDICATORS) {
      if (["zoomScheduled","zoomDone","activePostZoom"].includes(ind.key)) {
        // Snapshot-style — el dato útil es el del bucket más reciente.
        t[ind.key] = last[ind.key] || 0;
      } else {
        t[ind.key] = series.reduce((s, r) => s + (r[ind.key] || 0), 0);
      }
    }
    return t;
  }, [series]);

  // Asesores únicos con leads en el rango.
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

  // ── Export CSV (KPIs/OKRs) ────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [];
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

    rows.push(["Reporte ejecutivo — Comando Directivo"]);
    rows.push([`Generado: ${stamp} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`]);
    rows.push([`Granularidad: ${granularity.label}`]);
    rows.push([`Leads en el rango: ${rangeLeads.length}`]);
    rows.push([]);

    // Sección 1 — Evolución temporal por bucket.
    rows.push(["EVOLUCIÓN TEMPORAL"]);
    rows.push(["Período", ...INDICATORS.map(i => FULL_LABELS[i.key] || i.label)]);
    for (const r of series) {
      rows.push([r.csvLabel, ...INDICATORS.map(i => r[i.key] || 0)]);
    }
    rows.push([]);

    // Sección 2 — Totales del rango.
    rows.push(["TOTALES DEL RANGO"]);
    rows.push(["Indicador", "Valor", "Tipo"]);
    for (const ind of INDICATORS) {
      const isSnapshot = ["zoomScheduled","zoomDone","activePostZoom"].includes(ind.key);
      rows.push([
        FULL_LABELS[ind.key] || ind.label,
        rangeTotals[ind.key],
        isSnapshot ? "Estado actual" : "Acumulado del rango",
      ]);
    }
    rows.push([]);

    // Sección 3 — Por asesor (snapshot del rango).
    rows.push(["DESGLOSE POR ASESOR"]);
    rows.push(["Asesor", "Leads en el rango", ...INDICATORS.map(i => FULL_LABELS[i.key] || i.label)]);
    const asesores = [...new Set(rangeLeads.map(l => l.asesor).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    for (const ases of asesores) {
      const leadsOf = rangeLeads.filter(l => l.asesor === ases);
      rows.push([ases, leadsOf.length, ...INDICATORS.map(i => i.compute(leadsOf))]);
    }
    if (asesores.length === 0) {
      rows.push(["(sin asesores con leads en el rango)"]);
    }

    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    // BOM para que Excel reconozca UTF-8 correctamente.
    const filename = `comando-directivo_${granularity.label.toLowerCase()}_${stamp}.csv`;
    downloadFile(filename, "﻿" + csv);
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
            title="Descargar reporte CSV con todos los KPIs y OKRs para enviar a dirección"
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

      {/* ── 2) KPI cards — totales del rango ─────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))",
        gap: 12,
      }}>
        {INDICATORS.map(ind => {
          const Icon = ICONS_BY_KEY[ind.key] || Activity;
          const c = COLORS_BY_KEY[ind.key] || accent;
          const val = rangeTotals[ind.key];
          const isSnapshot = ["zoomScheduled","zoomDone","activePostZoom"].includes(ind.key);
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
                {isSnapshot ? "Estado actual del pipeline" : `Acumulado · ${granularity.label.toLowerCase()}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── 3) Desglose por asesor (coordinado con CRM) ─────────────────── */}
      <AdvisorMetrics leadsData={leadsData} theme={isLight ? "light" : "dark"} />
    </div>
  );
};

export default ComandoDirectivo;
