/**
 * app/views/Copilot.jsx — v2 (15-jul)
 * ─────────────────────────────────────────────────────────────────────────────
 * Copilot — el asistente IA del CRM, mismo cerebro que el bot de Telegram
 * @Strato_sasistente_crm_bot, con UI rediseñada para igualar WhatsApp:
 * chat a pantalla completa, header compacto, área de mensajes expansiva,
 * composer minimalista abajo.
 *
 * Estrategia híbrida de respuesta (telegram.js):
 *   1. copilot_send (RPC stratos-prod) → rápido, determinista
 *   2. Webhook n8n (GPT-4o) → respuesta directa del body
 *   3. Polling getCopilotActivity → red de seguridad
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Sparkles, RefreshCw, Mic, Square, X, ChevronDown, ChevronUp, ChevronLeft, Bot, BookOpen, Play, Pause, Bell, Camera } from "lucide-react";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G } from "../SharedComponents";
import CopilotMark from "../components/CopilotMark";
import { useClient } from "../../hooks/useClient";
import { useAuth } from "../../hooks/useAuth";
import {
  getPairingStatus, requestPairingCode, unpairTelegram,
  getCopilotActivity, sendCopilotMessage,
} from "../../lib/telegram";
import { getPushStatus, enablePushNotifications } from "../../lib/push";
import { supabase } from "../../lib/supabase";

const SUGGESTIONS = [
  { label: "Mis clientes", text: "mis clientes" },
  { label: "Agenda", text: "agenda" },
  { label: "KPIs", text: "kpis" },
  { label: "Pipeline", text: "pipeline" },
  { label: "Guía del asistente", text: "mandame la guia del asistente" },
];

const REC_MAX_SECS = 300;
const fmtRecSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Copilot({ theme = "dark", T: Tprop, isLight: isLightProp, onBack, score }) {
  const isLight = isLightProp != null ? isLightProp : theme === "light";
  const T = Tprop || (isLight ? LP : P);
  const { config: clientConfig } = useClient();
  const { user } = useAuth();
  // Solo el equipo de marketing (rol `marketing`: Yazz, Luis, Emmanuel) adjunta evidencia
  // desde el Copilot — son quienes completan tareas. Gate 100% contenido: si es asesor,
  // el control NI SE RENDERIZA y el Copilot se comporta idéntico a hoy.
  const isMarketing = user?.role === 'marketing';
  const orgId = user?.organizationId;
  const botUsername = clientConfig?.tenant?.botUsername || "Strato_sasistente_crm_bot";
  // (manualPairing y getPairingStatus ya no se usan acá: el Copilot no espera
  //  el estado de Telegram para abrir — abre instantáneo, como WhatsApp.)
  const onUnpaired = () => {};

  // ⭐ REGLA (Ángel 2026-07-17): el Copilot NUNCA se gatea por Telegram. Apenas
  // se crea el usuario del asesor, la DB le asigna identidad sintética sola
  // (trigger `trg_assign_copilot_identity`), así que su Copilot ya funciona.
  // Conectar Telegram es OPCIONAL y vive en Perfil (para recibir los avisos ahí
  // y poder usar el asistente desde Telegram). Por eso ACÁ se renderiza SIEMPRE
  // el chat — jamás la vieja pantalla "Conecta tu Telegram para activar", que
  // parecía un muro. (`ConnectPrompt` queda en el archivo por si algún tenant
  // futuro con pairing manual lo necesita, pero no se muestra por defecto.)
  return <Chat T={T} isLight={isLight} botUsername={botUsername} onUnpaired={onUnpaired} onBack={onBack} score={score} isMarketing={isMarketing} orgId={orgId} />;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Chat — layout WhatsApp: header fino, mensajes expansivos, composer compacto */
/* ─────────────────────────────────────────────────────────────────────────── */
function Chat({ T, isLight, botUsername, onUnpaired, onBack, score, isMarketing, orgId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [errBanner, setErrBanner] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [attaching, setAttaching] = useState(false);  // subiendo evidencia (solo marketing)
  const evInputRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);  // espejo de `sending` para el reload en foco (evita pisar el envío en curso)

  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [pendingVoiceBlob, setPendingVoiceBlob] = useState(null);
  const [pendingVoiceUrl, setPendingVoiceUrl] = useState(null);
  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const recordTimerRef = useRef(null);

  // Solo los últimos 50 mensajes: el módulo carga rápido y no se sobrecarga
  // aunque el asesor haya hablado muchísimo (el historial completo vive en la DB).
  const reload = useCallback(async () => {
    const r = await getCopilotActivity(50);
    if (!mountedRef.current) return;
    setMessages([...(r.messages || [])].reverse());
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    // Sincronización entre dispositivos: si hablaste con el Copilot en el celular
    // y ahora mirás la PC (o volvés a la pestaña), refrescamos para traer lo último.
    // Función NOMBRADA + removeEventListener en cleanup (regla de performance).
    const onFocusReload = () => { if (!document.hidden && !sendingRef.current) reload(); };
    document.addEventListener('visibilitychange', onFocusReload);
    window.addEventListener('focus', onFocusReload);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onFocusReload);
      window.removeEventListener('focus', onFocusReload);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      try { recorderRef.current?.cancel(); } catch { /* noop */ }
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    };
  }, [reload]);

  useEffect(() => { sendingRef.current = sending; }, [sending]);

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

  const send = async (rawText, options = {}) => {
    const text = (rawText ?? "").trim();
    if (!text && !options.callback_data) return;
    if (sending) return;
    setErrBanner(null);
    setInput("");
    setVoiceTranscript("");
    setPendingVoiceBlob(null);

    const tmpId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tmpId, role: "user", content: text || "Acción seleccionada", occurred_at: new Date().toISOString(), pending: true }]);
    setSending(true);

    const r = await sendCopilotMessage(text, options);
    setSending(false);

    if (r.error === "not_paired") { onUnpaired(); return; }
    if (r.error) {
      setErrBanner("No se pudo enviar. Probá de nuevo.");
      return;
    }

    // Si el backend devolvió una respuesta directa, inyectarla al chat sin leer la DB
    // (la DB de stratos-prod puede tener viejos "No conozco esa acción" que taparían la respuesta real)
    if (r.reply) {
      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: r.reply,
        buttons: r.buttons || [],
        occurred_at: new Date().toISOString(),
      };
      setMessages((prev) => {
        // Marcar el mensaje del usuario como confirmado (quitar pending)
        const updated = prev.map(m => m.id === tmpId ? { ...m, pending: false } : m);
        return [...updated, aiMsg];
      });
    }
    inputRef.current?.focus();
  };

  /* ── Evidencia foto/video desde el Copilot (solo marketing) ──
     Sube al bucket "evidencia" (mismo que el módulo) y la vincula a la última
     tarea completada del propio usuario vía RPC mkt_attach_evidence (determinista,
     se resuelve por auth.uid()). Muestra una burbuja de confirmación. */
  const handlePickEvidence = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (!orgId) { setErrBanner("No pude identificar tu organización. Actualizá la página."); return; }
    if (attaching || sending) return;
    setErrBanner(null);
    setAttaching(true);
    try {
      const safe = String(file.name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = `mkt/${orgId}/copilot/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("evidencia").upload(path, file);
      if (upErr) throw upErr;
      const tipo = String(file.type || "").startsWith("video") ? "video" : "foto";
      const { data: replyText, error: rpcErr } = await supabase.rpc("mkt_attach_evidence", { p_path: path, p_tipo: tipo });
      if (rpcErr) throw rpcErr;
      setMessages((prev) => [...prev, {
        id: `ev-${Date.now()}`,
        role: "ai",
        content: (typeof replyText === "string" && replyText.trim())
          ? replyText
          : `Evidencia adjuntada (${tipo}). Suma a tu reporte.`,
        occurred_at: new Date().toISOString(),
      }]);
    } catch (err) {
      setErrBanner("No se pudo subir la evidencia. Probá de nuevo.");
    } finally {
      setAttaching(false);
      inputRef.current?.focus();
    }
  };

  /* ── Grabación de audio ── */
  const stopRecTracks = (rec) => { try { rec?.stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* noop */ } };

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

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recSpeech = new SpeechRec();
        recSpeech.lang = "es-MX";
        recSpeech.continuous = true;
        recSpeech.interimResults = true;
        recSpeech.onresult = (e) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          if (mountedRef.current) setVoiceTranscript(t);
        };
        recSpeech.start();
        recognitionRef.current = recSpeech;
      } catch { /* noop */ }
    }

    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setErrBanner("Sin permiso de micrófono."); return; }
    if (!mountedRef.current) { try { stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ } return; }

    const mime = (window.MediaRecorder && ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m))) || "";
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
    catch { stream.getTracks().forEach((t) => t.stop()); setErrBanner("Grabación no soportada."); return; }

    const chunks = [];
    let cancelled = false;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      stopRecTracks(rec);
      if (cancelled || chunks.length === 0) return;
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      if (mountedRef.current) setPendingVoiceBlob(blob);
    };

    recorderRef.current = {
      finish: () => { try { if (rec.state !== "inactive") rec.stop(); } catch { /* noop */ } },
      cancel: () => { cancelled = true; try { if (rec.state !== "inactive") rec.stop(); } catch { /* noop */ } stopRecTracks(rec); },
    };

    setRecording(true);
    setRecordSecs(0);
    rec.start(250);
    recordTimerRef.current = setInterval(() => {
      setRecordSecs((s) => { const next = s + 1; if (next >= REC_MAX_SECS) queueMicrotask(finishRecording); return next; });
    }, 1000);
  }, [recording, sending, finishRecording]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  /* ── Colores burbujas ── */
  const bubbleUserBg = isLight ? "linear-gradient(135deg, #0D9A76 0%, #067A5E 100%)" : "linear-gradient(135deg, #6EE7C2 0%, #34D399 100%)";
  const bubbleUserTxt = isLight ? "#FFFFFF" : "#041016";
  const bubbleAiBg = isLight ? "#FFFFFF" : "rgba(18,24,38,0.82)";
  const bubbleAiBd = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)";
  const bgArea = isLight ? "#F8FAFC" : "#060A12";
  const composerBg = isLight ? "#FFFFFF" : "rgba(10,15,26,0.95)";

  // El motion del avatar solo vive en la ÚLTIMA respuesta del asistente (la
  // más reciente); las burbujas anteriores quedan estáticas. Se recalcula en
  // cada render, así el movimiento "salta" solo a la burbuja nueva.
  let lastAiId = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") { lastAiId = messages[i].id; break; }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: bgArea, overflow: "hidden" }}>
      {/* ── Header compacto (estilo WhatsApp) ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexShrink: 0,
        // Header inmersivo (estilo WhatsApp): reemplaza al header de la app en
        // móvil → lleva el safe-area-top para no quedar bajo el reloj del iPhone.
        paddingTop: "calc(10px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
        background: isLight ? "#FFFFFF" : "rgba(10,15,26,0.95)",
        borderBottom: `1px solid ${T.border}`, zIndex: 10,
        boxShadow: isLight ? "0 1px 3px rgba(15,23,42,0.06)" : "0 1px 3px rgba(0,0,0,0.3)"
      }}>
        {/* Flecha "‹ volver" (solo cuando hay onBack = app móvil inmersiva).
            Blanca en oscuro, verde de marca en claro (como la referencia de
            WhatsApp que mandó Ángel). Al lado, el SCORE del asesor (badge tipo
            el "180" de WhatsApp). */}
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Volver" style={{
            display: "flex", alignItems: "center", gap: 1, padding: "4px 6px 4px 2px", marginRight: 2,
            background: "transparent", border: "none", cursor: "pointer", flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}>
            <ChevronLeft size={26} strokeWidth={2.4} color={isLight ? "#0D9A76" : "#FFFFFF"} />
            {Number.isFinite(score) && score > 0 && (
              <span title="Score de tu cartera" style={{
                fontSize: 13, fontWeight: 700, fontFamily: fontDisp, lineHeight: 1,
                color: isLight ? "#0D9A76" : "#FFFFFF", minWidth: 18, textAlign: "center",
              }}>{score}</span>
            )}
          </button>
        )}
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: isLight ? "linear-gradient(135deg, #E8F8F4 0%, #D1F2E8 100%)" : "linear-gradient(135deg, rgba(110,231,194,0.22) 0%, rgba(52,211,153,0.12) 100%)",
          border: `1px solid ${T.accent}4D`, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <CopilotMark size={22} isLight={isLight} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.txt, fontFamily: fontDisp, lineHeight: 1.2 }}>Copilot AI</div>
          <div style={{ fontSize: 11, color: T.accent, fontFamily: font, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, boxShadow: `0 0 6px ${T.accent}` }} />En línea
          </div>
        </div>
        <button type="button" onClick={reload} title="Refrescar"
          style={{ width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none", color: T.txt3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw size={14} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => setShowSuggestions(!showSuggestions)}
          style={{ width: 30, height: 30, borderRadius: 8, background: "transparent", border: "none", color: T.txt3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {showSuggestions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Banner "Activar notificaciones" (push) ── */}
      <NotifBanner T={T} isLight={isLight} />

      {/* ── Sugerencias colapsables ── */}
      {showSuggestions && (
        <div style={{ display: "flex", gap: 6, padding: "8px 16px", flexWrap: "wrap", flexShrink: 0, background: composerBg, borderBottom: `1px solid ${T.border}` }}>
          {SUGGESTIONS.map((s) => (
            <button key={s.text} type="button" onClick={() => send(s.text)} disabled={sending}
              style={{
                padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontFamily: font,
                background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.06)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)"}`,
                color: T.txt2, cursor: sending ? "default" : "pointer"
              }}>
              <Bot size={11} color={T.accent} style={{ marginRight: 4, verticalAlign: "middle" }} />{s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Mensajes (área expansiva) ── */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ margin: "auto", color: T.txt3, fontSize: 12, fontFamily: font }}>Cargando conversación…</div>
        ) : messages.length === 0 ? (
          <EmptyState T={T} isLight={isLight} onPick={send} />
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} isLast={m.id === lastAiId} T={T} isLight={isLight} userBg={bubbleUserBg} userTxt={bubbleUserTxt} aiBg={bubbleAiBg} aiBd={bubbleAiBd} onPick={send} sending={sending} />)
        )}
        {sending && <Typing T={T} isLight={isLight} aiBg={bubbleAiBg} aiBd={bubbleAiBd} />}
      </div>

      {/* ── Banner de error ── */}
      {errBanner && (
        <div style={{ margin: "0 14px 4px", padding: "8px 12px", borderRadius: 8, fontSize: 12, background: isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.10)", border: `1px solid ${isLight ? "rgba(225,29,72,0.22)" : "rgba(248,113,113,0.22)"}`, color: isLight ? "#B91C3A" : "#FCA5A5", fontFamily: font, flexShrink: 0 }}>
          {errBanner}
        </div>
      )}

      {/* ── Audio pendiente (reproductor custom, sin la caja blanca nativa) ── */}
      {pendingVoiceBlob && !recording && pendingVoiceUrl && (
        <VoiceNote
          url={pendingVoiceUrl}
          transcript={voiceTranscript}
          T={T}
          isLight={isLight}
          onDiscard={() => { setPendingVoiceBlob(null); setVoiceTranscript(""); }}
          onSend={() => send(voiceTranscript || "mis clientes")}
        />
      )}

      {/* ── Barra de grabación ── */}
      {recording && (
        <div style={{ margin: "0 14px 4px", padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0, animation: "pulse 1.2s ease-in-out infinite" }} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: isLight ? "#B91C1C" : "#FCA5A5", fontFamily: fontDisp }}>
            Grabando {fmtRecSecs(recordSecs)}
            {voiceTranscript ? <span style={{ fontWeight: 400, opacity: 0.9, marginLeft: 6, fontSize: 11 }}>({voiceTranscript})</span> : null}
          </span>
          <button onClick={cancelRecording} style={{ padding: "3px 8px", borderRadius: 6, background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, fontSize: 11, fontFamily: font, cursor: "pointer" }}><X size={10} /> Cancelar</button>
          <button onClick={finishRecording} style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#EF4444", color: "#FFF", fontSize: 11, fontWeight: 600, fontFamily: fontDisp, cursor: "pointer" }}><Square size={9} /> Listo</button>
        </div>
      )}

      {/* ── Composer compacto (estilo WhatsApp) ── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 12px calc(10px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))", background: composerBg, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        {/* Adjuntar evidencia (foto/video) — solo equipo de marketing */}
        {isMarketing && (
          <>
            <button type="button" title="Adjuntar foto o video de evidencia"
              onClick={() => evInputRef.current?.click()} disabled={attaching || sending}
              style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, border: "none", background: "transparent", color: attaching ? T.accent : T.txt3, cursor: (attaching || sending) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {attaching
                ? <RefreshCw size={17} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
                : <Camera size={18} strokeWidth={2} />}
            </button>
            <input ref={evInputRef} type="file" accept="image/*,video/*" onChange={handlePickEvidence} style={{ display: "none" }} />
          </>
        )}
        {/* Botón micrófono */}
        <button type="button" onClick={recording ? finishRecording : startRecording} disabled={sending}
          style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, border: "none", background: "transparent", color: recording ? "#EF4444" : T.txt3, cursor: sending ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mic size={18} strokeWidth={2} />
        </button>

        {/* Input */}
        <input
          ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Escríbele al asistente…" disabled={sending || recording}
          style={{
            flex: 1, minWidth: 0, height: 36, padding: "0 12px", borderRadius: 18,
            background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.10)"}`,
            color: T.txt, fontSize: 13.5, fontFamily: font, outline: "none", transition: "border-color 0.15s"
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.10)"; }}
        />

        {/* Botón enviar */}
        <button type="button" onClick={() => send(input)} disabled={sending || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0, border: "none",
            background: (sending || !input.trim()) ? "transparent" : T.accent,
            color: (sending || !input.trim()) ? T.txt3 : (isLight ? "#FFF" : "#041016"),
            cursor: (sending || !input.trim()) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s"
          }}>
          <Send size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

/* ── Burbuja de mensaje ── */
/* Convierte el texto en nodos con links clicables: markdown [label](url) y URLs sueltas.
   Así los Drive del catálogo/recomendación se abren con un toque (antes se veían crudos). */
function renderRichText(text, linkColor) {
  if (typeof text !== "string" || !text) return text;
  const rx = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  const out = [];
  let last = 0, m, key = 0;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const url = m[2] || m[3];
    const label = m[1] || m[3];
    out.push(
      <a key={`lnk${key++}`} href={url} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: linkColor || "inherit", textDecoration: "underline", fontWeight: 600, wordBreak: "break-all" }}>{label}</a>
    );
    last = rx.lastIndex;
  }
  if (last === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Bubble({ m, T, isLight, userBg, userTxt, aiBg, aiBd, onPick, sending, isLast }) {
  const isUser = m.role === "user";
  const time = m.occurred_at
    ? new Date(m.occurred_at).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : m.created_at
    ? new Date(m.created_at).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : "";

  /* ── Detección de botones inline (misma lógica que Telegram y botones explícitos) ── */
  let inlineButtons = [];
  if (!isUser) {
    if (Array.isArray(m.buttons) && m.buttons.length > 0) {
      inlineButtons = m.buttons;
    } else if (m.content && typeof m.content === "string") {
      const text = m.content.trim();
      const lower = text.toLowerCase();
      
      // 1) Confirmaciones explícitas o de cambio de etapa (tienen prioridad, no se limitan por longitud)
      if (
        lower.includes("¿confirmas?") || lower.includes("confirmas el registro") ||
        lower.includes("voy a registrar") || lower.includes("staged_action") ||
        lower.includes("¿procedo?") || lower.includes("confirmas mover") ||
        lower.includes("confirmas el cambio") || lower.includes("deseas confirmar") ||
        (lower.includes("he preparado el cambio") && lower.includes("confirmas"))
      ) {
        inlineButtons = [
          { label: "✅ Sí, confirmar", action: "si", primary: true },
          { label: "❌ Cancelar", action: "cancelar", primary: false }
        ];
      }
      // 2) Guía o manual del asistente
      else if (
        lower.includes("guía del asistente") || lower.includes("guia del asistente") ||
        lower.includes("manual del asistente") || lower.includes("este es tu asistente operativo") ||
        (lower.includes("aquí tienes la guía") && lower.includes("telegram")) ||
        lower.includes("puedes consultar el manual completo")
      ) {
        inlineButtons = [
          { label: "📖 Abrir Manual web", action: "https://app.stratoscapitalgroup.com/manual-asistente-telegram", isUrl: true, primary: true },
          { label: "💡 ¿Cómo agendar Zooms?", action: "¿Cómo agendar un zoom con el asistente?", primary: false },
          { label: "🚀 Ver comandos de voz", action: "¿Cómo registrar un cliente por voz?", primary: false }
        ];
      }
      // 3) Otros botones contextuales de notificaciones y seguimiento (si no es un reporte masivo)
      else {
        const bulletCount = (text.match(/^[•\-*]\s/gm) || []).length;
        const isMassiveReport = bulletCount > 3 || text.length > 550;
        if (!isMassiveReport) {
          if (lower.includes("días sin movimiento") || lower.includes("lead abandonado") || lower.includes("sin movimiento")) {
            inlineButtons = [
              { label: "📞 Ya lo contacté", action: "Ya lo contacté", primary: true },
              { label: "📅 Definir acción", action: "Definir próxima acción", primary: false },
              { label: "👤 Ver ficha", action: "Ver ficha del cliente", primary: false }
            ];
          } else if (lower.includes("antes de tu zoom") || lower.includes("plan sugerido") || lower.includes("zooms en 3 horas")) {
            inlineButtons = [
              { label: "🧠 Ya lo estudié", action: "Ya estudié, este es mi plan", primary: true },
              { label: "🗓️ Reagendar", action: "Reagendar", primary: false },
              { label: "📁 Expediente", action: "Ver expediente", primary: false }
            ];
          } else if (lower.includes("ya hiciste esta acción") || lower.includes("lista de acción") || lower.includes("tarea pendiente")) {
            inlineButtons = [
              { label: "✅ Hecho", action: "Ya la hice", primary: true },
              { label: "⏳ En proceso", action: "En proceso", primary: false },
              { label: "❌ No la hice", action: "No la hice", primary: false }
            ];
          }
        }
      }
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
      {!isUser && (
        <div style={{ width: 24, height: 24, borderRadius: 7, background: `${T.accent}15`, border: `1px solid ${T.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
          <CopilotMark size={15} isLight={isLight} animated={!!isLast && !sending} />
        </div>
      )}
      <div style={{
        maxWidth: "82%", padding: "8px 12px", borderRadius: 14,
        borderBottomRightRadius: isUser ? 3 : 14, borderBottomLeftRadius: isUser ? 14 : 3,
        background: isUser ? userBg : aiBg, border: isUser ? "none" : `1px solid ${aiBd}`,
        color: isUser ? userTxt : T.txt, fontSize: 13.2, lineHeight: 1.48, fontFamily: font,
        whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: m.pending ? 0.7 : 1,
        boxShadow: isLight ? (isUser ? `0 3px 10px ${T.accent}28` : "0 1px 4px rgba(15,23,42,0.03)") : "none"
      }}>
        {renderRichText(m.content, isUser ? "inherit" : T.accent)}
        {inlineButtons.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, paddingTop: 7, borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}` }}>
            {inlineButtons.map((btn, idx) => (
              <button key={btn.action || idx} type="button"
                onClick={() => {
                  if (sending) return;
                  if (btn.isUrl) {
                    window.open(btn.action, "_blank", "noopener,noreferrer");
                  } else if (onPick) {
                    if (typeof btn.action === 'string' && (btn.action.startsWith('pickdis:') || btn.action.startsWith('cancel:') || btn.action.startsWith('confirm:') || btn.action.includes(':'))) {
                      onPick(btn.label, { callback_data: btn.action });
                    } else {
                      onPick(btn.action);
                    }
                  }
                }}
                disabled={sending && !btn.isUrl}
                style={{
                  padding: "4px 10px", borderRadius: 7, border: btn.primary ? "none" : `1px solid ${T.border}`,
                  background: btn.primary ? T.accent : (isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)"),
                  color: btn.primary ? (isLight ? "#FFF" : "#041016") : T.txt, fontSize: 11.5, fontWeight: btn.primary ? 600 : 500,
                  fontFamily: font, cursor: (sending && !btn.isUrl) ? "default" : "pointer"
                }}>{btn.label}</button>
            ))}
          </div>
        )}
        {time && <span style={{ display: "block", marginTop: 3, fontSize: 10, opacity: 0.55, textAlign: "right" }}>{time}</span>}
      </div>
    </div>
  );
}

/* ── Nota de voz: reproductor custom (reemplaza al <audio controls> nativo) ── */
/* Barras tipo waveform + play/pause + tiempo, con la paleta de marca. La
   transcripción se muestra debajo (se mantiene, funciona bien). */
const VOICE_BARS = [7, 12, 20, 14, 26, 34, 22, 30, 16, 24, 38, 28, 18, 32, 40, 26, 20, 34, 14, 24, 30, 18, 12, 22, 28, 16, 10, 8];
const fmtClock = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

function VoiceNote({ url, transcript, T, isLight, onDiscard, onSend }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => { setPlaying(false); setCur(0); setDur(0); }, [url]);

  const onLoaded = () => {
    const a = audioRef.current;
    if (!a) return;
    // Blobs de MediaRecorder (webm) reportan duration=Infinity hasta que se
    // fuerza un seek. Truco estándar para obtener la duración real.
    if (!isFinite(a.duration)) {
      const fix = () => {
        a.currentTime = 0;
        setDur(isFinite(a.duration) ? a.duration : 0);
        a.removeEventListener("timeupdate", fix);
      };
      a.addEventListener("timeupdate", fix);
      a.currentTime = 1e101;
    } else {
      setDur(a.duration);
    }
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  const seekTo = (frac) => {
    const a = audioRef.current;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    a.currentTime = Math.max(0, Math.min(1, frac)) * a.duration;
    setCur(a.currentTime);
  };

  const progress = dur > 0 ? cur / dur : 0;
  const accent = T.accent;
  const trackOff = isLight ? "rgba(15,23,42,0.16)" : "rgba(255,255,255,0.20)";

  return (
    <div style={{
      margin: "0 14px 4px", padding: "10px 12px", borderRadius: 14, flexShrink: 0,
      background: isLight ? "rgba(13,154,118,0.055)" : "rgba(110,231,194,0.06)",
      border: `1px solid ${accent}33`,
    }}>
      <audio
        ref={audioRef} src={url} preload="metadata"
        onLoadedMetadata={onLoaded}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); setCur(0); }}
        style={{ display: "none" }}
      />
      {/* Fila reproductor */}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <button
          type="button" onClick={toggle} aria-label={playing ? "Pausar" : "Reproducir"}
          style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${accent}, #0D9A76)`,
            color: isLight ? "#FFFFFF" : "#041016",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 12px ${accent}44`,
          }}
        >
          {playing ? <Pause size={16} strokeWidth={2.4} fill="currentColor" /> : <Play size={16} strokeWidth={2.4} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>

        {/* Waveform clicable */}
        <div
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width); }}
          style={{ flex: 1, minWidth: 0, height: 34, display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}
        >
          {VOICE_BARS.map((h, i) => {
            const barFrac = (i + 0.5) / VOICE_BARS.length;
            const on = barFrac <= progress;
            return (
              <span key={i} style={{
                flex: 1, minWidth: 2, height: `${h}%`, borderRadius: 99,
                background: on ? accent : trackOff,
                transition: "background 0.12s linear",
              }} />
            );
          })}
        </div>

        <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 500, fontFamily: fontDisp, fontVariantNumeric: "tabular-nums", color: T.txt2, minWidth: 66, textAlign: "right" }}>
          {fmtClock(cur)} / {fmtClock(dur)}
        </span>

        <button type="button" onClick={onDiscard} aria-label="Descartar audio"
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.txt3 }}>
          <X size={15} />
        </button>
      </div>

      {/* Transcripción + enviar */}
      {(transcript || true) && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: transcript ? 9 : 8, paddingTop: transcript ? 9 : 0, borderTop: transcript ? `1px solid ${accent}1F` : "none" }}>
          {transcript ? (
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, color: T.txt, fontFamily: font, fontStyle: "italic" }}>
              "{transcript}"
            </span>
          ) : (
            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: T.txt3, fontFamily: font }}>Nota de voz lista para enviar</span>
          )}
          <button type="button" onClick={onSend}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 9, border: "none", background: accent, color: isLight ? "#FFF" : "#041016", fontSize: 12, fontWeight: 600, fontFamily: fontDisp, cursor: "pointer" }}>
            <Send size={13} strokeWidth={2.4} /> Enviar
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Indicador de escritura ── */
function Typing({ T, isLight, aiBg, aiBd }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", gap: 8, alignItems: "flex-end" }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, background: `${T.accent}15`, border: `1px solid ${T.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
        <CopilotMark size={15} isLight={isLight} />
      </div>
      <div style={{ padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 3, background: aiBg, border: `1px solid ${aiBd}`, display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent, display: "inline-block", animation: `copilotBlink 1.2s ${i * 0.18}s infinite ease-in-out` }} />
        ))}
      </div>
      <style>{`@keyframes copilotBlink { 0%,80%,100%{opacity:.25;transform:translateY(0)} 40%{opacity:1;transform:translateY(-3px)} }`}</style>
    </div>
  );
}

/* ── Estado vacío ── */
function EmptyState({ T, isLight, onPick }) {
  return (
    <div style={{ margin: "auto", textAlign: "center", maxWidth: 340, padding: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px", background: isLight ? "linear-gradient(135deg, #E8F8F4 0%, #D1F2E8 100%)" : "linear-gradient(135deg, rgba(110,231,194,0.15) 0%, rgba(52,211,153,0.08) 100%)", border: `1px solid ${T.accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CopilotMark size={30} isLight={isLight} />
      </div>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>Tu Asistente Operativo</h3>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: T.txt3, lineHeight: 1.5, fontFamily: font }}>
        Escríbele o díctale por voz. Pídele clientes, agenda, métricas, o busca a alguien por nombre.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {SUGGESTIONS.map((s) => (
          <button key={s.text} type="button" onClick={() => onPick(s.text)}
            style={{ padding: "5px 12px", borderRadius: 999, background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.05)", border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)"}`, color: T.txt2, fontSize: 12, fontFamily: font, cursor: "pointer" }}>
            <Bot size={12} color={T.accent} style={{ marginRight: 4, verticalAlign: "middle" }} />{s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Banner de activación de notificaciones push ──
   El Copilot ya recibe TODO en el historial; esto es para que además llegue el
   aviso al teléfono (con la app cerrada), reemplazando la dependencia de Telegram.
   Auto-suscribe corre en App.jsx si el permiso ya está concedido; este banner
   cubre el caso que necesita gesto del usuario (permiso 'default'). */
function NotifBanner({ T, isLight }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (sessionStorage.getItem("stratos_notif_dismissed") === "1") return;
        const st = await getPushStatus();
        if (!alive) return;
        // Ocultar si no soporta, si el user bloqueó, o si ya está activo (suscrito)
        if (!st.supported || st.permission === "denied" || st.isActive) return;
        setNeedsInstall(!!st.needsInstall);
        setShow(true);
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { sessionStorage.setItem("stratos_notif_dismissed", "1"); } catch { /* noop */ }
    setShow(false);
  };

  const enable = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await enablePushNotifications(user?.id);
      if (r.success) { setShow(false); }
      else if (r.permission === "denied") { setErr("Bloqueaste las notificaciones. Actívalas desde los Ajustes del teléfono."); }
      else { setErr("No se pudo activar. Probá de nuevo."); }
    } catch { setErr("No se pudo activar. Probá de nuevo."); }
    setBusy(false);
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", flexShrink: 0,
      background: isLight ? "rgba(13,154,118,0.07)" : "rgba(110,231,194,0.07)",
      borderBottom: `1px solid ${T.accent}22`,
    }}>
      <Bell size={16} color={T.accent} strokeWidth={2} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.txt2, fontFamily: font, lineHeight: 1.35 }}>
        {needsInstall
          ? <>Para recibir avisos con la app cerrada, instalala: <strong style={{ color: T.txt }}>botón Compartir → Agregar a inicio</strong>.</>
          : (err
              ? <span style={{ color: isLight ? "#B91C3A" : "#FCA5A5" }}>{err}</span>
              : <>Activá las notificaciones para enterarte de tus Zooms, tareas y recordatorios aunque tengas la app cerrada.</>)}
      </div>
      {!needsInstall && (
        <button type="button" onClick={enable} disabled={busy}
          style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "none", background: busy ? `${T.accent}66` : T.accent, color: isLight ? "#FFF" : "#041016", fontSize: 12, fontWeight: 600, fontFamily: fontDisp, cursor: busy ? "default" : "pointer" }}>
          {busy ? "Activando…" : "Activar"}
        </button>
      )}
      <button type="button" onClick={dismiss} title="Ahora no"
        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, background: "transparent", border: "none", color: T.txt3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Prompt de conexión (cuando no está pareado) ── */
function ConnectPrompt({ T, isLight, botUsername, manualPairing, onPaired, onBack }) {
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
    if (r.error || !r.code) { setErr("No se pudo generar el código. Intenta en un minuto."); return; }
    if (deepLinkMode) window.open(`https://t.me/${botUsername}?start=${r.code}`, "_blank", "noopener,noreferrer");
    setCode(r.code);
    startPoll();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
      {/* Flecha volver — en el modo inmersivo (sin header/nav de la app) es la
          única salida si el asesor cae en esta pantalla sin parear. */}
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Volver" style={{
          position: "absolute", top: "calc(10px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))", left: 12,
          width: 40, height: 40, borderRadius: 12, background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent",
        }}>
          <ChevronLeft size={26} strokeWidth={2.4} color={isLight ? "#0D9A76" : "#FFFFFF"} />
        </button>
      )}
      <G T={T} style={{ padding: 28, textAlign: "center", borderRadius: 18, maxWidth: 400, width: "100%", boxShadow: isLight ? "0 8px 32px rgba(15,23,42,0.06)" : "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px", background: isLight ? "linear-gradient(135deg, #E8F8F4 0%, #D1F2E8 100%)" : "linear-gradient(135deg, rgba(110,231,194,0.15) 0%, rgba(52,211,153,0.08) 100%)", border: `1px solid ${T.accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CopilotMark size={32} isLight={isLight} />
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>Activa tu Copilot AI</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: T.txt2, lineHeight: 1.5, fontFamily: font }}>
          Conecta tu Telegram una vez y tendrás a tu asistente operativo del CRM en esta pantalla.
        </p>

        {!code ? (
          <>
            {!deepLinkMode && (
              <div style={{ textAlign: "left", margin: "0 auto 16px", maxWidth: 320, fontSize: 12.5, color: T.txt3, display: "flex", flexDirection: "column", gap: 4, fontFamily: font }}>
                <span>1. Busca en Telegram <strong style={{ color: T.txt2 }}>@{botName}</strong> y toca <strong>/start</strong></span>
                <span>2. Toca "Conectar mi Telegram"</span>
                <span>3. Envíale el código al bot</span>
              </div>
            )}
            <button type="button" onClick={connect} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 12, background: busy ? `${T.accent}44` : T.accent, border: "none", color: isLight ? "#FFF" : "#041016", fontSize: 14, fontWeight: 600, fontFamily: fontDisp, cursor: busy ? "default" : "pointer" }}>
              {busy ? "Conectando…" : "Conectar mi Telegram"}
            </button>
          </>
        ) : (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: T.txt3, fontFamily: fontDisp }}>Tu código</p>
            <div style={{ padding: "16px 20px", background: `${T.accent}0C`, border: `1px solid ${T.accent}2A`, borderRadius: 14, fontSize: "clamp(26px,7vw,36px)", fontWeight: 400, letterSpacing: "0.10em", fontFamily: fontDisp, color: T.txt, fontVariantNumeric: "tabular-nums", marginBottom: 14 }}>{code}</div>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: T.txt2, fontFamily: font }}>Envía a <strong>@{botName}</strong>:</p>
            <code style={{ display: "block", padding: "10px 12px", background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, fontFamily: "ui-monospace, SF Mono, monospace", color: T.txt }}>/conectar {code}</code>
            {botUsername && (
              <button type="button" onClick={() => window.open(`https://t.me/${botUsername}?start=${code}`, "_blank", "noopener,noreferrer")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "8px 14px", borderRadius: 10, background: "transparent", border: `1px solid ${T.accent}33`, color: T.txt, fontSize: 12.5, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer" }}>
                <Send size={13} strokeWidth={2} /> Abrir en Telegram
              </button>
            )}
            <p style={{ margin: "12px 0 0", fontSize: 11, color: T.txt3, fontFamily: font }}>Esta pantalla se activa sola al conectar.</p>
          </div>
        )}

        {err && (
          <div style={{ marginTop: 16, padding: "10px 12px", background: isLight ? "rgba(225,29,72,0.06)" : "rgba(248,113,113,0.08)", border: `1px solid ${isLight ? "rgba(225,29,72,0.22)" : "rgba(248,113,113,0.22)"}`, borderRadius: 10, fontSize: 12, color: isLight ? "#B91C3A" : "#FCA5A5", fontFamily: font }}>{err}</div>
        )}
      </G>
    </div>
  );
}
