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
import { Plus, Send, StickyNote, Sparkles, ExternalLink, Pencil } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";
import { renderMarkdown } from "../../../lib/markdown";

/* ── Detección de links en el texto de una nota ──────────────────────────────
   Si el usuario pega un link (Drive, PDF, web…), en vez de mostrarlo como texto
   plano lo renderiza como un botón/chip clickeable que indica a dónde lleva.
   El resto del texto queda igual. */
const URL_SPLIT = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const isUrl = (s) => /^(https?:\/\/|www\.)/i.test(s || "");
function linkKind(url) {
  const u = url.toLowerCase();
  if (u.includes("drive.google") || u.includes("docs.google")) return "Google Drive";
  if (u.includes("dropbox.com"))   return "Dropbox";
  if (u.includes("onedrive") || u.includes("sharepoint")) return "OneDrive";
  if (u.includes("wetransfer"))    return "WeTransfer";
  if (u.endsWith(".pdf"))          return "PDF";
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return "Abrir enlace"; }
}
function renderNoteText(text, T) {
  const str = String(text ?? "");
  if (!URL_SPLIT.test(str)) return str;          // sin links → texto tal cual
  URL_SPLIT.lastIndex = 0;
  return str.split(URL_SPLIT).map((part, i) => {
    if (!part) return null;
    if (!isUrl(part)) return <span key={i}>{part}</span>;
    const href = part.startsWith("http") ? part : `https://${part}`;
    return (
      <a key={i} href={href} target="_blank" rel="noopener noreferrer"
         onClick={(e) => e.stopPropagation()}
         title={href}
         style={{
           display: "inline-flex", alignItems: "center", gap: 5, verticalAlign: "middle",
           margin: "1px 2px", padding: "2px 9px 2px 7px", borderRadius: 7,
           background: `${T.accent}14`, border: `1px solid ${T.accent}38`,
           color: T.accent, fontSize: 11.5, fontWeight: 500, fontFamily: font,
           textDecoration: "none", lineHeight: 1.4, cursor: "pointer",
           maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
         }}>
        <ExternalLink size={11} strokeWidth={2.4} style={{ flexShrink: 0 }} />
        {linkKind(part)}
      </a>
    );
  });
}

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

// Estilos diferenciados para notas humanas vs notas inyectadas por la IA.
// nota_ia tiene tinte amarillo + badge "IA" + render Markdown.
function noteVisualStyle(note, isLight) {
  const isAi = note.tipo === "nota_ia";
  if (isAi) {
    return {
      bg: isLight ? "rgba(250,204,21,0.10)" : "rgba(250,204,21,0.07)",
      border: isLight ? "rgba(202,138,4,0.32)" : "rgba(250,204,21,0.22)",
      accent: isLight ? "#A16207" : "#FACC15",
      badge: "IA",
      isAi: true,
    };
  }
  return {
    bg: isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)",
    border: null,        // usa T.border
    accent: null,        // usa T.accent
    badge: null,
    isAi: false,
  };
}

export default function LeadNotesTimeline({ lead, T = P, isLight = false, autoStartAdding = 0 }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  // Si el padre incrementa autoStartAdding (un trigger counter), arrancamos
  // el flujo de captura inmediatamente. Skip al primer mount (valor inicial).
  const lastTriggerRef = useRef(autoStartAdding);
  useEffect(() => {
    if (autoStartAdding !== lastTriggerRef.current) {
      lastTriggerRef.current = autoStartAdding;
      if (autoStartAdding > 0) setAdding(true);
    }
  }, [autoStartAdding]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const textareaRef = useRef(null);
  // Edición in-line de una nota ya guardada (RLS: admin de la org o autor).
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const startEdit  = (n) => { setErrorMsg(null); setEditingId(n.id); setEditDraft(n.descripcion || ""); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(""); };
  const saveEdit = async (n) => {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === (n.descripcion || "")) { cancelEdit(); return; }
    setSavingEdit(true);
    const { error } = await supabase.from("expediente_items").update({ descripcion: trimmed }).eq("id", n.id);
    setSavingEdit(false);
    if (error) { setErrorMsg("No se pudo guardar la edición. Reintenta."); return; }
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, descripcion: trimmed } : x)));
    cancelEdit();
  };

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
      .select("id, descripcion, titulo, tipo, metadata, created_at, asesor_id")
      .eq("lead_id", lead.id)
      .in("tipo", ["nota", "texto", "nota_ia"])
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

  // En modo demo: ocultamos el cronograma (no hay BD). El textarea
  // de "Notas del expediente" (legacy) sigue funcionando.
  if (user?.isDemo) return null;

  const headerC = isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.62)";

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10.5, fontWeight: 500, letterSpacing: "0.12em",
          textTransform: "uppercase", color: headerC,
          fontFamily: fontDisp,
        }}>
          <StickyNote size={11} />
          Cronograma de notas
          {notes.length > 0 && (
            <span style={{ fontWeight: 400, color: T.txt3, marginLeft: 4 }}>
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
              color: T.accent, fontSize: 11.5, fontWeight: 400, fontFamily: font,
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
                color: T.txt2, fontSize: 12, fontWeight: 400, fontFamily: font,
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
                fontSize: 12, fontWeight: 500, fontFamily: fontDisp,
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
            const v = noteVisualStyle(n, isLight);
            const dotColor    = v.isAi ? v.accent : T.accent;
            const borderColor = v.border || T.border;
            return (
              <div key={n.id} style={{
                padding: "10px 12px", borderRadius: 10,
                background: v.bg,
                border: `1px solid ${borderColor}`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  marginBottom: v.isAi ? 6 : 4, fontSize: 10.5, color: T.txt3,
                  fontFamily: fontDisp, letterSpacing: "0.04em",
                  flexWrap: "wrap",
                }}>
                  <span style={{
                    display: "inline-block", width: 5, height: 5, borderRadius: "50%",
                    background: dotColor, flexShrink: 0,
                  }} />
                  {fmtDateTime(n.created_at)}
                  {v.isAi && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      marginLeft: 4, padding: "1px 7px", borderRadius: 5,
                      background: isLight ? `${v.accent}1A` : `${v.accent}1F`,
                      color: v.accent,
                      fontSize: 9.5, fontWeight: 500, textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}>
                      <Sparkles size={9} strokeWidth={2.5} />
                      {v.badge}
                    </span>
                  )}
                  {!v.isAi && n.metadata?.source && n.metadata.source !== "web" && (
                    <span style={{
                      marginLeft: 4, padding: "1px 6px", borderRadius: 4,
                      background: `${T.accent}14`, color: T.accent,
                      fontSize: 9, fontWeight: 500, textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}>
                      {n.metadata.source}
                    </span>
                  )}
                  {v.isAi && n.titulo && n.titulo !== "Nota privada de IA" && (
                    <span style={{ marginLeft: 4, color: T.txt2, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      {n.titulo}
                    </span>
                  )}
                  {!v.isAi && editingId !== n.id && (
                    <button type="button" onClick={() => startEdit(n)} title="Editar nota"
                      style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: T.txt3, cursor: "pointer", padding: "2px 4px", fontFamily: font, fontSize: 10.5, opacity: 0.75, transition: "opacity 0.15s, color 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = T.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "0.75"; e.currentTarget.style.color = T.txt3; }}>
                      <Pencil size={11} strokeWidth={2.2} /> Editar
                    </button>
                  )}
                </div>
                {v.isAi ? (
                  <div style={{
                    fontSize: 13, color: T.txt,
                    fontFamily: font, lineHeight: 1.55,
                    wordBreak: "break-word",
                  }}>
                    {renderMarkdown(n.descripcion || "(nota vacía)")}
                  </div>
                ) : editingId === n.id ? (
                  <div>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      autoFocus
                      rows={4}
                      style={{
                        width: "100%", boxSizing: "border-box", padding: "9px 11px",
                        borderRadius: 9, background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${T.accent}55`, color: T.txt, fontSize: 13,
                        fontFamily: font, lineHeight: 1.55, outline: "none", resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                      <button type="button" onClick={cancelEdit} disabled={savingEdit}
                        style={{ padding: "5px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, cursor: "pointer", fontSize: 12, fontWeight: 400, fontFamily: font }}>
                        Cancelar
                      </button>
                      <button type="button" onClick={() => saveEdit(n)} disabled={savingEdit || !editDraft.trim()}
                        style={{ padding: "5px 14px", borderRadius: 8, background: editDraft.trim() ? T.accent : T.border, border: "none", color: editDraft.trim() ? "#041016" : T.txt3, cursor: editDraft.trim() ? "pointer" : "default", fontSize: 12, fontWeight: 500, fontFamily: font }}>
                        {savingEdit ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{
                    margin: 0, fontSize: 13, color: T.txt,
                    fontFamily: font, lineHeight: 1.55,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {renderNoteText(n.descripcion || "(nota vacía)", T)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
