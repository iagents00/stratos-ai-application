/**
 * LeadNotesTimeline — cronograma de notas individuales para un lead.
 *
 * Cada asesor puede agregar tantas notas como quiera. Cada nota se guarda
 * con timestamp y autor en `public.expediente_items` (tipo='nota').
 *
 * Esto es ADITIVO al textarea grande de "Notas del expediente" — el
 * textarea legacy sigue editando `leads.notas` (un único campo de texto).
 * Esta sección agrega notas separadas con cronograma.
 *
 * RLS: la tabla expediente_items hereda la visibilidad de leads — si el
 * asesor puede ver el lead, puede leer/escribir sus notas. Otros asesores
 * no pueden ver las notas de leads ajenos.
 *
 * RPCs y tablas relacionadas: ver supabase/migrations/008_*.sql
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Send, StickyNote, X } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";

const fmtDateTime = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export default function LeadNotesTimeline({ lead, T = P, isLight = false }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);

  const reload = useCallback(async () => {
    if (!lead?.id) return;
    // En modo demo (id no es UUID), no consultamos BD
    if (user?.isDemo || !/^[0-9a-f]{8}-/.test(String(lead.id))) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("expediente_items")
      .select("id, descripcion, titulo, metadata, created_at, updated_at, asesor_id")
      .eq("lead_id", lead.id)
      .in("tipo", ["nota", "texto"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      // No bloqueamos la UI por error de RLS o conexión — solo dejamos lista vacía.
      setNotes([]);
    } else {
      setNotes(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [lead?.id, user?.isDemo]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (adding && textareaRef.current) textareaRef.current.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId && editTextareaRef.current) {
      editTextareaRef.current.focus();
      const len = editTextareaRef.current.value.length;
      editTextareaRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  const onSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      // titulo es obligatorio segun la RPC. Usamos un titulo automatico
      // basado en fecha+hora si el asesor no provee uno.
      const autoTitle = `Nota — ${new Date().toLocaleString("es-MX", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })}`;
      const { error } = await supabase.rpc("add_expediente_item", {
        p_lead_id:      lead.id,
        p_tipo:         "nota",
        p_titulo:       autoTitle,
        p_descripcion:  trimmed,
        p_storage_path: null,
        p_mime_type:    null,
        p_size_bytes:   null,
        p_metadata:     { source: "web" },
      });
      if (error) throw error;
      setDraft("");
      setAdding(false);
      await reload();
    } catch (e) {
      setErrorMsg(e?.message || "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setDraft("");
    setAdding(false);
    setErrorMsg(null);
  };

  const onEditStart = (note) => {
    setEditingId(note.id);
    setEditDraft(note.descripcion || "");
    setEditError(null);
  };

  const onEditCancel = () => {
    setEditingId(null);
    setEditDraft("");
    setEditError(null);
  };

  const onEditSave = async (noteId) => {
    const trimmed = editDraft.trim();
    if (!trimmed || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const { error } = await supabase
        .from("expediente_items")
        .update({ descripcion: trimmed })
        .eq("id", noteId);
      if (error) throw error;
      setEditingId(null);
      setEditDraft("");
      await reload();
    } catch (e) {
      setEditError(e?.message || "No se pudo actualizar la nota.");
    } finally {
      setEditSaving(false);
    }
  };

  const wasEdited = (n) => {
    if (!n?.updated_at || !n?.created_at) return false;
    const diff = new Date(n.updated_at).getTime() - new Date(n.created_at).getTime();
    return diff > 2000;
  };

  const ADMIN_ROLES = ["super_admin", "admin", "ceo", "director"];
  const canEdit = (n) => {
    if (!user?.id) return false;
    if (n?.asesor_id === user.id) return true;
    return ADMIN_ROLES.includes(user.role);
  };

  // En modo demo: ocultamos el cronograma (no hay BD). El textarea
  // de "Notas del expediente" (legacy) sigue funcionando.
  if (user?.isDemo) return null;

  const headerC = isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.62)";

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: headerC,
          fontFamily: fontDisp,
        }}>
          <StickyNote size={11} />
          Cronograma de notas
          {notes.length > 0 && (
            <span style={{ fontWeight: 600, color: T.txt3, marginLeft: 4 }}>
              · {notes.length}
            </span>
          )}
        </span>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "6px 11px", borderRadius: 9,
              background: `${T.accent}14`, border: `1px solid ${T.accent}38`,
              color: T.accent, fontSize: 11.5, fontWeight: 600, fontFamily: font,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${T.accent}22`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = `${T.accent}14`)}
          >
            <Plus size={11} strokeWidth={2.4} />
            Agregar nota
          </button>
        )}
      </div>

      {/* Form para nota nueva */}
      {adding && (
        <div style={{
          padding: 12, marginBottom: 10, borderRadius: 11,
          background: isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)",
          border: `1px solid ${T.border}`,
        }}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe la nota… (ej: 'Le llamé, está revisando el comparativo con su esposa')"
            spellCheck={true}
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 9,
              background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.02)",
              border: `1px solid ${T.border}`,
              color: T.txt, fontSize: 13, fontFamily: font, lineHeight: 1.55,
              outline: "none", resize: "vertical", boxSizing: "border-box",
              transition: "border-color 0.18s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = T.borderH || T.accent; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
          />
          {errorMsg && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: "#F87171" }}>
              {errorMsg}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{
                padding: "7px 13px", borderRadius: 9,
                background: "transparent", border: `1px solid ${T.border}`,
                color: T.txt2, fontSize: 12, fontWeight: 600, fontFamily: font,
                cursor: saving ? "default" : "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !draft.trim()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9,
                background: saving || !draft.trim() ? `${T.accent}55` : T.accent,
                border: "none", color: "#041016",
                fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
                cursor: saving || !draft.trim() ? "default" : "pointer",
                transition: "all 0.15s",
              }}
            >
              <Send size={11} strokeWidth={2.4} />
              {saving ? "Guardando…" : "Guardar nota"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de notas */}
      {loading ? (
        <div style={{ padding: "10px 4px", fontSize: 12, color: T.txt3 }}>
          Cargando notas…
        </div>
      ) : notes.length === 0 ? (
        !adding && (
          <div style={{
            padding: "14px 12px", borderRadius: 11,
            background: "transparent", border: `1px dashed ${T.border}`,
            fontSize: 12.5, color: T.txt3, textAlign: "center",
          }}>
            Aún no hay notas con fecha. Agrega la primera con el botón de arriba.
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n) => {
            const isEditing = editingId === n.id;
            const editable = canEdit(n);
            return (
              <div key={n.id} style={{
                padding: "10px 12px", borderRadius: 10,
                background: isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  marginBottom: 4, fontSize: 10.5, color: T.txt3,
                  fontFamily: fontDisp, letterSpacing: "0.04em",
                }}>
                  <span style={{
                    display: "inline-block", width: 5, height: 5, borderRadius: "50%",
                    background: T.accent, flexShrink: 0,
                  }} />
                  {fmtDateTime(n.created_at)}
                  {n.metadata?.source && n.metadata.source !== "web" && (
                    <span style={{
                      marginLeft: 4, padding: "1px 6px", borderRadius: 4,
                      background: `${T.accent}14`, color: T.accent,
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}>
                      {n.metadata.source}
                    </span>
                  )}
                  {wasEdited(n) && !isEditing && (
                    <span style={{
                      marginLeft: 4, fontSize: 10, color: T.txt3,
                      fontStyle: "italic", letterSpacing: "0.02em",
                    }}>
                      · editada
                    </span>
                  )}
                  {editable && !isEditing && (
                    <button
                      type="button"
                      onClick={() => onEditStart(n)}
                      title="Editar nota"
                      aria-label="Editar nota"
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 8px", borderRadius: 7,
                        background: "transparent", border: `1px solid ${T.border}`,
                        color: T.txt3, fontSize: 10.5, fontWeight: 600,
                        fontFamily: font, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = T.accent;
                        e.currentTarget.style.borderColor = `${T.accent}55`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = T.txt3;
                        e.currentTarget.style.borderColor = T.border;
                      }}
                    >
                      <Pencil size={10} strokeWidth={2.2} />
                      Editar
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <p style={{
                    margin: 0, fontSize: 13, color: T.txt,
                    fontFamily: font, lineHeight: 1.55,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {n.descripcion || "(nota vacía)"}
                  </p>
                ) : (
                  <div>
                    <textarea
                      ref={editTextareaRef}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      spellCheck={true}
                      rows={3}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 9,
                        background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${T.border}`,
                        color: T.txt, fontSize: 13, fontFamily: font, lineHeight: 1.55,
                        outline: "none", resize: "vertical", boxSizing: "border-box",
                        transition: "border-color 0.18s",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = T.borderH || T.accent; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
                    />
                    {editError && (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: "#F87171" }}>
                        {editError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={onEditCancel}
                        disabled={editSaving}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "7px 13px", borderRadius: 9,
                          background: "transparent", border: `1px solid ${T.border}`,
                          color: T.txt2, fontSize: 12, fontWeight: 600, fontFamily: font,
                          cursor: editSaving ? "default" : "pointer",
                        }}
                      >
                        <X size={11} strokeWidth={2.4} />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditSave(n.id)}
                        disabled={editSaving || !editDraft.trim()}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "7px 14px", borderRadius: 9,
                          background: editSaving || !editDraft.trim() ? `${T.accent}55` : T.accent,
                          border: "none", color: "#041016",
                          fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
                          cursor: editSaving || !editDraft.trim() ? "default" : "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <Send size={11} strokeWidth={2.4} />
                        {editSaving ? "Guardando…" : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
