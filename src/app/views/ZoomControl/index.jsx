/**
 * app/views/ZoomControl/index.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel "Control de Zooms" — pestaña dentro de Comando Directivo (Duke).
 *
 * Reemplaza el Excel "control_zooms_agendados_roles" que el equipo mantenía a
 * mano. Centro de control completo: KPIs del día/semana/próximos, productividad
 * por Liner y por Presentador, y una tabla filtrable con CRUD directo sobre
 * public.zoom_agendados (migración 027) vía RLS por organización.
 *
 * Theme-aware (claro/oscuro) usando los tokens P/LP — mismo criterio que el
 * resto de Comando Directivo. Sin librerías nuevas, todo inline styles.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState, useCallback } from "react";
import {
  Video, Plus, RefreshCw, Search, X, Pencil, Trash2,
  CalendarDays, CheckCircle2, UserCheck, Clock3, AlertTriangle,
} from "lucide-react";
import { P, LP, font, fontDisp } from "../../../design-system/tokens";
import { G, KPI } from "../../SharedComponents";
import { useZoomAgendados } from "../../../hooks/useZoomAgendados";
import {
  LINERS, PRESENTADORES, ESTATUS, ESTATUS_DEFAULT,
  ESTATUS_ASISTIO, ESTATUS_NO_SHOW, ESTATUS_ACTIVOS,
  estatusColor, suggestPresentador, suggestApoyo,
} from "./constants";

// ── Helpers de fecha (comparación lexicográfica sobre YYYY-MM-DD = cronológica,
//    evita líos de zona horaria) ───────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function todayStr() { return ymd(new Date()); }
function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function weekRange() {
  const now = new Date();
  const dow = now.getDay();             // 0=Dom … 6=Sáb
  const back = (dow + 6) % 7;           // días desde el lunes
  const monday = addDays(now, -back);
  return { start: ymd(monday), end: ymd(addDays(monday, 6)) };
}
function next7Range() {
  const now = new Date();
  return { start: ymd(now), end: ymd(addDays(now, 6)) };
}
function inRange(dateStr, start, end) {
  return !!dateStr && dateStr >= start && dateStr <= end;
}
// "2026-06-03" → "mié 3 jun"
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function prettyDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]} ${d} ${MON[m - 1]}`;
}

const RANGES = [
  { id: "hoy",   label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "prox7", label: "Próximos 7" },
  { id: "todos", label: "Todos" },
];

const ZoomControl = ({ theme = "dark" }) => {
  const isLight = theme === "light";
  const T = isLight ? LP : P;
  const accent = T.accent;

  const { rows, loading, error, refetch, createRow, updateRow, removeRow } = useZoomAgendados();

  const [range, setRange] = useState("prox7");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal de alta/edición
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [formErr, setFormErr] = useState("");

  const today = todayStr();

  // ── KPIs (sobre TODA la data, no el filtro visible) ──────────────────────
  const kpis = useMemo(() => {
    const wk = weekRange();
    const n7 = next7Range();
    let hoy = 0, semana = 0, prox7 = 0, porConfirmar = 0, asistio = 0, noShow = 0;
    for (const r of rows) {
      const f = r.fecha_zoom;
      if (f === today) hoy++;
      if (inRange(f, wk.start, wk.end)) semana++;
      if (inRange(f, n7.start, n7.end) && ESTATUS_ACTIVOS.has(r.estatus)) prox7++;
      if (r.estatus === "Agendado") porConfirmar++;
      if (r.estatus === ESTATUS_ASISTIO) asistio++;
      if (r.estatus === ESTATUS_NO_SHOW) noShow++;
    }
    const base = asistio + noShow;
    const tasa = base ? Math.round((asistio / base) * 100) : null;
    return { hoy, semana, prox7, porConfirmar, asistio, noShow, tasa };
  }, [rows, today]);

  // ── Productividad por Liner / Presentador ────────────────────────────────
  const productividad = useMemo(() => {
    const byLiner = new Map();
    const byPres = new Map();
    const bump = (map, key, asistio) => {
      if (!key) return;
      const cur = map.get(key) || { total: 0, asistio: 0 };
      cur.total++;
      if (asistio) cur.asistio++;
      map.set(key, cur);
    };
    for (const r of rows) {
      const a = r.estatus === ESTATUS_ASISTIO;
      bump(byLiner, r.liner, a);
      bump(byPres, r.presentador_principal, a);
    }
    const toSorted = (map) =>
      [...map.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((x, y) => y.total - x.total);
    return { liners: toSorted(byLiner), presentadores: toSorted(byPres) };
  }, [rows]);

  // ── Lista filtrada + ordenada ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const wk = weekRange();
    const n7 = next7Range();
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      // rango
      if (range === "hoy" && r.fecha_zoom !== today) return false;
      if (range === "semana" && !inRange(r.fecha_zoom, wk.start, wk.end)) return false;
      if (range === "prox7" && !inRange(r.fecha_zoom, n7.start, n7.end)) return false;
      // estatus
      if (statusFilter !== "Todos" && r.estatus !== statusFilter) return false;
      // texto
      if (needle) {
        const hay = [r.cliente, r.proyecto, r.liner, r.presentador_principal, r.presentador_apoyo, r.comentarios]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // orden: por fecha_zoom asc (sin fecha al final), luego hora
    list = [...list].sort((a, b) => {
      const fa = a.fecha_zoom || "9999-12-31";
      const fb = b.fecha_zoom || "9999-12-31";
      if (fa !== fb) return fa < fb ? -1 : 1;
      return (a.hora || "").localeCompare(b.hora || "");
    });
    return list;
  }, [rows, range, statusFilter, q, today]);

  // ── Form helpers ─────────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({
      fecha_agendado: today, fecha_zoom: "", hora: "",
      liner: "", presentador_principal: "", presentador_apoyo: "",
      cliente: "", proyecto: "", estatus: ESTATUS_DEFAULT, comentarios: "",
    });
    setFormErr("");
    setModalOpen(true);
  }, [today]);

  const openEdit = useCallback((row) => {
    setEditingId(row.id);
    setForm({
      fecha_agendado: row.fecha_agendado || "",
      fecha_zoom: row.fecha_zoom || "",
      hora: row.hora || "",
      liner: row.liner || "",
      presentador_principal: row.presentador_principal || "",
      presentador_apoyo: row.presentador_apoyo || "",
      cliente: row.cliente || "",
      proyecto: row.proyecto || "",
      estatus: row.estatus || ESTATUS_DEFAULT,
      comentarios: row.comentarios || "",
    });
    setFormErr("");
    setModalOpen(true);
  }, []);

  const setField = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Al elegir liner, sugerir dupla si los presentadores están vacíos.
      if (k === "liner") {
        if (!f.presentador_principal) next.presentador_principal = suggestPresentador(v);
        if (!f.presentador_apoyo) next.presentador_apoyo = suggestApoyo(v);
      }
      return next;
    });
  };

  const closeModal = () => { setModalOpen(false); setForm(null); setEditingId(null); setFormErr(""); };

  const save = async () => {
    if (!form.cliente?.trim()) { setFormErr("El cliente es obligatorio."); return; }
    setBusy(true);
    const res = editingId ? await updateRow(editingId, form) : await createRow(form);
    setBusy(false);
    if (res?.error) { setFormErr(typeof res.error === "string" ? res.error : "No se pudo guardar."); return; }
    closeModal();
  };

  const onDelete = async (row) => {
    if (!window.confirm(`¿Eliminar el Zoom de "${row.cliente || "—"}"? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    await removeRow(row.id);
    setBusy(false);
  };

  const onInlineStatus = async (row, estatus) => {
    if (estatus === row.estatus) return;
    setBusy(true);
    await updateRow(row.id, { estatus });
    setBusy(false);
  };

  const onRefresh = async () => { setBusy(true); await refetch(); setBusy(false); };

  // ── Estilos compartidos (theme-aware) ────────────────────────────────────
  const cardBorder = isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)";
  const subtleBg = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `${accent}14`, border: `1px solid ${accent}2A`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Video size={20} color={accent} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
              Control de Zooms
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.txt2, fontFamily: font }}>
              Agenda de Zooms de venta — Liner, Presentador y estatus en un solo lugar.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onRefresh}
            disabled={busy}
            title="Recargar"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 13px", borderRadius: 10,
              fontSize: 12.5, fontWeight: 600, fontFamily: fontDisp,
              cursor: busy ? "default" : "pointer",
              background: subtleBg, color: T.txt2,
              border: `1px solid ${cardBorder}`,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={busy ? { animation: "spin 0.8s linear infinite" } : undefined} />
            Recargar
          </button>
          <button
            onClick={openCreate}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 15px", borderRadius: 10,
              fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
              cursor: "pointer",
              background: isLight ? accent : `${accent}1F`,
              color: isLight ? "#06080F" : accent,
              border: `1px solid ${isLight ? "transparent" : `${accent}55`}`,
              boxShadow: isLight ? `0 2px 8px ${accent}40` : "none",
            }}
          >
            <Plus size={15} />
            Nuevo Zoom
          </button>
        </div>
      </div>

      {/* ── Aviso si la tabla aún no existe ────────────────────────────────── */}
      {error === "missing_table" && (
        <G T={T} style={{ borderColor: `${T.amber}40` }}>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            <AlertTriangle size={18} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: T.txt2, fontFamily: font, lineHeight: 1.5 }}>
              <strong style={{ color: T.txt }}>Falta aplicar la migración 027.</strong> La tabla{" "}
              <code style={{ fontFamily: "monospace", color: T.txt }}>zoom_agendados</code> aún no existe en este
              proyecto. Aplica <code style={{ fontFamily: "monospace", color: T.txt }}>supabase/migrations/027_zoom_agendados.sql</code>{" "}
              y recarga — el panel funciona en cuanto la tabla esté creada.
            </div>
          </div>
        </G>
      )}
      {error && error !== "missing_table" && (
        <G T={T} style={{ borderColor: `${T.rose}40` }}>
          <div style={{ fontSize: 12.5, color: T.txt2, fontFamily: font }}>
            <strong style={{ color: T.txt }}>No se pudieron cargar los Zooms.</strong> {error}
          </div>
        </G>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <KPI T={T} label="Zooms hoy"        value={kpis.hoy}    icon={CalendarDays} color={accent}     sub="agendados para hoy" />
        <KPI T={T} label="Esta semana"      value={kpis.semana} icon={Video}        color={T.blue}     sub="lunes a domingo" />
        <KPI T={T} label="Por confirmar"    value={kpis.porConfirmar} icon={Clock3} color="#F59E0B"    sub="estatus Agendado" />
        <KPI T={T} label="Tasa de asistencia" value={kpis.tasa == null ? "—" : `${kpis.tasa}%`} icon={UserCheck} color="#10B981" sub={`${kpis.asistio} asistió · ${kpis.noShow} no show`} />
      </div>

      {/* ── Productividad por Liner / Presentador ──────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <ProdPanel T={T} isLight={isLight} title="Productividad por Liner" subtitle="Quién agenda más Zooms" rows={productividad.liners} accent={accent} />
        <ProdPanel T={T} isLight={isLight} title="Productividad por Presentador" subtitle="Quién corre más Zooms" rows={productividad.presentadores} accent={T.blue} />
      </div>

      {/* ── Toolbar de filtros ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Rango */}
        <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 12, background: subtleBg, border: `1px solid ${rowBorder}` }}>
          {RANGES.map((r) => {
            const active = range === r.id;
            return (
              <button key={r.id} onClick={() => setRange(r.id)} style={{
                padding: "7px 13px", borderRadius: 9, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: active ? 700 : 600, fontFamily: fontDisp,
                background: active ? (isLight ? accent : `${accent}22`) : "transparent",
                color: active ? (isLight ? "#06080F" : accent) : T.txt2,
              }}>{r.label}</button>
            );
          })}
        </div>

        {/* Estatus */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={selectStyle(T, isLight)}
        >
          <option value="Todos">Todos los estatus</option>
          {ESTATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Búsqueda */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search size={14} color={T.txt3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente, proyecto, liner…"
            style={{ ...inputStyle(T, isLight), paddingLeft: 32, width: "100%" }}
          />
        </div>

        <span style={{ fontSize: 11.5, color: T.txt3, fontFamily: fontDisp, whiteSpace: "nowrap" }}>
          {filtered.length} {filtered.length === 1 ? "Zoom" : "Zooms"}
        </span>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <G T={T} np style={{ overflow: "hidden", border: `1px solid ${cardBorder}` }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: isLight ? "rgba(15,23,42,0.035)" : "rgba(255,255,255,0.035)" }}>
                {["Fecha del Zoom", "Cliente", "Proyecto", "Liner", "Presentador", "Estatus", ""].map((h, i) => (
                  <th key={i} style={thStyle(T, i === 0 ? "left" : i >= 5 ? "center" : "left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ ...tdStyle(T, "center"), padding: "32px", color: T.txt3 }}>Cargando Zooms…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...tdStyle(T, "center"), padding: "36px 20px", color: T.txt3 }}>
                  {rows.length === 0
                    ? "Aún no hay Zooms registrados. Crea el primero con “Nuevo Zoom”."
                    : "Ningún Zoom coincide con este filtro."}
                </td></tr>
              )}
              {!loading && filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openEdit(r)}
                  style={{ borderTop: `1px solid ${rowBorder}`, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={tdStyle(T, "left")}>
                    <div style={{ fontWeight: 600, color: T.txt }}>{prettyDate(r.fecha_zoom)}</div>
                    <div style={{ fontSize: 11, color: T.txt3 }}>{r.hora || "sin hora"}</div>
                  </td>
                  <td style={{ ...tdStyle(T, "left"), fontWeight: 600, color: T.txt }}>{r.cliente || "—"}</td>
                  <td style={tdStyle(T, "left")}>{r.proyecto || "—"}</td>
                  <td style={tdStyle(T, "left")}>{r.liner || "—"}</td>
                  <td style={tdStyle(T, "left")}>
                    <div>{r.presentador_principal || "—"}</div>
                    {r.presentador_apoyo && <div style={{ fontSize: 11, color: T.txt3 }}>+ {r.presentador_apoyo}</div>}
                  </td>
                  <td style={{ ...tdStyle(T, "center"), padding: "8px 10px" }} onClick={(e) => e.stopPropagation()}>
                    <StatusSelect T={T} isLight={isLight} value={r.estatus} onChange={(s) => onInlineStatus(r, s)} />
                  </td>
                  <td style={{ ...tdStyle(T, "center"), padding: "8px 10px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(r)} title="Editar" style={iconBtn(T, isLight)}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(r)} title="Eliminar" style={{ ...iconBtn(T, isLight), marginLeft: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </G>

      {/* ── Modal de alta / edición ────────────────────────────────────────── */}
      {modalOpen && form && (
        <ZoomModal
          T={T} isLight={isLight} accent={accent}
          editing={!!editingId} form={form} setField={setField}
          formErr={formErr} busy={busy}
          onCancel={closeModal} onSave={save}
        />
      )}
    </div>
  );
};

// ── Sub-componente: panel de productividad ───────────────────────────────────
function ProdPanel({ T, isLight, title, subtitle, rows, accent }) {
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0) || 1;
  return (
    <G T={T} style={{ border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}` }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: T.txt3, fontFamily: font }}>{subtitle}</div>
      </div>
      {rows.length === 0 && (
        <div style={{ fontSize: 12, color: T.txt3, fontFamily: font, padding: "6px 0" }}>Sin datos todavía.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.slice(0, 6).map((r) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: "0 0 38%", fontSize: 12.5, color: T.txt, fontFamily: fontDisp, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.name}
            </div>
            <div style={{ flex: 1, height: 7, borderRadius: 99, background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${Math.round((r.total / max) * 100)}%`, height: "100%", borderRadius: 99, background: accent }} />
            </div>
            <div style={{ flex: "0 0 auto", fontSize: 12, color: T.txt2, fontFamily: fontDisp, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              <strong style={{ color: T.txt }}>{r.total}</strong>
              <span style={{ color: T.txt3 }}> · {r.asistio} asist.</span>
            </div>
          </div>
        ))}
      </div>
    </G>
  );
}

// ── Sub-componente: select de estatus inline (pill coloreado) ────────────────
function StatusSelect({ T, isLight, value, onChange }) {
  const c = estatusColor(value);
  const textColor = isLight ? `color-mix(in srgb, ${c} 62%, #0B1220 38%)` : c;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: "none", WebkitAppearance: "none",
        padding: "5px 12px", borderRadius: 99, cursor: "pointer",
        fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp,
        color: textColor,
        background: isLight ? `${c}1F` : `${c}22`,
        border: `1px solid ${c}55`,
        textAlign: "center", textAlignLast: "center",
      }}
    >
      {ESTATUS.map((s) => <option key={s} value={s} style={{ color: "#0B1220" }}>{s}</option>)}
    </select>
  );
}

// ── Sub-componente: modal de alta/edición ────────────────────────────────────
function ZoomModal({ T, isLight, accent, editing, form, setField, formErr, busy, onCancel, onSave }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(3,8,16,0.62)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "5vh 16px", overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          background: isLight ? "#FFFFFF" : "#0B1220",
          border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
          borderRadius: 20, padding: 22,
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
            {editing ? "Editar Zoom" : "Nuevo Zoom"}
          </h3>
          <button onClick={onCancel} style={iconBtn(T, isLight)}><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field T={T} label="Cliente *" full>
            <input value={form.cliente} onChange={(e) => setField("cliente", e.target.value)} placeholder="Nombre del cliente" style={{ ...inputStyle(T, isLight), width: "100%" }} autoFocus />
          </Field>

          <Field T={T} label="Fecha del Zoom">
            <input type="date" value={form.fecha_zoom} onChange={(e) => setField("fecha_zoom", e.target.value)} style={{ ...inputStyle(T, isLight), width: "100%" }} />
          </Field>
          <Field T={T} label="Hora">
            <input type="time" value={form.hora} onChange={(e) => setField("hora", e.target.value)} style={{ ...inputStyle(T, isLight), width: "100%" }} />
          </Field>

          <Field T={T} label="Liner (agenda)">
            <EditableSelect T={T} isLight={isLight} value={form.liner} options={LINERS} onChange={(v) => setField("liner", v)} placeholder="Quién agenda" />
          </Field>
          <Field T={T} label="Proyecto / Desarrollo">
            <input value={form.proyecto} onChange={(e) => setField("proyecto", e.target.value)} placeholder="Ej. Grupo 28" style={{ ...inputStyle(T, isLight), width: "100%" }} />
          </Field>

          <Field T={T} label="Presentador principal">
            <EditableSelect T={T} isLight={isLight} value={form.presentador_principal} options={PRESENTADORES} onChange={(v) => setField("presentador_principal", v)} placeholder="Quién corre el Zoom" />
          </Field>
          <Field T={T} label="Presentador de apoyo">
            <EditableSelect T={T} isLight={isLight} value={form.presentador_apoyo} options={PRESENTADORES} onChange={(v) => setField("presentador_apoyo", v)} placeholder="Opcional" />
          </Field>

          <Field T={T} label="Estatus">
            <select value={form.estatus} onChange={(e) => setField("estatus", e.target.value)} style={{ ...selectStyle(T, isLight), width: "100%" }}>
              {ESTATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field T={T} label="Fecha en que se agendó">
            <input type="date" value={form.fecha_agendado} onChange={(e) => setField("fecha_agendado", e.target.value)} style={{ ...inputStyle(T, isLight), width: "100%" }} />
          </Field>

          <Field T={T} label="Comentarios" full>
            <textarea value={form.comentarios} onChange={(e) => setField("comentarios", e.target.value)} rows={2} placeholder="Notas del Zoom (opcional)" style={{ ...inputStyle(T, isLight), width: "100%", resize: "vertical", fontFamily: font }} />
          </Field>
        </div>

        {formErr && (
          <div style={{ marginTop: 12, fontSize: 12, color: T.rose, fontFamily: font }}>{formErr}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
          <button onClick={onCancel} disabled={busy} style={{
            padding: "10px 16px", borderRadius: 10, cursor: busy ? "default" : "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: fontDisp,
            background: "transparent", color: T.txt2,
            border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)"}`,
          }}>Cancelar</button>
          <button onClick={onSave} disabled={busy} style={{
            padding: "10px 18px", borderRadius: 10, cursor: busy ? "default" : "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
            background: accent, color: "#06080F", border: "none",
            boxShadow: `0 2px 10px ${accent}50`, opacity: busy ? 0.7 : 1,
            display: "inline-flex", alignItems: "center", gap: 7,
          }}>
            <CheckCircle2 size={15} />
            {busy ? "Guardando…" : editing ? "Guardar cambios" : "Registrar Zoom"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Select con opciones del catálogo + opción de teclear un valor libre.
// (datalist nativa → dropdown sugerido pero permite escribir nombres nuevos,
//  igual que el Excel toleraba entradas a mano.)
function EditableSelect({ T, isLight, value, options, onChange, placeholder }) {
  const listId = useMemo(() => `dl-${Math.random().toString(36).slice(2, 9)}`, []);
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle(T, isLight), width: "100%" }}
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}

function Field({ T, label, children, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto", display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.txt2, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Estilos util (theme-aware) ───────────────────────────────────────────────
function inputStyle(T, isLight) {
  return {
    boxSizing: "border-box",
    padding: "9px 12px", borderRadius: 10,
    fontSize: 13, fontFamily: fontDisp, color: T.txt,
    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.03)",
    border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.10)"}`,
    outline: "none",
  };
}
function selectStyle(T, isLight) {
  return {
    ...inputStyle(T, isLight),
    cursor: "pointer",
    paddingRight: 28,
  };
}
function iconBtn(T, isLight) {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 8, cursor: "pointer",
    background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)"}`,
    color: T.txt2,
  };
}
function thStyle(T, align) {
  return {
    padding: "11px 14px", textAlign: align,
    fontSize: 10.5, fontWeight: 700, color: T.txt2, fontFamily: fontDisp,
    textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
  };
}
function tdStyle(T, align) {
  return {
    padding: "11px 14px", textAlign: align,
    fontSize: 12.5, fontWeight: 500, color: T.txt2, fontFamily: fontDisp,
    verticalAlign: "middle",
  };
}

export default ZoomControl;
