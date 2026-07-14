/**
 * app/views/Copilot.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Copilot — el asistente IA del CRM (el MISMO cerebro que el bot de Telegram
 * @Strato_sasistente_crm_bot) embebido como un chat dentro del CRM.
 *
 * El asesor conecta su Telegram una vez (código de pareo → profiles.telegram_chat_id)
 * y desde acá opera sus leads escribiéndole al asistente, igual que por Telegram:
 *   - Envía  →  RPC copilot_send  →  bot_nlu_dispatch_gvintell (responde + loguea)
 *   - Lee    →  RPC get_my_copilot_activity  →  tg_bot_activity (conversación limpia)
 *
 * Gateado por features.copilotModule (hoy: Duke). Ver navigation.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Send, Check, ExternalLink, Sparkles, RefreshCw } from "lucide-react";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G, Pill } from "../SharedComponents";
import { useClient } from "../../hooks/useClient";
import {
  getPairingStatus, requestPairingCode, unpairTelegram,
  getCopilotActivity, sendCopilotMessage,
} from "../../lib/telegram";

// Atajos rápidos (mismos comandos deterministas del bot)
const SUGGESTIONS = [
  { label: "Mis clientes", text: "mis clientes" },
  { label: "Qué tengo hoy", text: "agenda" },
  { label: "Cómo voy", text: "kpis" },
  { label: "Pipeline", text: "pipeline" },
  { label: "Menú", text: "menu" },
];

export default function Copilot({ theme = "dark", T: Tprop, isLight: isLightProp }) {
  const isLight = isLightProp != null ? isLightProp : theme === "light";
  const T = Tprop || (isLight ? LP : P);
  const { config: clientConfig } = useClient();
  const botUsername = clientConfig?.tenant?.botUsername || "Strato_sasistente_crm_bot";
  const manualPairing = !!clientConfig?.tenant?.telegramManualPairing;

  const [status, setStatus] = useState({ loading: true, paired: false, pairedAt: null });

  useEffect(() => {
    let mounted = true;
    getPairingStatus().then((r) => {
      if (!mounted) return;
      setStatus({ loading: false, paired: r.paired, pairedAt: r.pairedAt });
    });
    return () => { mounted = false; };
  }, []);

  const onPaired = (pairedAt) => setStatus({ loading: false, paired: true, pairedAt });
  const onUnpaired = () => setStatus({ loading: false, paired: false, pairedAt: null });

  if (status.loading) {
    return (
      <div style={{ padding: 24 }}>
        <G T={T} style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: T.txt3 }}>Cargando Copilot…</div>
        </G>
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 18px 10px", height: "calc(100dvh - 118px)", minHeight: 460, display: "flex", flexDirection: "column" }}>
      {status.paired
        ? <Chat T={T} isLight={isLight} botUsername={botUsername} onUnpaired={onUnpaired} />
        : <ConnectPrompt T={T} isLight={isLight} botUsername={botUsername} manualPairing={manualPairing} onPaired={onPaired} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Chat                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
function Chat({ T, isLight, botUsername, onUnpaired }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [errBanner, setErrBanner] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const reload = useCallback(async () => {
    const r = await getCopilotActivity(60);
    // RPC devuelve más reciente primero → invertir para orden cronológico
    setMessages([...(r.messages || [])].reverse());
    setLoading(false);
  }, []);

  // Carga inicial — setState dentro del callback (no en el cuerpo del effect)
  useEffect(() => {
    let mounted = true;
    getCopilotActivity(60).then((r) => {
      if (!mounted) return;
      setMessages([...(r.messages || [])].reverse());
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  // Auto-scroll al final cuando cambian los mensajes o el estado de "escribiendo"
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async (raw) => {
    const text = (raw ?? "").trim();
    if (!text || sending) return;
    setErrBanner(null);
    setInput("");
    // Optimista: pinta el mensaje del usuario ya mismo
    const tmpId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tmpId, role: "user", content: text, occurred_at: new Date().toISOString(), pending: true }]);
    setSending(true);
    const r = await sendCopilotMessage(text);
    setSending(false);
    if (r.error === "not_paired") { onUnpaired(); return; }
    if (r.error) {
      setErrBanner("No se pudo enviar. Probá de nuevo.");
      // deja el mensaje optimista marcado; recarga por si acaso
      reload();
      inputRef.current?.focus();
      return;
    }
    // El RPC ya logueó user+ai → recargamos la conversación canónica
    await reload();
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const bubbleUserBg = T.accent;
  const bubbleAiBg = isLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.055)";
  const bubbleAiBd = isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)";

  return (
    <G T={T} style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: `${T.accent}16`, border: `1px solid ${T.accent}2E`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Bot size={19} color={T.accent} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em", color: T.txt, fontFamily: fontDisp }}>Copilot</h2>
            <Pill color={T.accent} isLight={isLight}>Conectado</Pill>
          </div>
          <p style={{ margin: "1px 0 0", fontSize: 11.5, color: T.txt3 }}>Tu asistente del CRM · pedile lo mismo que al bot de Telegram</p>
        </div>
        <button
          type="button" onClick={reload} title="Refrescar"
          style={{ width: 32, height: 32, borderRadius: 9, background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <RefreshCw size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ margin: "auto", color: T.txt3, fontSize: 13 }}>Cargando conversación…</div>
        ) : messages.length === 0 ? (
          <EmptyState T={T} isLight={isLight} onPick={send} />
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} T={T} userBg={bubbleUserBg} aiBg={bubbleAiBg} aiBd={bubbleAiBd} />)
        )}
        {sending && <Typing T={T} aiBg={bubbleAiBg} aiBd={bubbleAiBd} />}
      </div>

      {/* Sugerencias */}
      {!loading && (
        <div style={{ display: "flex", gap: 8, padding: "0 18px 10px", flexWrap: "wrap", flexShrink: 0 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text} type="button" onClick={() => send(s.text)} disabled={sending}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999,
                background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
                color: T.txt2, fontSize: 12, fontFamily: font, cursor: sending ? "default" : "pointer", transition: "all .15s",
              }}
            >
              <Sparkles size={11} color={T.accent} /> {s.label}
            </button>
          ))}
        </div>
      )}

      {errBanner && (
        <div style={{ margin: "0 18px 8px", padding: "8px 12px", borderRadius: 9, fontSize: 12, background: isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${isLight ? "rgba(225,29,72,0.28)" : "rgba(248,113,113,0.22)"}`, color: isLight ? "#B91C3A" : "#FCA5A5" }}>
          {errBanner}
        </div>
      )}

      {/* Composer */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: "12px 18px 14px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <textarea
          ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Escribile al asistente…  (ej: mis clientes de hoy)" rows={1} disabled={sending}
          style={{
            flex: 1, resize: "none", maxHeight: 120, minHeight: 24, padding: "10px 14px", borderRadius: 12,
            background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
            color: T.txt, fontSize: 14, fontFamily: font, lineHeight: 1.4, outline: "none",
          }}
        />
        <button
          type="button" onClick={() => send(input)} disabled={sending || !input.trim()}
          style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, border: "none",
            background: (sending || !input.trim()) ? `${T.accent}44` : T.accent, color: "#FFFFFF",
            cursor: (sending || !input.trim()) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: (sending || !input.trim()) ? "none" : `0 4px 14px ${T.accent}55`, transition: "all .18s",
          }}
        >
          <Send size={18} strokeWidth={2.1} />
        </button>
      </div>

      {/* Footer conexión */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 18px 12px", flexShrink: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: T.txt3 }}>
          <Check size={11} color={T.accent} strokeWidth={2.6} /> Conectado a Telegram
        </span>
        {botUsername && (
          <button type="button" onClick={() => window.open(`https://t.me/${botUsername}`, "_blank", "noopener,noreferrer")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: T.txt3, fontSize: 11, cursor: "pointer", fontFamily: font }}>
            <ExternalLink size={11} /> Abrir en Telegram
          </button>
        )}
        <UnpairBtn T={T} onUnpaired={onUnpaired} />
      </div>
    </G>
  );
}

function Bubble({ m, T, userBg, aiBg, aiBd }) {
  const isUser = m.role === "user";
  const time = m.occurred_at
    ? new Date(m.occurred_at).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "82%", padding: "9px 13px", borderRadius: 14,
        borderBottomRightRadius: isUser ? 4 : 14, borderBottomLeftRadius: isUser ? 14 : 4,
        background: isUser ? userBg : aiBg, border: isUser ? "none" : `1px solid ${aiBd}`,
        color: isUser ? "#FFFFFF" : T.txt, fontSize: 13.5, lineHeight: 1.5, fontFamily: font,
        whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: m.pending ? 0.72 : 1,
      }}>
        {m.content}
        {time && (
          <span style={{ display: "block", marginTop: 4, fontSize: 10, opacity: 0.6, textAlign: "right" }}>{time}</span>
        )}
      </div>
    </div>
  );
}

function Typing({ T, aiBg, aiBd }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{ padding: "11px 15px", borderRadius: 14, borderBottomLeftRadius: 4, background: aiBg, border: `1px solid ${aiBd}`, display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.txt3, display: "inline-block", animation: `copilotBlink 1.2s ${i * 0.18}s infinite ease-in-out` }} />
        ))}
      </div>
      <style>{`@keyframes copilotBlink { 0%,80%,100%{opacity:.25;transform:translateY(0)} 40%{opacity:1;transform:translateY(-2px)} }`}</style>
    </div>
  );
}

function EmptyState({ T, isLight, onPick }) {
  return (
    <div style={{ margin: "auto", textAlign: "center", maxWidth: 380, padding: 12 }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, margin: "0 auto 14px", background: `${T.accent}14`, border: `1px solid ${T.accent}2A`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bot size={26} color={T.accent} strokeWidth={1.7} />
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>Hablá con tu Copilot</h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: T.txt3, lineHeight: 1.55 }}>
        Es tu asistente del CRM. Pedile tus clientes, tu agenda, tus números, o buscá a alguien — lo mismo que le pedís al bot de Telegram.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {SUGGESTIONS.map((s) => (
          <button key={s.text} type="button" onClick={() => onPick(s.text)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, color: T.txt2, fontSize: 12.5, fontFamily: font, cursor: "pointer" }}>
            <Sparkles size={12} color={T.accent} /> {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UnpairBtn({ T, onUnpaired }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (!confirm("¿Desconectar tu Telegram del asistente?\nDejarás de poder usar el Copilot y el bot hasta reconectar.")) return;
    setBusy(true);
    const r = await unpairTelegram();
    setBusy(false);
    if (!r.error) onUnpaired();
  };
  return (
    <button type="button" onClick={handle} disabled={busy}
      style={{ background: "none", border: "none", color: T.txt3, fontSize: 11, cursor: busy ? "default" : "pointer", fontFamily: font, opacity: 0.8 }}>
      {busy ? "Desconectando…" : "Desconectar"}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Conectar (si el asesor aún no vinculó su Telegram)                          */
/* ─────────────────────────────────────────────────────────────────────────── */
function ConnectPrompt({ T, isLight, botUsername, manualPairing, onPaired }) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(null);
  const [err, setErr] = useState(null);
  const pollRef = useRef(null);
  const deepLinkMode = !!botUsername && !manualPairing;
  const botName = botUsername || "Strato_sasistente_crm_bot";

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (document.hidden) return;
    pollRef.current = setInterval(async () => {
      const r = await getPairingStatus();
      if (r.paired) { clearInterval(pollRef.current); pollRef.current = null; onPaired(r.pairedAt); }
    }, 4000);
  };

  const connect = async () => {
    setBusy(true); setErr(null);
    const r = await requestPairingCode();
    setBusy(false);
    if (r.error || !r.code) { setErr("No se pudo generar el código. Probá en un minuto."); return; }
    if (deepLinkMode) window.open(`https://t.me/${botUsername}?start=${r.code}`, "_blank", "noopener,noreferrer");
    setCode(r.code);
    startPoll();
  };

  return (
    <div style={{ margin: "auto", width: "100%", maxWidth: 460 }}>
      <G T={T} style={{ padding: 28, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px", background: `${T.accent}14`, border: `1px solid ${T.accent}2A`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot size={28} color={T.accent} strokeWidth={1.7} />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>Activá tu Copilot</h2>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: T.txt2, lineHeight: 1.55 }}>
          Conectá tu Telegram una sola vez y tendrás a tu asistente del CRM acá mismo: tus clientes, tu agenda, tus números y más — chateando.
        </p>

        {!code ? (
          <>
            {!deepLinkMode && (
              <div style={{ textAlign: "left", margin: "0 auto 18px", maxWidth: 340, fontSize: 12.5, color: T.txt3, display: "flex", flexDirection: "column", gap: 5 }}>
                <span>1. Buscá en Telegram <strong style={{ color: T.txt2 }}>@{botName}</strong> y tocá <strong>/start</strong></span>
                <span>2. Tocá "Generar código" aquí abajo</span>
                <span>3. Mandale el código al bot</span>
              </div>
            )}
            <button type="button" onClick={connect} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 24px", borderRadius: 12, background: busy ? `${T.accent}44` : T.accent, border: "none", color: "#FFFFFF", fontSize: 14.5, fontWeight: 500, fontFamily: fontDisp, cursor: busy ? "default" : "pointer", boxShadow: `0 4px 16px ${T.accent}55` }}>
              {busy ? "Abriendo…" : (deepLinkMode ? "Conectar mi Telegram" : "Generar código")}
              {!busy && <ExternalLink size={15} strokeWidth={2.2} />}
            </button>
          </>
        ) : (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: T.txt3, fontFamily: fontDisp }}>Tu código</p>
            <div style={{ padding: "18px 20px", background: `${T.accent}0A`, border: `1px solid ${T.accent}2E`, borderRadius: 14, fontSize: "clamp(26px,8vw,38px)", fontWeight: 300, letterSpacing: "0.10em", fontFamily: fontDisp, color: T.txt, fontVariantNumeric: "tabular-nums", marginBottom: 14 }}>{code}</div>
            <p style={{ margin: "0 0 8px", fontSize: 12.5, color: T.txt2 }}>Abrí <strong>@{botName}</strong> en Telegram y enviá:</p>
            <code style={{ display: "block", padding: "10px 12px", background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, fontFamily: "ui-monospace, SF Mono, Menlo, monospace", color: T.txt }}>/conectar {code}</code>
            {botUsername && (
              <button type="button" onClick={() => window.open(`https://t.me/${botUsername}?start=${code}`, "_blank", "noopener,noreferrer")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, padding: "9px 14px", borderRadius: 11, background: "transparent", border: `1px solid ${T.accent}40`, color: T.txt, fontSize: 12.5, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer" }}>
                <Send size={13} strokeWidth={2.2} /> Abrir el bot en Telegram
              </button>
            )}
            <p style={{ margin: "12px 0 0", fontSize: 11, color: T.txt3 }}>Esta pantalla se activa sola cuando el bot reciba el código.</p>
          </div>
        )}

        {err && (
          <div style={{ marginTop: 16, padding: "10px 12px", background: isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${isLight ? "rgba(225,29,72,0.28)" : "rgba(248,113,113,0.22)"}`, borderRadius: 10, fontSize: 12, color: isLight ? "#B91C3A" : "#FCA5A5" }}>{err}</div>
        )}
      </G>
    </div>
  );
}
