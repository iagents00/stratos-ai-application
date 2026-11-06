/**
 * CRM/LeadRelatedContacts.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "Familiares o Socios" del expediente — personas ALLEGADAS al contacto
 * (normalmente la esposa/o, un socio o un familiar) con su propio teléfono/email.
 *
 * A diferencia del panel de Perfilamiento IA (LeadDiscoveryPanel, solo lectura),
 * esto lo EDITA el administrador: agrega / edita / borra allegados. 1 lead → N allegados,
 * en la tabla `public.lead_related_contacts` (RLS: org + lead visible, igual que
 * discovery_data — un asesor solo toca los allegados de SUS leads).
 *
 * Modo demo (o lead sin id real): funciona en memoria, sin tocar la BD.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from "react";
import { Users, Plus, Phone, Mail, Trash2, Pencil, X, Check } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { L } from "../../constants/labels";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";
import { contactChannels } from "../../../lib/lead-documents.mjs";

const REL_SUGGESTIONS = ["Esposa", "Esposo", "Pareja", "Socio", "Socia", "Familiar", "Hermano/a", "Hijo/a"];
const EMPTY = { name: "", relationship: "", phones: [""], emails: [""], notas: "" };
const CONTACT_FIELDS = "id, name, relationship, phone, email, phones, emails, notas";

export default function LeadRelatedContacts({ lead, T = P, isLight = false }) {
  const { user } = useAuth();
  // Agregar/editar/borrar allegados = SOLO admin (candado real en la RLS,
  // migración 105). El asesor los VE en lectura. Regla de negocio jul 2026.
  const isAdmin = ["super_admin", "admin", "ceo", "director"].includes(user?.role);
  const isDemo = user?.isDemo || !/^[0-9a-f]{8}-/.test(String(lead?.id || ""));

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null); // null | "new" | <id>
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    let cancelled = false;
    setContacts([]); setEditing(null); setErr("");
    if (!lead?.id || isDemo) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from("lead_related_contacts")
      .select(CONTACT_FIELDS)
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setErr("No se pudieron cargar los contactos. Vuelve a abrir el expediente.");
        else setContacts(data || []);
        setLoading(false);
      }).catch(() => {
        if (!cancelled) { setErr("No se pudieron cargar los contactos. Vuelve a abrir el expediente."); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [lead?.id, isDemo]);

  const reset = () => { setForm(EMPTY); setEditing(null); setErr(""); setSaving(false); };
  const startNew  = () => { setForm(EMPTY); setEditing("new"); setErr(""); };
  const startEdit = (c) => {
    const phones = contactChannels(c, "phone"), emails = contactChannels(c, "email");
    setForm({ name: c.name || "", relationship: c.relationship || "", phones: phones.length ? phones : [""], emails: emails.length ? emails : [""], notas: c.notas || "" });
    setEditing(c.id); setErr("");
  };

  const save = async () => {
    if (saving) return;
    const name = form.name.trim();
    if (!name) { setErr("El nombre es obligatorio."); return; }
    const phones = contactChannels(form, "phone"), emails = contactChannels(form, "email");
    if (emails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setErr("Revisa los correos electrónicos antes de guardar."); return; }
    setSaving(true); setErr("");
    const payload = {
      name,
      relationship: form.relationship.trim() || null,
      phones, emails,
      phone:        phones[0] || null,
      email:        emails[0] || null,
      notas:        form.notas.trim() || null,
    };
    if (isDemo) {
      if (editing === "new") setContacts(prev => [...prev, { id: `demo_${Date.now()}`, ...payload }]);
      else                   setContacts(prev => prev.map(c => (c.id === editing ? { ...c, ...payload } : c)));
      reset(); return;
    }
    try {
      if (editing === "new") {
        const { data, error } = await supabase
        .from("lead_related_contacts")
        .insert({ lead_id: lead.id, ...payload })
        .select(CONTACT_FIELDS)
        .single();
        if (error) throw error;
        if (active.current) setContacts(prev => [...prev, data]);
      } else {
        const { data, error } = await supabase.from("lead_related_contacts").update(payload).eq("id", editing).eq("lead_id", lead.id).select(CONTACT_FIELDS).single();
        if (error) throw error;
        if (active.current) setContacts(prev => prev.map(c => (c.id === editing ? data : c)));
      }
      if (active.current) reset();
    } catch {
      if (active.current) { setErr("No se pudo guardar. Tus cambios siguen aquí; intenta de nuevo."); setSaving(false); }
    }
  };

  const remove = async (id) => {
    if (saving) return;
    setSaving(true); setErr("");
    try {
      if (!isDemo) {
        const { error } = await supabase.from("lead_related_contacts").delete().eq("id", id).eq("lead_id", lead.id).select("id").single();
        if (error) throw error;
      }
      if (active.current) { setContacts(prev => prev.filter(c => c.id !== id)); if (editing === id) reset(); }
    } catch { if (active.current) setErr("No se pudo eliminar el contacto. Intenta de nuevo."); }
    finally { if (active.current) setSaving(false); }
  };

  if (loading) return null; // silencioso mientras carga
  // El asesor solo LEE. Si no es admin y no hay allegados, ocultamos la sección
  // (no le mostramos un panel vacío que no puede llenar). Solo en el expediente.
  if (!isAdmin && contacts.length === 0 && !err) return null;

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
    fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
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
          <input aria-label="Nombre del contacto adicional" maxLength={200} disabled={saving} value={form.name} placeholder="Ej. María Pérez" autoFocus onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={labelStyle}>Relación / parentesco</label>
          <input aria-label="Relación o parentesco" disabled={saving} value={form.relationship} placeholder="Esposa, socio, hermano…" list="lrc-rel-suggestions" onChange={(e) => setForm(f => ({ ...f, relationship: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      <datalist id="lrc-rel-suggestions">
        {REL_SUGGESTIONS.map(r => <option key={r} value={r} />)}
      </datalist>
      {[{ field: "phones", label: "Teléfono", type: "tel", placeholder: "+52 …", add: "Agregar teléfono" },
        { field: "emails", label: "Correo", type: "email", placeholder: "correo@ejemplo.com", add: "Agregar correo" }].map(channel => (
        <div key={channel.field} style={{ display: "grid", gap: 6 }}>
          <span style={labelStyle}>{channel.field === "phones" ? "Teléfonos" : "Correos electrónicos"}</span>
          {form[channel.field].map((value, index) => <div key={index} style={{ display: "flex", gap: 6 }}>
            <input aria-label={`${channel.label} adicional ${index + 1}`} type={channel.type} maxLength={254} disabled={saving} value={value} placeholder={channel.placeholder}
              onChange={event => setForm(previous => ({ ...previous, [channel.field]: previous[channel.field].map((item, i) => i === index ? event.target.value : item) }))} style={inputStyle} />
            {form[channel.field].length > 1 && <button type="button" aria-label={`Quitar ${channel.label.toLowerCase()} ${index + 1}`} disabled={saving}
              onClick={() => setForm(previous => ({ ...previous, [channel.field]: previous[channel.field].filter((_, i) => i !== index) }))}
              style={{ display: "flex", alignItems: "center", padding: 8, borderRadius: 8, background: "transparent", border: `1px solid ${inputBorder}`, color: T.txt3, cursor: "pointer" }}><X size={14} /></button>}
          </div>)}
          <button type="button" disabled={saving || form[channel.field].length >= 20} onClick={() => setForm(previous => ({ ...previous, [channel.field]: [...previous[channel.field], ""] }))}
            style={{ display: "inline-flex", alignItems: "center", justifySelf: "start", gap: 5, padding: "5px 0", background: "transparent", border: 0, color: accentStrong, cursor: "pointer", fontSize: 12 }}><Plus size={12} />{channel.add}</button>
        </div>
      ))}
      <div>
        <label style={labelStyle}>Nota (opcional)</label>
        <input aria-label="Nota del contacto adicional" disabled={saving} value={form.notas} onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ej. decide junto con el titular" style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={reset} disabled={saving} style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9,
          background: "transparent", border: `1px solid ${inputBorder}`, color: T.txt3,
          fontSize: 12.5, fontWeight: 400, fontFamily: fontDisp, cursor: "pointer",
        }}><X size={13} /> Cancelar</button>
        <button type="button" onClick={save} disabled={saving || !form.name.trim()} style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 9,
          background: (saving || !form.name.trim()) ? (isLight ? "rgba(15,23,42,0.06)" : T.glass) : (isLight ? `linear-gradient(135deg, ${T.accent}, #005B78)` : "#FFFFFF"),
          border: `1px solid ${(saving || !form.name.trim()) ? inputBorder : "transparent"}`,
          color: (saving || !form.name.trim()) ? T.txt3 : (isLight ? "#FFFFFF" : "#0C0C0C"),
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
          fontSize: 11.5, fontWeight: 500, letterSpacing: "0.12em",
          textTransform: "uppercase", color: headerC, fontFamily: fontDisp,
        }}>
          <Users size={11} /> {L.relatedContacts}
        </span>
        {isAdmin && editing === null && (
          <button type="button" onClick={startNew} disabled={saving} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 11px", borderRadius: 8,
            background: `${T.accent}14`, border: `1px solid ${T.accent}3A`,
            color: accentStrong, fontSize: 12, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
          }}><Plus size={12} /> Agregar</button>
        )}
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {isAdmin && contacts.length === 0 && editing !== "new" && (
          <p style={{ margin: 0, fontSize: 12.5, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
            {L.relatedContacts === "Familiares o Socios"
              ? "Agrega a quienes compran con el cliente, con sus teléfonos y correos."
              : `Sin contactos aún. Agrega aquí a las personas relacionadas con esta ${L.entity}.`}
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
                    <span style={{ padding: "1px 7px", borderRadius: 5, background: `${T.accent}18`, color: accentStrong, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.relationship}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 5 }}>
                  {contactChannels(c, "phone").map(phone => (
                    <a key={phone} href={`tel:${phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: T.txt2, textDecoration: "none", fontFamily: font, overflowWrap: "anywhere" }}>
                      <Phone size={12} style={{ opacity: 0.7, flexShrink: 0 }} /> {phone}
                    </a>
                  ))}
                  {contactChannels(c, "email").map(email => (
                    <a key={email} href={`mailto:${email}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: T.txt2, textDecoration: "none", fontFamily: font, wordBreak: "break-all" }}>
                      <Mail size={12} style={{ opacity: 0.7, flexShrink: 0 }} /> {email}
                    </a>
                  ))}
                </div>
                {c.notas && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font, lineHeight: 1.45 }}>{c.notas}</p>}
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button type="button" title={`Editar contacto ${c.name}`} disabled={saving || editing !== null} onClick={() => startEdit(c)} style={{ padding: 8, borderRadius: 7, background: "transparent", border: `1px solid ${inputBorder}`, color: T.txt3, cursor: "pointer", display: "inline-flex" }}><Pencil size={13} /></button>
                  <button type="button" title={`Eliminar contacto ${c.name}`} disabled={saving || editing !== null} onClick={() => remove(c.id)} style={{ padding: 8, borderRadius: 7, background: "transparent", border: "1px solid rgba(239,68,68,0.30)", color: "#F87171", cursor: "pointer", display: "inline-flex" }}><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          )
        ))}

        {editing === "new" && formCard}
        {err && <p role="alert" style={{ margin: 0, color: isLight ? "#B42318" : "#FCA5A5", fontSize: 12.5, fontFamily: font }}>{err}</p>}
      </div>
    </div>
  );
}
