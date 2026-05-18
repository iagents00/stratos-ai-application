/**
 * CRM/LeadChatHistory.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tab "Chat" del drawer del lead — muestra el historial de mensajes que la IA
 * (Chatwoot/WhatsApp vía n8n) inyecta usando `fn_add_lead_note` con
 * `note_type='historial_chat'`.
 *
 * Por qué un tab separado:
 *   El "Expediente" debe quedar limpio para los cerradores — audios de Retell,
 *   resúmenes IA del Perfil Estratégico, notas humanas. Mezclar ahí 50 líneas
 *   de transcripción de WhatsApp arruina la lectura. Acá el asesor entra solo
 *   si quiere ver el hilo completo.
 *
 * Lee de `public.expediente_items` filtrado por `tipo='historial_chat'`.
 * RLS hereda visibilidad de leads (igual que el resto del expediente).
 *
 * Render: cada ítem como una "burbuja" con su título + timestamp + el content
 * tal cual (preserva los saltos de línea con whiteSpace: pre-wrap). Si el
 * content viene con marcadores tipo "👤 Cliente:" / "🤖 Bot:" se renderizan
 * directo — n8n decide el formato.
 *
 * Props: { lead, T, isLight }
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";

const fmtDateTime = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const isUuid = (id) => /^[0-9a-f]{8}-/.test(String(id || ""));

export default function LeadChatHistory({ lead, T = P, isLight = false }) {
  const { user } = useAuth();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!lead?.id) { setLoading(false); return; }
      if (user?.isDemo || !isUuid(lead.id)) {
        setItems([]); setLoading(false); return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("expediente_items")
        .select("id, titulo, descripcion, metadata, created_at")
        .eq("lead_id", lead.id)
        .eq("tipo", "historial_chat")
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [lead?.id, user?.isDemo]);

  const headerC   = isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.62)";
  const subC      = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.45)";
  const bubbleBg  = isLight ? "rgba(110,231,194,0.05)" : "rgba(110,231,194,0.04)";
  const bubbleBd  = isLight ? "rgba(13,154,118,0.18)"  : "rgba(110,231,194,0.16)";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: headerC, fontFamily: fontDisp,
        }}>
          <MessageCircle size={11} />
          Historial de chat (WhatsApp)
          {items.length > 0 && (
            <span style={{ fontWeight: 600, color: T.txt3, marginLeft: 4 }}>· {items.length}</span>
          )}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: "10px 4px", fontSize: 12, color: T.txt3, fontFamily: font }}>
          Cargando historial…
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: "22px 16px", borderRadius: 12, textAlign: "center",
          background: "transparent", border: `1px dashed ${T.border}`,
          fontSize: 12.5, color: T.txt3, fontFamily: font, lineHeight: 1.55,
        }}>
          Sin historial de chat todavía.<br />
          Cuando la IA registre la conversación de WhatsApp, aparecerá acá.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} style={{
              padding: "12px 14px", borderRadius: 12,
              background: bubbleBg,
              border: `1px solid ${bubbleBd}`,
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, color: T.txt2,
                  fontFamily: fontDisp, letterSpacing: "-0.005em",
                }}>
                  {it.titulo || "Conversación"}
                </span>
                <span style={{ fontSize: 10.5, color: subC, fontFamily: font, flexShrink: 0 }}>
                  {fmtDateTime(it.created_at)}
                </span>
              </div>
              <pre style={{
                margin: 0, fontSize: 12.5, color: T.txt,
                fontFamily: font, lineHeight: 1.55,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{it.descripcion || ""}</pre>
              {it.metadata && Object.keys(it.metadata).length > 0 && (
                <div style={{
                  marginTop: 8, paddingTop: 6,
                  borderTop: `1px dashed ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}`,
                  fontSize: 10, color: subC, fontFamily: fontDisp, letterSpacing: "0.02em",
                  display: "flex", flexWrap: "wrap", gap: 8,
                }}>
                  {it.metadata.source && <span>fuente: <strong>{it.metadata.source}</strong></span>}
                  {it.metadata.conversation_id && <span>conv #{it.metadata.conversation_id}</span>}
                  {it.metadata.inbox_id && <span>inbox #{it.metadata.inbox_id}</span>}
                  {it.metadata.message_count && <span>{it.metadata.message_count} msg</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
