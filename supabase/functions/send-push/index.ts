// send-push — envía notificaciones push a dispositivos suscritos via Web Push API
// ─────────────────────────────────────────────────────────────────────────────
// Endpoint PRIVADO (verify_jwt=false, protegido por secreto compartido).
// Lo llaman flujos de n8n Y el trigger de DB `trg_push_on_proactive_sent`
// (vía pg_net) cuando hay que notificar a un usuario (recordatorios, Copilot…).
//
// Payload esperado:
//   POST { user_id, title, body, url?, view?, lead_id?, tag? }
//     → Busca todas las suscripciones del usuario, envía push a cada una.
//   POST { user_ids: [...], title, body, ... }
//     → Igual pero para múltiples usuarios a la vez.
//
// La VAPID private key se lee de env (VAPID_PRIVATE_KEY) o, si no está, de la
// tabla `push_secure_config` (server-side, RLS solo service_role). Así el repo
// NUNCA lleva el secreto pero el deploy funciona igual.
//
// Deploy: supabase functions deploy send-push --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ??
  "https://glulgyhkrqpykxmujodb.supabase.co";
const SERVICE_ROLE =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// VAPID public key (raw P-256, base64url). Es PÚBLICA por diseño — puede ir en
// el código y en el frontend (applicationServerKey). DEBE coincidir con la
// private guardada en push_secure_config.vapid_private.
const VAPID_SUBJECT = "mailto:angel@iagents.io";
const VAPID_PUBLIC_KEY =
  "BI73OWNrVS1mQwL825rbFkv7PxGCRklmJdrCgV6tvJtL2hx1cZSIbg_xs8sfnemFTBz0gtq-lBRFe_5Pypcif2o";

// Secreto compartido simple (debe coincidir con quien llame: n8n / trigger DB)
const PUSH_SECRET =
  Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "stratos-push-internal-2026";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Private key: env primero; si no, de la DB (push_secure_config). Cache en warm.
let _vapidPrivate: string | null = null;
async function getVapidPrivate(): Promise<string> {
  const env = Deno.env.get("VAPID_PRIVATE_KEY");
  if (env && !env.startsWith("__SET_")) return env;
  if (_vapidPrivate) return _vapidPrivate;
  try {
    const { data, error } = await admin
      .from("push_secure_config")
      .select("value")
      .eq("key", "vapid_private")
      .maybeSingle();
    if (error) {
      console.error("[send-push] no pude leer vapid_private de DB:", error.message);
      return "";
    }
    _vapidPrivate = data?.value ?? "";
    return _vapidPrivate;
  } catch (e) {
    console.error("[send-push] excepción leyendo vapid_private:", (e as Error).message);
    return "";
  }
}

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-push-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...cors(origin),
    },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(origin) });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  // Auth por secreto compartido (sin JWT — lo llaman flujos internos / trigger DB)
  const secret = req.headers.get("x-push-secret") ?? "";
  if (secret !== PUSH_SECRET) {
    return json({ ok: false, error: "unauthorized" }, 401, origin);
  }

  const VAPID_PRIVATE_KEY = await getVapidPrivate();
  if (!SERVICE_ROLE || !VAPID_PRIVATE_KEY || VAPID_PRIVATE_KEY.startsWith("__SET_")) {
    console.error("[send-push] Falta SERVICE_ROLE o VAPID_PRIVATE_KEY");
    return json({ ok: false, error: "server_misconfigured" }, 500, origin);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }

  const title = String(payload.title || "Stratos AI");
  const body = String(payload.body || "");
  const url = String(payload.url || "/");
  const view = String(payload.view || "c");
  const leadId = payload.lead_id ? String(payload.lead_id) : null;
  const tag = String(payload.tag || "stratos-notif");

  // Determinar los user_ids a notificar
  const userIds: string[] = [];
  if (Array.isArray(payload.user_ids)) {
    for (const id of payload.user_ids) {
      if (typeof id === "string" && id.length > 0) userIds.push(id);
    }
  } else if (typeof payload.user_id === "string" && payload.user_id.length > 0) {
    userIds.push(payload.user_id);
  }

  if (userIds.length === 0) {
    return json({ ok: false, error: "no_user_ids" }, 400, origin);
  }

  // Configurar web-push con las VAPID keys
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const pushPayload = JSON.stringify({
    title,
    body,
    icon: "/icon-192.png",
    badge: "/favicon-32.png",
    tag,
    url,
    view,
    lead_id: leadId,
    timestamp: Date.now(),
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Buscar y enviar a cada usuario
  for (const userId of userIds) {
    try {
      const { data: subs, error } = await admin.rpc("push_get_for_user", {
        p_user_id: userId,
      });

      if (error) {
        console.error(`[send-push] Error buscando subs para ${userId}:`, error.message);
        failed++;
        continue;
      }

      if (!subs || subs.length === 0) {
        continue; // usuario sin suscripciones → no es error
      }

      for (const sub of subs as Array<{ endpoint: string; p256dh: string; auth: string; platform: string }>) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload,
          );
          sent++;
        } catch (e) {
          const msg = (e as Error).message || "";
          console.error(`[send-push] Error enviando a ${sub.platform}:`, msg);

          // Si la suscripción expiró (410 Gone / 404), eliminarla
          if (
            msg.includes("410") || msg.includes("gone") ||
            msg.includes("404") || msg.includes("expired") ||
            msg.includes("unsubscribed")
          ) {
            try {
              await admin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", sub.endpoint);
              console.log(`[send-push] Suscripción expirada eliminada: ${sub.endpoint.substring(0, 50)}...`);
            } catch { /* best-effort */ }
          }

          failed++;
          if (errors.length < 5) errors.push(msg);
        }
      }
    } catch (e) {
      console.error(`[send-push] Error procesando usuario ${userId}:`, (e as Error).message);
      failed++;
    }
  }

  return json(
    {
      ok: true,
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      users: userIds.length,
    },
    200,
    origin,
  );
});
