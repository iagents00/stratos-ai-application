// password-recovery — recuperación de contraseña por CÓDIGO enviado al correo de
// recuperación del usuario (distinto del email de login, que puede ser placeholder).
//
// Endpoint PÚBLICO (verify_jwt=false): lo llama gente NO logueada desde el LoginScreen.
// La seguridad NO está en el CORS sino en el código: rate-limit, código hasheado,
// single-use, expiración corta, y respuestas genéricas (anti-enumeración).
//
// Flujo:
//   POST { action: "request", email }
//        -> busca el usuario (por email de login o recovery_email), genera código de
//           6 dígitos, lo hashea y guarda (fn_recovery_prepare), y dispara el correo
//           via webhook n8n (Gmail). SIEMPRE responde { ok: true } (no revela si existe).
//   POST { action: "verify", email, code, password }
//        -> valida el código (fn_recovery_confirm) y, si es correcto, cambia la
//           contraseña con la Admin API. Responde { ok: true } o { ok: false, error }.
//
// Deploy: supabase functions deploy password-recovery --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ??
  "https://glulgyhkrqpykxmujodb.supabase.co";
const SERVICE_ROLE =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Webhook n8n que envía el correo por Gmail + secreto compartido (server-to-server).
// Vive solo en el servidor (esta función + el flujo n8n); nunca llega al navegador.
const N8N_WEBHOOK_URL =
  Deno.env.get("N8N_RECOVERY_WEBHOOK") ??
  "https://personal-n8n.suwsiw.easypanel.host/webhook/stratos-password-recovery";
// El secreto REAL está embebido en la función desplegada (Supabase) y en el flujo
// n8n; NO se comitea al repo. Idealmente migrarlo a un Supabase edge secret.
const N8N_RECOVERY_SECRET =
  Deno.env.get("N8N_RECOVERY_SECRET") ?? "__SET_IN_DEPLOYED_FUNCTION__";

const CODE_TTL_MINUTES = 15;
const MIN_PASSWORD = 8;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Hash = sha256(code + user_email + pepper). El pepper (service role key) solo existe
// en el servidor => aunque alguien lea la tabla, no puede revertir el código.
async function hashCode(code: string, email: string): Promise<string> {
  const data = new TextEncoder().encode(`${code}:${email.toLowerCase().trim()}:${SERVICE_ROLE}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sixDigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (!SERVICE_ROLE) return json({ ok: false, error: "server_misconfigured" }, 500, origin);

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400, origin); }

  const action = String(payload.action ?? "");
  const email = String(payload.email ?? "").trim().toLowerCase();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  // ── REQUEST: generar código y enviarlo ─────────────────────────────────
  if (action === "request") {
    if (!emailOk) return json({ ok: false, error: "Ingresa un correo válido." }, 200, origin);
    try {
      const code = sixDigitCode();
      const code_hash = await hashCode(code, email);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      const { data, error } = await admin.rpc("fn_recovery_prepare", {
        p_email: email, p_code_hash: code_hash, p_ip: ip, p_ttl_minutes: CODE_TTL_MINUTES,
      });
      if (error) { console.error("[recovery] prepare error:", error.message); }

      // Solo enviamos si la cuenta existe y tiene correo de recuperación.
      if (data && (data as any).sent === true) {
        const recovery_email = (data as any).recovery_email as string;
        const name = ((data as any).name as string) || "";
        try {
          const r = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "content-type": "application/json", "x-recovery-secret": N8N_RECOVERY_SECRET },
            body: JSON.stringify({ recovery_email, code, name, ttl_minutes: CODE_TTL_MINUTES }),
          });
          if (!r.ok) console.error("[recovery] n8n webhook status:", r.status);
        } catch (e) {
          console.error("[recovery] n8n webhook failed:", (e as Error).message);
        }
      }
    } catch (e) {
      console.error("[recovery] request fatal:", (e as Error).message);
    }
    // SIEMPRE genérico (no revelamos si el correo existe o tiene recovery configurado).
    return json({ ok: true, message: "Si la cuenta tiene un correo de recuperación configurado, enviamos un código." }, 200, origin);
  }

  // ── VERIFY: validar código y cambiar contraseña ────────────────────────
  if (action === "verify") {
    const code = String(payload.code ?? "").trim();
    const password = String(payload.password ?? "");
    if (!emailOk) return json({ ok: false, error: "Ingresa un correo válido." }, 200, origin);
    if (!/^\d{6}$/.test(code)) return json({ ok: false, error: "El código debe tener 6 dígitos." }, 200, origin);
    if (password.length < MIN_PASSWORD)
      return json({ ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }, 200, origin);

    try {
      const code_hash = await hashCode(code, email);
      const { data, error } = await admin.rpc("fn_recovery_confirm", {
        p_email: email, p_code_hash: code_hash,
      });
      if (error) { console.error("[recovery] confirm error:", error.message); return json({ ok: false, error: "No se pudo validar el código. Intenta de nuevo." }, 500, origin); }

      const res = data as any;
      if (!res?.ok) {
        const map: Record<string, string> = {
          expired: "El código expiró. Pide uno nuevo.",
          too_many: "Demasiados intentos. Pide un código nuevo.",
          no_code: "No hay un código activo. Pide uno nuevo.",
          invalid: "Código incorrecto.",
        };
        return json({ ok: false, error: map[res?.reason] ?? "Código incorrecto." }, 200, origin);
      }

      const userId = res.user_id as string;
      const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password });
      if (upErr) { console.error("[recovery] updateUser error:", upErr.message); return json({ ok: false, error: "No se pudo actualizar la contraseña. Intenta de nuevo." }, 500, origin); }

      // Auditoría best-effort
      try {
        await admin.from("audit_log").insert({
          actor_id: userId, entity_type: "auth", action: "PASSWORD_RESET",
          metadata: { via: "recovery_code", email, at: new Date().toISOString() },
        });
      } catch (_) { /* no bloquear */ }

      return json({ ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." }, 200, origin);
    } catch (e) {
      console.error("[recovery] verify fatal:", (e as Error).message);
      return json({ ok: false, error: "Error inesperado. Intenta de nuevo." }, 500, origin);
    }
  }

  return json({ ok: false, error: "accion_desconocida" }, 400, origin);
});
