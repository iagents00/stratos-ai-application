#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  Browsers,
  DEFAULT_CONNECTION_CONFIG,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  makeWASocket,
  normalizeMessageContent,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import qrImage from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const DEFAULTS = {
  webhookUrl: "https://personal-n8n.suwsiw.easypanel.host/webhook/meta-directo-leads",
  displayPhoneNumber: "+52 1 984 254 0664",
  phoneNumberId: "1139531549240830",
  wabaId: "1900999323921319",
  verifiedName: "Cecilia Mendoza Vazquez Asesora Inmobiliaria Certificada",
  pairingPhoneNumber: "5219842540664",
  sessionDir: ".wa-sessions/baileys-cecilia",
  processedFile: ".wa-sessions/cecilia-baileys-processed.json",
  eventLogFile: ".wa-sessions/cecilia-bridge.events.log",
  qrPngFile: ".wa-sessions/cecilia-latest-qr.png",
  qrTextFile: ".wa-sessions/cecilia-latest-qr.txt",
  processedLimit: 2000,
  pairingDelayMs: 3500,
  pairingCodeIntervalMs: 55000,
  reconnectBaseMs: 2000,
  reconnectMaxMs: 30000,
};

const args = new Set(process.argv.slice(2));

loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

const config = {
  webhookUrl: env("CECILIA_BRIDGE_WEBHOOK_URL", DEFAULTS.webhookUrl),
  displayPhoneNumber: env("CECILIA_BRIDGE_DISPLAY_PHONE_NUMBER", DEFAULTS.displayPhoneNumber),
  phoneNumberId: env("CECILIA_BRIDGE_PHONE_NUMBER_ID", DEFAULTS.phoneNumberId),
  wabaId: env("CECILIA_BRIDGE_WABA_ID", DEFAULTS.wabaId),
  verifiedName: env("CECILIA_BRIDGE_VERIFIED_NAME", DEFAULTS.verifiedName),
  pairingPhoneNumber: env("CECILIA_BRIDGE_PAIRING_PHONE_NUMBER", DEFAULTS.pairingPhoneNumber).replace(/\D/g, ""),
  sessionDir: path.resolve(rootDir, env("CECILIA_BRIDGE_SESSION_DIR", DEFAULTS.sessionDir)),
  processedFile: path.resolve(rootDir, env("CECILIA_BRIDGE_PROCESSED_FILE", DEFAULTS.processedFile)),
  eventLogFile: path.resolve(rootDir, env("CECILIA_BRIDGE_EVENT_LOG_FILE", DEFAULTS.eventLogFile)),
  qrPngFile: path.resolve(rootDir, env("CECILIA_BRIDGE_QR_PNG_FILE", DEFAULTS.qrPngFile)),
  qrTextFile: path.resolve(rootDir, env("CECILIA_BRIDGE_QR_TEXT_FILE", DEFAULTS.qrTextFile)),
  processedLimit: Number(env("CECILIA_BRIDGE_PROCESSED_LIMIT", String(DEFAULTS.processedLimit))),
  pairingDelayMs: Number(env("CECILIA_BRIDGE_PAIRING_DELAY_MS", String(DEFAULTS.pairingDelayMs))),
  pairingCodeIntervalMs: Number(env("CECILIA_BRIDGE_PAIRING_CODE_INTERVAL_MS", String(DEFAULTS.pairingCodeIntervalMs))),
  reconnectBaseMs: Number(env("CECILIA_BRIDGE_RECONNECT_BASE_MS", String(DEFAULTS.reconnectBaseMs))),
  reconnectMaxMs: Number(env("CECILIA_BRIDGE_RECONNECT_MAX_MS", String(DEFAULTS.reconnectMaxMs))),
  requestPairingCode: ["1", "true", "yes"].includes(env("CECILIA_BRIDGE_PAIRING_CODE", "1").toLowerCase()),
  printQrTerminal: ["1", "true", "yes"].includes(env("CECILIA_BRIDGE_PRINT_QR_TERMINAL", "0").toLowerCase()),
  dryRun: args.has("--dry-run") || env("CECILIA_BRIDGE_DRY_RUN", "0") === "1",
  simulate: args.has("--simulate"),
};

ensureWebhookUrl(config.webhookUrl);
for (const directory of [
  config.sessionDir,
  path.dirname(config.processedFile),
  path.dirname(config.eventLogFile),
  path.dirname(config.qrPngFile),
  path.dirname(config.qrTextFile),
]) {
  fs.mkdirSync(directory, { recursive: true });
}

const logger = pino({
  level: env("CECILIA_BRIDGE_LOG_LEVEL", "silent"),
});
const processed = loadProcessed(config.processedFile);

if (config.simulate) {
  const payload = buildMetaCloudPayload({
    fromDigits: "155501990664",
    senderName: "Bridge Simulation Cecilia",
    body: "Prueba local del puente Cecilia Baileys",
    messageId: `simulate-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    bridgeMeta: {
      mode: "simulate",
      source: "cecilia-baileys-bridge",
    },
  });
  await deliver(payload);
  process.exit(0);
}

let sock = null;
let stopping = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let pairingCodeTimer = null;

log("Iniciando puente WhatsApp vinculado para Cecilia.");
log(`Webhook destino: ${config.webhookUrl}`);
log(`Telefono receptor Meta simulado: ${config.displayPhoneNumber} (${config.phoneNumberId})`);
log(config.dryRun ? "Modo DRY RUN: no se enviara nada a n8n." : "Modo REAL: mensajes entrantes se enviaran a n8n.");

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await connect();
await new Promise(() => {});

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const version = await getBaileysVersion();

  sock = makeWASocket({
    auth: state,
    browser: Browsers.macOS("Stratos Cecilia Bridge"),
    generateHighQualityLinkPreview: false,
    logger,
    markOnlineOnConnect: false,
    printQRInTerminal: false,
    shouldSyncHistoryMessage: () => false,
    syncFullHistory: false,
    version,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", handleConnectionUpdate);
  sock.ev.on("messages.upsert", handleMessagesUpsert);

  if (config.requestPairingCode && !state.creds.registered) {
    schedulePairingCodeRequest(config.pairingDelayMs);
  }
}

async function requestPairingCode() {
  if (!sock || !config.pairingPhoneNumber) return;
  const code = await sock.requestPairingCode(config.pairingPhoneNumber);
  log(`Codigo de vinculacion WhatsApp para ${formatPhone(config.pairingPhoneNumber)}: ${formatPairingCode(code)}`);
}

function schedulePairingCodeRequest(delay) {
  if (pairingCodeTimer) clearTimeout(pairingCodeTimer);
  pairingCodeTimer = setTimeout(async () => {
    pairingCodeTimer = null;
    try {
      await requestPairingCode();
      if (!stopping && config.pairingCodeIntervalMs > 0) {
        schedulePairingCodeRequest(config.pairingCodeIntervalMs);
      }
    } catch (error) {
      log(`No se pudo generar codigo de vinculacion; usa QR: ${error?.message || error}`);
    }
  }, delay);
}

async function getBaileysVersion() {
  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    log(`Version WhatsApp Web usada por Baileys: ${version.join(".")} (${isLatest ? "latest" : "fallback remoto"}).`);
    return version;
  } catch (error) {
    const fallback = DEFAULT_CONNECTION_CONFIG.version;
    log(`No se pudo consultar version Baileys; uso fallback ${fallback.join(".")}: ${error.message}`);
    return fallback;
  }
}

async function handleConnectionUpdate(update) {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    console.log("");
    log("Escanea este QR con WhatsApp Business de Cecilia: Menu > Dispositivos vinculados > Vincular dispositivo.");
    if (config.printQrTerminal) qrcode.generate(qr, { small: true });
    fs.writeFileSync(config.qrTextFile, qr);
    await qrImage.toFile(config.qrPngFile, qr, {
      width: 900,
      margin: 3,
      color: { dark: "#000000", light: "#ffffff" },
    });
    log(`QR PNG actualizado: ${config.qrPngFile}`);
    console.log("");
  }

  if (connection === "open") {
    reconnectAttempts = 0;
    log("Puente listo. Escuchando mensajes entrantes individuales.");
  }

  if (connection === "close") {
    const statusCode = getDisconnectStatusCode(lastDisconnect);
    log(`Conexion cerrada${statusCode ? ` (codigo ${statusCode})` : ""}.`);

    if (statusCode === DisconnectReason.loggedOut) {
      log("La sesion fue cerrada desde WhatsApp. Hay que volver a vincular con QR nuevo.");
      archiveSessionDir();
      scheduleReconnect();
      return;
    }

    scheduleReconnect();
  }
}

async function handleMessagesUpsert(event) {
  if (!event || event.type !== "notify") return;

  for (const message of event.messages || []) {
    await processMessage(message);
  }
}

async function processMessage(message) {
  try {
    if (shouldSkipMessage(message)) return;

    const messageKey = getMessageKey(message);
    if (processed.ids.has(messageKey)) {
      log(`Duplicado ignorado: ${messageKey}`);
      return;
    }

    const remoteJid = message.key.remoteJid;
    const fromDigits = normalizeWaId(remoteJid);
    if (!fromDigits) {
      log(`Mensaje ignorado porque no pude obtener telefono desde JID: ${remoteJid}`);
      return;
    }

    const content = normalizeMessageContent(message.message || {}) || message.message || {};
    const contentType = getContentType(content) || "unknown";
    const body = buildMessageBody(content, contentType);
    const senderName = cleanName(message.pushName || `Cliente WhatsApp ${fromDigits.slice(-4)}`);
    const timestamp = Number(message.messageTimestamp) || Math.floor(Date.now() / 1000);

    const payload = buildMetaCloudPayload({
      fromDigits,
      senderName,
      body,
      messageId: `baileys-${toBase64Url(messageKey).slice(0, 96)}`,
      timestamp,
      bridgeMeta: {
        source: "cecilia-baileys-bridge",
        baileys_type: contentType,
        remote_jid: remoteJid,
        message_id: message.key.id,
      },
    });

    await deliver(payload);
    rememberProcessed(processed, config.processedFile, messageKey, config.processedLimit);
    log(`Entregado a n8n: ${senderName} ${formatPhone(fromDigits)} - ${body.slice(0, 90)}`);
  } catch (error) {
    log(`Error procesando mensaje: ${error?.stack || error?.message || error}`);
  }
}

async function deliver(payload) {
  if (config.dryRun) {
    log("DRY RUN payload:");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Stratos-Bridge": "cecilia-baileys",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n respondio HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
}

function buildMetaCloudPayload({ fromDigits, senderName, body, messageId, timestamp, bridgeMeta }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: config.wabaId,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: config.displayPhoneNumber,
                phone_number_id: config.phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: senderName },
                  wa_id: fromDigits,
                },
              ],
              messages: [
                {
                  from: fromDigits,
                  id: messageId,
                  timestamp: String(timestamp),
                  type: "text",
                  text: { body },
                },
              ],
              bridge: bridgeMeta,
            },
          },
        ],
      },
    ],
  };
}

function shouldSkipMessage(message) {
  if (!message || !message.message) return true;
  if (message.key?.fromMe) return true;

  const remoteJid = message.key?.remoteJid || "";
  if (!remoteJid) return true;
  if (isJidGroup(remoteJid)) return true;
  if (isJidBroadcast(remoteJid) || isJidStatusBroadcast(remoteJid)) return true;
  if (isJidNewsletter(remoteJid)) return true;
  if (message.messageStubType != null) return true;

  return false;
}

function buildMessageBody(content, contentType) {
  const direct = getTextContent(content, contentType);
  if (direct) return direct;

  const label = {
    audioMessage: content.audioMessage?.ptt ? "Nota de voz recibida" : "Audio recibido",
    contactMessage: content.contactMessage?.displayName
      ? `Contacto recibido: ${content.contactMessage.displayName}`
      : "Contacto recibido",
    contactsArrayMessage: "Contactos recibidos",
    documentMessage: "Documento recibido",
    imageMessage: "Foto recibida",
    liveLocationMessage: "Ubicacion en vivo recibida",
    locationMessage: formatLocation(content.locationMessage),
    reactionMessage: content.reactionMessage?.text
      ? `Reaccion recibida: ${content.reactionMessage.text}`
      : "Reaccion recibida",
    stickerMessage: "Sticker recibido",
    videoMessage: "Video recibido",
  }[contentType];

  return label ? `[${label}]` : `[Mensaje recibido: ${contentType || "desconocido"}]`;
}

function getTextContent(content, contentType) {
  const value = {
    conversation: content.conversation,
    extendedTextMessage: content.extendedTextMessage?.text,
    imageMessage: content.imageMessage?.caption,
    videoMessage: content.videoMessage?.caption,
    documentMessage: content.documentMessage?.caption,
    buttonsResponseMessage:
      content.buttonsResponseMessage?.selectedDisplayText || content.buttonsResponseMessage?.selectedButtonId,
    listResponseMessage:
      content.listResponseMessage?.title ||
      content.listResponseMessage?.description ||
      content.listResponseMessage?.singleSelectReply?.selectedRowId,
    templateButtonReplyMessage:
      content.templateButtonReplyMessage?.selectedDisplayText ||
      content.templateButtonReplyMessage?.selectedId,
    interactiveResponseMessage:
      content.interactiveResponseMessage?.body?.text ||
      content.interactiveResponseMessage?.nativeFlowResponseMessage?.name,
  }[contentType];

  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatLocation(location) {
  if (!location) return "Ubicacion recibida";
  const lat = location.degreesLatitude;
  const lng = location.degreesLongitude;
  if (lat == null || lng == null) return "Ubicacion recibida";
  return `Ubicacion recibida: ${lat}, ${lng}`;
}

function getMessageKey(message) {
  return [
    message.key?.remoteJid,
    message.key?.participant,
    message.key?.id,
    message.messageTimestamp,
  ]
    .filter(Boolean)
    .join("::");
}

function normalizeWaId(value) {
  return String(value || "").replace(/@.*/, "").replace(/\D/g, "");
}

function cleanName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  return name || "Cliente WhatsApp";
}

function formatPhone(digits) {
  return digits ? `+${digits}` : "(sin telefono)";
}

function formatPairingCode(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function toBase64Url(value) {
  return Buffer.from(String(value)).toString("base64url");
}

function loadProcessed(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) return { list: ids, ids: new Set(ids) };
  } catch {
    // No previous dedupe file.
  }
  return { list: [], ids: new Set() };
}

function rememberProcessed(state, file, id, limit) {
  state.ids.add(id);
  state.list.unshift(id);
  if (state.list.length > limit) {
    for (const removed of state.list.splice(limit)) state.ids.delete(removed);
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state.list, null, 2));
  fs.renameSync(tmp, file);
}

function scheduleReconnect() {
  if (stopping || reconnectTimer) return;
  if (pairingCodeTimer) {
    clearTimeout(pairingCodeTimer);
    pairingCodeTimer = null;
  }

  const delay = Math.min(
    config.reconnectMaxMs,
    config.reconnectBaseMs * 2 ** Math.min(reconnectAttempts, 4)
  );
  reconnectAttempts += 1;
  log(`Reintentando conexion en ${Math.round(delay / 1000)}s.`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await connect();
    } catch (error) {
      log(`No se pudo reconectar: ${error?.stack || error?.message || error}`);
      scheduleReconnect();
    }
  }, delay);
}

function archiveSessionDir() {
  if (!fs.existsSync(config.sessionDir)) return;
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const backupDir = `${config.sessionDir}.backup-${stamp}`;
  try {
    fs.renameSync(config.sessionDir, backupDir);
    log(`Sesion local archivada: ${backupDir}`);
  } catch (error) {
    log(`No pude archivar sesion local ${config.sessionDir}: ${error?.message || error}`);
  }
}

function getDisconnectStatusCode(lastDisconnect) {
  return (
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.status ||
    lastDisconnect?.error?.data?.statusCode ||
    null
  );
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] != null) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function env(key, fallback) {
  const value = process.env[key];
  return value == null || value === "" ? fallback : value;
}

function ensureWebhookUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Webhook must be HTTPS");
  } catch (error) {
    throw new Error(`CECILIA_BRIDGE_WEBHOOK_URL invalido: ${error.message}`);
  }
}

async function shutdown() {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pairingCodeTimer) clearTimeout(pairingCodeTimer);
  log("Cerrando puente...");
  await sock?.end?.();
  process.exit(0);
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  try {
    fs.appendFileSync(config.eventLogFile, `${line}\n`);
  } catch {
    // Keep stdout logging available even if the local event log cannot be written.
  }
  console.log(line);
}
