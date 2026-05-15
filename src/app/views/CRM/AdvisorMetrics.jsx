/**
 * CRM/AdvisorMetrics.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tabla de indicadores por asesor (Comando Directivo dentro del CRM).
 * Solo se renderiza si el cliente activo tiene `crm.advisorMetricsTab=true`
 * y el usuario tiene rol admin/director/super_admin/ceo. Esa lógica vive en
 * el caller (CRM/index.jsx); este componente asume que ya se autorizó.
 *
 * Todas las métricas se calculan en memoria desde `leadsData`. Los conteos
 * filtrables por período usan `lead.created_at` (leads creados en la ventana).
 * "Seguim." muestra el total acumulado del counter `lead.seguimientos` para
 * los leads del período → es el único valor que NO se puede filtrar finamente
 * por fecha porque no hay historial event-level disponible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import { Users, Phone, BadgeCheck, CalendarDays, CheckCircle2, Activity, RefreshCw } from "lucide-react";
import { P, LP, font, fontDisp, STAGES } from "../../../design-system/tokens";

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s, i]));
const IDX_PRIMER_CONTACTO = STAGE_INDEX["Primer Contacto"];
const IDX_SEGUIMIENTO     = STAGE_INDEX["Seguimiento"];
const IDX_ZOOM_CONCRETADO = STAGE_INDEX["Zoom Concretado"];

const PERIODS = [
  { id: "today", label: "Hoy" },
  { id: "week",  label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "all",   label: "Todo" },
];

function periodStart(periodId) {
  if (periodId === "all") return null;
  const now = new Date();
  if (periodId === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (periodId === "week") {
    // Lunes 00:00 de esta semana (1 = lunes, 0 = domingo).
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    return monday.getTime();
  }
  if (periodId === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  return null;
}

function leadInPeriod(lead, startTs) {
  if (startTs === null) return true;
  if (!lead.created_at) return false;
  const t = new Date(lead.created_at).getTime();
  return !Number.isNaN(t) && t >= startTs;
}

function stageIdx(stage) {
  const idx = STAGE_INDEX[stage];
  return typeof idx === "number" ? idx : -1;
}

// 7 indicadores pedidos en el ticket. Cada uno recibe el array de leads ya
// filtrado por período + asesor y devuelve un número.
const INDICATORS = [
  {
    key: "assigned",
    label: "Asignados",
    icon: Users,
    title: "Leads asignados — leads creados en el período con asesor.",
    compute: (leads) => leads.filter(l => l.asesor).length,
  },
  {
    key: "contacted",
    label: "Contactados",
    icon: Phone,
    title: "Leads contactados — etapa ≥ Primer Contacto.",
    compute: (leads) => leads.filter(l => stageIdx(l.st) >= IDX_PRIMER_CONTACTO).length,
  },
  {
    key: "qualified",
    label: "Calificados",
    icon: BadgeCheck,
    title: "Leads calificados — etapa ≥ Seguimiento.",
    compute: (leads) => leads.filter(l => stageIdx(l.st) >= IDX_SEGUIMIENTO).length,
  },
  {
    key: "zoomScheduled",
    label: "Zooms Ag.",
    icon: CalendarDays,
    title: "Zooms agendados (etapa actual = Zoom Agendado).",
    compute: (leads) => leads.filter(l => l.st === "Zoom Agendado").length,
  },
  {
    key: "zoomDone",
    label: "Zooms Real.",
    icon: CheckCircle2,
    title: "Zooms realizados (etapa actual = Zoom Concretado).",
    compute: (leads) => leads.filter(l => l.st === "Zoom Concretado").length,
  },
  {
    key: "activePostZoom",
    label: "Activos",
    icon: Activity,
    title: "Activos post-Zoom — etapa ≥ Zoom Concretado, excluye Perdido y Rotación.",
    compute: (leads) => leads.filter(l =>
      stageIdx(l.st) >= IDX_ZOOM_CONCRETADO
      && l.st !== "Perdido"
      && l.st !== "Rotación"
    ).length,
  },
  {
    key: "followUps",
    label: "Seguim.",
    icon: RefreshCw,
    title: "Suma de seguimientos registrados en los leads del período.",
    compute: (leads) => leads.reduce((s, l) => s + (l.seguimientos || 0), 0),
  },
];

export default function AdvisorMetrics({ leadsData = [], theme = "dark" }) {
  const isLight = theme === "light";
  const T = isLight ? LP : P;
  const [periodId, setPeriodId] = useState("month");

  const startTs = useMemo(() => periodStart(periodId), [periodId]);

  // Lista de asesores únicos presentes en leadsData. Ordenado alfabético.
  const asesores = useMemo(() => {
    const set = new Set(leadsData.map(l => l.asesor).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData]);

  // Filas: { asesor, metrics: { key: number } }
  const rows = useMemo(() => {
    return asesores.map(asesor => {
      const leadsOfAsesor = leadsData.filter(l =>
        l.asesor === asesor && leadInPeriod(l, startTs)
      );
      const metrics = {};
      for (const ind of INDICATORS) metrics[ind.key] = ind.compute(leadsOfAsesor);
      return { asesor, metrics, count: leadsOfAsesor.length };
    });
  }, [asesores, leadsData, startTs]);

  // Totales del equipo (fila TOTAL al pie).
  const totals = useMemo(() => {
    const leadsInPeriod = leadsData.filter(l => leadInPeriod(l, startTs));
    const t = {};
    for (const ind of INDICATORS) t[ind.key] = ind.compute(leadsInPeriod);
    return t;
  }, [leadsData, startTs]);

  const headerBg   = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder  = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  const cellPad    = "10px 12px";
  const accent     = T.accent;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header con título + selector de período */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.02em" }}>
            Indicadores de Asesores
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.txt3, fontFamily: font }}>
            Métricas por asesor calculadas desde los leads del período seleccionado.
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
                  padding: "6px 14px", borderRadius: 7,
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

      {/* Tabla */}
      <div style={{
        borderRadius: 14,
        background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${rowBorder}`,
        overflow: "hidden",
        overflowX: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: headerBg }}>
              <th style={{ ...thStyle(T), textAlign: "left", paddingLeft: 16 }}>Asesor</th>
              {INDICATORS.map(ind => {
                const Icon = ind.icon;
                return (
                  <th key={ind.key} title={ind.title} style={thStyle(T)}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon size={11} color={T.txt3} strokeWidth={2} />
                      <span>{ind.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={INDICATORS.length + 1} style={{ padding: 28, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 13 }}>
                  No hay asesores con leads en este período.
                </td>
              </tr>
            )}
            {rows.map(({ asesor, metrics, count }, i) => (
              <tr key={asesor} style={{ borderTop: i === 0 ? "none" : `1px solid ${rowBorder}` }}>
                <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 600, color: T.txt, fontSize: 13 }}>
                  {asesor}
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: T.txt3 }}>
                    {count} {count === 1 ? "lead" : "leads"}
                  </span>
                </td>
                {INDICATORS.map(ind => (
                  <td key={ind.key} style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 600, color: T.txt, fontSize: 14 }}>
                    {metrics[ind.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `1px solid ${rowBorder}`, background: headerBg }}>
                <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 700, color: T.txt2, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Total
                </td>
                {INDICATORS.map(ind => (
                  <td key={ind.key} style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 700, color: accent, fontSize: 14 }}>
                    {totals[ind.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p style={{ margin: "10px 4px 0", fontSize: 10.5, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
        Datos derivados de leads actuales filtrados por fecha de creación. Las columnas <strong>Zooms Ag./Real.</strong> y <strong>Activos</strong> reflejan la etapa actual del lead, no su historial.
      </p>
    </div>
  );
}

function thStyle(T) {
  return {
    padding: "11px 12px",
    textAlign: "center",
    fontSize: 10.5,
    fontWeight: 600,
    color: T.txt2,
    fontFamily: fontDisp,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  };
}
