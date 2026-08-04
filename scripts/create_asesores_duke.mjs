#!/usr/bin/env node
/**
 * scripts/create_asesores_duke.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Alta de asesores nuevos de Duke del Caribe (pedido de Emmanuel Ortiz, 1-ago-2026):
 * Marco Lopez, Carlos Reyes y Aldo Medina.
 *
 * Idempotente: a quien ya tenga cuenta en Auth NO se le toca nada.
 * Mismo patrón que scripts/create_area_accounts.mjs (batch del 31-jul), con dos
 * diferencias deliberadas:
 *   - role: 'asesor' (no colaborador) → entran al CRM con RLS por asesor_name.
 *   - SIN telegram_chat_id sintético: los asesores parean su Telegram real con
 *     código de pareo (n8n/workflows/generar-codigo-pareo.json).
 *
 * USO:
 *   node scripts/create_asesores_duke.mjs --dry-run
 *   node scripts/create_asesores_duke.mjs
 *
 * CREDENCIALES: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de .env.local.
 * Las contraseñas temporales se imprimen a stdout — no se escribe archivo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const ORG_ID = '00000000-0000-0000-0000-000000000001'   // Stratos Capital Group (Duke)
const TEMP_PASSWORD = 'Stratos12'                        // temporal estándar de dirección

// profiles.name es la identidad del RLS de leads (leads.asesor_name = profiles.name):
// se escribe EXACTAMENTE como se va a asignar en los leads.
const REGISTRO = [
  { name: 'Marco Lopez',  email: 'marco.lopez@stratos.ai' },
  { name: 'Carlos Reyes', email: 'carlos.reyes@stratos.ai' },
  { name: 'Aldo Medina',  email: 'aldo.medina@stratos.ai' },
  // Alta del 3-ago-2026. OJO: existe aparte `paz.adm@stratos.ai` (perfil "Paz",
  // colaborador de Administrativo). Son cuentas distintas a propósito.
  { name: 'Paz Cambray',  email: 'paz.cambray@stratos.ai' },
  // Alta del 3-ago-2026. El `name` sale del propio correo porque no se dieron
  // apellidos, y NO puede quedar solo "Alexander": ya hay un "Alexander"
  // (colaborador de Administrativo, alexander.adm@stratos.ai) y la RLS de leads
  // empareja al asesor POR NOMBRE — dos perfiles con el mismo nombre en la misma
  // org se verían los clientes entre sí. Renombrar en cuanto lleguen apellidos,
  // ANTES de asignarles cartera (después habría que tocar leads.asesor_name).
  { name: 'Diego PV',     email: 'diego.pv@stratos.ai' },
  { name: 'Alexander PV', email: 'alexander.pv@stratos.ai' },
]

function loadEnv() {
  const envPath = resolve(projectRoot, '.env.local')
  if (!existsSync(envPath)) {
    console.error('✗ .env.local no existe (necesita VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

// NOTA: aquí no se usa auth.admin.listUsers — las 6 cuentas QA de qalab tienen
// columnas de token en NULL y GoTrue devuelve 500 al listar. La idempotencia
// sale del propio createUser: si el email ya existe responde `email_exists`.
const esEmailExistente = (e) =>
  e?.code === 'email_exists' || /already been registered/i.test(e?.message || '')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  if (dryRun) {
    console.log('\nDRY RUN — no se escribe nada.\n')
    for (const p of REGISTRO) {
      console.log(`  ${p.name.padEnd(16)} ${p.email.padEnd(30)} → se crea (asesor, Duke); si ya existe se salta`)
    }
    console.log('\nQuita --dry-run para ejecutar.\n')
    return
  }

  let errores = 0
  for (const p of REGISTRO) {
    try {
      const { data: created, error } = await sb.auth.admin.createUser({
        email: p.email, password: TEMP_PASSWORD, email_confirm: true,
        user_metadata: { name: p.name, role: 'asesor', organization_id: ORG_ID },
      })
      if (error) {
        if (esEmailExistente(error)) {
          console.log(`  = ${p.email.padEnd(30)} ya existía — no se tocó`)
          continue
        }
        throw error
      }

      const { error: profErr } = await sb.from('profiles').upsert({
        id: created.user.id, name: p.name, role: 'asesor',
        organization_id: ORG_ID, active: true,
      }, { onConflict: 'id' })
      if (profErr) throw profErr

      console.log(`  + ${p.email.padEnd(30)} creada · asesor · ${p.name}`)
    } catch (e) {
      errores++
      console.log(`  x ${p.email} → ${e.message}`)
    }
  }

  console.log(`\nContraseña temporal de las cuentas nuevas: ${TEMP_PASSWORD}`)
  console.log('Cada asesor debe cambiarla desde Perfil en su primer ingreso.\n')
  if (errores) process.exit(1)
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
