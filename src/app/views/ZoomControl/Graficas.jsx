/**
 * app/views/ZoomControl/Graficas.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Apartado "Gráficas" del Control de Zooms — las vistas visuales del sheet del
 * director comercial, con diseño cuidado (skill dataviz):
 *
 *   1) Tendencia semanal (8 semanas L-D): barras APILADAS por resultado.
 *   2) Distribución por estatus del mes: dona con total al centro.
 *   3) Zooms por Liner (mes): barras horizontales, UN solo tono (magnitud).
 *   4) Zooms por Presentador (mes): ídem en verde.
 *
 * Reglas aplicadas: un solo eje; identidad NUNCA por color solo (leyenda con
 * nombre+conteo, gaps de 2px entre segmentos, tooltips con nombre); texto en
 * tokens de texto, no en el color de la serie; grid recesivo; magnitud por
 * categoría en un solo tono (las personas no llevan un color cada una).
 * Los colores de estatus son los MISMOS de las pills de toda la app (el color
 * sigue a la entidad). Paleta validada: CVD deutan ΔE 16.6 (PASS) claro/oscuro;
 * el WARN de contraste en claro se cubre con las leyendas y tooltips.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, LabelList,
} from "recharts";
import { font, fontDisp } from "../../../design-system/tokens";
import { monthRange, inRange, addDays, ymd, weekRange, DOW, MON } from "./dates";

// Resultados del Zoom — orden FIJO del stack (nunca se recicla ni reordena).
// "En agenda" agrupa Agendado+Confirmado (aún no ocurre el Zoom).
const RESULTADOS = [
  { key: "asistio",   label: "Asistió",    color: "#10B981", match: (e) => e === "Asistió" },
  { key: "noshow",    label: "No show",    color: "#EA580C", match: (e) => e === "No show" },
  { key: "reagendado", label: "Reagendado", color: "#F59E0B", match: (e) => e === "Reagendado" },
  { key: "cancelado", label: "Cancelado",  color: "#64748B", match: (e) => e === "Cancelado" },
  { key: "agenda",    label: "En agenda",  color: "#3B82F6", match: (e) => e === "Agendado" || e === "Confirmado" },
];

function clasifica(row) {
  for (const rdo of RESULTADOS) if (rdo.match(row.estatus)) return rdo.key;
  return "agenda";
}

// ── Tooltip común, con la misma voz visual del resto del Comando ────────────
function ChartTip({ active, payload, label, isLight, T, totalLabel = "Total" }) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter(p => (p.value ?? 0) > 0);
  const total = items.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: isLight ? "#FFFFFF" : "#0E1320",
      border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
      borderRadius: 12, padding: "9px 12px", fontFamily: font, fontSize: 12,
      boxShadow: "0 12px 32px rgba(0,0,0,0.20)", minWidth: 160,
    }}>
      {label != null && (
        <div style={{ fontSize: 11, fontWeight: 500, color: T.txt, fontFamily: fontDisp, marginBottom: 6 }}>{label}</div>
      )}
      {items.map(p => (
        <div key={p.dataKey || p.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "1.5px 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.txt2, fontSize: 11.5, fontFamily: fontDisp, fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.payload?.fill, flexShrink: 0 }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 500, color: T.txt, fontVariantNumeric: "tabular-nums", fontFamily: fontDisp }}>{p.value}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.07)"}` }}>
          <span style={{ fontSize: 10, fontWeight: 500, color: T.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.05em" }}>{totalLabel}</span>
          <span style={{ fontWeight: 500, color: T.txt, fontVariantNumeric: "tabular-nums", fontFamily: fontDisp }}>{total}</span>
        </div>
      )}
    </div>
  );
}

// ── Card contenedora de cada gráfica ─────────────────────────────────────────
function ChartCard({ T, isLight, title, subtitle, children }) {
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${rowBorder}`,
      background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)",
      padding: "14px 14px 8px",
    }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: T.txt2, fontFamily: font, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

// Leyenda de chips — identidad SIEMPRE con nombre (nunca color solo).
function LegendChips({ T, items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", padding: "6px 2px 4px" }}>
      {items.map(it => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 400, color: T.txt2, fontFamily: fontDisp }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: it.color, flexShrink: 0 }} />
          {it.label}{it.count != null && <span style={{ color: T.txt, fontWeight: 500 }}>{it.count}</span>}
        </span>
      ))}
    </div>
  );
}

export default function GraficasZooms({ rows = [], T, isLight }) {
  const accent = T.accent;
  const gridStroke = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  const axisTick = { fill: T.txt2, fontSize: 11, fontFamily: fontDisp, fontWeight: 500 };
  // Gap de 2px entre segmentos apilados = trazo del color de la superficie.
  const surface = isLight ? "#FFFFFF" : "#0B1220";

  const mo = monthRange();
  const mesRows = useMemo(() => rows.filter(r => inRange(r.fecha_zoom, mo.start, mo.end)), [rows, mo.start, mo.end]);

  // 1) Tendencia semanal — últimas 8 semanas (L-D), stack por resultado.
  const semanas = useMemo(() => {
    const { monday } = weekRange();
    const out = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDays(monday, -7 * i);
      const startKey = ymd(start);
      const endKey = ymd(addDays(start, 6));
      const delRango = rows.filter(r => r.fecha_zoom && r.fecha_zoom >= startKey && r.fecha_zoom <= endKey);
      const fila = {
        label: `${start.getDate()} ${MON[start.getMonth()]}`,
        tooltipLabel: `Semana del ${DOW[1]} ${start.getDate()} ${MON[start.getMonth()]}`,
        asistio: 0, noshow: 0, reagendado: 0, cancelado: 0, agenda: 0,
        esActual: i === 0,
      };
      for (const r of delRango) fila[clasifica(r)]++;
      out.push(fila);
    }
    return out;
  }, [rows]);

  // 2) Distribución por estatus (mes) — dona.
  const porEstatus = useMemo(() => {
    return RESULTADOS
      .map(rdo => ({ name: rdo.label, color: rdo.color, value: mesRows.filter(r => clasifica(r) === rdo.key).length }))
      .filter(d => d.value > 0);
  }, [mesRows]);
  const totalMes = mesRows.length;

  // 3+4) Magnitud por persona (mes) — barras horizontales en UN tono.
  const porPersona = (campo) => {
    const map = new Map();
    for (const r of mesRows) {
      const n = (r[campo] || "").trim();
      if (!n) continue;
      map.set(n, (map.get(n) || 0) + 1);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };
  const porLiner = useMemo(() => porPersona("liner"), [mesRows]);
  const porPresentador = useMemo(() => porPersona("presentador_principal"), [mesRows]);

  const sinDatosMes = totalMes === 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 12 }}>
      {/* 1) Tendencia semanal */}
      <ChartCard T={T} isLight={isLight} title="Tendencia semanal" subtitle="Últimas 8 semanas (lunes a domingo) · resultado de cada Zoom">
        <div style={{ width: "100%", height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={semanas} margin={{ top: 6, right: 6, bottom: 0, left: -18 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 5" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} interval={0} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={34} />
              <Tooltip
                cursor={{ fill: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)" }}
                content={(p) => <ChartTip {...p} isLight={isLight} T={T} label={p?.payload?.[0]?.payload?.tooltipLabel} />}
              />
              {RESULTADOS.map((rdo, i) => (
                <Bar
                  key={rdo.key}
                  dataKey={rdo.key}
                  name={rdo.label}
                  stackId="sem"
                  fill={rdo.color}
                  stroke={surface}
                  strokeWidth={2}
                  radius={i === RESULTADOS.length - 1 ? [4, 4, 0, 0] : 0}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <LegendChips T={T} items={RESULTADOS.map(rdo => ({ label: rdo.label, color: rdo.color }))} />
      </ChartCard>

      {/* 2) Dona por estatus del mes */}
      <ChartCard T={T} isLight={isLight} title={`Resultado del mes · ${mo.label}`} subtitle="Cómo terminaron los Zooms del mes">
        {sinDatosMes ? (
          <div style={{ height: 230, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
            Sin Zooms este mes todavía.
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: "56%", height: 230, position: "relative", flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={(p) => <ChartTip {...p} isLight={isLight} T={T} />} />
                  <Pie
                    data={porEstatus} dataKey="value" nameKey="name"
                    innerRadius="64%" outerRadius="92%"
                    paddingAngle={2.5} stroke={surface} strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {porEstatus.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Número héroe al centro — texto en tokens de texto. */}
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <span style={{ fontSize: 30, fontWeight: 500, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{totalMes}</span>
                <span style={{ fontSize: 10.5, fontWeight: 500, color: T.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.06em" }}>Zooms</span>
              </div>
            </div>
            {/* Leyenda con nombre + conteo + % — identidad nunca por color solo. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0, flex: 1 }}>
              {porEstatus.map(d => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 400, color: T.txt2, fontFamily: fontDisp, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: T.txt, fontFamily: fontDisp, fontVariantNumeric: "tabular-nums" }}>{d.value}</span>
                  <span style={{ fontSize: 11, color: T.txt3, fontFamily: font, width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round((d.value / totalMes) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>

      {/* 3) Por Liner (mes) — magnitud en un solo tono */}
      <ChartCard T={T} isLight={isLight} title={`Zooms por Liner · ${mo.label}`} subtitle="Quién agenda más este mes">
        <PersonBars data={porLiner} color="#3B82F6" T={T} isLight={isLight} gridStroke={gridStroke} axisTick={axisTick} />
      </ChartCard>

      {/* 4) Por Presentador (mes) */}
      <ChartCard T={T} isLight={isLight} title={`Zooms por Presentador · ${mo.label}`} subtitle="Quién corre más Zooms este mes">
        <PersonBars data={porPresentador} color="#10B981" T={T} isLight={isLight} gridStroke={gridStroke} axisTick={axisTick} />
      </ChartCard>
    </div>
  );
}

// Barras horizontales de magnitud por persona — un solo tono, valor al final
// de cada barra (etiqueta directa en token de texto, no en el color).
function PersonBars({ data, color, T, isLight, gridStroke, axisTick }) {
  if (!data.length) {
    return (
      <div style={{ height: 230, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, color: T.txt3, fontFamily: "inherit" }}>
        Sin Zooms este mes todavía.
      </div>
    );
  }
  const h = Math.max(150, data.length * 34 + 20);
  return (
    <div style={{ width: "100%", height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 2, right: 34, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 5" stroke={gridStroke} horizontal={false} />
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis
            type="category" dataKey="name" width={128}
            tick={{ ...axisTick, fontSize: 12 }} tickLine={false} axisLine={false}
          />
          <Tooltip
            cursor={{ fill: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)" }}
            content={(p) => <ChartTip {...p} isLight={isLight} T={T} />}
          />
          <Bar dataKey="value" name="Zooms" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" style={{ fill: T.txt, fontSize: 12, fontWeight: 500, fontFamily: fontDisp }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
