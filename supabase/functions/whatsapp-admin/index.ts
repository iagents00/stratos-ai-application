import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SB_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const INFOBIP_BASE_URL = (Deno.env.get("INFOBIP_BASE_URL") ?? "https://api.infobip.com").replace(/\/$/, "");
const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY") ?? "";

const VALID_ROLES = new Set(["super_admin", "admin", "director", "ceo", "asesor", "marketing", "colaborador"]);
const VALID_STATUSES = new Set(["draft", "waiting_customer", "meta_finished", "infobip_registering", "ready_to_test", "active", "failed", "disconnected"]);

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const respond = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) },
  });

const slugify = (value: string) => value
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

const normalizePhone = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
};

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return respond({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return respond({ ok: false, error: "server_misconfigured" }, 500, origin);

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return respond({ ok: false, error: "Tu sesión venció. Vuelve a entrar." }, 401, origin);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user?.id) return respond({ ok: false, error: "Sesión inválida." }, 401, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
  const callerId = authData.user.id;
  const { data: platformAdmin } = await admin.from("platform_admins")
    .select("user_id, active").eq("user_id", callerId).eq("active", true).maybeSingle();
  if (!platformAdmin) return respond({ ok: false, error: "Acceso restringido a administradores de plataforma." }, 403, origin);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return respond({ ok: false, error: "bad_json" }, 400, origin); }
  const action = String(body.action ?? "bootstrap");

  try {
    if (action === "bootstrap") {
      const [orgs, profiles, channels, runs] = await Promise.all([
        admin.from("organizations").select("id,name,slug,plan,seats,active,subscription_status,meta_config,created_at").order("created_at", { ascending: false }),
        admin.from("profiles").select("id,organization_id,name,role,active,phone").order("name"),
        admin.from("whatsapp_numero_asesor").select("id,organization_id,numero_whatsapp,asesor_id,asesor_name,waba_id,phone_number_id,estado_conexion,quality_rating,active,updated_at").order("updated_at", { ascending: false }),
        admin.from("whatsapp_onboarding_runs").select("*").order("created_at", { ascending: false }).limit(300),
      ]);
      const firstError = orgs.error || profiles.error || channels.error || runs.error;
      if (firstError) throw firstError;
      return respond({
        ok: true,
        organizations: orgs.data ?? [], profiles: profiles.data ?? [],
        channels: channels.data ?? [], runs: runs.data ?? [],
        provider: { infobipConfigured: Boolean(INFOBIP_API_KEY), embeddedSignupReady: Boolean(INFOBIP_API_KEY) },
      }, 200, origin);
    }

    if (action === "create_organization") {
      const name = String(body.name ?? "").trim();
      const slug = slugify(String(body.slug ?? name));
      const seats = Math.max(1, Math.min(1000, Number(body.seats ?? 30) || 30));
      if (name.length < 2 || !slug) return respond({ ok: false, error: "Falta un nombre válido para la empresa." }, 400, origin);
      const metaConfig = {
        onboarding: { status: "draft", createdFrom: "whatsapp_admin", createdAt: new Date().toISOString() },
        features: { crm: true, teamAdmin: true, whatsappSignup: true, whatsappModule: false, whatsappChat: false },
      };
      const { data, error } = await admin.from("organizations").insert({
        name, slug, seats, plan: "custom", active: true, subscription_status: "trial", meta_config: metaConfig,
      }).select("id,name,slug,seats,plan,active,subscription_status,meta_config,created_at").single();
      if (error) throw error;
      return respond({ ok: true, organization: data }, 200, origin);
    }

    if (action === "create_user") {
      const organizationId = String(body.organization_id ?? "");
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = String(body.role ?? "asesor");
      const platform = body.platform_admin === true;
      const suppliedPassword = String(body.password ?? "");
      const password = suppliedPassword || tempPassword();
      if (!organizationId || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return respond({ ok: false, error: "Empresa, nombre y correo válido son obligatorios." }, 400, origin);
      }
      if (!VALID_ROLES.has(role)) return respond({ ok: false, error: "Rol inválido." }, 400, origin);
      if (password.length < 12) return respond({ ok: false, error: "La contraseña debe tener al menos 12 caracteres." }, 400, origin);
      const { data: org } = await admin.from("organizations").select("id").eq("id", organizationId).eq("active", true).maybeSingle();
      if (!org) return respond({ ok: false, error: "La empresa no existe o está inactiva." }, 404, origin);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name },
      });
      if (createError) throw createError;
      const userId = created.user?.id;
      if (!userId) throw new Error("Auth no devolvió el id del usuario.");
      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId, organization_id: organizationId, name, role, active: true,
      });
      if (profileError) {
        // No borrar automáticamente una identidad si falla el perfil. Se
        // bloquea para que quede auditable y pueda repararse manualmente.
        await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" }).catch(() => null);
        throw profileError;
      }
      if (platform) {
        const { error: grantError } = await admin.from("platform_admins").upsert({ user_id: userId, active: true, granted_by: callerId });
        if (grantError) throw grantError;
      }
      return respond({ ok: true, user: { id: userId, email, name, role, organization_id: organizationId }, temp_password: password }, 200, origin);
    }

    if (action === "create_run") {
      const organizationId = String(body.organization_id ?? "");
      const advisorId = String(body.advisor_id ?? "") || null;
      const phone = normalizePhone(body.phone_e164);
      const ownerType = body.owner_type === "advisor" ? "advisor" : "company";
      if (!organizationId) return respond({ ok: false, error: "Selecciona la empresa." }, 400, origin);
      if (body.phone_e164 && !phone) return respond({ ok: false, error: "El número debe estar en formato internacional." }, 400, origin);
      if (advisorId) {
        const { data: advisor } = await admin.from("profiles").select("id").eq("id", advisorId).eq("organization_id", organizationId).eq("active", true).maybeSingle();
        if (!advisor) return respond({ ok: false, error: "El asesor no pertenece a esa empresa." }, 400, origin);
      }
      const { data, error } = await admin.from("whatsapp_onboarding_runs").insert({
        organization_id: organizationId, requested_by: callerId, advisor_id: advisorId,
        owner_type: ownerType, owner_name: String(body.owner_name ?? "").trim() || null,
        phone_e164: phone, status: "waiting_customer",
      }).select("*").single();
      if (error) throw error;
      return respond({ ok: true, run: data }, 200, origin);
    }

    if (action === "complete_signup" || action === "retry_share") {
      const runId = String(body.run_id ?? "");
      const { data: run } = await admin.from("whatsapp_onboarding_runs").select("*").eq("id", runId).maybeSingle();
      if (!run) return respond({ ok: false, error: "No encontré ese proceso." }, 404, origin);
      const wabaId = String(body.waba_id ?? run.waba_id ?? "").trim();
      const phoneNumberId = String(body.phone_number_id ?? run.phone_number_id ?? "").trim() || null;
      if (!wabaId) return respond({ ok: false, error: "Meta no devolvió el WABA ID." }, 400, origin);
      await admin.from("whatsapp_onboarding_runs").update({
        waba_id: wabaId, phone_number_id: phoneNumberId, status: "meta_finished",
        meta_completed_at: new Date().toISOString(), last_error: null,
      }).eq("id", runId);
      if (!INFOBIP_API_KEY) return respond({ ok: false, error: "Falta configurar INFOBIP_API_KEY en el servidor.", run_id: runId }, 503, origin);
      await admin.from("whatsapp_onboarding_runs").update({ status: "infobip_registering" }).eq("id", runId);
      const infobip = await fetch(`${INFOBIP_BASE_URL}/whatsapp/1/embedded-signup/registrations/share-waba`, {
        method: "POST",
        headers: {
          Authorization: INFOBIP_API_KEY.startsWith("App ") ? INFOBIP_API_KEY : `App ${INFOBIP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessAccountId: wabaId }),
      });
      const responseBody = await infobip.json().catch(() => ({}));
      if (!infobip.ok) {
        const message = String(responseBody?.requestError?.serviceException?.text ?? responseBody?.message ?? `Infobip HTTP ${infobip.status}`);
        await admin.from("whatsapp_onboarding_runs").update({ status: "failed", last_error: message, provider_state: responseBody }).eq("id", runId);
        return respond({ ok: false, error: message }, 502, origin);
      }
      await admin.from("whatsapp_onboarding_runs").update({ provider_state: responseBody }).eq("id", runId);
      return respond({ ok: true, run_id: runId, status: "infobip_registering" }, 200, origin);
    }

    if (action === "approve_tests") {
      const runId = String(body.run_id ?? "");
      const checks = body.checks as Record<string, unknown> | undefined;
      const required = ["inbound", "outbound", "media", "isolation"];
      if (!checks || required.some(key => checks[key] !== true)) {
        return respond({ ok: false, error: "Deben pasar entrada, salida, multimedia y aislamiento." }, 400, origin);
      }
      const { data: run } = await admin.from("whatsapp_onboarding_runs").select("id,phone_number_id,status").eq("id", runId).maybeSingle();
      if (!run || run.status !== "ready_to_test") return respond({ ok: false, error: "El canal todavía no está listo para aprobar pruebas." }, 409, origin);
      await admin.from("whatsapp_onboarding_runs").update({ status: "active", verified_at: new Date().toISOString() }).eq("id", runId);
      if (run.phone_number_id) {
        await admin.from("whatsapp_numero_asesor").update({ estado_conexion: "CONNECTED", verificado_at: new Date().toISOString(), ultimo_error: null }).eq("phone_number_id", run.phone_number_id);
      }
      return respond({ ok: true, status: "active" }, 200, origin);
    }

    if (action === "set_status") {
      const runId = String(body.run_id ?? "");
      const status = String(body.status ?? "");
      if (!VALID_STATUSES.has(status)) return respond({ ok: false, error: "Estado inválido." }, 400, origin);
      const { error } = await admin.from("whatsapp_onboarding_runs").update({ status }).eq("id", runId);
      if (error) throw error;
      return respond({ ok: true, status }, 200, origin);
    }

    return respond({ ok: false, error: "Acción no reconocida." }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return respond({ ok: false, error: message }, 500, origin);
  }
});
