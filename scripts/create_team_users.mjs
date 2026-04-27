#!/usr/bin/env node
/**
 * scripts/create_team_users.mjs
 *
 * Crea los usuarios del equipo en Supabase Auth en lote.
 * Genera passwords seguras, asigna roles y produce un archivo
 * de credenciales listo para repartir al equipo.
 *
 * USO:
 *   1. Copia `team_users.example.json` a `team_users.json`
 *      y llena con los 10 datos reales.
 *   2. Crea `.env.local` en la raíz con:
 *        VITE_SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...   (NO la anon key)
 *   3. Sanity check (no crea nada, solo valida):
 *        node scripts/create_team_users.mjs --dry-run
 *   4. Crear los usuarios reales:
 *        node scripts/create_team_users.mjs
 *
 * El script es IDEMPOTENTE: si un email ya existe, lo deja como está
 * y solo actualiza el perfil (nombre + rol).
 *
 * SEGURIDAD:
 *   • La service role key tiene acceso total — nunca subirla a git.
 *   • El archivo team_credentials.txt generado tampoco se sube.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ── Cargar env ─────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(projectRoot, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌ .env.local no existe. Crea uno con:')
    console.error('   VITE_SUPABASE_URL=https://xxxx.supabase.co')
    console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJ...')
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

// ── Generar password segura y memorable ────────────────────
// Formato: Stratos-XXXX-NNNN  (mayúsculas + dígitos, fácil de leer)
function generatePassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sin I/O para evitar confusión
  const digits  = '23456789'                  // sin 0/1
  const part = (chars, len) =>
    Array.from(randomBytes(len)).map(b => chars[b % chars.length]).join('')
  return `Stratos-${part(letters, 4)}-${part(digits, 4)}`
}

// ── Validación ─────────────────────────────────────────────
const VALID_ROLES = ['super_admin', 'admin', 'ceo', 'director', 'asesor']

// Org default donde van todos los usuarios del equipo Stratos.
// Si tu equipo va a tener su propia org separada, cámbialo o
// pásalo en team_users.json con la prop "organizationId" por user.
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

function validateUsers(users) {
  if (!Array.isArray(users)) throw new Error('team_users.json debe ser un array')
  const seen = new Set()
  for (const u of users) {
    if (!u.email || !u.name || !u.role) {
      throw new Error(`Usuario incompleto: ${JSON.stringify(u)}`)
    }
    if (!VALID_ROLES.includes(u.role)) {
      throw new Error(`Rol inválido "${u.role}" para ${u.email}. Válidos: ${VALID_ROLES.join(', ')}`)
    }
    const email = u.email.toLowerCase().trim()
    if (seen.has(email)) throw new Error(`Email duplicado: ${email}`)
    seen.add(email)
  }
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('❌ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }

  const usersPath = resolve(projectRoot, 'team_users.json')
  if (!existsSync(usersPath)) {
    console.error('❌ team_users.json no existe.')
    console.error('   Copia team_users.example.json y rellena con datos reales.')
    process.exit(1)
  }

  const users = JSON.parse(readFileSync(usersPath, 'utf8'))
  validateUsers(users)

  if (dryRun) {
    console.log('\n🧪 DRY RUN — no se va a crear ningún usuario, solo validar.\n')
    console.log(`✓ team_users.json válido con ${users.length} usuario(s):\n`)
    const counts = users.reduce((a, u) => ({ ...a, [u.role]: (a[u.role] || 0) + 1 }), {})
    Object.entries(counts).forEach(([role, n]) =>
      console.log(`   ${role.padEnd(12)} → ${n}`))
    console.log()
    users.forEach((u, i) =>
      console.log(`   ${String(i+1).padStart(2)}. ${u.name.padEnd(28)} ${u.email.padEnd(40)} (${u.role})`))
    console.log()
    console.log(`✓ Conexión a Supabase con service role key: validando…`)
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      if (error) {
        console.error(`   ✗ Error: ${error.message}`)
        console.error(`   ↳ Asegúrate de haber corrido las migraciones 001-004.`)
        process.exit(1)
      }
      console.log(`   ✓ Conexión OK · tabla profiles accesible.`)
    } catch (e) {
      console.error(`   ✗ Error: ${e.message}`)
      process.exit(1)
    }
    console.log('\n✅ Todo listo. Quita --dry-run para crear los usuarios reales.\n')
    return
  }

  console.log(`\n🚀 Creando ${users.length} usuarios en Supabase…\n`)

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const results = []
  for (const u of users) {
    const email = u.email.toLowerCase().trim()
    const name  = u.name.trim()
    const role  = u.role

    try {
      // 1. Crear (o reusar) usuario en auth.users
      let userId
      let password = generatePassword()
      let alreadyExisted = false

      const orgId = u.organizationId || DEFAULT_ORG_ID
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,             // sin verificación por correo
        user_metadata: { name, role, organization_id: orgId },
      })

      if (createErr) {
        // Si ya existe, buscarlo
        if (/already (been )?registered|already exists/i.test(createErr.message)) {
          alreadyExisted = true
          // listUsers paginado — buscamos por email
          const { data: list } = await supabase.auth.admin.listUsers({ perPage: 200 })
          const existing = list?.users?.find(x => x.email?.toLowerCase() === email)
          if (!existing) throw new Error(`Usuario ya existía pero no se pudo recuperar`)
          userId = existing.id
          password = '(ya existía — no se cambió)'
        } else {
          throw createErr
        }
      } else {
        userId = created.user.id
      }

      // 2. Actualizar perfil (el trigger lo creó con defaults; lo afinamos)
      // Forzamos organization_id por si el trigger creó una org nueva.
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert({
          id: userId, name, role, active: true,
          organization_id: orgId,
        }, { onConflict: 'id' })

      if (profErr) throw profErr

      results.push({ status: alreadyExisted ? 'reused' : 'created', email, name, role, password, userId })
      console.log(`  ${alreadyExisted ? '↺' : '✓'} ${email}  (${role})`)
    } catch (e) {
      results.push({ status: 'error', email, name, role, error: e.message })
      console.log(`  ✗ ${email}  → ${e.message}`)
    }
  }

  // ── Resumen ──────────────────────────────────────────────
  const ok    = results.filter(r => r.status === 'created').length
  const reuse = results.filter(r => r.status === 'reused').length
  const fail  = results.filter(r => r.status === 'error').length
  console.log(`\n📊 Resultado: ${ok} creados · ${reuse} reusados · ${fail} errores\n`)

  // ── Generar archivo de credenciales ──────────────────────
  const lines = []
  lines.push('# Stratos AI — Credenciales del equipo')
  lines.push(`# Generado: ${new Date().toISOString()}`)
  lines.push(`# IMPORTANTE: este archivo contiene contraseñas. NO subir a git.`)
  lines.push('')
  lines.push('| # | Nombre | Email | Password temporal | Rol |')
  lines.push('|---|---|---|---|---|')
  results.forEach((r, i) => {
    if (r.status === 'error') {
      lines.push(`| ${i+1} | ${r.name} | ${r.email} | **ERROR** | ${r.role} — ${r.error} |`)
    } else {
      lines.push(`| ${i+1} | ${r.name} | \`${r.email}\` | \`${r.password}\` | ${r.role} |`)
    }
  })
  lines.push('')
  lines.push('---')
  lines.push('## Mensaje de bienvenida (copy-paste por persona)')
  lines.push('')
  results.filter(r => r.status === 'created').forEach(r => {
    lines.push(`### Para ${r.name} (${r.email})`)
    lines.push('```')
    lines.push(`Hola ${r.name.split(' ')[0]} 👋`)
    lines.push('')
    lines.push('Bienvenida/o al sistema Stratos AI CRM.')
    lines.push('')
    lines.push('🔗 Link:     https://app.stratoscapitalgroup.com')
    lines.push(`📧 Email:    ${r.email}`)
    lines.push(`🔑 Password: ${r.password}`)
    lines.push('')
    lines.push('⚠️ Por favor cambia tu contraseña al entrar la primera vez.')
    lines.push('')
    lines.push('Adjunto la guía rápida del CRM (CRM_TUTORIAL.md).')
    lines.push('Cualquier duda, repórtala. ¡Bienvenida/o!')
    lines.push('```')
    lines.push('')
  })

  const outPath = resolve(projectRoot, 'team_credentials.md')
  writeFileSync(outPath, lines.join('\n'))
  console.log(`📝 Credenciales guardadas en: ${outPath}`)
  console.log(`   Repártelas individualmente al equipo y luego BORRA el archivo.\n`)

  if (fail > 0) process.exit(1)
}

main().catch(e => {
  console.error('💥 Error fatal:', e.message)
  process.exit(1)
})
