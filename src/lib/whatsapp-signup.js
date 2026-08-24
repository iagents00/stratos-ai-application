/**
 * lib/whatsapp-signup.js — Embedded Signup de WhatsApp (Meta Tech Provider)
 * ─────────────────────────────────────────────────────────────────────────────
 * Abre el popup de Meta donde el cliente elige su número de WhatsApp Business
 * y lo conecta a Stratos en tres clics — el mismo flujo que usan GoHighLevel
 * y HubSpot. Reemplaza el alta manual asesor por asesor.
 *
 * ARQUITECTURA — por qué el navegador no termina el trabajo:
 *   El popup devuelve un `code` de un solo uso. Intercambiarlo por un token
 *   requiere el APP SECRET, que NUNCA puede vivir en el bundle JS. Por eso el
 *   navegador solo recoge `code` + ids y los manda al backend (n8n), que hace
 *   el intercambio y llama a `fn_registrar_canal_whatsapp` con service_role.
 *
 * REQUISITOS antes de que esto funcione (ver ops/META-TECH-PROVIDER-briefing.md):
 *   1. Portafolio comercial propio de Stratos AI, verificado
 *   2. App de Meta con acceso avanzado a whatsapp_business_management,
 *      whatsapp_business_messaging y business_management
 *   3. Registro como proveedor de tecnología aprobado
 *   4. Una configuración de Embedded Signup → de ahí sale el `configId`
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SDK_SRC     = "https://connect.facebook.net/en_US/sdk.js";
const SDK_VERSION = "v21.0";

let sdkPromise = null;

/** ¿Hay config suficiente para siquiera intentar abrir el popup? */
export function isSignupConfigured(clientConfig) {
  const meta = clientConfig?.meta;
  return Boolean(meta?.appId && meta?.configId);
}

/**
 * Carga el JS SDK de Facebook una sola vez y lo inicializa.
 * Idempotente: llamadas simultáneas comparten la misma promesa.
 */
export function loadFacebookSdk(appId) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Embedded Signup solo corre en el navegador"));
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const init = () => {
      try {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: false,
          version: SDK_VERSION,
        });
        resolve(window.FB);
      } catch (err) {
        sdkPromise = null;
        reject(err);
      }
    };

    if (window.FB) { init(); return; }

    window.fbAsyncInit = init;

    const existing = document.getElementById("facebook-jssdk");
    if (existing) return;   // ya se está cargando; fbAsyncInit resolverá

    const script = document.createElement("script");
    script.id    = "facebook-jssdk";
    script.src   = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("No se pudo cargar el SDK de Facebook. ¿Bloqueador de anuncios?"));
    };
    document.body.appendChild(script);
  });

  return sdkPromise;
}

/**
 * Escucha los mensajes que el popup de Meta manda a la ventana padre.
 * De aquí salen `phone_number_id` y `waba_id` — el `code` de FB.login NO los trae.
 * Devuelve una función para desuscribirse.
 */
function listenSignupMessages(onEvent) {
  const handler = (event) => {
    // Solo aceptamos mensajes de Facebook. Sin esto, cualquier iframe podría
    // inyectar un waba_id falso y secuestrar el alta del canal.
    if (event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com") return;
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
    onEvent(payload);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

/**
 * Abre el popup y resuelve cuando el cliente termina.
 *
 * @returns {Promise<{code:string, phoneNumberId:string|null, wabaId:string|null}>}
 * @throws  Error con `.reason = "cancelled"` si el cliente cierra el popup.
 */
export async function launchWhatsAppSignup({ appId, configId }) {
  if (!appId || !configId) {
    throw new Error("Falta appId o configId de Meta — revisa la config del cliente");
  }

  const FB = await loadFacebookSdk(appId);

  return new Promise((resolve, reject) => {
    let captured = { phoneNumberId: null, wabaId: null };
    let settled  = false;

    const stopListening = listenSignupMessages((payload) => {
      if (payload.event === "FINISH" || payload.event === "FINISH_ONLY_WABA") {
        captured = {
          phoneNumberId: payload.data?.phone_number_id ?? null,
          wabaId:        payload.data?.waba_id ?? null,
        };
      } else if (payload.event === "CANCEL" && !settled) {
        settled = true;
        stopListening();
        const err = new Error("El cliente cerró el registro sin terminar");
        err.reason = "cancelled";
        reject(err);
      } else if (payload.event === "ERROR" && !settled) {
        settled = true;
        stopListening();
        reject(new Error(payload.data?.error_message || "Meta reportó un error en el registro"));
      }
    });

    FB.login((response) => {
      if (settled) return;
      settled = true;
      stopListening();

      const code = response?.authResponse?.code;
      if (!code) {
        const err = new Error("El cliente cerró el registro sin terminar");
        err.reason = "cancelled";
        reject(err);
        return;
      }
      resolve({ code, ...captured });
    }, {
      config_id: configId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: "",
        sessionInfoVersion: "3",
      },
    });
  });
}

/**
 * Manda el resultado al backend, que intercambia el code por token (con el app
 * secret, del lado servidor) y registra el canal en Supabase.
 */
export async function finishWhatsAppSignup(callbackUrl, { code, phoneNumberId, wabaId, orgSlug, organizationId, asesorName }) {
  if (!callbackUrl) {
    throw new Error("Falta meta.signupCallbackUrl en la config del cliente");
  }

  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      phone_number_id: phoneNumberId,
      waba_id:         wabaId,
      org_slug:        orgSlug,
      organization_id: organizationId,
      asesor_name:     asesorName,
      onboarded_via:   "embedded_signup",
    }),
  });

  let body = null;
  try { body = await res.json(); } catch { /* respuesta vacía */ }

  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `El backend rechazó el alta (HTTP ${res.status})`);
  }
  return body;
}
