// send-push — envía notificaciones push a dispositivos suscritos via Web Push API
// ─────────────────────────────────────────────────────────────────────────────
// Endpoint PRIVADO (verify_jwt=false, protegido por secreto compartido).
// Lo llaman flujos de n8n cuando hay que notificar a un usuario (WhatsApp,
// recordatorios, Copilot, etc.).
//
// Payload esperado:
//   POST { user_id, title, body, url?, view?, lead_id?, tag? }
//     → Busca todas las suscripciones del usuario, envía push a cada una.
//
//   POST { user_ids: [...], title, body, ... }
//     → Igual pero para múltiples usuarios a la vez.
//
// Requiere el secreto VAPID_PRIVATE_KEY en las variables de entorno de Supabase.
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

// VAPID keys (generadas para app.stratoscapitalgroup.com)
const VAPID_SUBJECT = "mailto:angel@iagents.io";
const VAPID_PUBLIC_KEY =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE05rs6s65MZsvr2G0N72CxJbPlRV4Pp8jvg8BCARk5IJauQ2_kvQ_WRVFM9cctR-9PLHODm0d7aE7eGneZmDa5g";
const VAPID_PRIVATE_KEY =
  Deno.env.get("VAPID_PRIVATE_KEY") ??
  "__SET_VAPID_PRIVATE_KEY_IN_SUPABASE_SECRETS__";

// Secreto compartido simple (puede ser cualquier string; debe coincidir con quien llame)
const PUSH_SECRET =
  Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "stratos-push-internal-2026";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

  // Auth por secreto compartido (sin JWT — lo llaman flujos internos de n8n)
  const secret = req.headers.get("x-push-secret") ?? "";
  if (secret !== PUSH_SECRET) {
    return json({ ok: false, error: "unauthorized" }, 401, origin);
  }

  if (!SERVICE_ROLE || !VAPID_PRIVATE_KEY || VAPID_PRIVATE_KEY.startsWith("__SET_")) {
    console.error("[send-push] Falta SERVICE_ROLE o VAPID_PRIVATE_KEY en secrets");
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
