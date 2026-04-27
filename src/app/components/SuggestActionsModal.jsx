/**
 * SuggestActionsModal — Co-pilot IA que sugiere próximas acciones.
 *
 * Lee el expediente del lead y llama a la Edge Function
 * `suggest-next-actions` (Claude Sonnet 4.5 + Protocolo Duke).
 * Muestra 1-3 sugerencias con técnica de venta + razón.
 * El asesor elige cuáles agregar a tasks.
 */
import { useEffect, useState } from "react";
import { X, Wand2, Plus, RefreshCw, Lightbulb } from "lucide-react";
import { P, font, fontDisp, mono } from "../../design-system/tokens";
import { suggestNextActions, suggestionToTask } from "../../lib/suggest-actions";

const PRIORITY_META = {
  alta:  { color: "#EF4444", label: "ALTA" },
  media: { color: "#FBBF24", label: "MEDIA" },
  baja:  { color: "#7EB8F0", label: "BAJA" },
};

export default function SuggestActionsModal({ open, onClose, lead, onAddTasks }) {
  const [loading, setLoading]       = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary]       = useState("");
  const [error, setError]           = useState(null);
  const [selected, setSelected]     = useState(new Set());

  const fetchSuggestions = async () => {
    if (!lead) return;
    setLoading(true); setError(null); setSelected(new Set());
    try {
      const tasks = Array.isArray(lead.tasks) ? lead.tasks : [];
      const r = await suggestNextActions(lead, tasks);
      if (r.error) setError(r.error);
      setSuggestions(r.suggestions || []);
      setSummary(r.summary_one_line || "");
    } catch (e) {
      setError(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && lead) fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id]);

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const addSelected = () => {
    const newTasks = [...selected].map(idx => suggestionToTask(suggestions[idx], "ai"));
    if (newTasks.length === 0) return;
    onAddTasks?.(newTasks);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100002,
        background: "rgba(3,8,16,0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.2s",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(580px, 96vw)",
          maxHeight: "88vh",
          background: P.bg2,
          border: `1px solid ${P.accentB}`,
          borderRadius: P.r,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(110,231,194,0.06)",
          display: "flex", flexDirection: "column",
          fontFamily: font,
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${P.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${P.accent}26, ${P.violet}26)`,
              border: `1px solid ${P.accentB}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Wand2 size={17} color={P.accent} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: P.txt3, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: fontDisp }}>
                Copilot · Protocolo Duke
              </div>
              <div style={{ fontSize: 16, color: P.txt, fontWeight: 700, fontFamily: fontDisp, marginTop: 2 }}>
                Sugerencias para {lead?.n || lead?.name}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 999,
              border: `1px solid ${P.border}`,
              background: P.glass, color: P.txt2, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* Summary del agente */}
          {summary && !loading && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: `${P.accent}0E`,
              border: `1px solid ${P.accentB}`,
              marginBottom: 14,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <Lightbulb size={14} color={P.accent} strokeWidth={2.2} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: P.txt2, fontFamily: font, lineHeight: 1.55 }}>
                {summary}
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ padding: 40, textAlign: "center", color: P.txt3, fontFamily: font }}>
              <RefreshCw size={28} color={P.accent} strokeWidth={2} style={{ animation: "spinAi 1s linear infinite", marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.txt2 }}>Analizando expediente…</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: P.txt3 }}>Aplicando técnicas Duke + BANT + manejo de objeciones</p>
              <style>{`@keyframes spinAi { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{
              padding: 14, borderRadius: 10,
              background: `${P.rose}14`, border: `1px solid ${P.rose}33`,
              color: P.rose, fontSize: 12,
            }}>
              {error}. ¿La Edge Function está deployada y tiene ANTHROPIC_API_KEY configurada?
            </div>
          )}

          {/* Suggestions */}
          {!loading && !error && suggestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.map((s, i) => {
                const pm = PRIORITY_META[s.priority] || PRIORITY_META.media;
                const isSel = selected.has(i);
                return (
                  <div
                    key={i}
                    onClick={() => toggleSelect(i)}
                    style={{
                      padding: 14, borderRadius: P.r,
                      background: isSel ? `${P.accent}12` : P.glass,
                      border: `1px solid ${isSel ? P.accentB : P.border}`,
                      cursor: "pointer",
                      transition: "all 0.18s",
                    }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.borderColor = P.borderH; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.borderColor = P.border; }}
                  >
                    {/* Top row: priority + technique + checkbox */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: pm.color,
                        background: `${pm.color}1A`, border: `1px solid ${pm.color}33`,
                        padding: "2px 8px", borderRadius: 99, letterSpacing: "0.08em", fontFamily: fontDisp,
                      }}>{pm.label}</span>
                      <span style={{
                        fontSize: 9.5, color: P.violet,
                        background: `${P.violet}15`, border: `1px solid ${P.violet}33`,
                        padding: "2px 8px", borderRadius: 99, fontFamily: fontDisp, fontWeight: 700,
                      }}>{s.technique || "Técnica"}</span>
                      <div style={{ flex: 1 }} />
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        border: `1.5px solid ${isSel ? P.accent : P.borderH}`,
                        background: isSel ? P.accent : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isSel && <Plus size={12} color="#0B1220" strokeWidth={3} style={{ transform: "rotate(45deg)" }} />}
                      </div>
                    </div>

                    {/* Action */}
                    <p style={{
                      margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: P.txt,
                      fontFamily: fontDisp, lineHeight: 1.4,
                    }}>{s.action}</p>

                    {/* Date */}
                    {s.date && (
                      <p style={{ margin: "0 0 8px", fontSize: 11, color: P.accent, fontFamily: mono }}>
                        📅 {s.date}
                      </p>
                    )}

                    {/* Reason */}
                    {s.reason && (
                      <p style={{
                        margin: 0, fontSize: 11.5, color: P.txt2, fontFamily: font, lineHeight: 1.55,
                        paddingTop: 8, borderTop: `1px solid ${P.border}`,
                      }}>
                        <span style={{ color: P.txt3, fontWeight: 600 }}>POR QUÉ · </span>
                        {s.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && suggestions.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: P.txt3 }}>
              <p style={{ margin: 0, fontSize: 12 }}>Sin sugerencias por ahora.</p>
              <button onClick={fetchSuggestions} style={{
                marginTop: 10, padding: "6px 14px", borderRadius: 8,
                background: P.glass, border: `1px solid ${P.border}`, color: P.accent,
                cursor: "pointer", fontSize: 11, fontFamily: font,
              }}>Reintentar</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && !loading && (
          <div style={{
            padding: "14px 20px",
            borderTop: `1px solid ${P.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <button onClick={fetchSuggestions} style={{
              padding: "8px 14px", borderRadius: 9,
              background: "transparent", border: `1px solid ${P.border}`,
              color: P.txt2, cursor: "pointer", fontSize: 12, fontFamily: font,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <RefreshCw size={12} /> Otras sugerencias
            </button>
            <button
              onClick={addSelected}
              disabled={selected.size === 0}
              style={{
                padding: "9px 18px", borderRadius: 9,
                background: selected.size > 0 ? P.accent : P.glass,
                border: `1px solid ${selected.size > 0 ? P.accent : P.border}`,
                color: selected.size > 0 ? "#0B1220" : P.txt3,
                cursor: selected.size > 0 ? "pointer" : "not-allowed",
                fontSize: 12.5, fontFamily: fontDisp, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.18s",
              }}
            >
              <Plus size={13} strokeWidth={3} />
              Agregar {selected.size > 0 ? `${selected.size} ` : ""}a tasks
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
