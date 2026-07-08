/**
 * views/WhatsApp.jsx — Módulo "WhatsApp" (bandeja de conversaciones)
 * ─────────────────────────────────────────────────────────────────────────────
 * Todos los chats de WhatsApp de los clientes en un solo lugar (estilo
 * GoHighLevel): lista ordenada por último mensaje con contador de NO LEÍDOS
 * por conversación + el hilo seleccionado con composer para responder
 * (reutiliza LeadWhatsAppChat, el mismo del expediente).
 *
 * Caso de uso central: que la asesora (Cecilia) SEPA al instante cuándo un
 * cliente le escribió y pueda responder sin salir del CRM.
 *
 * Permisos: la RLS decide sola — asesor ve SUS conversaciones; admin ve
 * todas las de la org. Módulo gateado por el flag `whatsappChat` en
 * canAccessModule (patrón Caja).
 *
 * Props: { T, isLight, inbox, openLead }
 *   inbox    ← instancia de useWhatsAppInbox creada en App.jsx (una sola
 *              suscripción realtime compartida con la campanita).
 *   openLead ← { id, ts } nonce para abrir una conversación directo desde
 *              la campanita de notificaciones.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, ArrowLeft, Phone } from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { useIsMobile } from "../../hooks/useViewport";
import LeadWhatsAppChat from "./CRM/LeadWhatsAppChat";

const fmtWhen = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

const initials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

export default function WhatsAppInbox({ T = P, isLight = false, inbox, openLead }) {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const conversations = inbox?.conversations || [];
  const loading = inbox?.loading ?? true;

  // Apertura directa desde la campanita (nonce {id, ts})
  useEffect(() => {
    if (openLead?.id) {
      setSelectedId(openLead.id);
      setMobileShowChat(true);
      inbox?.markRead?.(openLead.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLead?.ts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.lead_name || "").toLowerCase().includes(q) ||
        (c.lead_phone || "").toLowerCase().includes(q) ||
        (c.asesor_name || "").toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const selected = useMemo(
    () => conversations.find((c) => c.lead_id === selectedId) || null,
    [conversations, selectedId]
  );

  // Si llegan mensajes nuevos a la conversación ABIERTA, marcarla leída.
  useEffect(() => {
    if (selected && Number(selected.unread_count || 0) > 0) {
      inbox?.markRead?.(selected.lead_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.unread_count, selected?.lead_id]);

  const handleSelect = (c) => {
    setSelectedId(c.lead_id);
    setMobileShowChat(true);
    if (Number(c.unread_count || 0) > 0) inbox?.markRead?.(c.lead_id);
  };

  const subC = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.45)";
  const cardBg = isLight ? "#FFFFFF" : T.glass;
  const accentStrong = isLight ? T.accentDark || T.accent : T.accent;

  const showList = !isMobile || !mobileShowChat;
  const showChat = !isMobile || mobileShowChat;

  /* ── Lista de conversaciones ─────────────────────────────────────────── */
  const listPane = (
    <div
      style={{
        width: isMobile ? "100%" : 340, flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 10, minHeight: 0,
      }}
    >
      <div style={{ position: "relative" }}>
        <Search size={13} color={T.txt3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente o teléfono…"
          style={{
            width: "100%", height: 34, padding: "0 11px 0 32px",
            borderRadius: 9, background: isLight ? "rgba(255,255,255,0.85)" : T.glass,
            border: `1px solid ${T.border}`, color: T.txt,
            fontSize: 12.5, outline: "none", fontFamily: font, boxSizing: "border-box",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = T.accentB || T.accent; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 14, fontSize: 12, color: T.txt3, fontFamily: font }}>Cargando conversaciones…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: "26px 16px", borderRadius: 12, textAlign: "center",
              border: `1px dashed ${T.border}`, fontSize: 12.5, color: T.txt3,
              fontFamily: font, lineHeight: 1.55,
            }}
          >
            {query ? "Sin resultados para esa búsqueda." : (
              <>Sin conversaciones todavía.<br />Cuando un cliente escriba por WhatsApp, aparecerá acá.</>
            )}
          </div>
        ) : (
          filtered.map((c) => {
            const unread = Number(c.unread_count || 0);
            const active = c.lead_id === selectedId;
            return (
              <button
                key={c.lead_id}
                onClick={() => handleSelect(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                  background: active
                    ? (isLight ? "rgba(13,154,118,0.08)" : "rgba(110,231,194,0.08)")
                    : cardBg,
                  border: `1px solid ${active ? (isLight ? "rgba(13,154,118,0.3)" : "rgba(110,231,194,0.25)") : T.border}`,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isLight ? "rgba(13,154,118,0.10)" : "rgba(110,231,194,0.09)",
                    color: accentStrong, fontSize: 12, fontWeight: 800, fontFamily: fontDisp,
                  }}
                >
                  {initials(c.lead_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 12.5, fontWeight: unread > 0 ? 800 : 600, color: T.txt,
                        fontFamily: fontDisp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {c.lead_name || c.lead_phone || "Cliente"}
                    </span>
                    <span style={{ fontSize: 9.5, color: unread > 0 ? accentStrong : subC, fontFamily: font, flexShrink: 0, fontWeight: unread > 0 ? 700 : 400 }}>
                      {fmtWhen(c.last_at)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
                    <span
                      style={{
                        fontSize: 11.5, color: unread > 0 ? T.txt : subC, fontFamily: font,
                        fontWeight: unread > 0 ? 600 : 400,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {c.last_direction === "out" ? "Tú: " : ""}{c.last_content || ""}
                    </span>
                    {unread > 0 && (
                      <span
                        style={{
                          minWidth: 17, height: 17, padding: "0 5px", borderRadius: 99, flexShrink: 0,
                          background: T.accent, color: "#041016",
                          fontSize: 9.5, fontWeight: 800, fontFamily: fontDisp,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  /* ── Panel del chat ──────────────────────────────────────────────────── */
  const chatPane = (
    <div
      style={{
        flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column",
        borderRadius: 14, border: `1px solid ${T.border}`,
        background: isLight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.02)",
        padding: 16,
      }}
    >
      {selected ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
            {isMobile && (
              <button
                onClick={() => setMobileShowChat(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
              >
                <ArrowLeft size={16} color={T.txt2} />
              </button>
            )}
            <div
              style={{
                width: 34, height: 34, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isLight ? "rgba(13,154,118,0.10)" : "rgba(110,231,194,0.09)",
                color: accentStrong, fontSize: 12, fontWeight: 800, fontFamily: fontDisp,
              }}
            >
              {initials(selected.lead_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>
                {selected.lead_name || "Cliente"}
              </p>
              <p style={{ fontSize: 10.5, color: subC, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
                <Phone size={9} />
                {selected.lead_phone || "—"}
                {selected.stage ? ` · ${selected.stage}` : ""}
                {selected.asesor_name ? ` · ${selected.asesor_name}` : ""}
              </p>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {/* key por conversación: al cambiar de chat se MONTA una instancia
                nueva → el borrador/adjunto y los mensajes NO se arrastran al
                siguiente cliente (evita responder a B con lo que ibas a mandar
                a A, y el envío con conversationId viejo mientras carga). */}
            <LeadWhatsAppChat
              key={selected.lead_id}
              lead={{ id: selected.lead_id, n: selected.lead_name, name: selected.lead_name }}
              T={T}
              isLight={isLight}
              threadMaxHeight={isMobile ? 340 : 460}
            />
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <MessageCircle size={30} color={T.txt3} />
          <p style={{ fontSize: 13, color: T.txt3, fontFamily: font }}>
            Selecciona una conversación para verla y responder.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 14,
        height: "100%", minHeight: 0, padding: isMobile ? "14px 12px 90px" : "22px 26px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34, height: 34, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isLight ? "rgba(13,154,118,0.10)" : "rgba(110,231,194,0.08)",
            border: `1px solid ${isLight ? "rgba(13,154,118,0.25)" : "rgba(110,231,194,0.18)"}`,
          }}
        >
          <MessageCircle size={16} color={accentStrong} />
        </div>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>
            WhatsApp
          </h1>
          <p style={{ fontSize: 11, color: subC, fontFamily: font }}>
            Conversaciones de tus clientes
            {inbox?.totalUnread > 0 ? ` · ${inbox.totalUnread} sin leer` : ""}
          </p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 14 }}>
        {showList && listPane}
        {showChat && !isMobile && chatPane}
        {showChat && isMobile && mobileShowChat && chatPane}
      </div>
    </div>
  );
}
