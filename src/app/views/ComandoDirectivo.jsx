/**
 * app/views/ComandoDirectivo.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard ejecutivo para clientes que prendieron `features.comandoDirectivo`
 * (hoy: Grupo 28). Reemplaza al Dash de Stratos cuando aplica.
 *
 * Estructura:
 *   1) Header con título + selector de período (Hoy / Semana / Mes).
 *   2) KPI grid — 7 indicadores ejecutivos.
 *   3) Gráfica de barras — los mismos 7 indicadores en una sola vista visual.
 *   4) Tabla por asesor (AdvisorMetrics) — coordinada con el CRM y los asesores.
 *
 * Toda la data viene de `leadsData` (los mismos leads que el CRM consume),
 * así que el dashboard refleja el estado real del pipeline en vivo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import {
  Users, Phone, BadgeCheck, CalendarDays, CheckCircle2, Activity, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G } from "../SharedComponents";
import AdvisorMetrics, {
  INDICATORS, PERIODS, periodStart, leadInPeriod
} from "./CRM/AdvisorMetrics";

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

const ComandoDirectivo = ({ leadsData = [], T: _T, theme = "dark" }) => {
  const isLight = theme === "light";
  const T = _T || (isLight ? LP : P);
  const [periodId, setPeriodId] = useState("week");

  const startTs = useMemo(() => periodStart(periodId), [periodId]);

  // Leads del período seleccionado (created_at dentro del rango).
  const periodLeads = useMemo(
    () => leadsData.filter(l => leadInPeriod(l, startTs)),
    [leadsData, startTs],
  );

  // Total por indicador para los KPI cards + datos para la gráfica.
  const totals = useMemo(() => {
    const t = {};
    for (const ind of INDICATORS) t[ind.key] = ind.compute(periodLeads);
    return t;
  }, [periodLeads]);

  const chartData = useMemo(
    () => INDICATORS.map(ind => ({
      name: FULL_LABELS[ind.key] || ind.label,
      short: ind.label,
      value: totals[ind.key],
      key: ind.key,
    })),
    [totals],
  );

  const periodLabel = PERIODS.find(p => p.id === periodId)?.label || "";
  const accent = T.accent;
  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Header: título + descripción + tabs de período ─────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
            Comando Directivo
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
            Indicadores ejecutivos del equipo · período: <strong style={{ color: T.txt2 }}>{periodLabel}</strong> · {periodLeads.length} leads
          </p>
        </div>
        <div role="tablist" aria-label="Período" style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: headerBg, border: `1px solid ${rowBorder}` }}>
          {PERIODS.map(p => {
            const active = p.id === periodId;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={active}
                onClick={() => setPeriodId(p.id)}
                style={{
                  padding: "7px 16px", borderRadius: 7,
                  background: active ? accent : "transparent",
                  color: active ? (isLight ? "#0B1220" : "#06080F") : T.txt2,
                  border: "none",
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  fontFamily: fontDisp, cursor: "pointer",
                  transition: "background 0.14s, color 0.14s",
                }}
              >{p.label}</button>
            );
          })}
        </div>
      </div>

      {/* ── KPI grid — 7 cards, una por indicador ──────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))",
        gap: 12,
      }}>
        {INDICATORS.map(ind => {
          const Icon = ICONS_BY_KEY[ind.key] || Activity;
          const val = totals[ind.key];
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
              }}
            >
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
                  background: `${accent}18`, border: `1px solid ${accent}30`,
                }}>
                  <Icon size={13} color={accent} strokeWidth={2.2} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {val}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Gráfica de barras ──────────────────────────────────────────────── */}
      <G T={T}>
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.01em" }}>
            Indicadores del equipo
          </p>
          <p style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, margin: "2px 0 0" }}>
            Comparativa visual de los 7 indicadores en el período seleccionado.
          </p>
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 8, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)"} vertical={false} />
              <XAxis
                dataKey="short"
                stroke={T.txt3}
                tick={{ fill: T.txt3, fontSize: 10.5, fontFamily: fontDisp }}
                tickLine={false}
                axisLine={{ stroke: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)" }}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                stroke={T.txt3}
                tick={{ fill: T.txt3, fontSize: 10.5, fontFamily: fontDisp }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: isLight ? "#FFFFFF" : "#0E1320",
                  border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
                  borderRadius: 10,
                  fontFamily: font, fontSize: 12,
                  boxShadow: "0 6px 22px rgba(0,0,0,0.25)",
                }}
                labelStyle={{ color: T.txt, fontWeight: 700, fontFamily: fontDisp }}
                itemStyle={{ color: T.txt2 }}
                formatter={(value, _name, entry) => [value, entry?.payload?.name || ""]}
              />
              <Bar dataKey="value" fill={accent} radius={[6, 6, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </G>

      {/* ── Tabla por asesor (coordinada con CRM + asesores) ─────────────────── */}
      <AdvisorMetrics leadsData={leadsData} theme={isLight ? "light" : "dark"} />
    </div>
  );
};

export default ComandoDirectivo;
