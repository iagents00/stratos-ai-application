import { createClient } from '@supabase/supabase-js'

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
      // PKCE flow: más resiliente con múltiples pestañas/dispositivos.
      // El refresh token no se invalida si dos pestañas refrescan a la vez.
      flowType:           'pkce',
      // NO sobrescribir storageKey: el default de Supabase es
      // `sb-<projectref>-auth-token`. Sobrescribirlo a uno custom rompe
      // las sesiones existentes de TODOS los usuarios (su token vive bajo
      // la key vieja y el código nuevo lo busca bajo la key custom → sesión
      // perdida → re-login forzado). Mejor mantener el default para
      // retro-compatibilidad y dejar que el SDK se encargue del namespacing.
    },
  }
)
