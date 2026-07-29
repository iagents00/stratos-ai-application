// Nomina.jsx — el apartado de nómina de la Caja.
//
// Pedido de Ángel (27-jul): «recuerda que te dije que pusieras un apartado para
// nómina de Ángel e Iván, por si eso llega a cambiar, y que todo esté registrado
// de forma inteligente».
//
// Qué muestra y qué deja hacer:
//   · Cuánto le toca a cada uno y cada cuánto (editable — si mañana sube, se cambia acá).
//   · Cuánto lleva ganado a hoy, cuánto ya cobró y cuánto le falta.
//   · Los últimos pagos con su comprobante.
//
// El cálculo NO se guarda en ningún lado: se deriva de lo que hay cargado. Si se
// corrige un pago, el saldo se corrige solo. Cambiar el monto NO reescribe la
// historia: aplica de la fecha de vigencia en adelante.

import { useState, useEffect, useCallback } from "react";
import { Users, Check, X, PenLine, RefreshCw, CalendarDays } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";

const money = (n, cur = "USD") =>
  `$${Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const fechaCorta = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
};

const PERIODOS = [
  { id: "semanal",   label: "por semana" },
  { id: "quincenal", label: "por quincena" },
  { id: "mensual",   label: "por mes" },
];

export default function Nomina({ T }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isLight = parseInt(String(T?.bg || "#000000").replace("#", "").slice(0, 2), 16) > 128;
  const txt    = T?.txt    || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2   || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3   || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent || (isLight ? "#0D9A76" : "#6EE7C2");
  const glass  = T?.glass  || (isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.032)");
  const bd     = T?.border || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");
  const PEND   = isLight ? "#B54708" : "#F59E0B";
  const OK     = isLight ? "#0E9F6E" : "#34D399";

  const card = {
    background: glass, border: `1px solid ${bd}`, borderRadius: 16,
    backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
  };
  const inputStyle = {
    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: txt,
    border: `1px solid ${bd}`, borderRadius: 10, padding: "9px 11px",
    fontSize: 13.5, fontFamily: font, outline: "none", boxSizing: "border-box",
  };

  const [gente, setGente] = useState([]);     // [{persona, monto, moneda, periodicidad, devengado, pagado}]
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);   // {persona, monto, periodicidad}

  const orgId = user?.organizationId;

  const load = useCallback(async () => {
    if (!user?.id || !orgId) return;
    setLoading(true); setError("");
    const [cmd, mov] = await Promise.all([
      supabase.rpc("fn_comando_nsg", { p_profile_id: user.id }),
      supabase.from("team_expenses")
        .select("id, amount, currency, description, spent_at, contraparte, evidence_path")
        .eq("organization_id", orgId).eq("category", "Nómina").eq("tipo", "egreso")
        .is("persona_id", null)
        .order("spent_at", { ascending: false }).limit(20),
    ]);
    if (cmd.error) setError("No pude traer la nómina.");
    else setGente(Array.isArray(cmd.data?.nomina) ? cmd.data.nomina : []);
    setPagos(mov.data || []);
    setLoading(false);
  }, [user?.id, orgId]);

  useEffect(() => { load(); }, [load]);

  const guardar = async () => {
    if (!editando) return;
    const monto = Number(String(editando.monto).replace(",", "."));
    if (!monto || monto <= 0) { setError("Poné un monto válido."); return; }
    const { error: e } = await supabase.rpc("fn_fin_set_nomina", {
      p_profile_id: user.id,
      p_persona: editando.persona,
      p_monto: monto,
      p_periodicidad: editando.periodicidad,
      p_moneda: "USD",
    });
    if (e) { setError(e.message); return; }
    setEditando(null);
    load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14.5, fontFamily: fontDisp, fontWeight: 500, color: txt }}>Nómina del equipo</div>
          <div style={{ fontSize: 12.5, color: txt2, marginTop: 3 }}>
            Cuánto le toca a cada uno, cuánto lleva ganado y cuánto le falta cobrar · se paga el 15 y el 30
          </div>
        </div>
        <button onClick={load} title="Actualizar" style={{ background: glass, border: `1px solid ${bd}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", color: txt2, display: "flex", alignItems: "center" }}>
          <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
        </button>
      </div>

      {error && (
        <div style={{ ...card, padding: "12px 15px", fontSize: 12.5, color: isLight ? "#B42318" : "#F87171" }}>{error}</div>
      )}

      {!loading && !gente.length && (
        <div style={{ ...card, padding: "30px 20px", textAlign: "center" }}>
          <Users size={24} color={txt3} strokeWidth={1.6} />
          <div style={{ fontSize: 13.5, color: txt2, marginTop: 10 }}>Todavía no hay nóminas definidas.</div>
          <div style={{ fontSize: 12.5, color: txt3, marginTop: 4 }}>
            Decile al Copilot «la nómina de Ángel es de $500 quincenales» y aparece acá.
          </div>
        </div>
      )}

      {/* Una tarjeta por persona */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {gente.map((n) => {
          const devengado = Number(n.devengado || 0);
          const pagado    = Number(n.pagado || 0);
          const debe      = Math.max(0, devengado - pagado);
          const pct       = devengado > 0 ? Math.min(100, Math.round((pagado / devengado) * 100)) : 0;
          const esta      = editando?.persona === n.persona;
          return (
            <div key={n.persona} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 14.5, fontFamily: fontDisp, fontWeight: 500, color: txt, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.persona}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: debe > 0 ? PEND : OK, whiteSpace: "nowrap", flexShrink: 0, fontFamily: fontDisp }}>
                  {debe > 0 ? money(debe, n.moneda) : "al día"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: txt3, marginTop: 2 }}>
                {debe > 0 ? "se le debe" : "no se le debe nada"}
              </div>

              {/* Cuánto gana — editable */}
              <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${bd}` }}>
                {esta ? (
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                    <input autoFocus type="number" step="0.01" inputMode="decimal" value={editando.monto}
                      onChange={(e) => setEditando(v => ({ ...v, monto: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setEditando(null); }}
                      style={{ ...inputStyle, width: 104 }} />
                    <select value={editando.periodicidad}
                      onChange={(e) => setEditando(v => ({ ...v, periodicidad: e.target.value }))}
                      style={{ ...inputStyle, padding: "9px 8px" }}>
                      {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <button onClick={guardar} title="Guardar"
                      style={{ background: `${accent}1A`, border: `1px solid ${accent}55`, borderRadius: 9, padding: "9px 11px", cursor: "pointer", color: accent, display: "flex" }}>
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditando(null)} title="Cancelar"
                      style={{ background: "transparent", border: `1px solid ${bd}`, borderRadius: 9, padding: "9px 11px", cursor: "pointer", color: txt3, display: "flex" }}>
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditando({ persona: n.persona, monto: n.monto, periodicidad: n.periodicidad })}
                    title="Cambiar cuánto gana"
                    style={{
                      background: "transparent", border: `1px solid ${bd}`, borderRadius: 10,
                      padding: "8px 12px", cursor: "pointer", color: txt2, fontSize: 13, fontFamily: font,
                      display: "flex", alignItems: "center", gap: 7, width: "100%", justifyContent: "space-between",
                    }}>
                    <span>{money(n.monto, n.moneda)} {PERIODOS.find(p => p.id === n.periodicidad)?.label || n.periodicidad}</span>
                    <PenLine size={13} />
                  </button>
                )}
              </div>

              {/* Avance */}
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 7, borderRadius: 999, background: isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: debe > 0 ? PEND : OK, transition: "width .5s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: txt3 }}>
                  <span>lleva ganado {money(devengado, n.moneda)}</span>
                  <span>ya cobró {money(pagado, n.moneda)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Los últimos pagos, para que el saldo sea auditable de un vistazo */}
      {!!pagos.length && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
            <CalendarDays size={14} color={txt3} />
            <span style={{ fontSize: 13, fontWeight: 500, color: txt, fontFamily: fontDisp }}>Últimos pagos</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pagos.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 12.5, color: txt2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: txt3, fontSize: 12 }}>{fechaCorta(p.spent_at)}</span>{" "}
                  {p.contraparte || p.description}
                  {!p.evidence_path && <span style={{ color: txt3, fontSize: 11.5 }}> · sin comprobante</span>}
                </span>
                <span style={{ fontSize: 13, color: txt, fontFamily: fontDisp, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {money(p.amount, p.currency || "USD")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: txt3, fontFamily: font }}>
        El saldo se calcula solo con lo que hay cargado: si se corrige un pago, se corrige el saldo.
        Cambiar el monto aplica de hoy en adelante — no reescribe lo ya pagado.
      </p>
    </div>
  );
}
