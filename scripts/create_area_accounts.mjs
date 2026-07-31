#!/usr/bin/env node
/**
 * scripts/create_area_accounts.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Da de alta (y deja listo el espacio de) al equipo de ÁREAS de Duke — el que
 * arrancó el «Plan de Trabajo Semanal» el 30-jul-2026.
 *
 * Hace tres cosas, todas idempotentes:
 *   1. Crea en Auth a quien NO tenga cuenta, con la contraseña temporal que fijó
 *      dirección. A quien YA tiene cuenta NO le toca la contraseña ni el rol.
 *   2. Escribe `profiles.area` de TODAS las personas del registro (incluidas las
 *      que ya existían) — es lo que decide qué carpeta de Drive ve cada quien.
 *   3. Le asigna un `telegram_chat_id` SINTÉTICO (negativo) a quien no tenga:
 *      es la identidad con la que el Copilot lo reconoce. Mismo patrón que usó
 *      el equipo de marketing (no son chats reales de Telegram).
 *
 * REQUISITO: la migración 227 aplicada (rol `colaborador` en el CHECK de
 * profiles.role + columna `area`). Sin ella el upsert del perfil falla y el
 * script te lo dice con todas sus letras en vez de dejar cuentas a medias.
 *
 * USO:
 *   node scripts/create_area_accounts.mjs --dry-run   # valida y muestra el plan
 *   node scripts/create_area_accounts.mjs             # ejecuta
 *   node scripts/create_area_accounts.mjs --areas-only # solo el paso 2 y 3
 *
 * CREDENCIALES (de .env.local, que está en .gitignore):
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * SALIDA: `team_credentials.md` (gitignored) con la tabla para repartir.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const ORG_ID = '00000000-0000-0000-0000-000000000001'   // Stratos Capital Group (Duke)
const TEMP_PASSWORD = 'Stratos12'                        // la que fijó dirección

/* ── El registro ──────────────────────────────────────────────────────────────
 * `email` es la identidad en Stratos. Quien ya la tiene, se respeta tal cual —
 * por eso van los correos reales de los que ya estaban (no se les crea nada,
 * solo se les completa el área).
 *
 * `crear: false` = ya tiene cuenta. NO se le toca contraseña ni rol.
 * ────────────────────────────────────────────────────────────────────────────*/
const REGISTRO = [
  // ── Marketing (ya operan en su espacio desde julio) ──
  { name: 'Yazmin Ledesma',       email: 'yazz.mkt@stratos.ai',                    area: 'Marketing',      crear: false },
  { name: 'Emmanuel Sánchez',     email: 'em.mkt@stratos.ai',                      area: 'Marketing',      crear: false },
  { name: 'Luis Ángel Landeros',  email: 'luis.mkt@stratos.ai',                    area: 'Marketing',      crear: false },
  // ── Comercial ──
  { name: 'Emmanuel Ortiz',       email: 'emmanuel@stratoscapitalgroup.com',       area: 'Comercial',      crear: false },
  { name: 'Carolina Curiel',      email: 'carolina.curiel@stratoscapitalgroup.com',area: 'Comercial',      crear: false },
  // ── Operativo ──
  { name: 'Mario',                email: 'mario.ops@stratos.ai',                   area: 'Operativo',      crear: true, role: 'colaborador' },
  { name: 'Shaday',               email: 'shaday.ops@stratos.ai',                  area: 'Operativo',      crear: true, role: 'colaborador' },
  // ── Administrativo ──
  { name: 'Paz',                  email: 'paz.adm@stratos.ai',                     area: 'Administrativo', crear: true, role: 'colaborador' },
  { name: 'Alexander',            email: 'alexander.adm@stratos.ai',               area: 'Administrativo', crear: true, role: 'colaborador' },
  // ── Finanzas ──
  { name: 'Wilbert',              email: 'wilbert.fin@stratos.ai',                 area: 'Finanzas',       crear: true, role: 'colaborador' },
  // ── Recursos Humanos ──
  { name: 'Yolanda',              email: 'rh.stratosgrup@gmail.com',               area: 'RRHH',           crear: false },
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

/** Busca un usuario de Auth por email recorriendo las páginas que haga falta. */
async function findAuthUser(sb, email) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data?.users?.find(u => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (!data?.users?.length || data.users.length < 200) return null
  }
  return null
}

async function main() {
  const dryRun    = process.argv.includes('--dry-run')
  const areasOnly = process.argv.includes('--areas-only')
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // Chequeo previo: ¿está la migración 227? Sin ella, todo lo demás falla feo.
  const { error: colErr } = await sb.from('profiles').select('id, area').limit(1)
  if (colErr) {
    console.error(`✗ No se pudo leer profiles.area: ${colErr.message}`)
    console.error('  ↳ Falta aplicar supabase/migrations/227_cada_area_tiene_su_espacio.sql')
    process.exit(1)
  }

  // Chat sintético: seguimos la serie negativa que ya usa el equipo de marketing.
  const { data: chats } = await sb
    .from('profiles').select('telegram_chat_id')
    .lt('telegram_chat_id', 0).order('telegram_chat_id', { ascending: true }).limit(1)
  let nextChat = (chats?.[0]?.telegram_chat_id ?? -9000000000000) - 1

  if (dryRun) {
    console.log('\nDRY RUN — no se escribe nada.\n')
    for (const p of REGISTRO) {
      const existente = await findAuthUser(sb, p.email)
      const q = existente ? 'ya existe' : (p.crear ? 'SE CREA' : '✗ NO existe y está marcado como crear:false')
      console.log(`  ${p.name.padEnd(22)} ${p.email.padEnd(42)} ${p.area.padEnd(15)} → ${q}`)
    }
    console.log('\nQuita --dry-run para ejecutar.\n')
    return
  }

  const results = []
  for (const p of REGISTRO) {
    try {
      let authUser = await findAuthUser(sb, p.email)
      let password = '(no se cambió)'
      let estado

      if (!authUser) {
        if (!p.crear || areasOnly) {
          results.push({ ...p, estado: 'falta', detalle: 'no existe en Auth y no se pidió crearla' })
          console.log(`  ! ${p.email} — no existe y no se creó`)
          continue
        }
        const { data: created, error } = await sb.auth.admin.createUser({
          email: p.email, password: TEMP_PASSWORD, email_confirm: true,
          user_metadata: { name: p.name, role: p.role, organization_id: ORG_ID },
        })
        if (error) throw error
        authUser = created.user
        password = TEMP_PASSWORD
        estado = 'creada'
      } else {
        estado = 'ya existía'
      }

      // Perfil: el área SIEMPRE se escribe; nombre/rol/org solo cuando la cuenta
      // es nueva (a quien ya trabajaba acá no se le cambia el rol por un script).
      const patch = { area: p.area }
      if (estado === 'creada') {
        Object.assign(patch, {
          id: authUser.id, name: p.name, role: p.role,
          organization_id: ORG_ID, active: true,
          telegram_chat_id: nextChat--,
        })
        const { error } = await sb.from('profiles').upsert(patch, { onConflict: 'id' })
        if (error) throw error
      } else {
        const { error } = await sb.from('profiles').update(patch).eq('id', authUser.id)
        if (error) throw error
      }

      results.push({ ...p, estado, password, userId: authUser.id })
      console.log(`  ${estado === 'creada' ? '+' : '='} ${p.email.padEnd(42)} ${p.area.padEnd(15)} ${estado}`)
    } catch (e) {
      results.push({ ...p, estado: 'error', detalle: e.message })
      console.log(`  x ${p.email} → ${e.message}`)
      if (/profiles_role_check/.test(e.message)) {
        console.error('    ↳ El rol `colaborador` no está en el CHECK: falta aplicar la migración 227.')
      }
    }
  }

  const creadas = results.filter(r => r.estado === 'creada')
  const errores = results.filter(r => r.estado === 'error' || r.estado === 'falta')
  console.log(`\n${creadas.length} creadas · ${results.filter(r => r.estado === 'ya existía').length} ya existían · ${errores.length} con problema\n`)

  if (creadas.length) {
    const L = []
    L.push('# Stratos AI — Accesos del Plan de Trabajo Semanal')
    L.push(`# Generado: ${new Date().toISOString()}`)
    L.push('# Contiene contraseñas temporales. NO subir a git. Repartir 1 a 1 y borrar.')
    L.push('')
    L.push('| Nombre | Área | Email | Contraseña temporal |')
    L.push('|---|---|---|---|')
    creadas.forEach(r => L.push(`| ${r.name} | ${r.area} | \`${r.email}\` | \`${r.password}\` |`))
    L.push('')
    L.push('## Mensaje para enviar (uno por persona)')
    L.push('')
    creadas.forEach(r => {
      L.push(`### ${r.name} — ${r.area}`)
      L.push('```')
      L.push(`Hola ${r.name.split(' ')[0]}:`)
      L.push('')
      L.push('Ya tienes tu espacio en Stratos para el Plan de Trabajo Semanal.')
      L.push('')
      L.push('Link:       https://app.stratoscapitalgroup.com')
      L.push(`Usuario:    ${r.email}`)
      L.push(`Contraseña: ${r.password}`)
      L.push('')
      L.push('Al entrar vas a ver Actividades (ahí registras tu plan y lo que hiciste),')
      L.push(`Mi Día, tu Copilot y Mi Drive con la carpeta de ${r.area}.`)
      L.push('Cambia tu contraseña desde Perfil la primera vez que entres.')
      L.push('```')
      L.push('')
    })
    const out = resolve(projectRoot, 'team_credentials.md')
    writeFileSync(out, L.join('\n'))
    console.log(`Credenciales en: ${out}\n`)
  }

  if (errores.length) process.exit(1)
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
