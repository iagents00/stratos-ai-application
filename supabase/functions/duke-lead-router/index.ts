// duke-lead-router — public campaign router for Duke del Caribe.
//
// Flow:
//   1) Public campaign page POSTs lead contact + profile answer.
//   2) Function writes to Stratos via fn_upsert_lead_from_meta_ads.
//   3) Function returns the assigned advisor and a wa.me URL.
//
// Deploy:
//   supabase functions deploy duke-lead-router --no-verify-jwt --use-api --project-ref glulgyhkrqpykxmujodb

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ??
  "https://glulgyhkrqpykxmujodb.supabase.co";
const SERVICE_ROLE =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const POOL_KEY = Deno.env.get("DUKE_LEAD_ROUTER_POOL_KEY") ?? "duke_ads_round_robin";
const DEFAULT_CAMPAIGN = "DUKE - Desarrollos USD 97K - Stratos Router";
// Los asesores directos NO se hardcodean: el pool `duke_ads_<clave>` en
// Supabase es la configuración. Antes esto era un mapa con Marco adentro, y
// con cualquier otro asesor el prospecto le escribía a uno mientras el lead
// se asignaba a otro por round-robin. Para dar de alta un asesor basta crear
// su pool; no hay que tocar ni redesplegar esta función.
const DIRECT_POOL_PREFIX = "duke_ads_";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const html = (body: string, status: number, origin: string | null) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": [
        "default-src 'self'",
        "img-src 'self' https://app.stratoscapitalgroup.com data:",
        "style-src 'unsafe-inline'",
        "script-src 'unsafe-inline'",
        "connect-src 'self' https://glulgyhkrqpykxmujodb.supabase.co",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join("; "),
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      ...cors(origin),
    },
  });

function cleanText(value: unknown, max = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function phoneDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeMxPhone(value: unknown) {
  let digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("521")) return `+52${digits.slice(3)}`;
  return `+${digits}`;
}

function normalizeAdvisorKey(value: unknown) {
  const normalized = cleanText(value, 80)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return "";
  if (normalized.includes("marco")) return "marco";
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requestedAdvisorKey(body: Record<string, unknown>, campaign: string) {
  return normalizeAdvisorKey(
    body.advisor || body.asesor || body.target_advisor || body.advisor_slug || body.utm_content ||
      (campaign.toLowerCase().includes("marco") ? "marco" : ""),
  );
}

async function getDirectAdvisor(advisorKey: string) {
  if (!advisorKey) return null;

  // En dos pasos a propósito: `lead_assignment_pools` y
  // `lead_assignment_pool_members` tienen ambas una columna `active`, y un
  // filtro anidado sobre ella se vuelve ambiguo y devuelve vacío en silencio.
  const { data: pool } = await admin
    .from("lead_assignment_pools")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("pool_key", `${DIRECT_POOL_PREFIX}${advisorKey}`)
    .maybeSingle();

  if (!pool?.id) return null;

  const { data: member } = await admin
    .from("lead_assignment_pool_members")
    .select("asesor_id, asesor_name, advisor_phone_e164")
    .eq("pool_id", pool.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const phone = cleanText(member?.advisor_phone_e164, 40);
  if (!phone) return null;

  return {
    advisor_key: advisorKey,
    advisor_id: cleanText(member?.asesor_id, 80) || null,
    advisor_name: cleanText(member?.asesor_name, 120) || null,
    advisor_phone_e164: phone,
  };
}

async function getAdvisorPhone(asesorId: string | null, asesorName: string | null) {
  if (!asesorId) return null;

  const { data: member } = await admin
    .from("lead_assignment_pool_members")
    .select("advisor_phone_e164, asesor_name, lead_assignment_pools!inner(pool_key, organization_id)")
    .eq("asesor_id", asesorId)
    .eq("lead_assignment_pools.pool_key", POOL_KEY)
    .eq("lead_assignment_pools.organization_id", ORG_ID)
    .maybeSingle();

  const memberPhone = cleanText((member as { advisor_phone_e164?: string } | null)?.advisor_phone_e164, 40);
  if (memberPhone) {
    return {
      advisor_name: cleanText((member as { asesor_name?: string } | null)?.asesor_name || asesorName, 120),
      advisor_phone_e164: memberPhone,
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("name, phone")
    .eq("id", asesorId)
    .maybeSingle();

  const profilePhone = cleanText((profile as { phone?: string } | null)?.phone, 40);
  if (!profilePhone) return null;
  return {
    advisor_name: cleanText((profile as { name?: string } | null)?.name || asesorName, 120),
    advisor_phone_e164: profilePhone,
  };
}

function landingHtml() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Duke del Caribe | Desarrollos desde USD $97,000</title>
  <meta name="description" content="Propiedades seleccionadas en Cancun, Playa del Carmen y Tulum desde USD $97,000." />
  <meta property="og:title" content="Duke del Caribe | Desarrollos desde USD $97,000" />
  <meta property="og:description" content="Elige la ciudad que te interesa y recibe opciones disponibles por WhatsApp." />
  <meta property="og:image" content="https://stratoscapitalgroup.com/favicon-48.png" />
  <style>
    :root {
      color-scheme: light;
      --ink: #101820;
      --muted: #52616e;
      --line: #d9e1e7;
      --surface: #ffffff;
      --soft: #f5f8fa;
      --brand: #0d6b68;
      --brand-strong: #064e4c;
      --gold: #b68a35;
      --error: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: #fff;
    }
    main {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
    }
    .hero {
      position: relative;
      min-height: 100vh;
      padding: 32px;
      display: flex;
      align-items: center;
      isolation: isolate;
      overflow: hidden;
      background: #fff;
    }
    .hero::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, #fff, #f7f9fb);
      z-index: -2;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      display: none;
      background: transparent;
      z-index: -1;
    }
    .hero-copy {
      width: min(760px, 100%);
      color: var(--ink);
    }
    .eyebrow {
      margin: 0 0 14px;
      color: var(--gold);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      max-width: 760px;
      font-size: clamp(38px, 7vw, 78px);
      line-height: 0.98;
      letter-spacing: 0;
    }
    .hero-copy p {
      margin: 18px 0 0;
      max-width: 580px;
      color: var(--muted);
      font-size: 19px;
      line-height: 1.45;
    }
    .panel {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      background: var(--surface);
    }
    .form-wrap {
      width: min(100%, 420px);
    }
    .brand {
      margin-bottom: 28px;
    }
    .brand strong {
      display: block;
      font-size: 15px;
      color: var(--brand-strong);
    }
    .brand span {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 26px;
      line-height: 1.18;
      letter-spacing: 0;
    }
    .hint {
      margin: 0 0 24px;
      color: var(--muted);
      line-height: 1.5;
    }
    form {
      display: grid;
      gap: 16px;
    }
    label {
      display: grid;
      gap: 8px;
      color: #25323d;
      font-size: 14px;
      font-weight: 700;
    }
    input, select {
      width: 100%;
      min-height: 48px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px;
      font: inherit;
      color: var(--ink);
      background: #fff;
    }
    input:focus, select:focus {
      outline: 3px solid rgba(13, 107, 104, 0.16);
      border-color: var(--brand);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    button {
      min-height: 52px;
      border: 0;
      border-radius: 8px;
      color: #fff;
      background: var(--brand);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    button:hover { background: var(--brand-strong); }
    button:disabled {
      cursor: progress;
      opacity: 0.72;
    }
    .status {
      min-height: 22px;
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .status.error { color: var(--error); }
    .notice {
      margin-top: 18px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .notice a {
      color: var(--brand-strong);
      font-weight: 700;
    }
    @media (max-width: 860px) {
      main { grid-template-columns: 1fr; }
      .hero {
        min-height: 42vh;
        padding: 24px;
      }
      .panel {
        min-height: auto;
        align-items: flex-start;
        padding: 28px 20px 36px;
      }
      h1 { font-size: 42px; }
      .hero-copy p { font-size: 16px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero" aria-label="Duke del Caribe">
      <div class="hero-copy">
        <p class="eyebrow">Duke del Caribe</p>
        <h1>Desarrollos desde USD $97,000</h1>
        <p>Opciones seleccionadas en Cancun, Playa del Carmen y Tulum.</p>
      </div>
    </section>
    <section class="panel" aria-label="Formulario de contacto">
      <div class="form-wrap">
        <div class="brand">
          <strong>Duke del Caribe</strong>
          <span>Te compartiremos opciones disponibles por WhatsApp.</span>
        </div>
        <h2>En que ciudad te gustaria ver propiedades desde USD $97,000?</h2>
        <p class="hint">Deja tus datos para continuar por WhatsApp con un asesor.</p>
        <form id="lead-form" novalidate>
          <label>
            Nombre completo
            <input name="name" autocomplete="name" required minlength="2" placeholder="Tu nombre" />
          </label>
          <label>
            WhatsApp
            <input name="phone" type="tel" autocomplete="tel" required inputmode="tel" placeholder="+52 984 000 0000" />
          </label>
          <label>
            Email
            <input name="email" type="email" autocomplete="email" placeholder="tu@email.com" />
          </label>
          <label>
            Ciudad de interes
            <select name="city" required>
              <option value="">Selecciona una opcion</option>
              <option>Cancun</option>
              <option>Playa del Carmen</option>
              <option>Tulum</option>
              <option>Cualquiera de las 3</option>
            </select>
          </label>
          <label class="sr-only">
            Sitio web
            <input name="company_website" tabindex="-1" autocomplete="off" />
          </label>
          <button type="submit">Continuar a WhatsApp</button>
          <p id="status" class="status" role="status"></p>
        </form>
        <p class="notice">
          Al continuar aceptas ser contactado por Duke del Caribe sobre propiedades disponibles.
          Consulta nuestro <a href="https://stratoscapitalgroup.com/politica-de-privacidad" target="_blank" rel="noopener">aviso de privacidad</a>.
        </p>
      </div>
    </section>
  </main>
  <script>
    (function () {
      var form = document.getElementById("lead-form");
      var status = document.getElementById("status");
      var button = form.querySelector("button");
      var errors = {
        name_required: "Escribe tu nombre completo.",
        phone_required: "Escribe un WhatsApp valido.",
        city_required: "Selecciona una ciudad.",
        crm_write_failed: "No pudimos guardar tus datos. Intentalo de nuevo.",
        advisor_phone_missing: "No pudimos asignar asesor. Intentalo de nuevo."
      };
      function setStatus(message, isError) {
        status.textContent = message || "";
        status.className = isError ? "status error" : "status";
      }
      function fromEntries(formData) {
        var obj = {};
        formData.forEach(function (value, key) { obj[key] = value; });
        return obj;
      }
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        button.disabled = true;
        setStatus("Guardando y abriendo WhatsApp...", false);
        var params = new URLSearchParams(window.location.search);
        var payload = fromEntries(new FormData(form));
        payload.page_url = window.location.href;
        payload.landing_path = window.location.pathname;
        payload.source = "duke_public_router";
        payload.campaign = params.get("utm_campaign") || "DUKE - Desarrollos USD 97K - Stratos Router";
        payload.advisor = params.get("advisor") || params.get("asesor") || params.get("target_advisor") || "";
        ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].forEach(function (key) {
          if (params.get(key)) payload[key] = params.get(key);
        });
        try {
          var response = await fetch(window.location.origin + window.location.pathname, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
          var data = await response.json();
          if (data && data.ok && data.wa_url) {
            setStatus("Listo. Abriendo WhatsApp...", false);
            window.location.href = data.wa_url;
            return;
          }
          setStatus(errors[data && data.error] || "No pudimos continuar. Intentalo de nuevo.", true);
        } catch (error) {
          setStatus("No pudimos conectar. Revisa tu internet e intentalo de nuevo.", true);
        } finally {
          button.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(origin) });
  }

  if (req.method === "HEAD") {
    const url = new URL(req.url);
    const accept = req.headers.get("accept") ?? "";
    const isHealth = url.searchParams.has("health") || accept.includes("application/json");
    return new Response(null, {
      status: 200,
      headers: {
        "content-type": isHealth ? "application/json" : "text/html; charset=utf-8",
        "cache-control": "no-store",
        ...cors(origin),
      },
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const accept = req.headers.get("accept") ?? "";
    if (url.searchParams.has("health") || accept.includes("application/json")) {
      return json({ ok: true, service: "duke-lead-router", pool_key: POOL_KEY }, 200, origin);
    }
    if (!SERVICE_ROLE) {
      return html("<!doctype html><title>Configuracion pendiente</title><p>Configuracion pendiente.</p>", 500, origin);
    }
    return html(landingHtml(), 200, origin);
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  if (!SERVICE_ROLE) {
    return json({ ok: false, error: "server_misconfigured" }, 500, origin);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!isRecord(parsed)) throw new Error("payload_not_object");
    body = parsed;
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }

  const honeypot = cleanText(body.company_website, 120);
  if (honeypot) {
    return json({ ok: true, ignored: true }, 200, origin);
  }

  // Landings de marca (sin formulario): sólo registramos el clic al WhatsApp.
  // Es la única atribución posible hasta que el prospecto escribe, y no
  // ensucia el pipeline de leads con registros sin teléfono.
  if (cleanText(body.event, 40) === "whatsapp_click") {
    const clickAdvisorKey = requestedAdvisorKey(body, cleanText(body.campaign || body.campaign_name, 180) || "");
    const clickAdvisor = await getDirectAdvisor(clickAdvisorKey);

    const { error: clickError } = await admin.from("duke_ad_clicks").insert({
      organization_id: ORG_ID,
      advisor_key: clickAdvisorKey || null,
      advisor_name: clickAdvisor?.advisor_name || null,
      advisor_phone_e164: clickAdvisor?.advisor_phone_e164 || null,
      project: cleanText(body.project || body.proyecto || body.desarrollo, 80) || null,
      campaign: cleanText(body.campaign || body.campaign_name, 180) || null,
      landing_path: cleanText(body.landing_path, 180) || null,
      page_url: cleanText(body.page_url, 600) || null,
      utm_source: cleanText(body.utm_source, 120) || null,
      utm_medium: cleanText(body.utm_medium, 120) || null,
      utm_campaign: cleanText(body.utm_campaign, 180) || null,
      utm_content: cleanText(body.utm_content, 180) || null,
      utm_term: cleanText(body.utm_term, 180) || null,
      fbclid: cleanText(body.fbclid, 240) || null,
      referrer: cleanText(body.referrer, 600) || null,
      user_agent: cleanText(req.headers.get("user-agent"), 400) || null,
    });

    if (clickError) {
      console.error("[duke-lead-router] click log failed", clickError.message);
    }

    // Sin asesor resoluble no inventamos un destino: la landing ya trae su
    // propio enlace y prefiere ese antes que mandar al prospecto con alguien
    // que no le corresponde.
    const clickPhone = phoneDigits(clickAdvisor?.advisor_phone_e164 || "");
    return json({
      ok: true,
      logged: !clickError,
      advisor: clickAdvisor?.advisor_name || null,
      wa_url: clickPhone ? `https://wa.me/${clickPhone}` : null,
    }, 200, origin);
  }

  const name = cleanText(body.name || body.full_name || body.nombre, 120);
  const rawPhone = cleanText(body.phone || body.whatsapp || body.telefono, 40);
  const phone = normalizeMxPhone(rawPhone);
  const phoneNorm = phoneDigits(phone);
  const email = cleanText(body.email || body.correo, 180);
  const city = cleanText(body.city || body.ciudad || body.profile_city, 80);
  const campaign = cleanText(body.campaign || body.campaign_name, 180) || DEFAULT_CAMPAIGN;
  // Desarrollo de interés declarado por la landing (ej. Mondrian). Se propaga al
  // CRM y al mensaje de WhatsApp; si no viene, el flujo queda como estaba.
  const interest = cleanText(body.project || body.proyecto || body.desarrollo, 80);
  const source = cleanText(body.source, 80) || "stratos_router_meta_ads";
  const advisorKey = requestedAdvisorKey(body, campaign);
  // Se resuelve aquí y no más abajo porque de esto depende a qué pool va el
  // RPC: si el asesor pedido no existe, el lead debe caer en el round-robin
  // en vez de quedarse sin dueño.
  const directAdvisor = await getDirectAdvisor(advisorKey);
  const rpcPoolKey = directAdvisor ? `${DIRECT_POOL_PREFIX}${advisorKey}` : POOL_KEY;

  if (!name || name.length < 2) {
    return json({ ok: false, error: "name_required" }, 200, origin);
  }
  if (phoneNorm.length < 10) {
    return json({ ok: false, error: "phone_required" }, 200, origin);
  }
  if (!city) {
    return json({ ok: false, error: "city_required" }, 200, origin);
  }

  const now = new Date().toISOString();
  const syntheticLeadId = `router:${phoneNorm}:${Date.now()}`;
  const payload = {
    leadgen_id: syntheticLeadId,
    full_name: name,
    phone,
    phone_number: phone,
    email,
    campaign_name: campaign,
    source,
    project: interest || "Duke desarrollos desde USD 97,000",
    city,
    "En que ciudad te gustaria ver propiedades desde USD $97,000": city,
    field_data: [
      { name: "full_name", values: [name] },
      { name: "phone_number", values: [phone] },
      ...(email ? [{ name: "email", values: [email] }] : []),
      { name: "En que ciudad te gustaria ver propiedades desde USD $97,000", values: [city] },
    ],
    page_url: cleanText(body.page_url, 600),
    landing_path: cleanText(body.landing_path, 180),
    utm_source: cleanText(body.utm_source, 120),
    utm_medium: cleanText(body.utm_medium, 120),
    utm_campaign: cleanText(body.utm_campaign, 180),
    utm_content: cleanText(body.utm_content, 180),
    utm_term: cleanText(body.utm_term, 180),
    fbclid: cleanText(body.fbclid, 240),
    advisor: advisorKey,
    received_at: now,
  };

  const { data, error } = await admin.rpc("fn_upsert_lead_from_meta_ads", {
    payload,
    p_pool_key: rpcPoolKey,
  });

  if (error) {
    console.error("[duke-lead-router] RPC failed", error.message, payload);
    return json({ ok: false, error: "crm_write_failed" }, 500, origin);
  }

  if (!isRecord(data) || data.ok !== true) {
    return json({ ok: false, error: data || "crm_rejected" }, 200, origin);
  }

  const asesorId = cleanText(data.asesor_id, 80) || null;
  const asesorName = cleanText(data.asesor_name, 120) || null;

  if (directAdvisor) {
    const updatePayload: Record<string, string | null> = {
      asesor_name: directAdvisor.advisor_name,
      updated_at: now,
    };
    if (directAdvisor.advisor_id) updatePayload.asesor_id = directAdvisor.advisor_id;

    const { error: updateError } = await admin
      .from("leads")
      .update(updatePayload)
      .eq("id", data.lead_id)
      .eq("organization_id", ORG_ID);

    if (updateError) {
      console.error("[duke-lead-router] advisor override failed", updateError.message, {
        lead_id: data.lead_id,
        advisor_key: advisorKey,
      });
      return json({ ok: false, error: "advisor_override_failed", lead_id: data.lead_id }, 500, origin);
    }
  }

  const advisor = directAdvisor || await getAdvisorPhone(asesorId, asesorName);

  if (!advisor?.advisor_phone_e164) {
    return json({
      ok: false,
      error: "advisor_phone_missing",
      lead_id: data.lead_id,
      asesor_id: asesorId,
      asesor_name: asesorName,
    }, 200, origin);
  }

  const advisorDigits = phoneDigits(advisor.advisor_phone_e164);
  // Sin montos en el mensaje: el cliente lo pidió explícitamente. Se nombra el
  // desarrollo cuando la landing lo manda (ej. Mondrian) para que el asesor
  // sepa de dónde viene sin tener que preguntarlo.
  const advisorFirstName = (advisor.advisor_name || "Duke").split(" ")[0];
  const waText = [
    `Hola ${advisorFirstName}, quiero invertir inteligentemente en Riviera Maya.`,
    `Soy ${name}.`,
    interest ? `Vi el anuncio de ${interest}.` : null,
    city ? `Me interesa ${city}.` : null,
    "¿Me compartes la información?",
  ].filter(Boolean).join("\n");
  const wa_url = `https://wa.me/${advisorDigits}?text=${encodeURIComponent(waText)}`;

  try {
    await admin.from("expediente_items").insert({
      lead_id: data.lead_id,
      organization_id: ORG_ID,
      tipo: "nota",
      titulo: "Router Stratos a WhatsApp",
      descripcion: `Cliente enviado al WhatsApp de ${advisor.advisor_name}. Ciudad de interés: ${city}.`,
      asesor_id: directAdvisor?.advisor_id || asesorId,
      metadata: {
        source: "duke_lead_router",
        advisor_phone_e164: advisor.advisor_phone_e164,
        advisor_override: directAdvisor?.advisor_key || null,
        pool_key: rpcPoolKey,
        wa_url_created: true,
        campaign,
        city,
      },
    });
  } catch (insertError) {
    console.error("[duke-lead-router] expediente note failed", (insertError as Error).message);
  }

  return json({
    ok: true,
    lead_id: data.lead_id,
    stage: data.stage,
    profile_city: data.profile_city,
    campaign,
    advisor: {
      id: directAdvisor?.advisor_id || asesorId,
      name: advisor.advisor_name,
      phone_e164: advisor.advisor_phone_e164,
    },
    wa_url,
  }, 200, origin);
});
