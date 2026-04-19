/**
 * supabase.js — Cliente de Supabase
 *
 * Actualmente devuelve null porque la migración de localStorage → Supabase
 * está pendiente. Ver el plan completo en:
 *   .claude/plans/glittery-doodling-avalanche.md
 *
 * PASOS PARA ACTIVAR:
 *   1. Crea un proyecto en https://supabase.com
 *   2. Copia la URL y el anon key al archivo .env.local:
 *        VITE_SUPABASE_URL=https://xxxx.supabase.co
 *        VITE_SUPABASE_ANON_KEY=eyJxxx...
 *   3. Instala el SDK: npm install @supabase/supabase-js
 *   4. Descomenta el bloque de abajo y elimina el export null
 *   5. Corre las migraciones SQL en supabase/migrations/
 */

// import { createClient } from '@supabase/supabase-js'
//
// const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
// const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY
//
// if (!supabaseUrl || !supabaseKey) {
//   console.error('[Supabase] Variables de entorno no configuradas. Ver .env.example')
// }
//
// export const supabase = createClient(supabaseUrl, supabaseKey)

export const supabase = null; // Placeholder — reemplazar con líneas de arriba
