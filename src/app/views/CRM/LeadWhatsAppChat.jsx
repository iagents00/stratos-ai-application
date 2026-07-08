/**
 * CRM/LeadWhatsAppChat.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Chat de WhatsApp EN VIVO dentro del expediente del lead (tab "Chat").
 *
 * Muestra el hilo real de WhatsApp (espejo `whatsapp_messages`, lo llena n8n
 * con los eventos de Chatwoot) y permite RESPONDER al cliente sin salir del
 * CRM (cola `whatsapp_outbox` → n8n → Chatwoot → WhatsApp).
 *
 * Reglas de producto:
 *  - Gateado por feature flag `whatsappChat` (hoy solo Duke lo prende).
 *  - Ventana de 24h de WhatsApp: si el cliente no escribe hace más de 24h,
 *    el texto libre no se puede enviar (regla de Meta, no nuestra) — se
 *    muestra un aviso en lugar del composer.
 *  - Demo / leads sin UUID: no consulta nada (mismo guard que LeadChatHistory).
 *  - Reintento real: los envíos failed (o atascados >60s) se re-encolan vía
 *    RPC fn_wa_outbox_retry y se vuelve a disparar el flujo.
 *
 * Perf (ZONA CRÍTICA del CLAUDE.md):
 *  - supabase.channel con removeChannel en el cleanup.
 *  - Eventos realtime DEBOUNCEADOS (300ms) → un solo refetch por ráfaga.
 *  - Guard de secuencia: una respuesta vieja nunca pisa estado más nuevo.
 *  - Un error transitorio de red NO borra el hilo visible (conserva estado).
 *  - Polling de respaldo cada 20s que no trabaja con la pestaña oculta.
 *  - Autoscroll solo si el usuario estaba pegado al fondo (no lo arrastra).
 *
 * Props: { lead, T = P, isLight = false } — contrato estándar del drawer.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Clock, AlertTriangle, RefreshCw, Lock } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";
import { useClient } from "../../../hooks/useClient";
import {
  fetchWhatsAppThread,
  mergeThread,
  isWindowOpen,
  windowRemainingMs,
  resolveConversationId,
  resolveOrgId,
  queueWhatsAppMessage,
  pingSendWebhook,
  retryOutboxMessage,
  WA_MAX_LEN,
  WA_STUCK_MS,
} from "../../../lib/whatsapp-chat";

const POLL_MS = 20000;
const REALTIME_DEBOUNCE_MS = 300;
const NEAR_BOTTOM_PX = 90;

const fmtTime = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const isUuid = (id) => /^[0-9a-f]{8}-/.test(String(id || ""));

export default function LeadWhatsAppChat({ lead, T = P, isLight = false }) {
  const { user } = useAuth();
  const { isFeatureEnabled } = useClient();

  const [messages, setMessages] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [retrying, setRetrying] = useState(null); // outboxId en reintento
  const scrollRef = useRef(null);
  const nearBottomRef = useRef(true);
  const loadSeqRef = useRef(0);
  const loadRef = useRef(() => {});

  const enabled =
    typeof isFeatureEnabled === "function" ? isFeatureEnabled("whatsappChat") : false;
  const canQuery = enabled && !!lead?.id && isUuid(lead.id) && !user?.isDemo;

  /* ── Carga + realtime (debounced) + polling de respaldo ─────────────────── */
  useEffect(() => {
    if (!canQuery) {
      setLoading(false);
      setMessages([]);
      setOutbox([]);
      return;
    }
    let cancelled = false;
    let debounceTimer = null;

    const load = async () => {
      const seq = ++loadSeqRef.current;
      const t = await fetchWhatsAppThread(lead.id);
      if (cancelled || seq !== loadSeqRef.current) return; // respuesta vieja: descartar
      if (!t.error) {
        // Un blip de red no debe borrar el hilo visible: solo pisar con datos buenos.
        setMessages(t.messages);
        setOutbox(t.outbox);
      }
      setLoading(false);
    };
    loadRef.current = load;
    load();

    // Realtime: ráfagas de eventos → UN refetch (trailing debounce)
    const onRealtimeEvent = () => {
      if (document.hidden) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, REALTIME_DEBOUNCE_MS);
    };
    const ch = supabase
      .channel(`wa_chat_${lead.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `lead_id=eq.${lead.id}` },
        onRealtimeEvent
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_outbox", filter: `lead_id=eq.${lead.id}` },
        onRealtimeEvent
      )
      .subscribe();

    // Respaldo por si realtime se cae; no trabaja con la pestaña oculta.
    const tick = () => {
      if (!document.hidden) load();
    };
    const pollTimer = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
      clearInterval(pollTimer);
    };
  }, [lead?.id, canQuery]);

  /* ── Derivados ──────────────────────────────────────────────────────────── */
  const thread = useMemo(() => mergeThread(messages, outbox), [messages, outbox]);
  const conversationId = useMemo(() => resolveConversationId(messages), [messages]);
  const orgId = useMemo(() => resolveOrgId(messages), [messages]);
  const windowOpen = useMemo(() => isWindowOpen(messages), [messages]);
  const remainingH = useMemo(
    () => Math.floor(windowRemainingMs(messages) / 3600000),
    [messages]
  );
  const hasThread = messages.length > 0;
  const canSend = canQuery && hasThread && windowOpen && conversationId != null && orgId != null;

  // Autoscroll SOLO si el usuario estaba pegado al fondo (no arrastrarlo
  // mientras lee historial arriba).
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [thread.length]);

  /* ── Enviar ─────────────────────────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    const clean = draft.trim();
    if (!clean || sending || !canSend) return;
    setSending(true);
    setSendError(null);
    const ins = await queueWhatsAppMessage({
      leadId: lead.id,
      organizationId: orgId,
      conversationId,
      content: clean,
      senderName: user?.name || null,
    });
    setSending(false);
    if (!ins.ok) {
      setSendError(ins.error === "too_long" ? "Mensaje demasiado largo" : ins.error);
      return;
    }
    // Burbuja optimista ANTES del ping, con dedupe (realtime/poll pueden
    // haber traído la fila ya).
    setDraft("");
    setOutbox((prev) =>
      prev.some((r) => r.id === ins.row.id) ? prev : [...prev, ins.row]
    );
    const ping = await pingSendWebhook(ins.row.id);
    if (!ping.ok) {
      setSendError(`El disparo falló (${ping.error}) — usa "reintentar" en el mensaje`);
    }
  }, [draft, sending, canSend, lead?.id, orgId, conversationId, user?.name]);

  const handleRetry = useCallback(async (outboxId) => {
    setRetrying(outboxId);
    setSendError(null);
    const res = await retryOutboxMessage(outboxId);
    setRetrying(null);
    if (!res.ok) setSendError(`Reintento: ${res.error}`);
    loadRef.current();
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /* ── Estilos ────────────────────────────────────────────────────────────── */
  const headerC = isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.62)";
  const subC = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.45)";
  const inBg = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const inBd = isLight ? "rgba(15,23,42,0.08)" : T.border;
  const outBg = isLight ? "rgba(13,154,118,0.07)" : "rgba(110,231,194,0.07)";
  const outBd = isLight ? "rgba(13,154,118,0.2)" : "rgba(110,231,194,0.18)";
  const accentStrong = isLight ? T.accentDark || T.accent : T.accent;

  if (!enabled) return null;

  const now = Date.now();
  const isStuck = (m) =>
    (m.status === "pending" || m.status === "sending") &&
    m.queuedAt &&
    now - new Date(m.queuedAt).getTime() > WA_STUCK_MS;

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: headerC, fontFamily: fontDisp,
          }}
        >
          <MessageCircle size={11} />
          WhatsApp · Conversación en vivo
          {thread.length > 0 && (
            <span style={{ fontWeight: 600, color: T.txt3, marginLeft: 4 }}>· {thread.length}</span>
          )}
        </span>
        {hasThread && (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 9.5, fontWeight: 700, fontFamily: fontDisp,
              padding: "3px 8px", borderRadius: 999,
              color: windowOpen ? (isLight ? "#067A5E" : T.accent) : T.amber,
              background: windowOpen
                ? (isLight ? "rgba(13,154,118,0.08)" : "rgba(110,231,194,0.08)")
                : "rgba(251,191,36,0.1)",
              border: `1px solid ${windowOpen ? outBd : "rgba(251,191,36,0.25)"}`,
            }}
            title={
              windowOpen
                ? "WhatsApp permite texto libre hasta 24h después del último mensaje del cliente"
                : "Pasadas 24h del último mensaje del cliente, WhatsApp solo permite plantillas"
            }
          >
            {windowOpen ? <Clock size={9} /> : <Lock size={9} />}
            {windowOpen ? `Ventana abierta · ~${remainingH}h` : "Ventana 24h cerrada"}
          </span>
        )}
      </div>

      {/* Cuerpo */}
      {!canQuery ? (
        <div
          style={{
            padding: "18px 16px", borderRadius: 12, textAlign: "center",
            border: `1px dashed ${T.border}`, fontSize: 12.5, color: T.txt3,
            fontFamily: font, lineHeight: 1.55,
          }}
        >
          Disponible con datos reales del CRM.
        </div>
      ) : loading ? (
        <div style={{ padding: "10px 4px", fontSize: 12, color: T.txt3, fontFamily: font }}>
          Cargando conversación…
        </div>
      ) : !hasThread ? (
        <div
          style={{
            padding: "22px 16px", borderRadius: 12, textAlign: "center",
            border: `1px dashed ${T.border}`, fontSize: 12.5, color: T.txt3,
            fontFamily: font, lineHeight: 1.55,
          }}
        >
          Sin conversación de WhatsApp conectada todavía.<br />
          Cuando el cliente escriba al número del CRM, el hilo aparecerá acá.
        </div>
      ) : (
        <>
          {/* Hilo */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              maxHeight: 360, overflowY: "auto", display: "flex",
              flexDirection: "column", gap: 8, padding: "4px 2px",
            }}
          >
            {thread.map((m) => {
              const mine = m.direction === "out";
              const failed = m.status === "failed";
              const inFlight = m.status === "pending" || m.status === "sending";
              const retryable = failed || isStuck(m);
              return (
                <div
                  key={m.key}
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: mine ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "82%", padding: "8px 12px",
                      borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                      background: mine ? outBg : inBg,
                      border: `1px solid ${failed ? "rgba(239,68,68,0.45)" : mine ? outBd : inBd}`,
                      opacity: inFlight ? 0.72 : 1,
                    }}
                  >
                    {mine && m.senderName && (
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: accentStrong, fontFamily: fontDisp, marginBottom: 3 }}>
                        {m.senderName}
                      </p>
                    )}
                    <pre
                      style={{
                        margin: 0, fontSize: 12.5, color: T.txt, fontFamily: font,
                        lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}
                    >
                      {m.content}
                    </pre>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, justifyContent: "flex-end" }}>
                      {inFlight && <Clock size={9} color={T.txt3} />}
                      {failed && <AlertTriangle size={9} color="#EF4444" />}
                      <span style={{ fontSize: 9.5, color: subC, fontFamily: font }}>
                        {failed ? "no se envió" : inFlight ? "enviando…" : fmtTime(m.at)}
                      </span>
                      {retryable && (
                        <button
                          onClick={() => handleRetry(m.outboxId)}
                          disabled={retrying === m.outboxId}
                          title={m.error || "Reenviar este mensaje"}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            padding: "1px 7px", borderRadius: 6,
                            cursor: retrying === m.outboxId ? "default" : "pointer",
                            background: "transparent", border: "1px solid rgba(239,68,68,0.4)",
                            color: "#EF4444", fontSize: 9.5, fontWeight: 700, fontFamily: font,
                            opacity: retrying === m.outboxId ? 0.5 : 1,
                          }}
                        >
                          <RefreshCw size={8} />
                          {retrying === m.outboxId ? "reintentando…" : "reintentar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer / aviso de ventana */}
          {canSend ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Responder a ${lead?.n || lead?.name || "cliente"} por WhatsApp…`}
                  rows={2}
                  maxLength={WA_MAX_LEN}
                  spellCheck={true}
                  style={{
                    flex: 1, padding: "9px 12px", borderRadius: 9,
                    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${T.border}`, color: T.txt,
                    fontSize: 13, fontFamily: font, lineHeight: 1.5,
                    outline: "none", resize: "vertical", boxSizing: "border-box",
                    transition: "border-color 0.18s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = T.borderH || T.accent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  title="Enviar (Enter)"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: draft.trim() && !sending ? T.accent : T.border,
                    border: "none",
                    color: draft.trim() && !sending ? "#041016" : T.txt3,
                    cursor: draft.trim() && !sending ? "pointer" : "default",
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9.5, color: sendError ? "#EF4444" : subC, fontFamily: font }}>
                  {sendError ? `⚠ ${sendError}` : "Enter envía · Shift+Enter salto de línea"}
                </span>
                {sending && (
                  <span style={{ fontSize: 9.5, color: T.txt3, fontFamily: font }}>Enviando…</span>
                )}
              </div>
            </div>
          ) : hasThread ? (
            <div
              style={{
                marginTop: 10, padding: "10px 12px", borderRadius: 10,
                background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.22)",
                fontSize: 11.5, color: isLight ? "#92600A" : T.amber,
                fontFamily: font, lineHeight: 1.5,
                display: "flex", alignItems: "flex-start", gap: 8,
              }}
            >
              <Lock size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>Ventana de 24h cerrada.</strong> WhatsApp solo permite texto libre
                hasta 24h después del último mensaje del cliente (regla de Meta). Para
                reabrir: envía una plantilla desde Chatwoot, o espera a que el cliente
                escriba de nuevo.
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
