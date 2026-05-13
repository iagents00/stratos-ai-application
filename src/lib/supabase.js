import { createClient } from '@supabase/supabase-js'

/* ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  ZONA CRÍTICA — NO TOCAR sin leer CLAUDE.md → "ZONA CRÍTICA — CONFIG DE
 *     AUTH ESTABLE". Esta config se logró tras muchas iteraciones para
 *     resolver "se sale al F5 y queda en Conectando con el servidor...".
 *
 *     Reglas no negociables:
 *     · flowType DEBE ser 'implicit' (NO 'pkce' — PKCE rompe signInWithPassword)
 *     · NO sobrescribir storageKey (ya causó pérdida masiva de sesiones)
 *     · Mantener FALLBACK_URL / FALLBACK_KEY (Vercel no tiene env vars set)
 * ═══════════════════════════════════════════════════════════════════════════ */

// Fallback al proyecto productivo. El anon key es público por diseño
// (protegido por RLS server-side). Si Vercel tiene VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY configurados, esos ganan; si no, usamos estos
// para que el login funcione sin depender de la config del host.
const FALLBACK_URL = 'https://glulgyhkrqpykxmujodb.supabase.co'
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdWxneWhrcnFweWt4bXVqb2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjc0ODQsImV4cCI6MjA5Mjg0MzQ4NH0.GUPRPxZM8G50TVpvTDegzADO8n117clpTgSQpaMJAEk'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '[Stratos AI] Usando fallback hardcodeado de Supabase. ' +
    'Para limpieza: configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY ' +
    'en Vercel → Settings → Environment Variables.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      // Mantener la sesión viva: refrescar access token automáticamente
      // antes de que expire (con el refresh token de larga duración).
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
      // FLOW IMPLICIT — el adecuado para signInWithPassword. PKCE estaba
      // configurado antes y rompía el persist: PKCE es un flow OAuth
      // (Google/GitHub/Magic Links) que escribe un `code_verifier` extra
      // en storage, y al refrescar la página el SDK intentaba completar
      // ese flow con un verifier que nunca existió porque el login fue
      // por email+password. Resultado: sesión se invalidaba silenciosamente
      // y el SDK disparaba un retry POST /token?grant_type=password en
      // background (visible como error 400 en console). Síntoma reportado:
      // "se sale al F5 y no puedo volver a loguear, queda en Conectando…".
      flowType:           'implicit',
      // NO sobrescribir storageKey: el default de Supabase es
      // `sb-<projectref>-auth-token`. Sobrescribirlo a uno custom rompe
      // las sesiones existentes de TODOS los usuarios (su token vive bajo
      // la key vieja y el código nuevo lo busca bajo la key custom → sesión
      // perdida → re-login forzado). Mejor mantener el default para
      // retro-compatibilidad y dejar que el SDK se encargue del namespacing.
    },
  }
)
