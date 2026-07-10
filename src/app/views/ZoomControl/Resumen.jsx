/**
 * app/views/ZoomControl/Resumen.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Resumen automático de Zooms" — réplica 1:1 de la pestaña Resumen del Google
 * Sheet del director comercial (reunión 2026-07-09). Es lo que él manda a los
 * socios cuando piden información del día, por eso tiene botón de PDF propio.
 *
 * Bloques (mismos que su sheet):
 *   1) Fecha de revisión + KPIs de HOY por estatus (Total / Confirmados /
 *      Asistieron / No show / Reagendados / Cancelados).
 *   2) Semana actual de LUNES a domingo — 7 tarjetas con los Zooms de cada
 *      día (los liners agendan a 5-7 días vista y se van acumulando).
 *   3) Tabla por Liner (toggle Hoy | Semana) con el desglose por estatus.
 *   4) Tabla por Presentador (Zooms hoy / semana / asistieron).
 *   5) Próximos 7 días (hoy → +6) con total y confirmados.
 *
 * Todo se calcula en memoria desde `rows` (zoom_agendados) — cero queries.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import { FileDown, CalendarRange } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { G } from "../../SharedComponents";
import { useClient } from "../../../hooks/useClient";
import { LINERS, PRESENTADORES, ESTATUS_ASISTIO } from "./constants";
import { todayStr, addDays, weekRange, inRange, ymd, DOW, MON } from "./dates";

// Conteo por estatus de un subconjunto de Zooms. `total` incluye TODOS los
// estatus (igual que "Total Zooms hoy" del sheet).
function countsOf(rows) {
  const c = { total: rows.length, confirmados: 0, asistieron: 0, noShow: 0, reagendados: 0, cancelados: 0 };
  for (const r of rows) {
    if (r.estatus === "Confirmado") c.confirmados++;
    else if (r.estatus === "Asistió") c.asistieron++;
    else if (r.estatus === "No show") c.noShow++;
    else if (r.estatus === "Reagendado") c.reagendados++;
    else if (r.estatus === "Cancelado") c.cancelados++;
  }
  return c;
}

// Personas de la tabla: catálogo primero (aparecen aunque vayan en cero, como
// en el sheet) + cualquier nombre extra tecleado a mano en los registros.
function peopleList(catalog, rows, field) {
  const extra = [...new Set(rows.map(r => (r[field] || "").trim()).filter(Boolean))]
    .filter(n => !catalog.includes(n))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...catalog, ...extra];
}

const ESTATUS_COLS = [
  { key: "total",       label: "Zooms" },
  { key: "confirmados", label: "Conf." },
  { key: "asistieron",  label: "Asistió" },
  { key: "noShow",      label: "No show" },
  { key: "reagendados", label: "Reag." },
  { key: "cancelados",  label: "Canc." },
];

export default function ResumenZooms({ rows = [], T, isLight }) {
  const { config: clientConfig } = useClient();
  const [linerScope, setLinerScope] = useState("hoy"); // hoy | semana
  const [pdfBusy, setPdfBusy] = useState(false);

  const today = todayStr();
  const wk = weekRange();

  const hoyRows    = useMemo(() => rows.filter(r => r.fecha_zoom === today), [rows, today]);
  const semanaRows = useMemo(() => rows.filter(r => inRange(r.fecha_zoom, wk.start, wk.end)), [rows, wk.start, wk.end]);
  const kpisHoy    = useMemo(() => countsOf(hoyRows), [hoyRows]);

  // Semana L-D: 7 días con sus conteos.
  const semanaDias = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(wk.monday, i);
      const key = ymd(d);
      const delDia = rows.filter(r => r.fecha_zoom === key);
      return {
        key,
        isToday: key === today,
        label: `${DOW[d.getDay()]} ${d.getDate()}`,
        longLabel: `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`,
        ...countsOf(delDia),
      };
    });
  }, [rows, wk.monday, today]);

  // Por Liner (hoy | semana) y por Presentador (principal — quien corre el Zoom).
  const porLiner = useMemo(() => {
    const scope = linerScope === "hoy" ? hoyRows : semanaRows;
    return peopleList(LINERS, rows, "liner")
      .map(name => ({ name, ...countsOf(scope.filter(r => (r.liner || "").trim() === name)) }));
  }, [linerScope, hoyRows, semanaRows, rows]);

  const porPresentador = useMemo(() => {
    return peopleList(PRESENTADORES, rows, "presentador_principal")
      .map(name => {
        const mine = (list) => list.filter(r => (r.presentador_principal || "").trim() === name);
        const week = mine(semanaRows);
        return {
          name,
          hoy: mine(hoyRows).length,
          semana: week.length,
          asistioSemana: week.filter(r => r.estatus === ESTATUS_ASISTIO).length,
        };
      });
  }, [hoyRows, semanaRows, rows]);

  const proximos7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(), i);
      const key = ymd(d);
      const delDia = rows.filter(r => r.fecha_zoom === key);
      const c = countsOf(delDia);
      return { key, label: `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`, total: c.total, confirmados: c.confirmados };
    });
  }, [rows]);

  // ── Export PDF (para los socios) ──────────────────────────────────────────
  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      const [{ default: JsPDF }, { buildZoomResumenPdf }] = await Promise.all([
        import("jspdf"),
        import("../ComandoDirectivo.pdf"),
      ]);
      const now = new Date();
      const stamp = ymd(now);
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const semanaCounts = countsOf(semanaRows);
      const linerTable = (scope) =>
        peopleList(LINERS, rows, "liner")
          .map(name => ({ name, ...countsOf(scope.filter(r => (r.liner || "").trim() === name)) }))
          .map(r => [r.name, r.total, r.confirmados, r.asistieron, r.noShow, r.reagendados, r.cancelados]);
      const model = {
        meta: {
          clientName: clientConfig?.legalName || clientConfig?.name || "Stratos",
          stamp, hhmm,
          subtitle1: `Hoy (${stamp}): ${kpisHoy.total} Zooms  -  Semana ${wk.start} a ${wk.end}: ${semanaCounts.total} Zooms`,
          subtitle2: `Fecha de revisión: ${stamp} ${hhmm}`,
        },
        cardsHoy: [
          { label: "Zooms hoy",   value: String(kpisHoy.total),       sub: "agendados para hoy", color: "#3B82F6" },
          { label: "Confirmados", value: String(kpisHoy.confirmados), sub: "hoy",                color: "#0EA5E9" },
          { label: "Asistieron",  value: String(kpisHoy.asistieron),  sub: "hoy",                color: "#10B981" },
          { label: "No show",     value: String(kpisHoy.noShow),      sub: "hoy",                color: "#EA580C" },
          { label: "Reagendados", value: String(kpisHoy.reagendados), sub: "hoy",                color: "#F59E0B" },
          { label: "Cancelados",  value: String(kpisHoy.cancelados),  sub: "hoy",                color: "#64748B" },
        ],
        semana: {
          title: `Semana actual (lunes a domingo) - ${semanaCounts.total} Zooms`,
          headers: ["Día", "Zooms", "Conf.", "Asistió", "No show", "Reag.", "Canc."],
          rows: semanaDias.map(d => [d.longLabel + (d.isToday ? "  (hoy)" : ""), d.total, d.confirmados, d.asistieron, d.noShow, d.reagendados, d.cancelados]),
          totals: ["Total semana", semanaCounts.total, semanaCounts.confirmados, semanaCounts.asistieron, semanaCounts.noShow, semanaCounts.reagendados, semanaCounts.cancelados],
        },
        linerHoy:    { title: "Por Liner - hoy",    headers: ["Liner", "Zooms", "Conf.", "Asistió", "No show", "Reag.", "Canc."], rows: linerTable(hoyRows) },
        linerSemana: { title: "Por Liner - semana", headers: ["Liner", "Zooms", "Conf.", "Asistió", "No show", "Reag.", "Canc."], rows: linerTable(semanaRows) },
        presentadores: {
          title: "Por Presentador",
          headers: ["Presentador", "Zooms hoy", "Zooms semana", "Asistieron (semana)"],
          rows: porPresentador.map(p => [p.name, p.hoy, p.semana, p.asistioSemana]),
        },
        proximos7: {
          title: "Próximos 7 días",
          headers: ["Fecha", "Zooms", "Confirmados"],
          rows: proximos7.map(d => [d.label, d.total, d.confirmados]),
        },
      };
      const doc = buildZoomResumenPdf(JsPDF, model);
      doc.save(`resumen-zooms_${stamp}.pdf`);
    } catch (err) {
      console.warn("[Control de Zooms] PDF del resumen falló:", err);
    }
    setPdfBusy(false);
  };

  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const accent    = T.accent;

  return (
    <G T={T}>
      {/* Header del resumen */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.014em" }}>
            Resumen automático de Zooms
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: T.txt3, fontFamily: font }}>
            Fecha de revisión: <strong style={{ color: T.txt2 }}>{today}</strong> · se actualiza solo con cada cambio de estatus · listo para mandar a los socios.
          </p>
        </div>
        <button
          onClick={handlePdf}
          disabled={pdfBusy}
          title="Descarga este resumen como PDF — para compartir con los socios"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 14px", borderRadius: 9,
            background: isLight ? accent : `${accent}18`,
            color: isLight ? "#06080F" : accent,
            border: `1px solid ${isLight ? "transparent" : `${accent}55`}`,
            fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
            cursor: pdfBusy ? "default" : "pointer", opacity: pdfBusy ? 0.6 : 1,
            boxShadow: isLight ? `0 2px 8px ${accent}40` : "none",
          }}
        >
          <FileDown size={13} strokeWidth={2.4} />
          {pdfBusy ? "Generando…" : "PDF del Resumen"}
        </button>
      </div>

      {/* 1) KPIs de HOY por estatus */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Zooms hoy",   value: kpisHoy.total,       color: "#3B82F6" },
          { label: "Confirmados", value: kpisHoy.confirmados, color: "#0EA5E9" },
          { label: "Asistieron",  value: kpisHoy.asistieron,  color: "#10B981" },
          { label: "No show",     value: kpisHoy.noShow,      color: "#EA580C" },
          { label: "Reagendados", value: kpisHoy.reagendados, color: "#F59E0B" },
          { label: "Cancelados",  value: kpisHoy.cancelados,  color: "#64748B" },
        ].map(k => (
          <div key={k.label} style={{
            borderRadius: 12, padding: "10px 12px",
            background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${rowBorder}`, borderTop: `2px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 2) Semana actual L-D */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <CalendarRange size={14} color={accent} strokeWidth={2.2} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Semana actual · lunes a domingo</span>
          <span style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>· {countsOf(semanaRows).total} Zooms esta semana</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(92px, 1fr))", gap: 6, overflowX: "auto" }}>
          {semanaDias.map(d => (
            <div key={d.key} title={`${d.longLabel}: ${d.total} Zooms · ${d.confirmados} confirmados · ${d.asistieron} asistieron`} style={{
              borderRadius: 10, padding: "8px 10px", textAlign: "center",
              background: d.isToday ? (isLight ? `${accent}14` : `${accent}14`) : (isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)"),
              border: `1px solid ${d.isToday ? `${accent}55` : rowBorder}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? accent : T.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {d.label}{d.isToday ? " · hoy" : ""}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{d.total}</div>
              <div style={{ fontSize: 9.5, color: T.txt3, fontFamily: font }}>{d.confirmados} conf. · {d.asistieron} asist.</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3+4+5) Tablas: por Liner (toggle hoy/semana), por Presentador, próximos 7 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        {/* Por Liner */}
        <div style={{ borderRadius: 12, border: `1px solid ${rowBorder}`, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", background: headerBg }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Por Liner</span>
            <div style={{ display: "inline-flex", gap: 3, padding: 2, borderRadius: 8, border: `1px solid ${rowBorder}` }}>
              {[{ id: "hoy", l: "Hoy" }, { id: "semana", l: "Semana" }].map(s => {
                const active = linerScope === s.id;
                return (
                  <button key={s.id} onClick={() => setLinerScope(s.id)} style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 10.5, fontWeight: active ? 700 : 600, fontFamily: fontDisp,
                    background: active ? (isLight ? accent : `${accent}22`) : "transparent",
                    color: active ? (isLight ? "#06080F" : accent) : T.txt3,
                  }}>{s.l}</button>
                );
              })}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 300 }}>
              <thead>
                <tr>
                  <th style={miniTh(T, "left")}>Liner</th>
                  {ESTATUS_COLS.map(c => <th key={c.key} style={miniTh(T)}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {porLiner.map((r, i) => (
                  <tr key={r.name} style={{ borderTop: `1px solid ${rowBorder}`, opacity: r.total === 0 ? 0.55 : 1 }}>
                    <td style={{ ...miniTd(T, "left"), fontWeight: 600, color: T.txt }}>{r.name}</td>
                    {ESTATUS_COLS.map(c => <td key={c.key} style={miniTd(T)}>{r[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `1px solid ${rowBorder}`, background: headerBg }}>
                  <td style={{ ...miniTd(T, "left"), fontWeight: 700, color: T.txt2, textTransform: "uppercase", fontSize: 10 }}>Total</td>
                  {ESTATUS_COLS.map(c => (
                    <td key={c.key} style={{ ...miniTd(T), fontWeight: 700, color: accent }}>
                      {porLiner.reduce((s, r) => s + r[c.key], 0)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Por Presentador */}
        <div style={{ borderRadius: 12, border: `1px solid ${rowBorder}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", background: headerBg }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Por Presentador</span>
            <span style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, marginLeft: 6 }}>quién corre el Zoom</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 280 }}>
              <thead>
                <tr>
                  <th style={miniTh(T, "left")}>Presentador</th>
                  <th style={miniTh(T)}>Hoy</th>
                  <th style={miniTh(T)}>Semana</th>
                  <th style={miniTh(T)}>Asistió (sem.)</th>
                </tr>
              </thead>
              <tbody>
                {porPresentador.map(p => (
                  <tr key={p.name} style={{ borderTop: `1px solid ${rowBorder}`, opacity: p.semana === 0 && p.hoy === 0 ? 0.55 : 1 }}>
                    <td style={{ ...miniTd(T, "left"), fontWeight: 600, color: T.txt }}>{p.name}</td>
                    <td style={miniTd(T)}>{p.hoy}</td>
                    <td style={miniTd(T)}>{p.semana}</td>
                    <td style={{ ...miniTd(T), color: "#10B981", fontWeight: 700 }}>{p.asistioSemana}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Próximos 7 días */}
        <div style={{ borderRadius: 12, border: `1px solid ${rowBorder}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", background: headerBg }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Próximos 7 días</span>
            <span style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, marginLeft: 6 }}>lo que viene en agenda</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={miniTh(T, "left")}>Fecha</th>
                <th style={miniTh(T)}>Zooms</th>
                <th style={miniTh(T)}>Confirmados</th>
              </tr>
            </thead>
            <tbody>
              {proximos7.map((d, i) => (
                <tr key={d.key} style={{ borderTop: `1px solid ${rowBorder}`, opacity: d.total === 0 ? 0.55 : 1 }}>
                  <td style={{ ...miniTd(T, "left"), fontWeight: i === 0 ? 700 : 500, color: T.txt }}>{d.label}{i === 0 ? " · hoy" : ""}</td>
                  <td style={miniTd(T)}>{d.total}</td>
                  <td style={{ ...miniTd(T), color: "#0EA5E9", fontWeight: 600 }}>{d.confirmados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </G>
  );
}

function miniTh(T, align = "center") {
  return {
    padding: "8px 10px", textAlign: align,
    fontSize: 9.5, fontWeight: 700, color: T.txt3, fontFamily: fontDisp,
    textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
  };
}
function miniTd(T, align = "center") {
  return {
    padding: "7px 10px", textAlign: align,
    fontSize: 12, color: T.txt2, fontFamily: fontDisp,
    fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
  };
}
