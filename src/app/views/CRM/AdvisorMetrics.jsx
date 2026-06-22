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
const IDX_PRIMER_CONTACTO = STAGE_INDEX["Segundo Intento"];
const IDX_SEGUIMIENTO     = STAGE_INDEX["Seguimiento"];
// Post-Mayo 2026 "Zoom Concretado" se consolidó en "Seguimiento": cualquier
// lead en Seguimiento ya tuvo su Zoom (es la etapa donde corre la negociación
// + proyectos + corridas + dudas). Usamos ese índice para "activos post-Zoom".
const IDX_POST_ZOOM       = STAGE_INDEX["Seguimiento"];

// ── Métrica de Zooms (histórica, no por foto actual) ─────────────────────────
// Un lead "realizó Zoom" si ALGUNA VEZ entró a Zoom Concretado o más allá
// (Seguimiento/Apartó/Visita/Cierre/Postventa) — aunque hoy esté en otra etapa
// o haya sido reasignado y reseteado a "Contáctame Ya". La métrica vieja solo
// miraba la etapa actual = "Seguimiento" y sub-contaba ~4×.
const ZOOM_DONE_STAGES = new Set([
  "Zoom Concretado", "Seguimiento", "Apartó", "Visita Agendada", "Cierre", "Postventa",
]);
const ZOOM_SCHEDULED_STAGE = "Zoom Agendado";

// Extrae la etapa destino de un evento de historial "Etapa: X → Y".
function targetStage(action) {
  if (typeof action !== "string") return null;
  const parts = action.split("→");
  return parts.length > 1 ? parts[parts.length - 1].trim() : null;
}

// Devuelve { scheduled, done } para un lead: el PRIMER evento de historial que
// lo llevó a Zoom Agendado / a una etapa post-Zoom, con su autor (by = quién lo
// dio) y fecha. Acredita el Zoom a quien lo movió, no al dueño actual, así el
// crédito no se pierde con las reasignaciones. Si no hay historial pero la etapa
// ACTUAL ya es de Zoom (leads sembrados o pre-historial), cae al dueño actual.
function zoomEventsOf(lead) {
  const hist = Array.isArray(lead.actionHistory) ? lead.actionHistory : [];
  let scheduled = null, done = null;
  for (const e of hist) {
    if (!e || e.type !== "etapa") continue;
    const t = targetStage(e.action);
    if (!t) continue;
    const at = e.completed_at || e.doneAt || null;
    if (t === ZOOM_SCHEDULED_STAGE && !scheduled) scheduled = { by: e.by || lead.asesor, at };
    if (ZOOM_DONE_STAGES.has(t) && !done)          done      = { by: e.by || lead.asesor, at };
  }
  if (!scheduled && lead.st === ZOOM_SCHEDULED_STAGE) scheduled = { by: lead.asesor, at: lead.created_at };
  if (!done && ZOOM_DONE_STAGES.has(lead.st))         done      = { by: lead.asesor, at: lead.created_at };
  return { scheduled, done };
}

function eventInPeriod(at, startTs) {
  if (startTs === null) return true;
  if (!at) return false;
  const t = new Date(at).getTime();
  return !Number.isNaN(t) && t >= startTs;
}

export const PERIODS = [
  { id: "today", label: "Hoy" },
  { id: "week",  label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "all",   label: "Todo" },
];

export function periodStart(periodId) {
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

export function leadInPeriod(lead, startTs) {
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
export const INDICATORS = [
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
    title: "Leads contactados — etapa ≥ Segundo Intento.",
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
    title: "Zooms agendados — leads que entraron a 'Zoom Agendado' alguna vez (histórico), acreditados a quien los agendó y por la fecha del evento.",
    // Conteo histórico a nivel lead (lo usa ComandoDirectivo: chart + totales).
    // En la tabla por asesor, AdvisorMetrics lo sobreescribe con el crédito
    // event-level a "quién lo dio" (ver `zoomAgg`).
    compute: (leads) => leads.filter(l => !!zoomEventsOf(l).scheduled).length,
  },
  {
    key: "zoomDone",
    label: "Zooms Real.",
    icon: CheckCircle2,
    title: "Zooms realizados — leads que alguna vez pasaron por Zoom Concretado o más allá (Seguimiento/Apartó/Visita/Cierre/Postventa), acreditados a quien dio el Zoom. Cuenta el historial, no la etapa actual.",
    compute: (leads) => leads.filter(l => !!zoomEventsOf(l).done).length,
  },
  {
    key: "activePostZoom",
    label: "Activos",
    icon: Activity,
    title: "Activos post-Zoom — etapa ≥ Seguimiento, excluye Postventa.",
    compute: (leads) => leads.filter(l =>
      stageIdx(l.st) >= IDX_POST_ZOOM
      && l.st !== "Postventa"
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

  // Agregación event-level de Zooms: persona → fechas de sus eventos de Zoom
  // (agendado / realizado), deduplicados a 1 por lead (el primer evento que
  // lo llevó a esa fase). El crédito va a `by` (quién lo dio), no al dueño hoy.
  const zoomAgg = useMemo(() => {
    const map = {}; // person -> { scheduled: [at...], done: [at...] }
    const push = (person, bucket, at) => {
      if (!person) return;
      (map[person] = map[person] || { scheduled: [], done: [] })[bucket].push(at);
    };
    for (const l of leadsData) {
      const { scheduled, done } = zoomEventsOf(l);
      if (scheduled) push(scheduled.by, "scheduled", scheduled.at);
      if (done)      push(done.by,      "done",      done.at);
    }
    return map;
  }, [leadsData]);

  const countZoom = (person, bucket) => {
    const arr = zoomAgg[person]?.[bucket];
    if (!arr) return 0;
    return arr.filter(at => eventInPeriod(at, startTs)).length;
  };

  // Lista de asesores: dueños actuales ∪ quienes tienen crédito de Zoom (un
  // presentador puede ya no tener leads propios pero sí Zooms acreditados).
  const asesores = useMemo(() => {
    const set = new Set([
      ...leadsData.map(l => l.asesor).filter(Boolean),
      ...Object.keys(zoomAgg),
    ]);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData, zoomAgg]);

  // Filas: { asesor, metrics: { key: number } }
  const rows = useMemo(() => {
    return asesores.map(asesor => {
      const leadsOfAsesor = leadsData.filter(l =>
        l.asesor === asesor && leadInPeriod(l, startTs)
      );
      const metrics = {};
      for (const ind of INDICATORS) metrics[ind.key] = ind.compute(leadsOfAsesor);
      // Override: las columnas de Zoom son histórico/event-level, no foto actual.
      metrics.zoomScheduled = countZoom(asesor, "scheduled");
      metrics.zoomDone      = countZoom(asesor, "done");
      return { asesor, metrics, count: leadsOfAsesor.length };
    });
  }, [asesores, leadsData, startTs, zoomAgg]);

  // Totales del equipo (fila TOTAL al pie).
  const totals = useMemo(() => {
    const leadsInPeriod = leadsData.filter(l => leadInPeriod(l, startTs));
    const t = {};
    for (const ind of INDICATORS) t[ind.key] = ind.compute(leadsInPeriod);
    // Zooms: suma de todos los eventos del período (todas las personas).
    let zs = 0, zd = 0;
    for (const person of Object.keys(zoomAgg)) {
      zs += countZoom(person, "scheduled");
      zd += countZoom(person, "done");
    }
    t.zoomScheduled = zs;
    t.zoomDone = zd;
    return t;
  }, [leadsData, startTs, zoomAgg]);

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
        Asignados / Contactados / Calificados / Activos se filtran por fecha de creación del lead y reflejan su etapa actual. Las columnas <strong>Zooms Ag./Real.</strong> son históricas: cuentan cada lead que alguna vez pasó por esa fase (aunque hoy esté en otra etapa o haya sido reasignado), acreditadas a <strong>quién dio el Zoom</strong> y filtradas por la fecha real del evento.
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
