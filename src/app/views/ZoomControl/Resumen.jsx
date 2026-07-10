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
import { todayStr, addDays, weekRange, quincenaRange, monthRange, inRange, ymd, DOW, MON } from "./dates";

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
  const qna = quincenaRange();
  const mo = monthRange();

  const hoyRows    = useMemo(() => rows.filter(r => r.fecha_zoom === today), [rows, today]);
  const semanaRows = useMemo(() => rows.filter(r => inRange(r.fecha_zoom, wk.start, wk.end)), [rows, wk.start, wk.end]);
  const qnaRows    = useMemo(() => rows.filter(r => inRange(r.fecha_zoom, qna.start, qna.end)), [rows, qna.start, qna.end]);
  const mesRows    = useMemo(() => rows.filter(r => inRange(r.fecha_zoom, mo.start, mo.end)), [rows, mo.start, mo.end]);
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

  // Por Liner (hoy | semana | mes) y por Presentador (principal — quien corre el Zoom).
  const porLiner = useMemo(() => {
    const scope = linerScope === "hoy" ? hoyRows
      : linerScope === "semana" ? semanaRows
      : linerScope === "qna" ? qnaRows
      : mesRows;
    return peopleList(LINERS, rows, "liner")
      .map(name => ({ name, ...countsOf(scope.filter(r => (r.liner || "").trim() === name)) }));
  }, [linerScope, hoyRows, semanaRows, qnaRows, mesRows, rows]);

  const porPresentador = useMemo(() => {
    return peopleList(PRESENTADORES, rows, "presentador_principal")
      .map(name => {
        const mine = (list) => list.filter(r => (r.presentador_principal || "").trim() === name);
        const week = mine(semanaRows);
        return {
          name,
          hoy: mine(hoyRows).length,
          semana: week.length,
          mes: mine(mesRows).length,
          asistioSemana: week.filter(r => r.estatus === ESTATUS_ASISTIO).length,
        };
      });
  }, [hoyRows, semanaRows, mesRows, rows]);

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
          subtitle1: `Hoy (${stamp}): ${kpisHoy.total} Zooms  -  Semana: ${semanaCounts.total}  -  ${qna.label}: ${countsOf(qnaRows).total}  -  Mes (${mo.label}): ${countsOf(mesRows).total}`,
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
        linerQuincena: { title: `Por Liner - quincena (${qna.label})`, headers: ["Liner", "Zooms", "Conf.", "Asistió", "No show", "Reag.", "Canc."], rows: linerTable(qnaRows) },
        linerMes:    { title: `Por Liner - mes (${mo.label})`, headers: ["Liner", "Zooms", "Conf.", "Asistió", "No show", "Reag.", "Canc."], rows: linerTable(mesRows) },
        presentadores: {
          title: "Por Presentador",
          headers: ["Presentador", "Zooms hoy", "Zooms semana", "Zooms mes", "Asistieron (semana)"],
          rows: porPresentador.map(p => [p.name, p.hoy, p.semana, p.mes, p.asistioSemana]),
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
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.014em" }}>
            Resumen automático de Zooms
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.txt2, fontFamily: font }}>
            Fecha de revisión: <strong style={{ color: T.txt }}>{today}</strong> · se actualiza solo con cada cambio de estatus · listo para mandar a los socios.
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
            borderRadius: 12, padding: "12px 14px",
            background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${rowBorder}`, borderTop: `3px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.txt2, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.txt, fontFamily: fontDisp, marginTop: 3, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 2) Semana actual L-D */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <CalendarRange size={15} color={accent} strokeWidth={2.2} />
          <span style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Semana actual · lunes a domingo</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.txt2, fontFamily: font }}>· {countsOf(semanaRows).total} Zooms esta semana</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(92px, 1fr))", gap: 6, overflowX: "auto" }}>
          {semanaDias.map(d => (
            <div key={d.key} title={`${d.longLabel}: ${d.total} Zooms · ${d.confirmados} confirmados · ${d.asistieron} asistieron`} style={{
              borderRadius: 10, padding: "10px 10px", textAlign: "center",
              background: d.isToday ? `${accent}14` : (isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)"),
              border: d.isToday ? `2px solid ${accent}77` : `1px solid ${rowBorder}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: d.isToday ? accent : T.txt2, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                {d.label}{d.isToday ? " · hoy" : ""}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.txt, fontFamily: fontDisp, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{d.total}</div>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: T.txt2, fontFamily: font, whiteSpace: "nowrap" }}>{d.confirmados} conf. · {d.asistieron} asist.</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3+4+5) Tablas: por Liner (toggle hoy/semana), por Presentador, próximos 7 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        {/* Por Liner */}
        <div style={{ borderRadius: 12, border: `1px solid ${rowBorder}`, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", background: headerBg }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Por Liner</span>
            <div style={{ display: "inline-flex", gap: 3, padding: 2, borderRadius: 8, border: `1px solid ${rowBorder}` }}>
              {[{ id: "hoy", l: "Hoy" }, { id: "semana", l: "Semana" }, { id: "qna", l: "Qna." }, { id: "mes", l: "Mes" }].map(s => {
                const active = linerScope === s.id;
                return (
                  <button key={s.id} onClick={() => setLinerScope(s.id)} style={{
                    padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 11.5, fontWeight: active ? 700 : 600, fontFamily: fontDisp,
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
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Por Presentador</span>
            <span style={{ fontSize: 11.5, color: T.txt2, fontFamily: font, marginLeft: 6 }}>quién corre el Zoom</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 280 }}>
              <thead>
                <tr>
                  <th style={miniTh(T, "left")}>Presentador</th>
                  <th style={miniTh(T)}>Hoy</th>
                  <th style={miniTh(T)}>Semana</th>
                  <th style={miniTh(T)}>Mes</th>
                  <th style={miniTh(T)}>Asistió (sem.)</th>
                </tr>
              </thead>
              <tbody>
                {porPresentador.map(p => (
                  <tr key={p.name} style={{ borderTop: `1px solid ${rowBorder}`, opacity: p.mes === 0 && p.hoy === 0 ? 0.55 : 1 }}>
                    <td style={{ ...miniTd(T, "left"), fontWeight: 600, color: T.txt }}>{p.name}</td>
                    <td style={miniTd(T)}>{p.hoy}</td>
                    <td style={miniTd(T)}>{p.semana}</td>
                    <td style={miniTd(T)}>{p.mes}</td>
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
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Próximos 7 días</span>
            <span style={{ fontSize: 11.5, color: T.txt2, fontFamily: font, marginLeft: 6 }}>lo que viene en agenda</span>
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
                  <td style={{ ...miniTd(T, "left"), fontWeight: i === 0 ? 800 : 600, color: T.txt }}>{d.label}{i === 0 ? " · hoy" : ""}</td>
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

// Tipografía de tablas del Resumen — tamaños generosos y tinta oscura:
// dirección lo lee en juntas y pantallas compartidas, nada de grises tenues.
function miniTh(T, align = "center") {
  return {
    padding: "9px 11px", textAlign: align,
    fontSize: 10.5, fontWeight: 700, color: T.txt2, fontFamily: fontDisp,
    textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
  };
}
function miniTd(T, align = "center") {
  return {
    padding: "9px 11px", textAlign: align,
    fontSize: 13.5, fontWeight: 600, color: T.txt, fontFamily: fontDisp,
    fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
  };
}
