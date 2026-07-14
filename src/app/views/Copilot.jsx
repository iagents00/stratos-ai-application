/**
 * app/views/Copilot.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Copilot — el asistente IA del CRM (el MISMO cerebro que el bot de Telegram
 * @Strato_sasistente_crm_bot) embebido como un chat dentro del CRM.
 *
 * El asesor conecta su Telegram una vez (código de pareo → profiles.telegram_chat_id)
 * y desde acá opera sus leads escribiéndole o dictándole por voz al asistente:
 *   - Envía  →  RPC copilot_send  →  bot_nlu_dispatch_gvintell (responde + loguea)
 *   - Lee    →  RPC get_my_copilot_activity  →  tg_bot_activity (conversación limpia)
 *   - Audio  →  Graba nota de voz (opus/media recorder + dictado en tiempo real)
 *
 * Gateado por features.copilotModule (hoy: Duke). Ver navigation.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Send, Check, ExternalLink, Sparkles, RefreshCw, Mic, Square, X, Volume2 } from "lucide-react";
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

const REC_MAX_SECS = 300; // 5 min tope
const fmtRecSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
        <G T={T} style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 13.5, color: T.txt3, fontFamily: font }}>Cargando Copilot AI…</div>
        </G>
      </div>
    );
  }

  return (
    <div style={{ padding: 0, width: "100%", height: "calc(100dvh - 56px)", minHeight: 480, display: "flex", flexDirection: "column", overflow: "hidden", background: isLight ? "#F8FAFC" : "#060A12" }}>
      {status.paired
        ? <Chat T={T} isLight={isLight} botUsername={botUsername} onUnpaired={onUnpaired} />
        : <ConnectPrompt T={T} isLight={isLight} botUsername={botUsername} manualPairing={manualPairing} onPaired={onPaired} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Chat (UI Premium + Grabación de Voz / Dictado)                             */
/* ─────────────────────────────────────────────────────────────────────────── */
function Chat({ T, isLight, botUsername, onUnpaired }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [errBanner, setErrBanner] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);

  // Estados para grabación de audios / notas de voz
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [pendingVoiceBlob, setPendingVoiceBlob] = useState(null);
  const [pendingVoiceUrl, setPendingVoiceUrl] = useState(null);
  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const recordTimerRef = useRef(null);

  const reload = useCallback(async () => {
    const r = await getCopilotActivity(60);
    if (!mountedRef.current) return;
    setMessages([...(r.messages || [])].reverse());
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    getCopilotActivity(60).then((r) => {
      if (!mountedRef.current) return;
      setMessages([...(r.messages || [])].reverse());
      setLoading(false);
    });
    return () => {
      mountedRef.current = false;
      const session = recorderRef.current;
      recorderRef.current = null;
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      try { session?.cancel(); } catch { /* noop */ }
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, recording, pendingVoiceBlob]);

  useEffect(() => {
    if (!pendingVoiceBlob) { setPendingVoiceUrl(null); return; }
    const url = URL.createObjectURL(pendingVoiceBlob);
    setPendingVoiceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingVoiceBlob]);

  const send = async (raw, isVoice = false, voiceUrl = null) => {
    const text = (raw ?? "").trim();
    if (!text && !isVoice) return;
    if (sending) return;
    setErrBanner(null);
    setInput("");
    setVoiceTranscript("");
    setPendingVoiceBlob(null);

    const tmpId = `tmp-${Date.now()}`;
    const displayContent = isVoice ? (text ? `🎙️ [Nota de voz] ${text}` : `🎙️ Nota de voz enviada`) : text;
    const payloadText = text || (isVoice ? "Te envío esta nota de voz. ¿Me puedes resumir qué tengo hoy en agenda o darme asistencia con mis clientes?" : "");

    setMessages((prev) => [...prev, { id: tmpId, role: "user", content: displayContent, occurred_at: new Date().toISOString(), pending: true, isVoice, voiceUrl }]);
    setSending(true);
    const r = await sendCopilotMessage(payloadText);
    setSending(false);
    if (r.error === "not_paired") { onUnpaired(); return; }
    if (r.error) {
      setErrBanner("No se pudo enviar. Probá de nuevo.");
      reload();
      inputRef.current?.focus();
      return;
    }
    await reload();
    inputRef.current?.focus();
  };

  /* ── Grabador de audios + dictado por voz ── */
  const stopRecTracks = (rec) => {
    try { rec?.stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* noop */ }
  };

  const finishRecording = useCallback(() => {
    const session = recorderRef.current;
    recorderRef.current = null;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecording(false);
    setRecordSecs(0);
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    try { session?.finish(); } catch { /* noop */ }
  }, []);

  const cancelRecording = useCallback(() => {
    const session = recorderRef.current;
    recorderRef.current = null;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecording(false);
    setRecordSecs(0);
    setVoiceTranscript("");
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    try { session?.cancel(); } catch { /* noop */ }
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || sending) return;
    setErrBanner(null);
    setVoiceTranscript("");

    // 1. Iniciar dictado en vivo del navegador si está soportado (transcripción instantánea en español)
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recSpeech = new SpeechRec();
        recSpeech.lang = "es-MX";
        recSpeech.continuous = true;
        recSpeech.interimResults = true;
        recSpeech.onresult = (e) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) {
            t += e.results[i][0].transcript;
          }
          if (mountedRef.current) setVoiceTranscript(t);
        };
        recSpeech.start();
        recognitionRef.current = recSpeech;
      } catch { /* noop */ }
    }

    // 2. Grabar audio con MediaRecorder / micrófono del celular
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrBanner("Sin permiso de micrófono — activá el acceso en la barra del navegador.");
      return;
    }
    if (!mountedRef.current) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      return;
    }

    const REC_MIME_CANDIDATES = ["audio/mp4", "audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
    const mime = (window.MediaRecorder && REC_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))) || "";
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setErrBanner("Tu navegador no soporta la grabación de audio.");
      return;
    }

    const chunks = [];
    let cancelled = false;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      stopRecTracks(rec);
      if (cancelled || chunks.length === 0) return;
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      if (mountedRef.current) {
        setPendingVoiceBlob(blob);
      }
    };

    recorderRef.current = {
      finish: () => { try { if (rec.state !== "inactive") rec.stop(); } catch { /* noop */ } },
      cancel: () => {
        cancelled = true;
        try { if (rec.state !== "inactive") rec.stop(); } catch { /* noop */ }
        stopRecTracks(rec);
      },
    };

    setRecording(true);
    setRecordSecs(0);
    rec.start(250);
    recordTimerRef.current = setInterval(() => {
      setRecordSecs((s) => {
        const next = s + 1;
        if (next >= REC_MAX_SECS) queueMicrotask(finishRecording);
        return next;
      });
    }, 1000);
  }, [recording, sending, finishRecording]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const bubbleUserBg = isLight ? "linear-gradient(135deg, #0D9A76 0%, #067A5E 100%)" : "linear-gradient(135deg, #6EE7C2 0%, #34D399 100%)";
  const bubbleUserTxt = isLight ? "#FFFFFF" : "#041016";
  const bubbleAiBg = isLight ? "rgba(255,255,255,0.85)" : "rgba(18,24,38,0.78)";
  const bubbleAiBd = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.09)";

  return (
    <div style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, width: "100%", height: "100%", overflow: "hidden", background: isLight ? "#F8FAFC" : "#060A12" }}>
      {/* Header Premium */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: isLight ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)" : "linear-gradient(180deg, rgba(16,22,36,0.98) 0%, rgba(10,15,26,0.95) 100%)", borderBottom: `1px solid ${T.border}`, flexShrink: 0, backdropFilter: "blur(12px)", zIndex: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, background: isLight ? "linear-gradient(135deg, #E8F8F4 0%, #D1F2E8 100%)" : "linear-gradient(135deg, rgba(110,231,194,0.18) 0%, rgba(52,211,153,0.10) 100%)", border: `1px solid ${T.accent}3D`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 14px ${T.accent}20`
        }}>
          <Bot size={22} color={T.accent} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", color: T.txt, fontFamily: fontDisp }}>Copilot AI</h2>
            <Pill color={T.accent} isLight={isLight}>Cerebro Conectado</Pill>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.txt2, fontFamily: font }}>Asistente operativo del CRM · Podés escribirle o dictarle por voz</p>
        </div>
        <button
          type="button" onClick={reload} title="Refrescar conversación"
          style={{ width: 34, height: 34, borderRadius: 10, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, color: T.txt2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.16s" }}
        >
          <RefreshCw size={15} strokeWidth={2} />
        </button>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12, background: isLight ? "#F8FAFC" : "rgba(6,9,16,0.5)" }}>
        {loading ? (
          <div style={{ margin: "auto", color: T.txt3, fontSize: 13, fontFamily: font }}>Cargando actividad del asistente…</div>
        ) : messages.length === 0 ? (
          <EmptyState T={T} isLight={isLight} onPick={send} />
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} T={T} isLight={isLight} userBg={bubbleUserBg} userTxt={bubbleUserTxt} aiBg={bubbleAiBg} aiBd={bubbleAiBd} />)
        )}
        {sending && <Typing T={T} aiBg={bubbleAiBg} aiBd={bubbleAiBd} />}
      </div>

      {/* Sugerencias rápidas */}
      {!loading && !recording && !pendingVoiceBlob && (
        <div style={{ display: "flex", gap: 8, padding: "8px 20px 10px", flexWrap: "wrap", flexShrink: 0, background: isLight ? "#F8FAFC" : "rgba(6,9,16,0.5)" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text} type="button" onClick={() => send(s.text)} disabled={sending}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999,
                background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)", border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.14)"}`,
                color: T.txt2, fontSize: 12, fontFamily: font, cursor: sending ? "default" : "pointer", transition: "all .16s", boxShadow: isLight ? "0 2px 6px rgba(15,23,42,0.04)" : "none"
              }}
            >
              <Sparkles size={12} color={T.accent} /> {s.label}
            </button>
          ))}
        </div>
      )}

      {errBanner && (
        <div style={{ margin: "0 20px 8px", padding: "10px 14px", borderRadius: 10, fontSize: 12.5, background: isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.10)", border: `1px solid ${isLight ? "rgba(225,29,72,0.28)" : "rgba(248,113,113,0.28)"}`, color: isLight ? "#B91C3A" : "#FCA5A5", fontFamily: font }}>
          {errBanner}
        </div>
      )}

      {/* Audio Pendiente de Envío */}
      {pendingVoiceBlob && !recording && (
        <div style={{ margin: "0 20px 8px", padding: "12px 16px", borderRadius: 14, background: isLight ? "rgba(13,154,118,0.08)" : "rgba(110,231,194,0.08)", border: `1px solid ${T.accent}40`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <Volume2 size={18} color={T.accent} />
          {pendingVoiceUrl && <audio controls src={pendingVoiceUrl} style={{ flex: 1, minWidth: 0, height: 34 }} />}
          {voiceTranscript && (
            <span style={{ fontSize: 12, color: T.txt, fontFamily: font, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
              "{voiceTranscript}"
            </span>
          )}
          <button onClick={() => { setPendingVoiceBlob(null); setVoiceTranscript(""); }} title="Descartar audio" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={16} color={T.txt3} />
          </button>
          <button
            onClick={() => send(voiceTranscript || "mis clientes", true, pendingVoiceUrl)}
            style={{ padding: "7px 16px", borderRadius: 10, border: "none", background: T.accent, color: isLight ? "#FFF" : "#041016", fontSize: 12.5, fontWeight: 600, fontFamily: fontDisp, cursor: "pointer" }}
          >
            Enviar Audio
          </button>
        </div>
      )}

      {/* Barra de Grabación en Curso */}
      {recording && (
        <div style={{ margin: "0 20px 8px", padding: "12px 16px", borderRadius: 14, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", flexShrink: 0, animation: "pulse 1.2s ease-in-out infinite" }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: isLight ? "#B91C1C" : "#FCA5A5", fontFamily: fontDisp }}>
            Grabando voz · {fmtRecSecs(recordSecs)}
            {voiceTranscript && <span style={{ fontWeight: 400, opacity: 0.9, marginLeft: 8, fontSize: 12 }}>({voiceTranscript})</span>}
          </span>
          <button onClick={cancelRecording} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 8, cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, fontSize: 11.5, fontFamily: font }}>
            <X size={12} /> Cancelar
          </button>
          <button onClick={finishRecording} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 8, cursor: "pointer", border: "none", background: "#EF4444", color: "#FFF", fontSize: 12, fontWeight: 600, fontFamily: fontDisp }}>
            <Square size={11} /> Listo
          </button>
        </div>
      )}

      {/* Composer estilo Apple / iOS */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: "14px 20px 16px", background: isLight ? "#FFFFFF" : "rgba(10,15,26,0.92)", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <textarea
          ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Escribile o dictale al asistente… (ej: ¿qué agenda tengo hoy?)" rows={1} disabled={sending || recording}
          style={{
            flex: 1, resize: "none", maxHeight: 120, minHeight: 44, padding: "11px 16px", borderRadius: 14,
            background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.05)", border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.10)"}`,
            color: T.txt, fontSize: 14, fontFamily: font, lineHeight: 1.45, outline: "none", transition: "border-color 0.18s"
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.10)"; }}
        />
        <button
          type="button" onClick={recording ? finishRecording : startRecording} disabled={sending}
          title={recording ? "Terminar grabación" : "Grabar audio para Copilot"}
          style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0, border: `1px solid ${recording ? "rgba(239,68,68,0.5)" : T.border}`,
            background: recording ? "rgba(239,68,68,0.16)" : (isLight ? "#F1F5F9" : "rgba(255,255,255,0.05)"),
            color: recording ? "#EF4444" : T.txt2, cursor: sending ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s"
          }}
        >
          <Mic size={19} strokeWidth={2.1} />
        </button>
        <button
          type="button" onClick={() => send(input)} disabled={sending || (!input.trim() && !pendingVoiceBlob)}
          style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0, border: "none",
            background: (sending || (!input.trim() && !pendingVoiceBlob)) ? (isLight ? "#E2E8F0" : "rgba(255,255,255,0.1)") : T.accent,
            color: (sending || (!input.trim() && !pendingVoiceBlob)) ? T.txt3 : (isLight ? "#FFF" : "#041016"),
            cursor: (sending || (!input.trim() && !pendingVoiceBlob)) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: (sending || (!input.trim() && !pendingVoiceBlob)) ? "none" : `0 4px 16px ${T.accent}45`, transition: "all .18s"
          }}
        >
          <Send size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Footer conexión */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "10px 24px", background: isLight ? "#FFFFFF" : "rgba(10,15,26,0.92)", flexShrink: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.txt3, fontFamily: font }}>
          <Check size={12} color={T.accent} strokeWidth={2.6} /> Conectado a @{botUsername}
        </span>
        {botUsername && (
          <button type="button" onClick={() => window.open(`https://t.me/${botUsername}`, "_blank", "noopener,noreferrer")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: T.txt2, fontSize: 11.5, cursor: "pointer", fontFamily: font }}>
            <ExternalLink size={12} /> Telegram App
          </button>
        )}
        <UnpairBtn T={T} onUnpaired={onUnpaired} />
      </div>
    </div>
  );
}

function Bubble({ m, T, isLight, userBg, userTxt, aiBg, aiBd }) {
  const isUser = m.role === "user";
  const time = m.occurred_at
    ? new Date(m.occurred_at).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: 10, background: `${T.accent}18`, border: `1px solid ${T.accent}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
          <Bot size={16} color={T.accent} strokeWidth={2} />
        </div>
      )}
      <div style={{
        maxWidth: "80%", padding: "11px 15px", borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16, borderBottomLeftRadius: isUser ? 16 : 4,
        background: isUser ? userBg : aiBg, border: isUser ? "none" : `1px solid ${aiBd}`,
        color: isUser ? userTxt : T.txt, fontSize: 13.8, lineHeight: 1.55, fontFamily: font,
        whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: m.pending ? 0.75 : 1,
        boxShadow: isLight ? (isUser ? `0 4px 14px ${T.accent}35` : "0 2px 8px rgba(15,23,42,0.04)") : "0 4px 12px rgba(0,0,0,0.2)"
      }}>
        {m.content}
        {time && (
          <span style={{ display: "block", marginTop: 5, fontSize: 10.5, opacity: 0.65, textAlign: "right" }}>{time}</span>
        )}
      </div>
    </div>
  );
}

function Typing({ T, aiBg, aiBd }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, alignItems: "flex-end" }}>
      <div style={{ width: 30, height: 30, borderRadius: 10, background: `${T.accent}18`, border: `1px solid ${T.accent}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
        <Bot size={16} color={T.accent} strokeWidth={2} />
      </div>
      <div style={{ padding: "13px 18px", borderRadius: 16, borderBottomLeftRadius: 4, background: aiBg, border: `1px solid ${aiBd}`, display: "flex", gap: 6, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, display: "inline-block", animation: `copilotBlink 1.2s ${i * 0.18}s infinite ease-in-out` }} />
        ))}
      </div>
      <style>{`@keyframes copilotBlink { 0%,80%,100%{opacity:.25;transform:translateY(0)} 40%{opacity:1;transform:translateY(-3px)} }`}</style>
    </div>
  );
}

function EmptyState({ T, isLight, onPick }) {
  return (
    <div style={{ margin: "auto", textAlign: "center", maxWidth: 420, padding: 16 }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto 16px", background: isLight ? "linear-gradient(135deg, #E8F8F4 0%, #D1F2E8 100%)" : "linear-gradient(135deg, rgba(110,231,194,0.18) 0%, rgba(52,211,153,0.10) 100%)", border: `1px solid ${T.accent}3D`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${T.accent}25` }}>
        <Bot size={30} color={T.accent} strokeWidth={1.8} />
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>Tu Asistente Operativo del CRM</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13.5, color: T.txt3, lineHeight: 1.55, fontFamily: font }}>
        Escribile o tocá el micrófono 🎙️ para dictarle por voz. Pedile tus clientes del día, tu agenda, métricas, o buscá a alguien por su nombre.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {SUGGESTIONS.map((s) => (
          <button key={s.text} type="button" onClick={() => onPick(s.text)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: 999, background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)", border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.14)"}`, color: T.txt2, fontSize: 13, fontFamily: font, cursor: "pointer", transition: "all .16s" }}>
            <Sparkles size={13} color={T.accent} /> {s.label}
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
      style={{ background: "none", border: "none", color: T.txt3, fontSize: 11.5, cursor: busy ? "default" : "pointer", fontFamily: font, opacity: 0.85 }}>
      {busy ? "Desconectando…" : "Desconectar"}
    </button>
  );
}

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
    <div style={{ margin: "auto", width: "100%", maxWidth: 480 }}>
      <G T={T} style={{ padding: 32, textAlign: "center", borderRadius: 20, boxShadow: isLight ? "0 12px 40px rgba(15,23,42,0.08)" : "0 16px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, margin: "0 auto 18px", background: isLight ? "linear-gradient(135deg, #E8F8F4 0%, #D1F2E8 100%)" : "linear-gradient(135deg, rgba(110,231,194,0.18) 0%, rgba(52,211,153,0.10) 100%)", border: `1px solid ${T.accent}3D`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${T.accent}25` }}>
          <Bot size={30} color={T.accent} strokeWidth={1.8} />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>Activá tu Copilot AI</h2>
        <p style={{ margin: "0 0 24px", fontSize: 13.8, color: T.txt2, lineHeight: 1.55, fontFamily: font }}>
          Conectá tu Telegram una sola vez y tendrás a tu asistente operativo del CRM en esta pantalla para chatear o dictarle notas de voz.
        </p>

        {!code ? (
          <>
            {!deepLinkMode && (
              <div style={{ textAlign: "left", margin: "0 auto 20px", maxWidth: 360, fontSize: 13, color: T.txt3, display: "flex", flexDirection: "column", gap: 6, fontFamily: font }}>
                <span>1. Buscá en Telegram <strong style={{ color: T.txt2 }}>@{botName}</strong> y tocá <strong>/start</strong></span>
                <span>2. Tocá "Generar código" aquí abajo</span>
                <span>3. Mandale el código al bot</span>
              </div>
            )}
            <button type="button" onClick={connect} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 28px", borderRadius: 14, background: busy ? `${T.accent}44` : T.accent, border: "none", color: isLight ? "#FFF" : "#041016", fontSize: 15, fontWeight: 600, fontFamily: fontDisp, cursor: busy ? "default" : "pointer", boxShadow: `0 6px 20px ${T.accent}40` }}>
              {busy ? "Conectando…" : (deepLinkMode ? "Conectar mi Telegram" : "Generar código")}
              {!busy && <ExternalLink size={16} strokeWidth={2.2} />}
            </button>
          </>
        ) : (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: T.txt3, fontFamily: fontDisp }}>Tu código de activación</p>
            <div style={{ padding: "20px 24px", background: `${T.accent}0E`, border: `1px solid ${T.accent}33`, borderRadius: 16, fontSize: "clamp(28px,8vw,40px)", fontWeight: 400, letterSpacing: "0.12em", fontFamily: fontDisp, color: T.txt, fontVariantNumeric: "tabular-nums", marginBottom: 16, boxShadow: `0 4px 16px ${T.accent}15` }}>{code}</div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: T.txt2, fontFamily: font }}>Abrí <strong>@{botName}</strong> en Telegram y enviá:</p>
            <code style={{ display: "block", padding: "12px 14px", background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14.5, fontFamily: "ui-monospace, SF Mono, Menlo, monospace", color: T.txt }}>/conectar {code}</code>
            {botUsername && (
              <button type="button" onClick={() => window.open(`https://t.me/${botUsername}?start=${code}`, "_blank", "noopener,noreferrer")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 16px", borderRadius: 12, background: "transparent", border: `1px solid ${T.accent}40`, color: T.txt, fontSize: 13, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer" }}>
                <Send size={14} strokeWidth={2.2} /> Abrir el bot en Telegram
              </button>
            )}
            <p style={{ margin: "14px 0 0", fontSize: 11.5, color: T.txt3, fontFamily: font }}>Esta pantalla se activará sola en cuanto el bot reciba el código.</p>
          </div>
        )}

        {err && (
          <div style={{ marginTop: 18, padding: "12px 14px", background: isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.10)", border: `1px solid ${isLight ? "rgba(225,29,72,0.28)" : "rgba(248,113,113,0.28)"}`, borderRadius: 12, fontSize: 12.5, color: isLight ? "#B91C3A" : "#FCA5A5", fontFamily: font }}>{err}</div>
        )}
      </G>
    </div>
  );
}
