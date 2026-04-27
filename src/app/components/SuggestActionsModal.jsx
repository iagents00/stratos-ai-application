/**
 * SuggestActionsModal — Co-pilot IA que sugiere próximas acciones.
 *
 * Estrategia DOBLE FUENTE:
 *   1. Inmediato: muestra el `lead.playbook` (5 acciones precalculadas
 *      desde el Protocolo Duke en build time, sin esperar red).
 *   2. Background: llama a la Edge Function `suggest-next-actions`
 *      (Gemini Flash + Protocolo Duke). Si responde con sugerencias
 *      mejores que las del playbook, las muestra. Si falla, se queda
 *      con el playbook — el asesor nunca ve un estado "vacío".
 *
 * El asesor selecciona cuáles agregar a sus tasks con un click.
 */
import { useEffect, useState } from "react";
import { X, Wand2, Plus, RefreshCw, Lightbulb } from "lucide-react";
import { P, font, fontDisp, mono } from "../../design-system/tokens";
import { suggestNextActions, suggestionToTask } from "../../lib/suggest-actions";

const PRIORITY_META = {
  alta:  { color: "#EF4444", label: "ATENDER YA" },
  media: { color: "#FBBF24", label: "ESTA SEMANA" },
  baja:  { color: "#7EB8F0", label: "CUANDO PUEDAS" },
};

// Traduce términos técnicos de venta a frases naturales para el asesor
const TECHNIQUE_LABEL = {
  "BANT — Authority":          "Saber quién decide",
  "BANT — Budget":             "Validar presupuesto",
  "BANT — Need":               "Entender necesidad",
  "BANT — Timeline":           "Confirmar urgencia",
  "BANT-F — Financing":        "Forma de pago",
  "BANT-F":                    "Calificar al cliente",
  "BANT":                      "Calificar al cliente",
  "SPIN":                      "Pregunta que abre conversación",
  "Manejo de objeción":        "Para responder dudas",
  "Manejo de objeción de precio": "Si dice 'está caro'",
  "Closing technique":         "Cierre suave",
  "Reactivación":              "Recuperar interés",
  "Re-engagement":             "Recuperar interés",
  "Velocidad de respuesta":    "Contactar rápido",
  "Doble canal":               "WhatsApp + llamada",
  "Cambio de canal":           "Cambiar el canal de contacto",
  "Aportar valor":             "Mensaje con valor nuevo",
  "Reducir fricción":          "Bajar la barrera",
  "Push de información":       "Enviar info sin pedir",
  "Manejo objeción precio":    "Si dice 'está caro'",
  "Avance del protocolo":      "Cerrar con siguiente paso",
  "Frecuencia por temperatura": "Cadencia ideal",
  "Personalización":           "Material específico al cliente",
  "Personalización doble":     "2 versiones para 2 decisores",
  "Decisión binaria":          "Dar 2 opciones cerradas",
  "Anticipación":              "Tener todo listo",
  "Preparación":               "Preparar antes de la cita",
  "Anti no-show":              "Confirmar para que no falte",
  "Estructura de venta":       "Plan estructurado de la cita",
  "Material persuasivo":       "Material que convence",
  "Velocidad post-cita":       "Mover rápido tras Zoom",
  "Propuesta personalizada":   "Propuesta a la medida",
  "Seguimiento activo":        "Provocar la respuesta",
  "Cita inclusiva":            "Incluir a todos los decisores",
  "Pre-venta a 2do decisor":   "Vender al otro decisor también",
  "Aumentar valor percibido":  "Mostrar valor extra",
  "Prueba social":             "Casos de éxito",
  "Costo de oportunidad":      "Mostrar lo que pierde si espera",
  "Escasez":                   "Crear urgencia con escasez",
  "Llamada en frío":           "Llamada de recuperación",
  "Cierre de proceso":         "Decidir si cerrar o seguir",
  "Cierre suave":              "Cerrar sin presionar",
  "Transparencia":             "Ser claro con costos",
  "Cierre ampliado":           "Cerrar y pedir más",
  "Post-venta":                "Atención post-compra",
  "Programa de referidos":     "Pedir referidos",
  "Mantener relación":         "Seguir en contacto",
  "Comunidad":                 "Mantenerlo cercano",
  "Re-engagement frío":        "Recuperar después de tiempo",
  "Escalation":                "Escalar al director",
  "Frecuencia":                "Cadencia adecuada",
};
function naturalTechnique(t) {
  if (!t) return "Sugerencia";
  return TECHNIQUE_LABEL[t] || t;
}

// ── Mapping playbook → suggestions ───────────────────────────────────
// Convierte items del playbook al formato de suggestions para que el
// modal pueda renderizarlos uniformemente.
const CATEGORY_TO_PRIORITY = {
  reactivacion: "alta",
  cita:         "alta",
  cierre:       "alta",
  calificacion: "media",
  propuesta:    "media",
  retencion:    "baja",
};

function playbookAsSuggestions(playbook = []) {
  return playbook
    .filter(p => !p.completed)   // no mostrar las ya completadas
    .map(p => ({
      action:    p.action,
      date:      "",
      technique: p.technique || "",
      reason:    p.reason || "",
      priority:  CATEGORY_TO_PRIORITY[p.category] || "media",
      icon:      p.icon || "💡",
      _fromPlaybook: true,
    }));
}

export default function SuggestActionsModal({ open, onClose, lead, onAddTasks }) {
  const [loading, setLoading]       = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary]       = useState("");
  const [error, setError]           = useState(null);
  const [selected, setSelected]     = useState(new Set());
  const [source, setSource]         = useState("playbook"); // "playbook" | "ai"

  /**
   * fetchSuggestions — estrategia de doble fuente:
   *   1. Inmediato: muestra el playbook precalculado del Protocolo Duke
   *      (5 acciones por cliente generadas en build time)
   *   2. Background: pide a la IA (Gemini Flash + Protocolo) sugerencias
   *      contextuales. Si la IA responde mejor, las sustituye.
   *   3. Si la IA falla, se queda con el playbook — el asesor nunca ve vacío.
   */
  const fetchSuggestions = async () => {
    if (!lead) return;
    setSelected(new Set());
    setError(null);

    // PASO 1: Playbook inmediato (sin esperar red)
    const playbookSuggestions = playbookAsSuggestions(lead.playbook || []);
    if (playbookSuggestions.length > 0) {
      setSuggestions(playbookSuggestions);
      setSummary("");
      setSource("playbook");
    }

    // PASO 2: Intentar mejorar con IA en background
    setLoading(true);
    try {
      const tasks = Array.isArray(lead.tasks) ? lead.tasks : [];
      const r = await suggestNextActions(lead, tasks);
      if (r && Array.isArray(r.suggestions) && r.suggestions.length > 0 && !r.error) {
        // IA respondió con sugerencias mejores → reemplazar
        setSuggestions(r.suggestions);
        setSummary(r.summary_one_line || "");
        setSource("ai");
      }
      // Si IA falla pero hay playbook, ya está mostrado — no mostrar error
    } catch (e) {
      // Sin IA → quedarse con el playbook silenciosamente
      if (playbookSuggestions.length === 0) {
        setError("No tenemos sugerencias para este cliente todavía. Agrega más información en el expediente.");
      }
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
              <div style={{ fontSize: 9, color: P.txt3, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: fontDisp, display: "flex", alignItems: "center", gap: 6 }}>
                <span>Tu asistente de venta</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "1px 7px", borderRadius: 99,
                  background: source === "ai" ? `${P.accent}1A` : `${P.violet}1A`,
                  border: `1px solid ${source === "ai" ? P.accentB : `${P.violet}33`}`,
                  color: source === "ai" ? P.accent : P.violet,
                  fontSize: 8.5, letterSpacing: "0.1em",
                }}>
                  <span style={{ fontSize: 8 }}>{source === "ai" ? "✨" : "🎯"}</span>
                  {source === "ai" ? "IA + Protocolo Duke" : "Protocolo Duke"}
                </span>
              </div>
              <div style={{ fontSize: 16, color: P.txt, fontWeight: 700, fontFamily: fontDisp, marginTop: 2 }}>
                ¿Qué hago ahora con {lead?.n || lead?.name}?
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
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.txt2 }}>Estoy leyendo el expediente…</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: P.txt3 }}>Pensando qué te conviene hacer para avanzar la venta</p>
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
                      }}>{naturalTechnique(s.technique) || "Sugerencia"}</span>
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
                        <span style={{ color: P.txt3, fontWeight: 600 }}>POR QUÉ TE LO SUGIERO · </span>
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
              <RefreshCw size={12} /> Pensar de nuevo
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
              {selected.size > 0 ? `Agregar ${selected.size} a mi lista de hoy` : "Agregar a mi lista"}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
