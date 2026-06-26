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
import { CalendarDays, CheckCircle2, MapPin, Handshake, History, ChevronDown, ShieldCheck, AlertTriangle } from "lucide-react";
import { P, LP, font, fontDisp, STAGE_COLORS } from "../../../design-system/tokens";
import { zoomEventsOf, funnelEntryOf, milestoneOf, ACTIVE_POST_ZOOM_STAGES, RECORRIDO_STAGES, CIERRE_STAGES, zoomMovements, zoomDataQuality } from "./zoom-metrics";
import DateRangeControl from "./DateRangeControl";
import { createDefaultDateFilter, resolveDateRange, timestampInRange } from "./date-range";

const fmtFecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
};

export default function ZoomBoard({ leadsData = [], theme = "dark", onOpenLead = null, dateFilter: sharedDateFilter = null }) {
  const isLight = theme === "light";
  const T = isLight ? LP : P;
  const [localDateFilter, setLocalDateFilter] = useState(createDefaultDateFilter);
  const [presentadorFilter, setPresentadorFilter] = useState("__all__");
  const [histOpen, setHistOpen] = useState(false);
  const [histKind, setHistKind] = useState("all"); // all | scheduled | done

  const dateFilter = sharedDateFilter || localDateFilter;
  const dateRange = useMemo(
    () => resolveDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo),
    [dateFilter],
  );
  const trendGran = useMemo(() => {
    if (dateRange.fromTs === null) return "month";
    const days = Math.max(1, Math.ceil((dateRange.toTs - dateRange.fromTs) / 86400000));
    return days <= 90 ? "week" : "month";
  }, [dateRange]);
  // Tendencia: cuántos Zooms realizados por semana / por mes a lo largo del
  // tiempo (lo que el equipo de Duke revisa cada domingo). Independiente del
  // filtro de período de arriba: muestra la evolución completa reciente.
  const trend = useMemo(() => {
    const now = new Date();
    const buckets = [];
    const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const fallbackStart = trendGran === "week"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 69)
      : new Date(now.getFullYear(), now.getMonth() - 7, 1);
    let cursor = dateRange.from || fallbackStart;
    const rangeEnd = dateRange.to || new Date(now.getFullYear(), now.getMonth() + 1, 1);

    if (trendGran === "week") {
      const dow = cursor.getDay();
      const diff = dow === 0 ? 6 : dow - 1;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - diff);
    } else {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    }

    for (let guard = 0; guard < 120 && cursor < rangeEnd; guard++) {
      let start, end, label;
      if (trendGran === "week") {
        start = new Date(cursor);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
        label = `${start.getDate()} ${MESES[start.getMonth()]}`;
      } else {
        start = new Date(cursor);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        label = MESES[start.getMonth()];
      }
      buckets.push({
        label,
        start: Math.max(start.getTime(), dateRange.fromTs ?? start.getTime()),
        end: Math.min(end.getTime(), dateRange.toTs ?? end.getTime()),
        done: 0,
        sched: 0,
      });
      cursor = end;
    }
    for (const l of leadsData) {
      const done = zoomEventsOf(l).done;
      const entry = funnelEntryOf(l); // agendados coherente con el KPI (funnel-entry)
      for (const [ev, key] of [[done, "done"], [entry, "sched"]]) {
        if (!ev || !ev.at) continue;
        const t = new Date(ev.at).getTime();
        if (Number.isNaN(t)) continue;
        const b = buckets.find(bk => t >= bk.start && t < bk.end);
        if (b) b[key]++;
      }
    }
    const max = Math.max(1, ...buckets.map(b => b.done));
    return { buckets, max };
  }, [dateRange, leadsData, trendGran]);

  // Historial de movimientos de Zoom (toda la cartera): cada lead que pasó por
  // Zoom agendado y/o realizado, con fecha, quién lo dio y si fue inferido de la
  // etapa actual (registro faltante). Respeta el período y el filtro de presentador.
  const historial = useMemo(() => {
    let rows = zoomMovements(leadsData)
      .filter(m => !m.inferred && timestampInRange(m.at, dateRange))
      .filter(m => histKind === "all" || m.kind === histKind)
      .filter(m => presentadorFilter === "__all__" || (m.by || m.lead.asesor) === presentadorFilter);
    rows.sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0));
    return rows;
  }, [dateRange, leadsData, histKind, presentadorFilter]);

  const inferidos = useMemo(() => historial.filter(m => m.inferred).length, [historial]);
  const quality = useMemo(() => zoomDataQuality(leadsData), [leadsData]);

  // Totales del embudo + productividad por presentador (quién dio el Zoom).
  // AGENDADOS = entró al funnel (agendado o ya realizado) → siempre ≥ realizados.
  // REALIZADOS = hizo el Zoom. Ambos con split registrado/inferido.
  const { byPresenter, totals, presenters } = useMemo(() => {
    const map = {}; // person -> realizados (presentó)
    let tAg = 0, tAgInf = 0, tDone = 0, tDoneInferred = 0;
    for (const l of leadsData) {
      const entry = funnelEntryOf(l);
      if (entry && !entry.inferred && timestampInRange(entry.at, dateRange)) { tAg++; if (entry.inferred) tAgInf++; }
      const { done } = zoomEventsOf(l);
      if (done && !done.inferred && timestampInRange(done.at, dateRange)) {
        map[done.by] = (map[done.by] || 0) + 1;
        tDone++; if (done.inferred) tDoneInferred++;
      }
    }
    const list = Object.entries(map)
      .map(([asesor, done]) => ({ asesor, done }))
      .sort((a, b) => b.done - a.done);
    return {
      byPresenter: list,
      totals: {
        scheduled: tAg, scheduledInferred: tAgInf, scheduledRegistered: tAg - tAgInf,
        done: tDone, doneInferred: tDoneInferred, doneRegistered: tDone - tDoneInferred,
      },
      presenters: list.map(r => r.asesor),
    };
  }, [dateRange, leadsData]);

  // Activos post-Zoom = etapa actual en una fase post-Zoom activa (set compartido).
  const activosPostZoom = useMemo(
    () => leadsData.filter(l => ACTIVE_POST_ZOOM_STAGES.has(l.st)).length,
    [leadsData],
  );

  // Funnel posterior al Zoom: Recorridos (visita) y Cierres (Apartó/Cierre),
  // contados como hitos históricos dentro del período (mismo criterio que el Zoom).
  const { recorridos, cierres } = useMemo(() => {
    let rec = 0, cie = 0;
    for (const l of leadsData) {
      const r = milestoneOf(l, RECORRIDO_STAGES);
      const c = milestoneOf(l, CIERRE_STAGES);
      if (r && !r.inferred && timestampInRange(r.at, dateRange)) rec++;
      if (c && !c.inferred && timestampInRange(c.at, dateRange)) cie++;
    }
    return { recorridos: rec, cierres: cie };
  }, [dateRange, leadsData]);

  // Lista cliente-por-cliente con Zoom realizado en el período.
  const clientes = useMemo(() => {
    const out = [];
    for (const l of leadsData) {
      const { done } = zoomEventsOf(l);
      if (!done || done.inferred || !timestampInRange(done.at, dateRange)) continue;
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
  }, [dateRange, leadsData, presentadorFilter]);

  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  const cellPad   = "10px 12px";
  const accent    = T.accent;

  // Funnel comercial de Oscar (de izquierda a derecha): Agendado → Realizado →
  // Recorrido → Cierre. Cada uno es un hito histórico (pasó por ahí alguna vez).
  const KPIS = [
    { key: "scheduled", label: "Zooms agendados",  value: totals.scheduled, icon: CalendarDays, color: "#2563EB", sub: totals.scheduledInferred ? `${totals.scheduledRegistered} registrados · ${totals.scheduledInferred} inferidos` : "entraron al funnel de Zoom" },
    { key: "done",      label: "Zooms realizados", value: totals.done,      icon: CheckCircle2, color: "#10B981", sub: totals.doneInferred ? `${totals.doneRegistered} registrados · ${totals.doneInferred} inferidos` : "se dieron (histórico)" },
    { key: "rec",       label: "Recorridos",       value: recorridos,       icon: MapPin,       color: "#06B6D4", sub: "clientes que llegaron a visita" },
    { key: "close",     label: "Apartó / Cierre",  value: cierres,          icon: Handshake,    color: accent,    sub: "milestones de cierre" },
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
            Segundo filtro comercial · el embudo desde el Zoom: agendado → realizado → recorrido → cierre, con el estado y el siguiente paso de cada cliente.
          </p>
        </div>
      </div>
      {!sharedDateFilter && (
        <DateRangeControl
          T={T}
          isLight={isLight}
          value={localDateFilter}
          onChange={setLocalDateFilter}
          label="Período"
        />
      )}

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

      <div style={{
        display: "grid", gridTemplateColumns: "minmax(240px, 1.2fr) repeat(3, minmax(150px, 1fr))",
        gap: 10, padding: 12, borderRadius: 16,
        background: isLight
          ? "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(37,99,235,0.035))"
          : "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(37,99,235,0.055))",
        border: "1px solid rgba(16,185,129,0.22)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px" }}>
          <span style={{ display: "inline-flex", padding: 9, borderRadius: 12, background: "rgba(16,185,129,0.14)" }}>
            <ShieldCheck size={18} color="#10B981" />
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 750, color: T.txt, fontFamily: fontDisp }}>Calidad del dato de Zoom</div>
            <div style={{ fontSize: 11, color: T.txt3, fontFamily: font, lineHeight: 1.45 }}>
              Los rangos por fecha cuentan únicamente eventos con evidencia temporal confirmada.
            </div>
          </div>
        </div>
        {[
          ["Concretados confirmados", quality.confirmedDone, "#10B981"],
          ["Históricos por validar", quality.inferredDone, "#F59E0B"],
          ["Concretados sin notas", quality.completedWithoutNotes, "#EF4444"],
        ].map(([label, value, color]) => (
          <div key={label} style={{
            padding: "10px 12px", borderRadius: 12,
            background: isLight ? "rgba(255,255,255,0.72)" : "rgba(3,8,16,0.32)",
            border: `1px solid ${color}24`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: T.txt3, fontFamily: font }}>
              {color !== "#10B981" && <AlertTriangle size={11} color={color} />}
              {label}
            </div>
            <div style={{ marginTop: 4, fontSize: 21, fontWeight: 800, color, fontFamily: fontDisp }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Leyenda: activos + nota de inferidos (recuperación, no alarma) */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px", margin: "-6px 2px 0", fontSize: 11.5, color: T.txt3, fontFamily: font }}>
        <span><strong style={{ color: T.txt2 }}>Activos post-Zoom:</strong> {activosPostZoom} clientes en cierre ahora</span>
        {totals.doneInferred > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 8,
            background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)", color: T.txt2,
          }}>
            <CheckCircle2 size={12} color="#10B981" strokeWidth={2.5} />
            {totals.doneRegistered} confirmados + {totals.doneInferred} recuperados por su etapa
            <span style={{ color: T.txt3 }}>· el sistema no pierde ningún Zoom aunque no se marque el paso</span>
          </span>
        )}
      </div>

      {/* Tendencia de Zooms por semana / mes — vista para la junta de domingo */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: fontDisp, color: T.txt }}>
              Zooms realizados por {trendGran === "week" ? "semana" : "mes"}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.txt3, fontFamily: font }}>
              Evolución reciente · cuántos Zooms se dieron en cada {trendGran === "week" ? "semana" : "mes"}.
            </p>
          </div>
          <span style={{
            padding: "7px 11px", borderRadius: 9,
            background: headerBg, border: `1px solid ${rowBorder}`,
            color: T.txt3, fontSize: 11, fontFamily: font,
          }}>
            Agrupación automática: <strong style={{ color: T.txt2 }}>{trendGran === "week" ? "Semanal" : "Mensual"}</strong>
          </span>
        </div>
        <div style={{ borderRadius: 14, background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)", border: `1px solid ${rowBorder}`, padding: "20px 18px 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: 150 }}>
            {trend.buckets.map((b, i) => {
              const h = Math.round((b.done / trend.max) * 120);
              return (
                <div key={i} title={`${b.label}: ${b.done} realizados · ${b.sched} agendados`}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: fontDisp, color: b.done ? T.txt : T.txt3 }}>{b.done}</span>
                  <div style={{
                    width: "100%", maxWidth: 38, height: Math.max(3, h), borderRadius: 6,
                    background: b.done ? "#10B981" : (isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)"),
                    transition: "height 0.2s",
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, borderTop: `1px solid ${rowBorder}`, paddingTop: 8 }}>
            {trend.buckets.map((b, i) => (
              <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: T.txt3, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla por presentador */}
      <div>
        <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 600, fontFamily: fontDisp, color: T.txt }}>
          Zooms realizados por asesor
        </h3>
        <p style={{ margin: "0 0 10px", fontSize: 11.5, color: T.txt3, fontFamily: font }}>
          Quién corrió el Zoom (presentador) — acreditado a quien lo dio, no al dueño actual del lead.
        </p>
        <div style={{ borderRadius: 14, background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)", border: `1px solid ${rowBorder}`, overflow: "hidden", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                <th style={{ ...thStyle(T), textAlign: "left", paddingLeft: 16 }}>Asesor</th>
                <th style={thStyle(T)}>Zooms realizados</th>
              </tr>
            </thead>
            <tbody>
              {byPresenter.length === 0 && (
                <tr><td colSpan={2} style={{ padding: 26, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 13 }}>Sin Zooms en este período.</td></tr>
              )}
              {byPresenter.map((r, i) => (
                  <tr key={r.asesor} style={{ borderTop: i === 0 ? "none" : `1px solid ${rowBorder}` }}>
                    <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 600, color: T.txt, fontSize: 13 }}>{r.asesor}</td>
                    <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 700, color: "#10B981", fontSize: 14 }}>{r.done}</td>
                  </tr>
              ))}
            </tbody>
            {byPresenter.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: `1px solid ${rowBorder}`, background: headerBg }}>
                  <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 700, color: T.txt2, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total</td>
                  <td style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 700, color: accent, fontSize: 14 }}>{totals.done}</td>
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
                  <td style={{ padding: cellPad, textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-block", whiteSpace: "nowrap", padding: "3px 10px", borderRadius: 999, fontFamily: fontDisp, fontWeight: 600, fontSize: 11, color: STAGE_COLORS[etapa] || T.txt3, background: `${STAGE_COLORS[etapa] || T.txt3}1A` }}>{etapa}</span>
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

      {/* ── Historial de movimientos de Zoom (colapsable) ─────────────────── */}
      <div>
        <button
          onClick={() => setHistOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "12px 14px", borderRadius: 12, cursor: "pointer",
            background: headerBg, border: `1px solid ${rowBorder}`, color: T.txt,
            fontFamily: fontDisp, fontWeight: 600, fontSize: 14,
          }}
        >
          <History size={15} color={accent} strokeWidth={2.2} />
          <span>Historial de movimientos de Zoom</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: T.txt3 }}>· {historial.length} movimientos{inferidos ? ` · ${inferidos} inferidos` : ""}</span>
          <ChevronDown size={16} color={T.txt3} style={{ marginLeft: "auto", transform: histOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>

        {histOpen && (
          <div style={{ marginTop: 10 }}>
            <div role="tablist" aria-label="Tipo" style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 10, background: headerBg, border: `1px solid ${rowBorder}`, marginBottom: 10 }}>
              {[{ id: "all", l: "Todos" }, { id: "scheduled", l: "Agendados" }, { id: "done", l: "Realizados" }].map(t => {
                const active = histKind === t.id;
                return (
                  <button key={t.id} onClick={() => setHistKind(t.id)} style={{
                    padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                    background: active ? accent : "transparent",
                    color: active ? (isLight ? "#FFFFFF" : "#06080F") : T.txt2,
                    fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: fontDisp,
                  }}>{t.l}</button>
                );
              })}
            </div>

            <div style={{ borderRadius: 14, background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)", border: `1px solid ${rowBorder}`, overflow: "hidden", overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: headerBg }}>
                    <th style={{ ...thStyle(T), textAlign: "left", paddingLeft: 16 }}>Cliente</th>
                    <th style={thStyle(T)}>Movimiento</th>
                    <th style={thStyle(T)}>Quién</th>
                    <th style={thStyle(T)}>Fecha</th>
                    <th style={thStyle(T)}>Etapa actual</th>
                    <th style={thStyle(T)}>Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 26, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 13 }}>Sin movimientos de Zoom en este período.</td></tr>
                  )}
                  {historial.map((m, i) => {
                    const esRealizado = m.kind === "done";
                    const movColor = esRealizado ? "#10B981" : "#2563EB";
                    const movLabel = esRealizado ? "Realizado" : "Agendado";
                    return (
                      <tr key={(m.lead.id || i) + m.kind}
                        onClick={onOpenLead ? () => onOpenLead(m.lead) : undefined}
                        style={{ borderTop: i === 0 ? "none" : `1px solid ${rowBorder}`, cursor: onOpenLead ? "pointer" : "default" }}
                        onMouseEnter={onOpenLead ? (e) => { e.currentTarget.style.background = headerBg; } : undefined}
                        onMouseLeave={onOpenLead ? (e) => { e.currentTarget.style.background = "transparent"; } : undefined}
                      >
                        <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 600, color: T.txt, fontSize: 13 }}>{m.lead.name || m.lead.n || "(sin nombre)"}</td>
                        <td style={{ padding: cellPad, textAlign: "center", fontSize: 12 }}>
                          <span style={{ display: "inline-block", whiteSpace: "nowrap", padding: "3px 10px", borderRadius: 999, fontFamily: fontDisp, fontWeight: 600, fontSize: 11, color: movColor, background: `${movColor}1A` }}>{movLabel}</span>
                        </td>
                        <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5 }}>{m.by || m.lead.asesor || "—"}</td>
                        <td style={{ padding: cellPad, textAlign: "center", fontFamily: font, color: T.txt2, fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtFecha(m.at)}</td>
                        <td style={{ padding: cellPad, textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-block", whiteSpace: "nowrap", padding: "3px 10px", borderRadius: 999, fontFamily: fontDisp, fontWeight: 600, fontSize: 11, color: STAGE_COLORS[m.lead.st] || T.txt3, background: `${STAGE_COLORS[m.lead.st] || T.txt3}1A` }}>{m.lead.st || "—"}</span>
                        </td>
                        <td style={{ padding: cellPad, textAlign: "center", fontSize: 11.5 }}>
                          {m.inferred
                            ? <span title="La etapa actual implica Zoom, pero el movimiento no se registró. Lo inferimos." style={{ color: "#F59E0B", fontFamily: fontDisp, fontWeight: 600 }}>Inferido</span>
                            : <span style={{ color: T.txt3, fontFamily: font }}>Registrado</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "8px 4px 0", fontSize: 10.5, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
              <strong style={{ color: "#F59E0B" }}>Inferido</strong> = la etapa actual del lead implica que hubo Zoom, pero el asesor no marcó el movimiento. Lo recuperamos de la etapa para no perder la métrica; conviene que se registre correctamente.
            </p>
          </div>
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
