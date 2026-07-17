/**
 * CRM/LeadRelatedContacts.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Familiares o Socios" del expediente — personas ALLEGADAS al contacto
 * (normalmente la esposa/o, un socio o un familiar) con su propio teléfono/email.
 *
 * A diferencia del panel de Perfilamiento IA (LeadDiscoveryPanel, solo lectura),
 * esto lo EDITA el asesor: agrega / edita / borra allegados. 1 lead → N allegados,
 * en la tabla `public.lead_related_contacts` (RLS: org + lead visible, igual que
 * discovery_data — un asesor solo toca los allegados de SUS leads).
 *
 * Modo demo (o lead sin id real): funciona en memoria, sin tocar la BD.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Phone, Mail, Trash2, Pencil, X, Check } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";

const REL_SUGGESTIONS = ["Esposa", "Esposo", "Pareja", "Socio", "Socia", "Familiar", "Hermano/a", "Hijo/a"];
const EMPTY = { name: "", relationship: "", phone: "", email: "", notas: "" };

export default function LeadRelatedContacts({ lead, T = P, isLight = false }) {
  const { user } = useAuth();
  const isDemo = user?.isDemo || !/^[0-9a-f]{8}-/.test(String(lead?.id || ""));

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null); // null | "new" | <id>
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  const load = useCallback(async () => {
    if (!lead?.id) { setLoading(false); return; }
    if (isDemo)    { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_related_contacts")
      .select("id, name, relationship, phone, email, notas")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true });
    if (!error) setContacts(data || []);
    setLoading(false);
  }, [lead?.id, isDemo]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(EMPTY); setEditing(null); setErr(""); setSaving(false); };
  const startNew  = () => { setForm(EMPTY); setEditing("new"); setErr(""); };
  const startEdit = (c) => {
    setForm({ name: c.name || "", relationship: c.relationship || "", phone: c.phone || "", email: c.email || "", notas: c.notas || "" });
    setEditing(c.id); setErr("");
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) { setErr("El nombre es obligatorio."); return; }
    setSaving(true); setErr("");
    const payload = {
      name,
      relationship: form.relationship.trim() || null,
      phone:        form.phone.trim() || null,
      email:        form.email.trim() || null,
      notas:        form.notas.trim() || null,
    };
    if (isDemo) {
      if (editing === "new") setContacts(prev => [...prev, { id: `demo_${Date.now()}`, ...payload }]);
      else                   setContacts(prev => prev.map(c => (c.id === editing ? { ...c, ...payload } : c)));
      reset(); return;
    }
    if (editing === "new") {
      const { data, error } = await supabase
        .from("lead_related_contacts")
        .insert({ lead_id: lead.id, ...payload })
        .select("id, name, relationship, phone, email, notas")
        .single();
      if (error) { setErr("No se pudo guardar. Intentá de nuevo."); setSaving(false); return; }
      setContacts(prev => [...prev, data]);
    } else {
      const { error } = await supabase.from("lead_related_contacts").update(payload).eq("id", editing);
      if (error) { setErr("No se pudo guardar. Intentá de nuevo."); setSaving(false); return; }
      setContacts(prev => prev.map(c => (c.id === editing ? { ...c, ...payload } : c)));
    }
    reset();
  };

  const remove = async (id) => {
    const snapshot = contacts;
    setContacts(snapshot.filter(c => c.id !== id));
    if (editing === id) reset();
    if (isDemo || String(id).startsWith("demo_")) return;
    const { error } = await supabase.from("lead_related_contacts").delete().eq("id", id);
    if (error) { setContacts(snapshot); setErr("No se pudo eliminar."); }
  };

  if (loading) return null; // silencioso mientras carga

  // ── Estilos derivados (mismo lenguaje que LeadDiscoveryPanel) ──
  const headerC    = isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.62)";
  const cardBg     = isLight ? "rgba(15,23,42,0.03)"  : "rgba(255,255,255,0.03)";
  const cardBorder = `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)"}`;
  const labelC     = isLight ? "rgba(15,23,42,0.55)"  : "rgba(255,255,255,0.45)";
  const inputBg     = isLight ? "rgba(15,23,42,0.03)"  : "rgba(255,255,255,0.04)";
  const inputBorder = isLight ? "rgba(15,23,42,0.12)"  : "rgba(255,255,255,0.10)";
  const accentStrong = isLight ? (T.accentDark || T.accent) : T.accent;

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    padding: "9px 11px", borderRadius: 9,
    background: inputBg, border: `1px solid ${inputBorder}`,
    color: T.txt, fontSize: 13, fontFamily: font, outline: "none",
  };
  const labelStyle = {
    display: "block", margin: "0 0 4px 2px",
    fontSize: 10, fontWeight: 500, letterSpacing: "0.06em",
    textTransform: "uppercase", color: labelC, fontFamily: fontDisp,
  };

  // OJO: los inputs van INLINE (no como un sub-componente <Field/>). Definir un
  // componente dentro del render le cambia la identidad en cada tecla → React
  // remonta el input y se pierde el foco. JSX inline se reconcilia por posición.
  const formCard = (
    <div style={{ padding: 12, borderRadius: 11, background: cardBg, border: cardBorder, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={labelStyle}>Nombre *</label>
          <input value={form.name} placeholder="Ej. María Pérez" autoFocus onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={labelStyle}>Relación / parentesco</label>
          <input value={form.relationship} placeholder="Esposa, socio, hermano…" list="lrc-rel-suggestions" onChange={(e) => setForm(f => ({ ...f, relationship: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      <datalist id="lrc-rel-suggestions">
        {REL_SUGGESTIONS.map(r => <option key={r} value={r} />)}
      </datalist>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={labelStyle}>Teléfono</label>
          <input type="tel" value={form.phone} placeholder="+52 …" onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={form.email} placeholder="correo@ejemplo.com" onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Nota (opcional)</label>
        <input value={form.notas} onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ej. decide junto con el titular" style={inputStyle} />
      </div>
      {err && <p style={{ margin: 0, color: "#F87171", fontSize: 12, fontFamily: font }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={reset} style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9,
          background: "transparent", border: `1px solid ${inputBorder}`, color: T.txt3,
          fontSize: 12.5, fontWeight: 400, fontFamily: fontDisp, cursor: "pointer",
        }}><X size={13} /> Cancelar</button>
        <button type="button" onClick={save} disabled={saving || !form.name.trim()} style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 9,
          background: (saving || !form.name.trim()) ? (isLight ? "rgba(15,23,42,0.06)" : T.glass) : (isLight ? `linear-gradient(135deg, ${T.accent}, #14B892)` : "#FFFFFF"),
          border: `1px solid ${(saving || !form.name.trim()) ? inputBorder : "transparent"}`,
          color: (saving || !form.name.trim()) ? T.txt3 : (isLight ? "#FFFFFF" : "#040C18"),
          fontSize: 12.5, fontWeight: 500, fontFamily: fontDisp, cursor: (saving || !form.name.trim()) ? "not-allowed" : "pointer",
        }}><Check size={13} /> {saving ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 12 }}>
      {/* Encabezado + botón agregar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10.5, fontWeight: 500, letterSpacing: "0.12em",
          textTransform: "uppercase", color: headerC, fontFamily: fontDisp,
        }}>
          <Users size={11} /> Familiares o Socios
        </span>
        {editing === null && (
          <button type="button" onClick={startNew} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 11px", borderRadius: 8,
            background: `${T.accent}14`, border: `1px solid ${T.accent}3A`,
            color: accentStrong, fontSize: 11.5, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
          }}><Plus size={12} /> Agregar</button>
        )}
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {contacts.length === 0 && editing !== "new" && (
          <p style={{ margin: 0, fontSize: 12, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
            Sin familiares o socios aún. Agregá el contacto de la esposa/o, un socio o un familiar del cliente.
          </p>
        )}

        {contacts.map((c) => (
          editing === c.id ? (
            <div key={c.id}>{formCard}</div>
          ) : (
            <div key={c.id} style={{ padding: "11px 13px", borderRadius: 11, background: cardBg, border: cardBorder, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>{c.name}</span>
                  {c.relationship && (
                    <span style={{ padding: "1px 7px", borderRadius: 5, background: `${T.accent}18`, color: accentStrong, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.relationship}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 5 }}>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: T.txt2, textDecoration: "none", fontFamily: font }}>
                      <Phone size={12} style={{ opacity: 0.7 }} /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: T.txt2, textDecoration: "none", fontFamily: font, wordBreak: "break-all" }}>
                      <Mail size={12} style={{ opacity: 0.7 }} /> {c.email}
                    </a>
                  )}
                </div>
                {c.notas && <p style={{ margin: "5px 0 0", fontSize: 12, color: T.txt3, fontFamily: font, lineHeight: 1.45 }}>{c.notas}</p>}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button type="button" title="Editar" onClick={() => startEdit(c)} style={{ padding: 6, borderRadius: 7, background: "transparent", border: `1px solid ${inputBorder}`, color: T.txt3, cursor: "pointer", display: "inline-flex" }}><Pencil size={13} /></button>
                <button type="button" title="Eliminar" onClick={() => remove(c.id)} style={{ padding: 6, borderRadius: 7, background: "transparent", border: "1px solid rgba(239,68,68,0.30)", color: "#F87171", cursor: "pointer", display: "inline-flex" }}><Trash2 size={13} /></button>
              </div>
            </div>
          )
        ))}

        {editing === "new" && formCard}
      </div>
    </div>
  );
}
