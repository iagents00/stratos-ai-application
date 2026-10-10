/**
 * lib/recovery.js — Recuperación de contraseña por CÓDIGO al correo de recuperación.
 *
 * Habla con la Edge Function `password-recovery` (verify_jwt=false, endpoint
 * público para gente NO logueada). El correo de recuperación es distinto del
 * email de login (que puede ser un placeholder): el usuario lo configura en su
 * Perfil. Ver supabase/functions/password-recovery/index.ts.
 *
 * Los rechazos de negocio usan { ok, error?, message? }; los fallos de servicio
 * usan HTTP 5xx. Ambos deben mostrarse sin confirmar un envío inexistente.
 */
import { supabase } from "./supabase";
import { logAuthEvent } from "./audit";

async function invokeRecovery(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const { data, error } = await supabase.functions.invoke("password-recovery", {
      body, signal: controller.signal,
    });
    if (error) {
      const response = await error.context?.json?.().catch(() => null);
      return { ok: false, error: response?.error || "No se pudo procesar la solicitud. Intenta de nuevo." };
    }
    return data?.ok ? { ok: true, message: data.message }
      : { ok: false, error: data?.error || "No se pudo procesar la solicitud." };
  } catch {
    return { ok: false, error: "Error de conexión. Verifica tu internet e inténtalo de nuevo." };
  } finally { clearTimeout(timer); }
}

const normalize = (e) => String(e || "").trim().toLowerCase();

/**
 * Paso 1 — pedir el código. Siempre responde genérico (no revela si la cuenta
 * existe o tiene correo de recuperación configurado).
 * @returns {Promise<{ok: boolean, message?: string, error?: string}>}
 */
export async function requestRecoveryCode(email) {
  const clean = normalize(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: false, error: "Ingresa un correo válido." };
  }
  const result = await invokeRecovery({ action: "request", email: clean });
  if (result.ok) logAuthEvent("PASSWORD_RESET", null, { email: clean, phase: "request" });
  return result;
}

/**
 * Paso 2 — validar el código y fijar la nueva contraseña.
 * @returns {Promise<{ok: boolean, message?: string, error?: string}>}
 */
export async function verifyRecoveryCode(email, code, password) {
  const clean = normalize(email);
  const cleanCode = String(code || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: "Ingresa un correo válido." };
  if (!/^\d{6}$/.test(cleanCode)) return { ok: false, error: "El código debe tener 6 dígitos." };
  if (typeof password !== "string" || password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  return invokeRecovery({ action: "verify", email: clean, code: cleanCode, password });
}
