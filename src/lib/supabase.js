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
      // Storage key explícito y consistente — evita colisiones con otros
      // proyectos Supabase que pudieran convivir en el mismo dominio.
      storageKey:         'stratos.supabase.auth.v1',
      // Lock de sesión multi-tab — Supabase JS v2.45+ usa BroadcastChannel
      // para coordinar refrescos entre pestañas. Sin él, dos pestañas pueden
      // rotar el refresh token a la vez y una se queda con token inválido.
      lock:               undefined, // null fuerza no-lock; undefined deja el default (recomendado)
    },
  }
)
