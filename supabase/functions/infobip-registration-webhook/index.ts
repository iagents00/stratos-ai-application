import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("INFOBIP_REGISTRATION_WEBHOOK_SECRET") ?? "";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !WEBHOOK_SECRET) return json({ ok: false, error: "server_misconfigured" }, 500);
  const url = new URL(req.url);
  const supplied = req.headers.get("x-stratos-webhook-secret") ?? url.searchParams.get("token") ?? "";
  if (supplied !== WEBHOOK_SECRET) return json({ ok: false, error: "unauthorized" }, 401);

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const wabaId = String(payload.businessAccountId ?? "");
  const status = String(payload.status ?? "").toUpperCase();
  const senders = Array.isArray(payload.senders) ? payload.senders as Array<Record<string, unknown>> : [];
  if (!wabaId || !status) return json({ ok: false, error: "missing_registration_identity" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: run } = await admin.from("whatsapp_onboarding_runs").select("*")
    .eq("waba_id", wabaId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return json({ ok: true, ignored: "unknown_waba" });

  if (status === "FAILED") {
    await admin.from("whatsapp_onboarding_runs").update({
      status: "failed", last_error: String(payload.registrationInfo ?? "Infobip reportó FAILED"), provider_state: payload,
    }).eq("id", run.id);
    return json({ ok: true, status: "failed" });
  }

  if (status !== "FINISHED") {
    await admin.from("whatsapp_onboarding_runs").update({ status: "infobip_registering", provider_state: payload }).eq("id", run.id);
    return json({ ok: true, status: "infobip_registering" });
  }

  const finished = senders.filter(sender => String(sender.status ?? "").toUpperCase() === "FINISHED");
  const { data: advisor } = run.advisor_id
    ? await admin.from("profiles").select("id,name").eq("id", run.advisor_id).maybeSingle()
    : { data: null };

  for (const sender of finished) {
    const phoneNumberId = String(sender.phoneNumberId ?? "");
    if (!phoneNumberId) continue;
    const displayPhone = String(sender.displayPhoneNumber ?? run.phone_e164 ?? phoneNumberId);
    const channel = {
      organization_id: run.organization_id,
      numero_whatsapp: displayPhone.startsWith("+") ? displayPhone : `+${displayPhone}`,
      asesor_id: advisor?.id ?? null,
      asesor_name: advisor?.name ?? run.owner_name ?? "Sin asignar",
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      platform_type: "CLOUD_API",
      verified_name: null,
      quality_rating: null,
      onboarded_via: "embedded_signup",
      onboarded_at: new Date().toISOString(),
      estado_conexion: "REGISTRATION_FINISHED",
      active: true,
      ultimo_error: null,
    };
    const { data: existing } = await admin.from("whatsapp_numero_asesor").select("id").eq("phone_number_id", phoneNumberId).maybeSingle();
    if (existing?.id) await admin.from("whatsapp_numero_asesor").update(channel).eq("id", existing.id);
    else await admin.from("whatsapp_numero_asesor").insert(channel);
  }

  const primary = finished[0];
  await admin.from("whatsapp_onboarding_runs").update({
    status: finished.length ? "ready_to_test" : "failed",
    phone_number_id: primary?.phoneNumberId ? String(primary.phoneNumberId) : run.phone_number_id,
    business_portfolio_id: payload.businessPortfolioId ? String(payload.businessPortfolioId) : run.business_portfolio_id,
    registration_info: String(payload.registrationInfo ?? ""),
    provider_state: payload,
    provider_completed_at: new Date().toISOString(),
    last_error: finished.length ? null : "Infobip terminó sin remitentes activos.",
  }).eq("id", run.id);

  return json({ ok: true, status: finished.length ? "ready_to_test" : "failed", senders: finished.length });
});
