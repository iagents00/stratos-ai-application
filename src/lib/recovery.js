/**
 * lib/recovery.js — Recuperación de contraseña por CÓDIGO al correo de recuperación.
 *
 * Habla con la Edge Function `password-recovery` (verify_jwt=false, endpoint público
 * para gente NO logueada). El correo de recuperación es distinto del email de login.
 *
 * IMPORTANTE — por qué fetch directo y NO supabase.functions.invoke():
 *   `functions.invoke()` pasa por el cliente de auth del SDK. En la pantalla de login
 *   el SDK a veces queda trabado (getSession se atasca, ver ZONA CRÍTICA), y entonces
 *   invoke() se cuelga eternamente ("Casi listo, un momento…") sin llegar al servidor.
 *   Un "olvidé mi contraseña" NO debe depender de la sesión. Por eso llamamos a la
 *   Edge Function con un fetch plano + apikey anónima + AbortController (timeout duro),
 *   así nunca se cuelga y siempre resuelve. (Lección 2026-07-06.)
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";

const FN_URL = `${SUPABASE_URL}/functions/v1/password-recovery`;
const TIMEOUT_MS = 20000;

const normalize = (e) => String(e || "").trim().toLowerCase();
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function callFn(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    return { data };
  } finally {
    clearTimeout(timer);
  }
}

function connError(e) {
  if (e && e.name === "AbortError") {
    return "La conexión tardó demasiado. Intenta de nuevo.";
  }
  return "Error de conexión. Verifica tu internet e inténtalo de nuevo.";
}

/**
 * Paso 1 — pedir el código. Siempre responde genérico (no revela si la cuenta existe).
 * @returns {Promise<{ok: boolean, message?: string, error?: string}>}
 */
export async function requestRecoveryCode(email) {
  const clean = normalize(email);
  if (!isEmail(clean)) return { ok: false, error: "Ingresa un correo válido." };
  try {
    const { data } = await callFn({ action: "request", email: clean });
    if (data?.ok) return { ok: true, message: data.message };
    return { ok: false, error: data?.error || "No se pudo procesar la solicitud." };
  } catch (e) {
    return { ok: false, error: connError(e) };
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
    const { data } = await callFn({ action: "verify", email: clean, code: cleanCode, password });
    if (data?.ok) return { ok: true, message: data.message };
    return { ok: false, error: data?.error || "Código incorrecto." };
  } catch (e) {
    return { ok: false, error: connError(e) };
  }
}
