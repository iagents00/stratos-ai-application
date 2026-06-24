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
import { P, LP, font, fontDisp, STAGES, STAGE_COLORS } from "../../../design-system/tokens";
import { zoomEventsOf, funnelEntryOf, eventInPeriod, ACTIVE_POST_ZOOM_STAGES } from "./zoom-metrics";

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s, i]));
const IDX_PRIMER_CONTACTO = STAGE_INDEX["Segundo Intento"];
const IDX_SEGUIMIENTO     = STAGE_INDEX["Seguimiento"];

// La métrica de Zooms (histórica, acreditada a quién la dio) vive en
// ./zoom-metrics.js — fuente única compartida con ZoomBoard.

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

// Rango de fechas exacto que cubre el período seleccionado — para mostrarlo en
// el selector y que no haya duda de "de cuándo a cuándo" se está contando.
const PR_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function periodRangeLabel(periodId) {
  const now = new Date();
  const fmt = (d) => `${d.getDate()} ${PR_MESES[d.getMonth()]}`;
  if (periodId === "all")   return "todo el histórico";
  if (periodId === "today") return `hoy · ${fmt(now)}`;
  if (periodId === "week") {
    const start = new Date(periodStart("week"));
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return `${fmt(start)} – ${fmt(end)}`;
  }
  if (periodId === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // último día del mes
    return `${fmt(start)} – ${fmt(end)}`;
  }
  return "";
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
    title: "Zooms agendados — leads que entraron al funnel de Zoom (agendado o ya realizado). Siempre ≥ realizados. Coherente con Filtro 2.",
    // Conteo histórico a nivel lead (lo usa ComandoDirectivo: chart + totales).
    // En la tabla por asesor, AdvisorMetrics lo sobreescribe con el crédito
    // event-level a "quién lo dio" (ver `zoomAgg`).
    compute: (leads) => leads.filter(l => !!funnelEntryOf(l)).length,
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
    title: "Activos post-Zoom — hizo el Zoom y sigue activo (Zoom Concretado / Seguimiento / Apartó / Visita / Cierre). Mismo criterio que Filtro 2.",
    compute: (leads) => leads.filter(l => ACTIVE_POST_ZOOM_STAGES.has(l.st)).length,
  },
  {
    key: "followUps",
    label: "Seguim.",
    icon: RefreshCw,
    title: "Suma de seguimientos registrados en los leads del período.",
    compute: (leads) => leads.reduce((s, l) => s + (l.seguimientos || 0), 0),
  },
];

export default function AdvisorMetrics({ leadsData = [], theme = "dark", onOpenLead = null }) {
  const isLight = theme === "light";
  const T = isLight ? LP : P;
  const [periodId, setPeriodId] = useState("month");
  const [zoomAsesor, setZoomAsesor] = useState("__all__"); // filtro de la lista Filtro 2

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
      // "Agendado" = entró al funnel de Zoom (agendado o ya realizado), para que
      // por asesor también sea ≥ realizados y cuadre con Filtro 2.
      const entry = funnelEntryOf(l);
      const { done } = zoomEventsOf(l);
      if (entry) push(entry.by, "scheduled", entry.at);
      if (done)  push(done.by,  "done",      done.at);
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

  // ── Filtro 2: lista de clientes que realizaron Zoom ───────────────────────
  // Una fila por lead con Zoom hecho: cliente, presentador (quién lo dio),
  // fecha del Zoom, dueño actual, etapa actual y siguiente paso. Filtrable por
  // período (fecha del Zoom) y por presentador. Es el "cliente por cliente" que
  // pidió dirección, no solo el número.
  const zoomClients = useMemo(() => {
    const out = [];
    for (const l of leadsData) {
      const { done } = zoomEventsOf(l);
      if (!done) continue;
      if (!eventInPeriod(done.at, startTs)) continue;
      const presentador = done.by || l.asesor || "—";
      if (zoomAsesor !== "__all__" && presentador !== zoomAsesor) continue;
      out.push({
        lead: l,
        cliente: l.name || l.n || "(sin nombre)",
        presentador,
        fecha: done.at || l.created_at || null,
        dueno: l.asesor || "—",
        etapa: l.st || "—",
        siguiente: l.nextAction || l.next_action || "—",
      });
    }
    // Más reciente primero.
    out.sort((a, b) => {
      const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
      const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
      return tb - ta;
    });
    return out;
  }, [leadsData, startTs, zoomAsesor]);

  const fmtFecha = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
  };

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: T.txt3, fontFamily: font }}>
            <CalendarDays size={11} strokeWidth={2} /> Mostrando: <strong style={{ color: T.txt2, fontWeight: 600 }}>{periodRangeLabel(periodId)}</strong>
          </span>
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

      {/* ── Filtro 2 — Clientes que realizaron Zoom (cliente por cliente) ──── */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.02em" }}>
              Clientes con Zoom realizado
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.txt3, fontFamily: font }}>
              {zoomClients.length} {zoomClients.length === 1 ? "cliente" : "clientes"} en el período · quién dio el Zoom, etapa actual y siguiente paso.
            </p>
          </div>
          <select
            value={zoomAsesor}
            onChange={(e) => setZoomAsesor(e.target.value)}
            aria-label="Filtrar por presentador"
            style={{
              padding: "8px 12px", borderRadius: 9, fontFamily: font, fontSize: 12.5,
              background: headerBg, color: T.txt, border: `1px solid ${rowBorder}`, cursor: "pointer",
            }}
          >
            <option value="__all__">Todos los presentadores</option>
            {asesores.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{
          borderRadius: 14,
          background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${rowBorder}`, overflow: "hidden", overflowX: "auto",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                <th style={{ ...thStyle(T), textAlign: "left", paddingLeft: 16 }}>Cliente</th>
                <th style={thStyle(T)}>Presentador</th>
                <th style={thStyle(T)}>Fecha Zoom</th>
                <th style={thStyle(T)}>Dueño actual</th>
                <th style={thStyle(T)}>Etapa actual</th>
                <th style={{ ...thStyle(T), textAlign: "left" }}>Siguiente paso</th>
              </tr>
            </thead>
            <tbody>
              {zoomClients.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 28, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 13 }}>
                    No hay clientes con Zoom realizado en este período.
                  </td>
                </tr>
              )}
              {zoomClients.map(({ lead, cliente, presentador, fecha, dueno, etapa, siguiente }, i) => (
                <tr
                  key={lead.id || i}
                  onClick={onOpenLead ? () => onOpenLead(lead) : undefined}
                  style={{
                    borderTop: i === 0 ? "none" : `1px solid ${rowBorder}`,
                    cursor: onOpenLead ? "pointer" : "default",
                  }}
                  onMouseEnter={onOpenLead ? (e) => { e.currentTarget.style.background = headerBg; } : undefined}
                  onMouseLeave={onOpenLead ? (e) => { e.currentTarget.style.background = "transparent"; } : undefined}
                >
                  <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 600, color: T.txt, fontSize: 13 }}>{cliente}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5 }}>{presentador}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtFecha(fecha)}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5 }}>{dueno}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-block", whiteSpace: "nowrap", padding: "3px 10px", borderRadius: 999, fontFamily: fontDisp, fontWeight: 600, fontSize: 11, color: STAGE_COLORS[etapa] || T.txt3, background: `${STAGE_COLORS[etapa] || T.txt3}1A` }}>
                      {etapa}
                    </span>
                  </td>
                  <td style={{ padding: cellPad, fontFamily: font, color: T.txt2, fontSize: 12.5 }}>{siguiente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {onOpenLead && zoomClients.length > 0 && (
          <p style={{ margin: "8px 4px 0", fontSize: 10.5, color: T.txt3, fontFamily: font }}>
            Toca un cliente para abrir su expediente, notas e historial.
          </p>
        )}
      </div>
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
