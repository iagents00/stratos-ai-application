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
 * Aesthetic: mismo design system que el resto (inline styles, T de theme).
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownRight, Scale, Plus, Search,
  RefreshCw, Send, X, MessageCircle, Monitor,
} from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";

const GREEN = "#34D399";
const RED   = "#F87171";

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
  const isLight = T?.bg !== "#060A11" && T?.bg !== "#04080F";
  const subTxt  = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)";
  const dimTxt  = isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.32)";
  const cardBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)";
  const border  = isLight ? "1px solid rgba(15,23,42,0.10)" : "1px solid rgba(255,255,255,0.07)";
  const inputStyle = {
    background: isLight ? "#fff" : "rgba(255,255,255,0.05)", color: T.txt,
    border, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: font,
    outline: "none", width: "100%", boxSizing: "border-box",
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

  const orgId = user?.organizationId;

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
    <div style={{ flex: 1, minWidth: isMobile ? "100%" : 180, background: cardBg, border, borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}18`, border: `1px solid ${color}33` }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: subTxt, fontFamily: font }}>{label}</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>{value}</div>
      </div>
    </div>
  );

  const chip = (id, label) => (
    <button key={id} onClick={() => setTipoFilter(id)} style={{
      padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontFamily: font,
      border: tipoFilter === id ? `1px solid ${T.accent}66` : border,
      background: tipoFilter === id ? `${T.accent}1A` : "transparent",
      color: tipoFilter === id ? T.accent : subTxt, fontWeight: tipoFilter === id ? 700 : 400,
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, color: T.txt, fontFamily: font }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontFamily: fontDisp, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <Wallet size={22} color={T.accent} /> Caja
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: subTxt }}>
            Cuentas, ingresos y egresos · los gastos por Telegram entran solos
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} title="Actualizar" style={{ background: "transparent", border, borderRadius: 10, padding: "8px 10px", cursor: "pointer", color: subTxt, display: "flex", alignItems: "center" }}>
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
          <button onClick={() => setShowForm(s => !s)} style={{
            background: showForm ? "transparent" : `${T.accent}1A`, border: `1px solid ${T.accent}55`,
            borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: T.accent,
            fontSize: 12.5, fontWeight: 700, fontFamily: font, display: "flex", alignItems: "center", gap: 6,
          }}>
            {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cerrar" : "Nuevo movimiento"}
          </button>
        </div>
      </div>

      {/* KPIs del mes */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="Ingresos del mes" value={fmtMoney(kpis.ing)} icon={ArrowUpRight} color={GREEN} />
        <KpiCard label="Egresos del mes" value={fmtMoney(kpis.egr)} icon={ArrowDownRight} color={RED} />
        <KpiCard label="Balance del mes" value={fmtMoney(kpis.bal)} icon={Scale} color={kpis.bal >= 0 ? GREEN : RED} />
      </div>

      {/* Form de registro */}
      {showForm && (
        <form onSubmit={submit} style={{ background: cardBg, border, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[["egreso", "Egreso", RED], ["ingreso", "Ingreso", GREEN]].map(([id, label, color]) => (
              <button type="button" key={id} onClick={() => setForm(f => ({ ...f, tipo: id }))} style={{
                flex: isMobile ? 1 : "none", padding: "8px 22px", borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 700, fontFamily: font,
                border: form.tipo === id ? `1px solid ${color}66` : border,
                background: form.tipo === id ? `${color}1A` : "transparent",
                color: form.tipo === id ? color : subTxt,
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
              background: `${T.accent}1A`, border: `1px solid ${T.accent}66`, borderRadius: 10,
              padding: "10px 20px", cursor: saving ? "wait" : "pointer", color: T.accent,
              fontSize: 13, fontWeight: 700, fontFamily: font, display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            }}>
              <Send size={14} /> {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
          {error && <div style={{ fontSize: 12.5, color: RED }}>{error}</div>}
        </form>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {chip("todos", "Todos")}{chip("ingreso", "Ingresos")}{chip("egreso", "Egresos")}
        <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
          <Search size={14} color={dimTxt} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Buscar por categoría, obra, persona…" value={searchQ}
            onChange={e => setSearchQ(e.target.value)} style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
      </div>

      {/* Lista de movimientos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && <div style={{ color: subTxt, fontSize: 13, padding: 20, textAlign: "center" }}>Cargando movimientos…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: subTxt, fontSize: 13, padding: 28, textAlign: "center", background: cardBg, border, borderRadius: 16 }}>
            Sin movimientos todavía. Registrá el primero acá arriba, o mandá un gasto por Telegram.
          </div>
        )}
        {filtered.map(r => {
          const tipo = r.tipo || "egreso";
          const color = tipo === "ingreso" ? GREEN : RED;
          const obra = obras.find(o => o.id === r.project_id)?.name;
          const quien = people[r.created_by];
          const porTelegram = r.source && r.source !== "web";
          return (
            <div key={r.id} style={{ background: cardBg, border, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}15`, border: `1px solid ${color}30` }}>
                {tipo === "ingreso" ? <ArrowUpRight size={15} color={color} /> : <ArrowDownRight size={15} color={color} />}
              </div>
              <div style={{ flex: 1, minWidth: isMobile ? "60%" : 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.txt }}>
                  {r.category || (tipo === "ingreso" ? "Ingreso" : "Gasto")}
                  {obra && <span style={{ color: subTxt, fontWeight: 400 }}> · {obra}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: dimTxt, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {fmtDate(r.spent_at)}
                  {quien && <span>· {quien}</span>}
                  {r.account && <span>· {r.account}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    · {porTelegram ? <MessageCircle size={11} /> : <Monitor size={11} />} {porTelegram ? "Telegram" : "Web"}
                  </span>
                </div>
                {r.description && <div style={{ fontSize: 11.5, color: subTxt, marginTop: 2 }}>{r.description}</div>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: fontDisp, color, whiteSpace: "nowrap" }}>
                {tipo === "ingreso" ? "+" : "−"}{fmtMoney(r.amount, r.currency)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
