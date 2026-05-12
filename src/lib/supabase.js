import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Stratos AI] ⚠️  Variables de entorno faltantes.\n' +
    '  Crea un archivo .env.local en la raíz del proyecto con:\n' +
    '  VITE_SUPABASE_URL=https://tu-proyecto.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=tu-anon-key\n' +
    '  La autenticación y base de datos no funcionarán sin estas variables.'
  )
}

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseKey  || 'placeholder-key',
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
