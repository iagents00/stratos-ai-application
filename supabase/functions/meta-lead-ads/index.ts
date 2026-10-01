// meta-lead-ads — receptor directo para Meta Lead Ads -> Stratos CRM.
//
// Endpoint publico (deploy con --no-verify-jwt) porque Meta debe poder llamar
// el webhook. La seguridad queda en:
//   1) GET challenge con META_LEAD_ADS_VERIFY_TOKEN.
//   2) POST firmado por Meta con x-hub-signature-256 + META_APP_SECRET, o
//      secreto interno x-stratos-meta-secret para pruebas/server-to-server.
//
// Deploy:
//   supabase secrets set META_LEAD_ADS_VERIFY_TOKEN=...
//   supabase secrets set META_APP_SECRET=...
//   supabase secrets set META_PAGE_ACCESS_TOKEN=...
//   supabase functions deploy meta-lead-ads --no-verify-jwt
//
// Callback URL:
//   https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/meta-lead-ads

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ??
  "https://glulgyhkrqpykxmujodb.supabase.co";
const SERVICE_ROLE =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const VERIFY_TOKEN =
  Deno.env.get("META_LEAD_ADS_VERIFY_TOKEN") ?? "stratos-meta-leads-2026";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const META_POST_SECRET = Deno.env.get("META_LEAD_ADS_POST_SECRET") ?? "";
const META_ACCESS_TOKEN =
  Deno.env.get("META_PAGE_ACCESS_TOKEN") ??
  Deno.env.get("META_LEAD_ACCESS_TOKEN") ??
  Deno.env.get("META_ACCESS_TOKEN") ??
  "";
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v26.0";

const DEFAULT_POOL_KEY =
  Deno.env.get("META_LEAD_ADS_POOL_KEY") ?? "duke_ads_round_robin";
const N8N_ADVISOR_WA_WEBHOOK = Deno.env.get("N8N_ADVISOR_WA_WEBHOOK") ?? "";
const N8N_ADVISOR_WA_SECRET = Deno.env.get("N8N_ADVISOR_WA_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type MetaLeadNotification = {
  leadgen_id?: string;
  lead_id?: string;
  form_id?: string;
  page_id?: string;
  campaign_id?: string;
  adset_id?: string;
  adgroup_id?: string;
  ad_id?: string;
  created_time?: number | string;
  [key: string]: unknown;
};

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-stratos-meta-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyMetaSignature(rawBody: string, signature: string | null) {
  if (!META_APP_SECRET) return false;
  if (!signature?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(META_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(`sha256=${toHex(digest)}`, signature);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function triggerAdvisorWhatsAppPump(results: unknown[]) {
  if (!N8N_ADVISOR_WA_WEBHOOK) return;
  if (!results.some((result) => isRecord(result) && result.ok)) return;

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (N8N_ADVISOR_WA_SECRET) {
      headers["x-stratos-webhook-secret"] = N8N_ADVISOR_WA_SECRET;
    }

    const response = await fetch(N8N_ADVISOR_WA_WEBHOOK, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "meta-lead-ads",
        event: "advisor_whatsapp_queue_ready",
        results,
        triggered_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.error("[meta-lead-ads] n8n advisor pump failed", response.status);
    }
  } catch (error) {
    console.error("[meta-lead-ads] n8n advisor pump error", (error as Error).message);
  }
}

function extractNotifications(body: Record<string, unknown>): MetaLeadNotification[] {
  if (body.leadgen_id || body.lead_id || body.field_data) {
    return [body as MetaLeadNotification];
  }

  const notifications: MetaLeadNotification[] = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const entryPageId = typeof entry.id === "string" ? entry.id : undefined;
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      if (!isRecord(change)) continue;
      if (change.field !== "leadgen") continue;
      if (!isRecord(change.value)) continue;
      notifications.push({
        page_id: entryPageId,
        ...(change.value as MetaLeadNotification),
      });
    }
  }

  return notifications;
}

async function fetchLeadDetails(notification: MetaLeadNotification) {
  const leadgenId = String(notification.leadgen_id ?? notification.lead_id ?? "");
  if (!leadgenId || !META_ACCESS_TOKEN) {
    return {
      ...notification,
      source: "meta_lead_ads",
      fetch_error: !leadgenId ? "missing_leadgen_id" : "missing_meta_access_token",
    };
  }

  const fields = [
    "created_time",
    "id",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "form_id",
    "field_data",
    "platform",
  ].join(",");

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", META_ACCESS_TOKEN);

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("[meta-lead-ads] Graph fetch failed", response.status, data);
    return {
      ...notification,
      source: "meta_lead_ads",
      fetch_error: "graph_fetch_failed",
      graph_status: response.status,
      graph_response: data,
    };
  }

  return {
    ...notification,
    ...(isRecord(data) ? data : {}),
    leadgen_id: leadgenId,
    meta_lead_id: leadgenId,
    source: "meta_lead_ads",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(origin) });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { "content-type": "text/plain", ...cors(origin) },
      });
    }
    return json({ ok: false, error: "verification_failed" }, 403, origin);
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  if (!SERVICE_ROLE) {
    return json({ ok: false, error: "server_misconfigured", missing: "service_role" }, 500, origin);
  }

  const rawBody = await req.text();
  const metaSignatureOk = await verifyMetaSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );
  const postSecretOk =
    Boolean(META_POST_SECRET) &&
    req.headers.get("x-stratos-meta-secret") === META_POST_SECRET;

  if (!metaSignatureOk && !postSecretOk) {
    return json({
      ok: false,
      error: META_APP_SECRET || META_POST_SECRET ? "unauthorized" : "server_misconfigured",
      detail: META_APP_SECRET || META_POST_SECRET
        ? "missing_or_invalid_signature"
        : "set_META_APP_SECRET_or_META_LEAD_ADS_POST_SECRET",
    }, META_APP_SECRET || META_POST_SECRET ? 401 : 500, origin);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!isRecord(parsed)) throw new Error("payload_not_object");
    body = parsed;
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }

  const poolKey = String(body.pool_key ?? body.p_pool_key ?? DEFAULT_POOL_KEY);
  const notifications = extractNotifications(body);
  if (notifications.length === 0) {
    return json({ ok: true, ignored: true, reason: "no_leadgen_changes" }, 200, origin);
  }

  const results = [];
  for (const notification of notifications) {
    const fetched = await fetchLeadDetails(notification);
    const payload = {
      ...fetched,
      source: "meta_lead_ads",
      received_at: new Date().toISOString(),
      raw_webhook_value: notification,
    };

    const { data, error } = await admin.rpc("fn_upsert_lead_from_meta_ads", {
      payload,
      p_pool_key: poolKey,
    });

    if (error) {
      console.error("[meta-lead-ads] RPC failed", error.message, payload);
      results.push({
        ok: false,
        error: "rpc_failed",
        detail: error.message,
        leadgen_id: payload.leadgen_id ?? payload.lead_id ?? null,
        fetch_error: payload.fetch_error ?? null,
      });
      continue;
    }

    results.push(data);
  }

  await triggerAdvisorWhatsAppPump(results);

  return json({
    ok: results.every((r) => Boolean(isRecord(r) && r.ok)),
    count: results.length,
    results,
  }, 200, origin);
});
