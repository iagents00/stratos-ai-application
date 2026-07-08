/**
 * views/Caja.jsx — Caja: cuentas, ingresos y egresos
 *
 * Libro de movimientos de la organización sobre la tabla `team_expenses`:
 *   · Los gastos que el equipo registra por Telegram (texto/audio/ticket)
 *     aparecen acá automáticamente (son filas de la misma tabla).
 *   · Desde la web, CUALQUIER rol (admin o asesor/empleado) puede registrar
 *     ingresos y egresos con cuenta, categoría, obra y fecha.
 *
 * Módulo gated por `features.caja` en la config del cliente (hoy solo Vega).
 * RLS filtra por organization_id; acá además se filtra explícito (defensa en
 * profundidad, mismo patrón que el resto del CRM).
 *
 * Aesthetic: usa la paleta `T` del theme de App.jsx (glass/border/txt/txt2/txt3/
 * accent) + glassmorphism, igual que el resto del CRM. La detección de light se
 * hace por luminancia del bg (antes comparaba hexes fijos y fallaba con el dark
 * real #030810 → texto casi invisible y tarjetas planas).
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownRight, Scale, Plus, Search,
  RefreshCw, Send, X, MessageCircle, Monitor, Paperclip, ExternalLink,
} from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";

const fmtMoney = (amount, currency = "ARS") => {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency", currency: currency || "ARS", maximumFractionDigits: n % 1 ? 2 : 0,
    }).format(n);
  } catch {
    return `$${n.toLocaleString("es-AR")}`;
  }
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const mos = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${d.getDate()} ${mos[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return "—"; }
};

const EMPTY_FORM = { tipo: "egreso", amount: "", account: "", category: "", projectId: "", date: "", description: "" };

export default function Caja({ T }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // ── Paleta theme-aware (tomada del `T` de App.jsx, igual que el resto del CRM).
  // isLight por LUMINANCIA del bg (robusto): antes se comparaban hexes fijos y
  // con el dark real (#030810) daba isLight=true → texto oscuro invisible.
  const isLight = parseInt(String(T?.bg || "#000000").replace("#", "").slice(0, 2), 16) > 128;
  const txt    = T?.txt     || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2    || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3    || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent  || (isLight ? "#0D9A76" : "#6EE7C2");
  const glass  = T?.glass   || (isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.032)");
  const bd     = T?.border  || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");
  const POS    = isLight ? "#0E9F6E" : "#34D399";  // ingreso (verde)
  const NEG    = isLight ? "#E02424" : "#F87171";  // egreso (rojo)

  // Contenedor glass estándar del CRM (blur + borde suave).
  const card = {
    background: glass, border: `1px solid ${bd}`, borderRadius: 16,
    backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
  };
  const inputStyle = {
    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: txt,
    border: `1px solid ${bd}`, borderRadius: 10, padding: "11px 13px",
    fontSize: 13.5, fontFamily: font, outline: "none", width: "100%", boxSizing: "border-box",
  };

  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState({});   // profile id → nombre
  const [obras, setObras] = useState([]);     // [{id,name}] para dropdown + mapeo
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos"); // todos | ingreso | egreso
  const [showForm, setShowForm] = useState(!isMobile);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewer, setViewer] = useState(null);   // comprobante abierto: { loading } | { url }

  const orgId = user?.organizationId;

  // Abre el comprobante (foto/ticket) de un gasto. La evidencia vive en el bucket
  // privado `evidencia`, así que se pide una URL firmada al vuelo. Si evidence_path
  // ya fuese una URL http, se abre directo.
  const openEvidence = useCallback(async (path) => {
    if (!path) return;
    if (/^https?:\/\//i.test(path)) { setViewer({ url: path }); return; }
    setViewer({ loading: true });
    try {
      const { data, error: e } = await supabase.storage.from("evidencia").createSignedUrl(path, 3600);
      if (e) throw e;
      setViewer({ url: data.signedUrl });
    } catch {
      setViewer(null);
      setError("No pude abrir el comprobante. Probá de nuevo.");
    }
  }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError("");
    try {
      const [mov, profs, leads] = await Promise.all([
        supabase.from("team_expenses")
          .select("id, tipo, amount, currency, account, category, description, spent_at, created_by, project_id, source, evidence_path")
          .eq("organization_id", orgId)
          .order("spent_at", { ascending: false })
          .limit(400),
        supabase.from("profiles").select("id, name").eq("organization_id", orgId),
        supabase.from("leads").select("id, name").eq("organization_id", orgId).is("deleted_at", null).limit(200),
      ]);
      if (mov.error) throw mov.error;
      setRows(mov.data || []);
      setPeople(Object.fromEntries((profs.data || []).map(p => [p.id, p.name])));
      setObras((leads.data || []).sort((a, b) => String(a.name).localeCompare(b.name)));
    } catch (e) {
      setError("No pude cargar los movimientos. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const cuentas = useMemo(() => {
    const set = new Set(["Caja", "Banco"]);
    rows.forEach(r => { if (r.account) set.add(r.account); });
    return [...set];
  }, [rows]);

  // KPIs del mes en curso
  const kpis = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let ing = 0, egr = 0;
    rows.forEach(r => {
      if (new Date(r.spent_at).getTime() < first) return;
      if (r.tipo === "ingreso") ing += Number(r.amount || 0);
      else egr += Number(r.amount || 0);
    });
    return { ing, egr, bal: ing - egr };
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (tipoFilter !== "todos" && (r.tipo || "egreso") !== tipoFilter) return false;
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    const obra = obras.find(o => o.id === r.project_id)?.name || "";
    return [r.category, r.description, r.account, people[r.created_by], obra]
      .some(s => String(s || "").toLowerCase().includes(q));
  }), [rows, tipoFilter, searchQ, obras, people]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const amount = parseFloat(String(form.amount).replace(",", "."));
    if (!amount || amount <= 0) { setError("Poné un monto válido."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.from("team_expenses").insert({
        organization_id: orgId,
        tipo: form.tipo,
        amount,
        currency: "ARS",
        account: form.account.trim() || null,
        category: form.category.trim() || (form.tipo === "ingreso" ? "Ingreso" : "Gasto general"),
        description: form.description.trim() || null,
        project_id: form.projectId || null,
        spent_at: form.date ? new Date(form.date + "T12:00:00").toISOString() : new Date().toISOString(),
        created_by: user?.id || null,
        source: "web",
      });
      if (err) throw err;
      setForm(EMPTY_FORM);
      if (isMobile) setShowForm(false);
      await load();
    } catch (e2) {
      setError("No se pudo guardar el movimiento. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const KpiCard = ({ label, value, icon: Icon, color }) => (
    <div style={{ ...card, flex: 1, minWidth: isMobile ? "100%" : 200, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: txt2, fontFamily: font, marginBottom: 10, whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: isMobile ? 23 : 28, fontWeight: 400, color: txt, fontFamily: fontDisp, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1F`, border: `1px solid ${color}33` }}>
        <Icon size={18} color={color} strokeWidth={1.9} />
      </div>
    </div>
  );

  const chip = (id, label) => (
    <button key={id} onClick={() => setTipoFilter(id)} style={{
      padding: "7px 15px", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontFamily: font,
      border: `1px solid ${tipoFilter === id ? accent : bd}`,
      background: tipoFilter === id ? `${accent}1A` : "transparent",
      color: tipoFilter === id ? accent : txt2, fontWeight: tipoFilter === id ? 700 : 500,
      transition: "all .15s ease",
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, color: txt, fontFamily: font, maxWidth: 1080, width: "100%", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}18`, border: `1px solid ${accent}33` }}>
            <Wallet size={20} color={accent} strokeWidth={1.9} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontFamily: fontDisp, fontWeight: 700, letterSpacing: "-0.01em", color: txt }}>Caja</h1>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: txt2 }}>
              Cuentas, ingresos y egresos · los gastos por Telegram entran solos
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} title="Actualizar" style={{ background: glass, border: `1px solid ${bd}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", color: txt2, display: "flex", alignItems: "center" }}>
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
          <button onClick={() => setShowForm(s => !s)} style={{
            background: showForm ? "transparent" : `${accent}1A`, border: `1px solid ${accent}55`,
            borderRadius: 10, padding: "9px 15px", cursor: "pointer", color: accent,
            fontSize: 12.5, fontWeight: 700, fontFamily: font, display: "flex", alignItems: "center", gap: 6,
          }}>
            {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cerrar" : "Nuevo movimiento"}
          </button>
        </div>
      </div>

      {/* KPIs del mes */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="Ingresos del mes" value={fmtMoney(kpis.ing)} icon={ArrowUpRight} color={POS} />
        <KpiCard label="Egresos del mes" value={fmtMoney(kpis.egr)} icon={ArrowDownRight} color={NEG} />
        <KpiCard label="Balance del mes" value={fmtMoney(kpis.bal)} icon={Scale} color={kpis.bal >= 0 ? POS : NEG} />
      </div>

      {/* Form de registro */}
      {showForm && (
        <form onSubmit={submit} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[["egreso", "Egreso", NEG], ["ingreso", "Ingreso", POS]].map(([id, label, color]) => (
              <button type="button" key={id} onClick={() => setForm(f => ({ ...f, tipo: id }))} style={{
                flex: isMobile ? 1 : "none", padding: "9px 24px", borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: font,
                border: `1px solid ${form.tipo === id ? color : bd}`,
                background: form.tipo === id ? `${color}1A` : "transparent",
                color: form.tipo === id ? color : txt2,
                transition: "all .15s ease",
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
            <input required inputMode="decimal" placeholder="Monto *" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
            <input list="caja-cuentas" placeholder="Cuenta (Caja, Banco…)" value={form.account}
              onChange={e => setForm(f => ({ ...f, account: e.target.value }))} style={inputStyle} />
            <datalist id="caja-cuentas">{cuentas.map(c => <option key={c} value={c} />)}</datalist>
            <input placeholder={form.tipo === "ingreso" ? "Concepto (certificado, anticipo…)" : "Categoría (materiales, comida…)"}
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle} />
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              title="Fecha (vacío = hoy)" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr auto", gap: 10 }}>
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputStyle}>
              <option value="">Sin obra / general</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <input placeholder="Descripción / detalle (opcional)" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
            <button type="submit" disabled={saving} style={{
              background: accent, border: `1px solid ${accent}`, borderRadius: 10,
              padding: "10px 22px", cursor: saving ? "wait" : "pointer", color: isLight ? "#FFFFFF" : "#04140F",
              fontSize: 13, fontWeight: 800, fontFamily: font, display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
              opacity: saving ? 0.65 : 1,
            }}>
              <Send size={14} /> {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
          {error && <div style={{ fontSize: 12.5, color: NEG }}>{error}</div>}
        </form>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {chip("todos", "Todos")}{chip("ingreso", "Ingresos")}{chip("egreso", "Egresos")}
        <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <Search size={15} color={txt3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Buscar por categoría, obra, persona…" value={searchQ}
            onChange={e => setSearchQ(e.target.value)} style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
      </div>

      {/* Lista de movimientos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && <div style={{ color: txt2, fontSize: 13, padding: 24, textAlign: "center" }}>Cargando movimientos…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ ...card, color: txt2, fontSize: 13, padding: 32, textAlign: "center" }}>
            Sin movimientos todavía. Registrá el primero acá arriba, o mandá un gasto por Telegram.
          </div>
        )}
        {filtered.map(r => {
          const tipo = r.tipo || "egreso";
          const color = tipo === "ingreso" ? POS : NEG;
          const obra = obras.find(o => o.id === r.project_id)?.name;
          const quien = people[r.created_by];
          const porTelegram = r.source && r.source !== "web";
          return (
            <div key={r.id} style={{ ...card, borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 13, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1A`, border: `1px solid ${color}33` }}>
                {tipo === "ingreso" ? <ArrowUpRight size={16} color={color} /> : <ArrowDownRight size={16} color={color} />}
              </div>
              <div style={{ flex: 1, minWidth: isMobile ? "55%" : 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: txt }}>
                  {r.category || (tipo === "ingreso" ? "Ingreso" : "Gasto")}
                  {obra && <span style={{ color: txt2, fontWeight: 400 }}> · {obra}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: txt3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                  {fmtDate(r.spent_at)}
                  {quien && <span>· {quien}</span>}
                  {r.account && <span>· {r.account}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    · {porTelegram ? <MessageCircle size={11} /> : <Monitor size={11} />} {porTelegram ? "Telegram" : "Web"}
                  </span>
                </div>
                {r.description && <div style={{ fontSize: 11.5, color: txt2, marginTop: 3 }}>{r.description}</div>}
                {r.evidence_path && (
                  <button type="button" onClick={() => openEvidence(r.evidence_path)} style={{
                    marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                    background: `${accent}14`, border: `1px solid ${accent}40`, color: accent,
                    fontSize: 11, fontWeight: 700, fontFamily: font,
                  }}>
                    <Paperclip size={11} /> Ver comprobante
                  </button>
                )}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 800, fontFamily: fontDisp, color, whiteSpace: "nowrap" }}>
                {tipo === "ingreso" ? "+" : "−"}{fmtMoney(r.amount, r.currency)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visor de comprobante */}
      {viewer && (
        <div onClick={() => setViewer(null)} style={{
          position: "fixed", inset: 0, zIndex: 100000, background: "rgba(3,8,16,0.82)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <button onClick={() => setViewer(null)} title="Cerrar" style={{
            position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.12)",
            border: "none", borderRadius: 10, padding: 8, cursor: "pointer", color: "#fff", display: "flex",
          }}><X size={18} /></button>
          {viewer.loading ? (
            <div style={{ color: "#fff", fontSize: 14, fontFamily: font }}>Abriendo comprobante…</div>
          ) : (
            <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: "94vw" }}>
              <img src={viewer.url} alt="Comprobante"
                style={{ maxWidth: "94vw", maxHeight: "82vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 12px 48px rgba(0,0,0,0.5)" }} />
              <a href={viewer.url} target="_blank" rel="noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 12.5,
                fontFamily: font, textDecoration: "none", opacity: 0.85,
              }}>
                <ExternalLink size={13} /> Abrir original (o descargar si es PDF)
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
