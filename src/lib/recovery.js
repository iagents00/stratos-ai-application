/**
 * lib/recovery.js — Recuperación de contraseña por CÓDIGO al correo de recuperación.
 *
 * Habla con la Edge Function `password-recovery` (verify_jwt=false, endpoint
 * público para gente NO logueada). El correo de recuperación es distinto del
 * email de login (que puede ser un placeholder): el usuario lo configura en su
 * Perfil. Ver supabase/functions/password-recovery/index.ts.
 *
 * La Edge Function responde 200 para todos los casos de negocio con { ok, error?, message? },
 * así que aquí basta con leer `data.ok` — no hay que parsear errores HTTP.
 */
import { supabase } from "./supabase";
import { logAuthEvent } from "./audit";

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
  try {
    const { data, error } = await supabase.functions.invoke("password-recovery", {
      body: { action: "request", email: clean },
    });
    if (error) return { ok: false, error: "No se pudo procesar la solicitud. Intenta de nuevo." };
    logAuthEvent("PASSWORD_RESET", null, { email: clean, phase: "request" });
    if (data?.ok) return { ok: true, message: data.message };
    return { ok: false, error: data?.error || "No se pudo procesar la solicitud." };
  } catch (e) {
    return { ok: false, error: "Error de conexión. Verifica tu internet e inténtalo de nuevo." };
  }
}

/**
 * Paso 2 — validar el código y fijar la nueva contraseña.
 * @returns {Promise<{ok: boolean, message?: string, error?: string}>}
 */
export async function verifyRecoveryCode(email, code, password) {
  const clean = normalize(email);
  const cleanCode = String(code || "").trim();
  try {
    const { data, error } = await supabase.functions.invoke("password-recovery", {
      body: { action: "verify", email: clean, code: cleanCode, password },
    });
    if (error) return { ok: false, error: "No se pudo validar el código. Intenta de nuevo." };
    if (data?.ok) return { ok: true, message: data.message };
    return { ok: false, error: data?.error || "Código incorrecto." };
  } catch (e) {
    return { ok: false, error: "Error de conexión. Verifica tu internet e inténtalo de nuevo." };
  }
}
