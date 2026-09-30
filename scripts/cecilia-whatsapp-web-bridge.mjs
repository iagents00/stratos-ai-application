#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import qrcode from "qrcode-terminal";
import qrImage from "qrcode";
import waPkg from "whatsapp-web.js";

const { Client, LocalAuth } = waPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const DEFAULTS = {
  webhookUrl: "https://personal-n8n.suwsiw.easypanel.host/webhook/meta-directo-leads",
  displayPhoneNumber: "+52 1 984 254 0664",
  phoneNumberId: "1139531549240830",
  wabaId: "1900999323921319",
  verifiedName: "Cecilia Mendoza Vazquez Asesora Inmobiliaria Certificada",
  clientId: "cecilia-9842540664",
  sessionDir: ".wa-sessions",
  processedFile: ".wa-sessions/cecilia-processed.json",
  qrPngFile: ".wa-sessions/cecilia-latest-qr.png",
  qrTextFile: ".wa-sessions/cecilia-latest-qr.txt",
  processedLimit: 2000,
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
  clientId: env("CECILIA_BRIDGE_CLIENT_ID", DEFAULTS.clientId),
  sessionDir: path.resolve(rootDir, env("CECILIA_BRIDGE_SESSION_DIR", DEFAULTS.sessionDir)),
  processedFile: path.resolve(rootDir, env("CECILIA_BRIDGE_PROCESSED_FILE", DEFAULTS.processedFile)),
  qrPngFile: path.resolve(rootDir, env("CECILIA_BRIDGE_QR_PNG_FILE", DEFAULTS.qrPngFile)),
  qrTextFile: path.resolve(rootDir, env("CECILIA_BRIDGE_QR_TEXT_FILE", DEFAULTS.qrTextFile)),
  processedLimit: Number(env("CECILIA_BRIDGE_PROCESSED_LIMIT", String(DEFAULTS.processedLimit))),
  chromeExecutable: env("PUPPETEER_EXECUTABLE_PATH", findChromeExecutable()),
  headless: !["0", "false", "no"].includes(env("CECILIA_BRIDGE_HEADLESS", "1").toLowerCase()),
  dryRun: args.has("--dry-run") || env("CECILIA_BRIDGE_DRY_RUN", "0") === "1",
  simulate: args.has("--simulate"),
};

ensureWebhookUrl(config.webhookUrl);
fs.mkdirSync(config.sessionDir, { recursive: true });
fs.mkdirSync(path.dirname(config.processedFile), { recursive: true });
fs.mkdirSync(path.dirname(config.qrPngFile), { recursive: true });
fs.mkdirSync(path.dirname(config.qrTextFile), { recursive: true });

const processed = loadProcessed(config.processedFile);

if (config.simulate) {
  const payload = buildMetaCloudPayload({
    fromDigits: "155501990664",
    senderName: "Bridge Simulation Cecilia",
    body: "Prueba local del puente Cecilia WhatsApp Web",
    messageId: `simulate-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    bridgeMeta: {
      mode: "simulate",
      source: "cecilia-whatsapp-web-bridge",
    },
  });
  await deliver(payload);
  process.exit(0);
}

log("Iniciando puente WhatsApp Web para Cecilia.");
log(`Webhook destino: ${config.webhookUrl}`);
log(`Telefono receptor Meta simulado: ${config.displayPhoneNumber} (${config.phoneNumberId})`);
log(config.dryRun ? "Modo DRY RUN: no se enviara nada a n8n." : "Modo REAL: mensajes entrantes se enviaran a n8n.");

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: config.clientId,
    dataPath: config.sessionDir,
  }),
  puppeteer: {
    executablePath: config.chromeExecutable || undefined,
    headless: config.headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

client.on("qr", async (qr) => {
  console.log("");
  log("Escanea este QR con WhatsApp Business de Cecilia: Menu > Dispositivos vinculados > Vincular dispositivo.");
  qrcode.generate(qr, { small: true });
  fs.writeFileSync(config.qrTextFile, qr);
  await qrImage.toFile(config.qrPngFile, qr, {
    width: 900,
    margin: 3,
    color: { dark: "#000000", light: "#ffffff" },
  });
  log(`QR PNG actualizado: ${config.qrPngFile}`);
  console.log("");
});

client.on("authenticated", () => log("Sesion autenticada."));
client.on("ready", () => log("Puente listo. Escuchando mensajes entrantes individuales."));
client.on("auth_failure", (message) => log(`Fallo de autenticacion: ${message}`));
client.on("disconnected", (reason) => {
  log(`WhatsApp Web desconectado: ${reason}`);
  process.exitCode = 1;
});

client.on("message", async (message) => {
  try {
    if (shouldSkip(message)) return;

    const messageKey = getMessageKey(message);
    if (processed.ids.has(messageKey)) {
      log(`Duplicado ignorado: ${messageKey}`);
      return;
    }

    const contact = await message.getContact().catch(() => null);
    const fromDigits = normalizeWaId(message.from);
    const senderName = cleanName(
      contact?.pushname || contact?.name || contact?.shortName || `Cliente WhatsApp ${fromDigits.slice(-4)}`
    );
    const body = buildMessageBody(message);

    const payload = buildMetaCloudPayload({
      fromDigits,
      senderName,
      body,
      messageId: `waweb-${messageKey}`,
      timestamp: Number(message.timestamp) || Math.floor(Date.now() / 1000),
      bridgeMeta: {
        source: "cecilia-whatsapp-web-bridge",
        whatsapp_web_type: message.type,
        has_media: Boolean(message.hasMedia),
        from: message.from,
      },
    });

    await deliver(payload);
    rememberProcessed(processed, config.processedFile, messageKey, config.processedLimit);
    log(`Entregado a n8n: ${senderName} ${formatPhone(fromDigits)} - ${body.slice(0, 90)}`);
  } catch (error) {
    log(`Error procesando mensaje: ${error?.stack || error?.message || error}`);
  }
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await client.initialize();
await new Promise(() => {});

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
      "X-Stratos-Bridge": "cecilia-whatsapp-web",
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

function shouldSkip(message) {
  if (!message || message.fromMe) return true;
  if (message.from === "status@broadcast" || message.to === "status@broadcast") return true;
  if (message.from?.endsWith("@g.us")) return true;
  if (message.type === "revoked") return true;
  return false;
}

function buildMessageBody(message) {
  const text = String(message.body || "").trim();
  if (text) return text;

  if (!message.hasMedia) return `[${message.type || "mensaje"} sin texto]`;

  const mediaLabel = {
    image: "Foto recibida",
    video: "Video recibido",
    audio: "Audio recibido",
    ptt: "Nota de voz recibida",
    document: "Documento recibido",
    sticker: "Sticker recibido",
  }[message.type] || `Adjunto recibido (${message.type || "media"})`;

  return `[${mediaLabel}]`;
}

function getMessageKey(message) {
  return String(message.id?._serialized || message.id?.id || `${message.from}-${message.timestamp}-${message.body}`);
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

function findChromeExecutable() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
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
  log("Cerrando puente...");
  await client.destroy().catch(() => {});
  process.exit(0);
}

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
