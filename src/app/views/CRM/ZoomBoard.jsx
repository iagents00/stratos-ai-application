/**
 * CRM/ZoomBoard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Espacio "Control de Zooms" del Comando Directivo. Tablero enfocado SOLO en
 * Zooms, derivado del pipeline + historial (ver ./zoom-metrics.js), no de la
 * tabla `zoom_agendados` (vacía en prod). Tres bloques:
 *   1) KPIs: Zooms realizados / agendados / conversión / activos post-Zoom.
 *   2) Tabla por presentador (quién dio los Zooms).
 *   3) Lista cliente-por-cliente con Zoom realizado (click abre el expediente).
 *
 * "Zoom realizado" = el lead entró ALGUNA VEZ a Zoom Concretado o a una etapa
 * posterior (la mayoría avanzan, pero algunos retroceden/se reasignan) — cuenta
 * el historial, no la foto actual.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import { CheckCircle2, CalendarDays, TrendingUp, Activity } from "lucide-react";
import { P, LP, font, fontDisp, STAGE_COLORS } from "../../../design-system/tokens";
import { PERIODS, periodStart } from "./AdvisorMetrics";
import { zoomEventsOf, eventInPeriod, ZOOM_DONE_STAGES } from "./zoom-metrics";

const fmtFecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
};

export default function ZoomBoard({ leadsData = [], theme = "dark", onOpenLead = null }) {
  const isLight = theme === "light";
  const T = isLight ? LP : P;
  const [periodId, setPeriodId] = useState("month");
  const [presentadorFilter, setPresentadorFilter] = useState("__all__");

  const startTs = useMemo(() => periodStart(periodId), [periodId]);

  // Agregación por presentador (quién dio el Zoom) dentro del período.
  const { byPresenter, totals, presenters } = useMemo(() => {
    const map = {}; // person -> { scheduled, done }
    const bump = (p, k) => { (map[p] = map[p] || { scheduled: 0, done: 0 })[k]++; };
    let tScheduled = 0, tDone = 0;
    for (const l of leadsData) {
      const { scheduled, done } = zoomEventsOf(l);
      if (scheduled && eventInPeriod(scheduled.at, startTs)) { bump(scheduled.by || "—", "scheduled"); tScheduled++; }
      if (done && eventInPeriod(done.at, startTs))           { bump(done.by || "—", "done"); tDone++; }
    }
    const list = Object.entries(map)
      .map(([asesor, m]) => ({ asesor, ...m }))
      .sort((a, b) => b.done - a.done || b.scheduled - a.scheduled);
    return { byPresenter: list, totals: { scheduled: tScheduled, done: tDone }, presenters: list.map(r => r.asesor) };
  }, [leadsData, startTs]);

  // Activos post-Zoom = etapa actual en una fase post-Zoom y no terminal.
  const activosPostZoom = useMemo(
    () => leadsData.filter(l => ZOOM_DONE_STAGES.has(l.st) && l.st !== "Postventa").length,
    [leadsData],
  );

  const conversion = totals.scheduled ? Math.round((totals.done / totals.scheduled) * 100) : 0;

  // Lista cliente-por-cliente con Zoom realizado en el período.
  const clientes = useMemo(() => {
    const out = [];
    for (const l of leadsData) {
      const { done } = zoomEventsOf(l);
      if (!done || !eventInPeriod(done.at, startTs)) continue;
      const presentador = done.by || l.asesor || "—";
      if (presentadorFilter !== "__all__" && presentador !== presentadorFilter) continue;
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
    out.sort((a, b) => (b.fecha ? new Date(b.fecha).getTime() : 0) - (a.fecha ? new Date(a.fecha).getTime() : 0));
    return out;
  }, [leadsData, startTs, presentadorFilter]);

  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  const cellPad   = "10px 12px";
  const accent    = T.accent;

  const KPIS = [
    { key: "done",      label: "Zooms realizados",   value: totals.done,     icon: CheckCircle2, color: "#10B981", sub: "pasaron por Zoom (histórico)" },
    { key: "scheduled", label: "Zooms agendados",    value: totals.scheduled,icon: CalendarDays, color: "#2563EB", sub: "llegaron a agendarse" },
    { key: "conv",      label: "Conversión a Zoom",  value: `${conversion}%`,icon: TrendingUp,   color: accent,    sub: "realizados / agendados" },
    { key: "active",    label: "Activos post-Zoom",  value: activosPostZoom, icon: Activity,     color: "#F59E0B", sub: "en cierre ahora" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header + selector de período */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
            Filtro 2 · Control de Zooms
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
            Segundo filtro comercial · desde el Zoom: quién lo dio, estado actual del cliente y siguiente paso · acreditado a quién dio el Zoom.
          </p>
        </div>
        <div role="tablist" aria-label="Período" style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: headerBg, border: `1px solid ${rowBorder}` }}>
          {PERIODS.map(p => {
            const active = p.id === periodId;
            return (
              <button key={p.id} role="tab" aria-selected={active} onClick={() => setPeriodId(p.id)}
                style={{
                  padding: "7px 16px", borderRadius: 7,
                  background: active ? accent : "transparent",
                  color: active ? (isLight ? "#0B1220" : "#06080F") : T.txt2,
                  border: "none", fontSize: 12, fontWeight: active ? 700 : 500,
                  fontFamily: fontDisp, cursor: "pointer", transition: "background 0.14s, color 0.14s",
                }}>{p.label}</button>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {KPIS.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.key} style={{
              borderRadius: 14, padding: "16px 18px",
              background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${rowBorder}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ display: "inline-flex", padding: 7, borderRadius: 9, background: `${k.color}1A` }}>
                  <Icon size={15} color={k.color} strokeWidth={2.2} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.txt2, fontFamily: font }}>{k.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.02em" }}>{k.value}</div>
              <div style={{ fontSize: 11, color: T.txt3, fontFamily: font, marginTop: 2 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Tabla por presentador */}
      <div>
        <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 600, fontFamily: fontDisp, color: T.txt }}>
          Productividad por asesor
        </h3>
        <p style={{ margin: "0 0 10px", fontSize: 11.5, color: T.txt3, fontFamily: font }}>
          <strong style={{ color: T.txt2 }}>Agendó</strong> = quién consiguió la cita (liner) · <strong style={{ color: T.txt2 }}>Presentó</strong> = quién corrió el Zoom.
        </p>
        <div style={{ borderRadius: 14, background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)", border: `1px solid ${rowBorder}`, overflow: "hidden", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                <th style={{ ...thStyle(T), textAlign: "left", paddingLeft: 16 }}>Asesor</th>
                <th style={thStyle(T)}>Agendó (Liner)</th>
                <th style={thStyle(T)}>Presentó</th>
                <th style={thStyle(T)}>Conversión</th>
              </tr>
            </thead>
            <tbody>
              {byPresenter.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 26, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 13 }}>Sin Zooms en este período.</td></tr>
              )}
              {byPresenter.map((r, i) => {
                const conv = r.scheduled ? Math.round((r.done / r.scheduled) * 100) : 0;
                return (
                  <tr key={r.asesor} style={{ borderTop: i === 0 ? "none" : `1px solid ${rowBorder}` }}>
                    <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 600, color: T.txt, fontSize: 13 }}>{r.asesor}</td>
                    <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, color: T.txt2, fontSize: 14 }}>{r.scheduled}</td>
                    <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 700, color: "#10B981", fontSize: 14 }}>{r.done}</td>
                    <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, color: T.txt2, fontSize: 13 }}>{conv}%</td>
                  </tr>
                );
              })}
            </tbody>
            {byPresenter.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: `1px solid ${rowBorder}`, background: headerBg }}>
                  <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 700, color: T.txt2, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 700, color: accent, fontSize: 14 }}>{totals.scheduled}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 700, color: accent, fontSize: 14 }}>{totals.done}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 700, color: accent, fontSize: 13 }}>{conversion}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Lista cliente-por-cliente */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: fontDisp, color: T.txt }}>
            Clientes con Zoom realizado <span style={{ fontSize: 12, fontWeight: 500, color: T.txt3 }}>· {clientes.length}</span>
          </h3>
          <select value={presentadorFilter} onChange={(e) => setPresentadorFilter(e.target.value)} aria-label="Filtrar por presentador"
            style={{ padding: "8px 12px", borderRadius: 9, fontFamily: font, fontSize: 12.5, background: headerBg, color: T.txt, border: `1px solid ${rowBorder}`, cursor: "pointer" }}>
            <option value="__all__">Todos los presentadores</option>
            {presenters.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ borderRadius: 14, background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)", border: `1px solid ${rowBorder}`, overflow: "hidden", overflowX: "auto" }}>
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
              {clientes.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 26, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 13 }}>No hay clientes con Zoom realizado en este período.</td></tr>
              )}
              {clientes.map(({ lead, cliente, presentador, fecha, dueno, etapa, siguiente }, i) => (
                <tr key={lead.id || i}
                  onClick={onOpenLead ? () => onOpenLead(lead) : undefined}
                  style={{ borderTop: i === 0 ? "none" : `1px solid ${rowBorder}`, cursor: onOpenLead ? "pointer" : "default" }}
                  onMouseEnter={onOpenLead ? (e) => { e.currentTarget.style.background = headerBg; } : undefined}
                  onMouseLeave={onOpenLead ? (e) => { e.currentTarget.style.background = "transparent"; } : undefined}
                >
                  <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 600, color: T.txt, fontSize: 13 }}>{cliente}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5 }}>{presentador}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtFecha(fecha)}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5 }}>{dueno}</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontSize: 12 }}>
                    <span style={{ padding: "3px 9px", borderRadius: 999, fontFamily: fontDisp, fontWeight: 600, fontSize: 11, color: STAGE_COLORS[etapa] || T.txt3, background: `${STAGE_COLORS[etapa] || T.txt3}1A` }}>{etapa}</span>
                  </td>
                  <td style={{ padding: cellPad, fontFamily: font, color: T.txt2, fontSize: 12.5 }}>{siguiente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {onOpenLead && clientes.length > 0 && (
          <p style={{ margin: "8px 4px 0", fontSize: 10.5, color: T.txt3, fontFamily: font }}>Toca un cliente para abrir su expediente, notas e historial.</p>
        )}
      </div>
    </div>
  );
}

function thStyle(T) {
  return {
    padding: "11px 12px", textAlign: "center", fontSize: 10.5, fontWeight: 600,
    color: T.txt2, fontFamily: fontDisp, textTransform: "uppercase",
    letterSpacing: "0.05em", whiteSpace: "nowrap",
  };
}
