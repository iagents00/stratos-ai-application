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
 *  - `threadMaxHeight`: alto máximo del hilo en el modo NORMAL (expediente).
 *  - `fill`: modo del MÓDULO WhatsApp — el chat ocupa TODO el alto disponible
 *    (columna flex): el hilo scrollea adentro y el composer queda SIEMPRE
 *    fijo abajo (no se pierde al hacer scroll). El expediente no lo usa.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Clock, AlertTriangle, RefreshCw, Lock, Paperclip, X, FileText, Download, Mic, Square } from "lucide-react";
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
  uploadOutboundMedia,
  pingSendWebhook,
  retryOutboxMessage,
  mediaTypeFromMime,
  WA_MAX_LEN,
  WA_STUCK_MS,
  WA_MEDIA_MAX_BYTES,
} from "../../../lib/whatsapp-chat";

/* Limpia nombres con fuga del header Content-Disposition (ej. "archivo.jpg-filename*=")
   y detecta el tipo por la extensión del nombre. */
const IMG_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i;
const AUD_EXT = /\.(mp3|m4a|ogg|oga|opus|wav|aac|amr)$/i;
const VID_EXT = /\.(mp4|mov|webm|3gp|mkv|avi)$/i;
function cleanFileName(raw, ext) {
  let s = String(raw || "").trim();
  s = s.split(/;|filename\*?=/i)[0];                       // corta la fuga de Content-Disposition
  s = s.replace(/^["']|["']$/g, "").replace(/[\s\-*=_"']+$/g, "").trim();
  if (!s || !/[a-z0-9]/i.test(s)) return ext ? `archivo.${ext}` : "Archivo";
  return s.slice(0, 80);
}
function typeFromName(name) {
  if (IMG_EXT.test(name)) return "image";
  if (AUD_EXT.test(name)) return "audio";
  if (VID_EXT.test(name)) return "video";
  return null;
}

/* Render de un adjunto (imagen / audio / video / archivo). */
function MediaAttachment({ m, T, isLight }) {
  const fname = cleanFileName(m.filename, m.ext);
  let type = m.type || mediaTypeFromMime(m.mime || "");
  // Si el mime no clasificó (o dio genérico) pero el NOMBRE tiene extensión conocida, inferir.
  if (!["image", "audio", "video"].includes(type)) type = typeFromName(fname) || type || "file";
  const url = m.url;
  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
        <img
          src={m.thumb || url}
          alt="imagen"
          style={{ maxWidth: 220, maxHeight: 240, borderRadius: 10, display: "block", objectFit: "cover" }}
          loading="lazy"
        />
      </a>
    );
  }
  if (type === "audio") {
    return <audio controls preload="none" src={url} style={{ width: 220, height: 38 }} />;
  }
  if (type === "video") {
    return <video controls preload="none" src={url} style={{ maxWidth: 240, maxHeight: 260, borderRadius: 10 }} />;
  }
  // archivo genérico (fname ya viene limpio de arriba)
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
        padding: "8px 12px", borderRadius: 10, maxWidth: 240,
        background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${T.border}`, color: T.txt,
      }}
    >
      <FileText size={16} color={T.txt2} />
      <span style={{ fontSize: 12, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {fname}
      </span>
      <Download size={13} color={T.txt3} />
    </a>
  );
}

const POLL_MS = 20000;
const REALTIME_DEBOUNCE_MS = 300;
const NEAR_BOTTOM_PX = 90;
/** Tope de una nota de voz (5 min ≈ un audio largo de WhatsApp). */
const REC_MAX_SECS = 300;

/* Formatos del MOTOR DE RESPALDO (MediaRecorder), solo si el encoder OGG/OPUS
   wasm no carga. Estos contenedores llegan como DOCUMENTO (Meta los rechaza
   como "audio"; el flujo n8n los degrada — ver nodo "Audio → documento"). */
const REC_MIME_CANDIDATES = ["audio/mp4", "audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];

const fmtRecSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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

export default function LeadWhatsAppChat({ lead, T = P, isLight = false, threadMaxHeight = 360, fill = false }) {
  const { user } = useAuth();
  const { isFeatureEnabled } = useClient();

  const [messages, setMessages] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [retrying, setRetrying] = useState(null); // outboxId en reintento
  const [pendingFile, setPendingFile] = useState(null); // File por enviar
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef(null);   // MediaRecorder activo
  const recordTimerRef = useRef(null);
  const recBusyRef = useRef(false);   // getUserMedia en vuelo (anti doble-click)
  const mountedRef = useRef(true);
  const fileInputRef = useRef(null);
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
  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = ""; // permitir re-elegir el mismo archivo
    if (!f) return;
    if (f.size > WA_MEDIA_MAX_BYTES) { setSendError("El archivo supera 16MB (tope de WhatsApp)"); return; }
    setSendError(null);
    setPendingFile(f);
  }, []);

  /* ── Nota de voz (grabar con el micrófono, como WhatsApp) ────────────────
     DOS motores, en orden de preferencia:
       1) OGG/OPUS vía opus-recorder (wasm, en un Worker): el formato NATIVO
          de voz de WhatsApp → llega como burbuja de voz real. La librería se
          carga PEREZOSA (solo al presionar el micrófono; ~380KB una vez) y se
          libera al terminar (close() suelta mic + AudioContext + worker).
       2) Respaldo: MediaRecorder (m4a/webm) → el flujo n8n lo entrega como
          DOCUMENTO (Meta rechaza esos contenedores como "audio").
     recorderRef guarda la SESIÓN activa: { finish(), cancel() }.            */
  const stopRecTracks = (rec) => {
    try { rec?.stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ya cerrado */ }
  };

  const voiceFileName = (ext) => {
    const d = new Date();
    const hhmmss = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join("");
    return `nota-de-voz-${hhmmss}.${ext}`;
  };

  // Adjunta el audio terminado (entra al MISMO camino de envío que un adjunto).
  const attachVoiceFile = useCallback((parts, mime, ext) => {
    if (!mountedRef.current) return; // nada de setState en un componente muerto
    const file = new File(parts, voiceFileName(ext), { type: mime });
    if (file.size > WA_MEDIA_MAX_BYTES) { setSendError("El audio supera 16MB"); return; }
    setPendingFile(file);
  }, []);

  // Termina la grabación y ADJUNTA (la sesión arma el File → pendingFile).
  const finishRecording = useCallback(() => {
    const session = recorderRef.current;
    recorderRef.current = null; // libre para una nueva grabación
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecording(false);
    setRecordSecs(0);
    try { session?.finish(); } catch { /* ya cerrada */ }
  }, []);

  // Descarta la grabación sin adjuntar.
  const cancelRecording = useCallback(() => {
    const session = recorderRef.current;
    recorderRef.current = null;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecording(false);
    setRecordSecs(0);
    try { session?.cancel(); } catch { /* ya cerrada */ }
  }, []);

  const startRecTimer = useCallback(() => {
    recordTimerRef.current = setInterval(() => {
      setRecordSecs((s) => {
        const next = s + 1;
        if (next >= REC_MAX_SECS) queueMicrotask(finishRecording); // tope 5 min
        return next;
      });
    }, 1000);
  }, [finishRecording]);

  const startRecording = useCallback(async () => {
    // recBusyRef cubre la ventana de los await (doble-click / carrera con
    // unmount): `recording` recién se prende cuando el motor ya arrancó.
    if (recording || sending || recBusyRef.current) return;
    recBusyRef.current = true;
    setSendError(null);

    /* ── Motor 1: OGG/OPUS → nota de voz NATIVA de WhatsApp ── */
    try {
      const [recMod, urlMod] = await Promise.all([
        import("opus-recorder"),
        import("opus-recorder/dist/encoderWorker.min.js?url"),
      ]);
      const Recorder = recMod.default || recMod;
      if (mountedRef.current && Recorder?.isRecordingSupported?.()) {
        const rec = new Recorder({
          encoderPath: urlMod.default || urlMod,
          numberOfChannels: 1,      // mono — requisito de Meta para voz
          encoderApplication: 2048, // perfil "Voice" de Opus
        });
        let cancelled = false;
        rec.ondataavailable = (buf) => {
          try { rec.close(); } catch { /* ya cerrado */ } // suelta mic+worker SIEMPRE
          if (cancelled || !buf || !buf.byteLength) return;
          attachVoiceFile([buf], "audio/ogg", "ogg");
        };
        try {
          await rec.start(); // pide el micrófono (viene de un gesto del usuario)
        } catch (e) {
          try { rec.close(); } catch { /* noop */ } // no dejar mic/worker a medias
          throw e; // → Motor 2
        }
        if (!mountedRef.current) {
          cancelled = true;
          try { rec.stop(); } catch { /* noop */ }
          try { rec.close(); } catch { /* noop */ }
          recBusyRef.current = false;
          return;
        }
        recorderRef.current = {
          finish: () => { try { rec.stop(); } catch { try { rec.close(); } catch { /* noop */ } } },
          cancel: () => {
            cancelled = true;
            try { rec.stop(); } catch { /* noop */ }
            try { rec.close(); } catch { /* noop */ }
          },
        };
        setRecording(true);
        setRecordSecs(0);
        recBusyRef.current = false;
        startRecTimer();
        return;
      }
    } catch { /* wasm no cargó (offline / navegador raro) → Motor 2 */ }

    if (!mountedRef.current) { recBusyRef.current = false; return; }

    /* ── Motor 2 (respaldo): MediaRecorder → llega como documento ── */
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      recBusyRef.current = false;
      if (mountedRef.current) setSendError("Sin permiso de micrófono — dale permiso en el candado de la barra del navegador");
      return;
    }
    // Si el chat se desmontó mientras el usuario respondía el permiso: soltar
    // el micrófono YA (nunca dejar la luz roja prendida en un componente muerto).
    if (!mountedRef.current) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      recBusyRef.current = false;
      return;
    }
    const mime = (window.MediaRecorder &&
      REC_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))) || "";
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      recBusyRef.current = false;
      setSendError("Este navegador no soporta grabar audio");
      return;
    }
    const chunks = []; // POR grabación (closure) — dos grabaciones nunca se mezclan
    let cancelled = false;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      stopRecTracks(rec);
      if (cancelled || chunks.length === 0) return;
      const baseType = (rec.mimeType || mime || "audio/webm").split(";")[0];
      const ext = baseType === "audio/mp4" ? "m4a" : baseType === "audio/ogg" ? "ogg" : "webm";
      attachVoiceFile(chunks, baseType, ext);
    };
    recorderRef.current = {
      finish: () => { try { if (rec.state !== "inactive") rec.stop(); } catch { /* ya parado */ } },
      cancel: () => {
        cancelled = true;
        try { if (rec.state !== "inactive") rec.stop(); } catch { /* ya parado */ }
        stopRecTracks(rec);
      },
    };
    setRecording(true);
    setRecordSecs(0);
    recBusyRef.current = false;
    rec.start(250);
    startRecTimer();
  }, [recording, sending, startRecTimer, attachVoiceFile]);

  // Al desmontar: soltar el micrófono SIEMPRE (nunca dejar la luz roja prendida).
  useEffect(() => () => {
    mountedRef.current = false;
    const session = recorderRef.current;
    recorderRef.current = null;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    try { session?.cancel(); } catch { /* ya cerrada */ }
  }, []);

  // Si el composer desaparece a mitad de grabación (p.ej. la ventana de 24h se
  // cerró en un refetch), NO dejar el micrófono grabando sin controles visibles.
  useEffect(() => {
    if (recording && !canSend) cancelRecording();
  }, [recording, canSend, cancelRecording]);

  // Preview del adjunto pendiente cuando es audio (escucharlo antes de enviar).
  // Object URL con ciclo de vida en un EFFECT (crear+revocar en pareja).
  const [pendingUrl, setPendingUrl] = useState(null);
  useEffect(() => {
    if (!pendingFile || !pendingFile.type?.startsWith("audio/")) { setPendingUrl(null); return; }
    const url = URL.createObjectURL(pendingFile);
    setPendingUrl(url);
    return () => { URL.revokeObjectURL(url); };
  }, [pendingFile]);

  const handleSend = useCallback(async () => {
    const clean = draft.trim();
    if ((!clean && !pendingFile) || sending || !canSend || recording) return;
    setSending(true);
    setSendError(null);

    let media = null;
    if (pendingFile) {
      const up = await uploadOutboundMedia({ file: pendingFile, organizationId: orgId, leadId: lead.id });
      if (!up.ok) {
        setSending(false);
        setSendError(up.error === "too_large" ? "El archivo supera 16MB" : `No se pudo subir el archivo (${up.error})`);
        return;
      }
      media = { path: up.path, type: up.type, mime: up.mime, filename: up.filename };
    }

    const ins = await queueWhatsAppMessage({
      leadId: lead.id,
      organizationId: orgId,
      conversationId,
      content: clean,
      senderName: user?.name || null,
      media,
    });
    setSending(false);
    if (!ins.ok) {
      setSendError(ins.error === "too_long" ? "Mensaje demasiado largo" : ins.error);
      return;
    }
    // Burbuja optimista ANTES del ping, con dedupe (realtime/poll pueden
    // haber traído la fila ya).
    setDraft("");
    setPendingFile(null);
    setOutbox((prev) =>
      prev.some((r) => r.id === ins.row.id) ? prev : [...prev, ins.row]
    );
    const ping = await pingSendWebhook(ins.row.id);
    if (!ping.ok) {
      setSendError(`El disparo falló (${ping.error}) — usa "reintentar" en el mensaje`);
    }
  }, [draft, pendingFile, sending, canSend, recording, lead?.id, orgId, conversationId, user?.name]);

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
    <div
      style={
        fill
          ? { display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 }
          : { marginBottom: 20 }
      }
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexShrink: 0 }}>
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
          {/* Hilo — en modo fill toma TODO el alto sobrante y scrollea adentro
              (el composer de abajo nunca se mueve); en modo normal (expediente)
              conserva el tope fijo de siempre. */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              ...(fill
                ? { flex: "1 1 0%", minHeight: 0 }
                : { maxHeight: threadMaxHeight }),
              overflowY: "auto", display: "flex",
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
                    {Array.isArray(m.media) && m.media.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: m.content ? 6 : 0 }}>
                        {m.media.map((att, i) => (
                          <MediaAttachment key={i} m={att} T={T} isLight={isLight} />
                        ))}
                      </div>
                    )}
                    {!m.media && m.mediaType && (
                      <div
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 10px", borderRadius: 8, marginBottom: m.content ? 6 : 0,
                          background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        <Paperclip size={12} color={T.txt2} />
                        <span style={{ fontSize: 11.5, color: T.txt2, fontFamily: font, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.mediaType === "image" ? "Foto" : m.mediaType === "audio" ? "Audio" : m.mediaType === "video" ? "Video" : cleanFileName(m.mediaFilename)}
                        </span>
                      </div>
                    )}
                    {m.content && (
                      <pre
                        style={{
                          margin: 0, fontSize: 12.5, color: T.txt, fontFamily: font,
                          lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}
                      >
                        {m.content}
                      </pre>
                    )}
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

          {/* Composer / aviso de ventana — flexShrink 0: en modo fill jamás se
              comprime ni se pierde (el hilo es el único que scrollea). */}
          {canSend ? (
            <div style={{ marginTop: 10, flexShrink: 0 }}>
              {/* Chip del archivo elegido (aún no enviado) — el audio se puede
                  escuchar antes de mandarlo */}
              {pendingFile && !recording && (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                    padding: "6px 10px", borderRadius: 9,
                    background: isLight ? "rgba(13,154,118,0.06)" : "rgba(110,231,194,0.06)",
                    border: `1px solid ${outBd}`,
                  }}
                >
                  {pendingUrl ? (
                    <>
                      <Mic size={13} color={accentStrong} style={{ flexShrink: 0 }} />
                      <audio controls preload="metadata" src={pendingUrl} style={{ flex: 1, minWidth: 0, height: 32 }} />
                    </>
                  ) : (
                    <>
                      <Paperclip size={13} color={accentStrong} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.txt, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pendingFile.name}
                      </span>
                    </>
                  )}
                  <span style={{ fontSize: 10, color: subC, fontFamily: font, flexShrink: 0 }}>
                    {(pendingFile.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => setPendingFile(null)}
                    title="Quitar adjunto"
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}
                  >
                    <X size={13} color={T.txt3} />
                  </button>
                </div>
              )}

              {/* Barra de grabación en curso */}
              {recording && (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                    padding: "8px 12px", borderRadius: 9,
                    background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.30)",
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#EF4444", flexShrink: 0, animation: "pulse 1.2s ease-in-out infinite" }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: isLight ? "#B91C1C" : "#FCA5A5", fontFamily: fontDisp }}>
                    Grabando nota de voz · {fmtRecSecs(recordSecs)}
                  </span>
                  <button
                    onClick={cancelRecording}
                    title="Descartar grabación"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px",
                      borderRadius: 7, cursor: "pointer", background: "transparent",
                      border: `1px solid ${isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.14)"}`,
                      color: T.txt2, fontSize: 11, fontWeight: 600, fontFamily: font,
                    }}
                  >
                    <X size={11} /> Cancelar
                  </button>
                  <button
                    onClick={finishRecording}
                    title="Terminar y adjuntar"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px",
                      borderRadius: 7, cursor: "pointer", border: "none",
                      background: "#EF4444", color: "#FFF",
                      fontSize: 11, fontWeight: 700, fontFamily: font,
                    }}
                  >
                    <Square size={10} /> Listo
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFile}
                  style={{ display: "none" }}
                  accept="image/*,audio/*,video/mp4,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  title="Adjuntar imagen, audio o archivo"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${T.border}`, color: T.txt2,
                    cursor: sending ? "default" : "pointer",
                  }}
                >
                  <Paperclip size={15} />
                </button>
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
                  onClick={recording ? finishRecording : startRecording}
                  disabled={sending}
                  title={recording ? "Terminar grabación" : "Grabar nota de voz"}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: recording ? "rgba(239,68,68,0.14)" : (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)"),
                    border: `1px solid ${recording ? "rgba(239,68,68,0.45)" : T.border}`,
                    color: recording ? "#EF4444" : T.txt2,
                    cursor: sending ? "default" : "pointer",
                  }}
                >
                  {recording ? <Square size={14} /> : <Mic size={15} />}
                </button>
                {(() => {
                  const active = (draft.trim() || pendingFile) && !sending && !recording;
                  return (
                    <button
                      onClick={handleSend}
                      disabled={!active}
                      title="Enviar (Enter)"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                        background: active ? T.accent : T.border,
                        border: "none",
                        color: active ? "#041016" : T.txt3,
                        cursor: active ? "pointer" : "default",
                      }}
                    >
                      <Send size={15} />
                    </button>
                  );
                })()}
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
                marginTop: 10, flexShrink: 0, padding: "10px 12px", borderRadius: 10,
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
