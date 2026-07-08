/**
 * lib/whatsapp-chat.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de datos del chat de WhatsApp EN VIVO del expediente del lead.
 *
 * Arquitectura (backend en Supabase + n8n, ver flujo "WHATSAPP SEND · CRM →
 * Chatwoot" y "INBOUND · Cecilia"):
 *
 *  - LEER: espejo `whatsapp_messages`. Lo llena n8n con los eventos de
 *    Chatwoot (mensajes ENTRANTES del cliente y SALIENTES del equipo).
 *    RLS: mismo alcance que el expediente — org + asesor del lead o admin.
 *
 *  - ENVIAR: INSERT en `whatsapp_outbox` (RLS exige sesión válida, org
 *    propia y lead visible) + "ping" al webhook de n8n con el id de la
 *    fila. El flujo reclama la fila vía RPC `fn_wa_outbox_claim` (solo si
 *    está `pending` → anti doble-envío), envía por la API de Chatwoot y
 *    marca `sent`/`failed`. El mensaje enviado vuelve por el webhook de
 *    Chatwoot y aparece en el espejo como fila `out`.
 *
 *  - REINTENTAR: RPC `fn_wa_outbox_retry` re-encola una fila `failed` (o
 *    atascada >60s) a `pending` con guardas de org/visibilidad, y se vuelve
 *    a pingear el webhook. (Sin el reset, el claim rechazaría la fila.)
 *
 *  - SEGURIDAD del webhook público: un request forjado NO puede enviar
 *    nada — sin una fila `pending` legítima (creada con login + RLS) el
 *    claim devuelve vacío. Mismo patrón de validación-en-DB que usa el
 *    resto del stack (ver lib/iagents-actions.js para el precedente).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabase";

const N8N_WA_SEND_WEBHOOK =
  "https://personal-n8n.suwsiw.easypanel.host/webhook/whatsapp-send-crm";
const PING_TIMEOUT_MS = 10000;

/** Ventana de sesión de WhatsApp: 24h desde el último mensaje DEL CLIENTE. */
export const WA_WINDOW_MS = 24 * 60 * 60 * 1000;
export const WA_MAX_LEN = 4096;
/** Edad a partir de la cual una fila pending/sending se considera atascada. */
export const WA_STUCK_MS = 60 * 1000;

/**
 * Trae el hilo del lead: espejo de mensajes + cola de envío.
 * OJO: se piden los N más RECIENTES (descending + limit) y se invierte en
 * cliente — ascending+limit devolvería los más viejos y en hilos largos los
 * mensajes nuevos desaparecerían (y la ventana 24h se calcularía mal).
 */
export async function fetchWhatsAppThread(leadId) {
  const [msgsRes, outboxRes] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select(
        "id, direction, content, content_type, media, sender_name, message_created_at, chatwoot_message_id, chatwoot_conversation_id, organization_id"
      )
      .eq("lead_id", leadId)
      .order("message_created_at", { ascending: false })
      .limit(500),
    supabase
      .from("whatsapp_outbox")
      .select("id, content, status, error, chatwoot_message_id, sender_name, created_at, updated_at, media_type, media_filename")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return {
    messages: Array.isArray(msgsRes.data) ? [...msgsRes.data].reverse() : [],
    outbox: Array.isArray(outboxRes.data) ? [...outboxRes.data].reverse() : [],
    error: msgsRes.error || outboxRes.error || null,
  };
}

/** Timestamp (ms) del último mensaje ENTRANTE del cliente, o null. */
export function lastIncomingAt(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "in" && messages[i].message_created_at) {
      const t = new Date(messages[i].message_created_at).getTime();
      if (!Number.isNaN(t)) return t;
    }
  }
  return null;
}

/** ¿La ventana de 24h para texto libre sigue abierta? */
export function isWindowOpen(messages, now = Date.now()) {
  const last = lastIncomingAt(messages);
  if (last == null) return false;
  return now - last < WA_WINDOW_MS;
}

/** Milisegundos restantes de ventana (0 si cerrada / sin entrantes). */
export function windowRemainingMs(messages, now = Date.now()) {
  const last = lastIncomingAt(messages);
  if (last == null) return 0;
  return Math.max(0, last + WA_WINDOW_MS - now);
}

/**
 * Une espejo + cola en un solo hilo ordenado para pintar:
 *  - Mensajes del espejo tal cual (fuente de verdad).
 *  - Filas de outbox como burbujas optimistas mientras su mensaje real NO
 *    esté en el espejo:
 *      · `sent` se omite cuando su chatwoot_message_id ya está espejado
 *        (evita el parpadeo entre que n8n marca sent y llega el webhook).
 *      · `pending`/`sending` se omiten si un mensaje `out` espejado con el
 *        MISMO contenido llegó después de crearse la fila (el espejo puede
 *        adelantarse al `finish` de n8n → evita verlo doble).
 *  - El `sender_name` de la fila (la asesora) pinta el mensaje espejado
 *    correspondiente vía chatwoot_message_id.
 */
export function mergeThread(messages, outbox) {
  const senderByMsgId = new Map();
  const mirroredIds = new Set();
  for (const m of messages) {
    if (m.chatwoot_message_id != null) mirroredIds.add(String(m.chatwoot_message_id));
  }
  for (const o of outbox) {
    if (o.status === "sent" && o.chatwoot_message_id != null && o.sender_name) {
      senderByMsgId.set(String(o.chatwoot_message_id), o.sender_name);
    }
  }
  const thread = messages.map((m) => ({
    key: `m-${m.id}`,
    kind: "message",
    direction: m.direction,
    content: m.content,
    media: Array.isArray(m.media) ? m.media : null,
    senderName:
      (m.direction === "out" &&
        m.chatwoot_message_id != null &&
        senderByMsgId.get(String(m.chatwoot_message_id))) ||
      m.sender_name ||
      null,
    at: m.message_created_at,
    status: "delivered",
  }));

  // Espejos de mensajes SALIENTES con adjunto (viejo→nuevo), para emparejar
  // 1:1 con las burbujas optimistas de media. Sin esto, un solo espejo tapaba
  // TODAS las burbujas pending con adjunto (mandás 2 fotos seguidas y la 2ª
  // desaparecía hasta que llegaba su propio espejo).
  const mediaMirrorPool = messages
    .filter((m) => m.direction === "out" && Array.isArray(m.media) && m.media.length > 0)
    .sort((a, b) => new Date(a.message_created_at || 0) - new Date(b.message_created_at || 0));
  const usedMirror = new Set();

  // ¿El mensaje real de esta fila de la cola ya está espejado? (ojo: para media
  // consume un espejo del pool → efecto de lado intencional, 1 llamada por fila.)
  const mirroredOutAfter = (o) => {
    const oAt = new Date(o.created_at || 0).getTime() - 10000;
    if (o.media_type) {
      for (const m of mediaMirrorPool) {
        if (usedMirror.has(m.id)) continue;
        if (new Date(m.message_created_at || 0).getTime() < oAt) continue;
        usedMirror.add(m.id); // reclamado por ESTA fila; no vuelve a tapar otra
        return true;
      }
      return false;
    }
    // texto: mismo contenido, más nuevo que la fila
    return messages.some((m) => {
      if (m.direction !== "out") return false;
      if (new Date(m.message_created_at || 0).getTime() < oAt) return false;
      return m.content && m.content === o.content;
    });
  };

  for (const o of outbox) {
    if (
      o.status === "sent" &&
      (o.chatwoot_message_id == null || mirroredIds.has(String(o.chatwoot_message_id)))
    ) {
      continue; // ya está (o estará vía dedup) en el espejo
    }
    if ((o.status === "pending" || o.status === "sending") && mirroredOutAfter(o)) {
      continue; // el espejo se adelantó al finish de n8n — no pintar doble
    }
    thread.push({
      key: `o-${o.id}`,
      kind: "outbox",
      direction: "out",
      content: o.content,
      mediaType: o.media_type || null,        // image|audio|file|video (optimista)
      mediaFilename: o.media_filename || null,
      senderName: o.sender_name || null,
      at: o.created_at,
      status: o.status === "sent" ? "delivered" : o.status, // sent sin espejo aún → entregado
      error: o.error || null,
      outboxId: o.id,
      queuedAt: o.updated_at || o.created_at,
    });
  }
  thread.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  return thread;
}

/** Resuelve el id de conversación de Chatwoot desde el espejo (último msg). */
export function resolveConversationId(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].chatwoot_conversation_id != null) {
      return messages[i].chatwoot_conversation_id;
    }
  }
  return null;
}

/** Resuelve la org desde el espejo (todas las filas del lead son de su org). */
export function resolveOrgId(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].organization_id) return messages[i].organization_id;
  }
  return null;
}

/** Ping al flujo de envío de n8n. Nunca lanza throw — {ok, error}. */
export async function pingSendWebhook(outboxId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(N8N_WA_SEND_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: outboxId }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, error: "timeout" };
    return { ok: false, error: e?.message || "network error" };
  } finally {
    clearTimeout(timer);
  }
}

export const WA_MEDIA_MAX_BYTES = 16 * 1024 * 1024; // 16MB (tope WhatsApp)

/** image|audio|video|file según el mime del archivo. */
export function mediaTypeFromMime(mime = "") {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

/**
 * Sube un archivo al bucket privado wa-outbound bajo {org}/{lead}/{ts-name}.
 * Devuelve { ok, path?, type?, mime?, filename?, error? } — nunca throw.
 */
export async function uploadOutboundMedia({ file, organizationId, leadId, stamp }) {
  if (!file) return { ok: false, error: "no_file" };
  if (file.size > WA_MEDIA_MAX_BYTES) return { ok: false, error: "too_large" };
  if (!organizationId || !leadId) return { ok: false, error: "missing_context" };
  const safeName = String(file.name || "archivo").replace(/[^\w.\-]+/g, "_").slice(-80);
  const ts = stamp || Date.now();
  const path = `${organizationId}/${leadId}/${ts}-${safeName}`;
  const { error } = await supabase.storage
    .from("wa-outbound")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return { ok: false, error: error.message || "upload_failed" };
  return {
    ok: true,
    path,
    type: mediaTypeFromMime(file.type || ""),
    mime: file.type || "application/octet-stream",
    filename: file.name || safeName,
  };
}

/**
 * Encola el mensaje (INSERT en whatsapp_outbox). NO pinguea — el caller
 * pinta la burbuja optimista primero y dispara el ping después.
 * Acepta texto y/o adjunto (media). Devuelve { ok, row?, error? }.
 */
export async function queueWhatsAppMessage({
  leadId,
  organizationId,
  conversationId,
  content,
  senderName,
  media, // { path, type, mime, filename } | null
}) {
  const clean = String(content || "").trim();
  if (!clean && !media) return { ok: false, error: "empty" };
  if (clean.length > WA_MAX_LEN) return { ok: false, error: "too_long" };
  if (!leadId || !organizationId || conversationId == null) {
    return { ok: false, error: "missing_context" };
  }

  const { data, error } = await supabase
    .from("whatsapp_outbox")
    .insert({
      organization_id: organizationId,
      lead_id: leadId,
      chatwoot_conversation_id: conversationId,
      content: clean || null,
      sender_name: senderName || null,
      media_path: media?.path || null,
      media_type: media?.type || null,
      media_mime: media?.mime || null,
      media_filename: media?.filename || null,
    })
    .select("id, content, status, error, chatwoot_message_id, sender_name, created_at, updated_at, media_type, media_filename")
    .single();

  if (error) return { ok: false, error: error.message || "insert_failed" };
  return { ok: true, row: data };
}

/**
 * Reintenta un envío failed/atascado: re-encola vía RPC (failed→pending con
 * guardas server-side) y vuelve a pingear el webhook. {ok, error?}.
 */
export async function retryOutboxMessage(outboxId) {
  const { data, error } = await supabase.rpc("fn_wa_outbox_retry", { p_id: outboxId });
  if (error) return { ok: false, error: error.message || "retry_rpc_failed" };
  if (!data?.ok) return { ok: false, error: data?.reason || "not_retryable" };
  const ping = await pingSendWebhook(outboxId);
  if (!ping.ok) return { ok: false, error: `reencolado, ping falló (${ping.error})` };
  return { ok: true };
}
