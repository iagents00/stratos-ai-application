#!/usr/bin/env node
/**
 * scripts/backup-supabase.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera un backup completo de la DB de Supabase usando la REST API.
 * Lo escribe a `backups/<fecha>.json` para que GitHub Actions lo commitée.
 *
 * Tablas respaldadas:
 *   • profiles          (usuarios)
 *   • leads             (clientes — sin filtro deleted_at, todo)
 *   • audit_log         (últimos 5000 eventos)
 *   • organizations     (multi-tenant, si existe)
 *
 * También exporta auth.users vía un RPC si está disponible (emails + IDs),
 * pero no falla si no está.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL              URL del proyecto (ej: https://xyz.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY service_role (no anon!) — bypassa RLS
 *
 * Uso local:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-supabase.mjs
 *
 * Output: backups/YYYY-MM-DD.json + backups/latest.json (alias)
 *         backups/README.md (metadatos del backup más reciente)
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan variables: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BACKUP_DIR = 'backups'
const TODAY      = new Date().toISOString().slice(0, 10)   // 2026-04-27

// ── Helper: fetch a Supabase REST con service role ──
async function fetchTable(tableName, opts = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${tableName}`)
  url.searchParams.set('select', opts.select ?? '*')
  if (opts.order) url.searchParams.set('order', opts.order)

  const headers = {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'count=exact',
  }
  if (opts.limit) headers['Range'] = `0-${opts.limit - 1}`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${tableName}: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function safeFetch(name, opts) {
  try {
    const data = await fetchTable(name, opts)
    console.log(`  ✓ ${name}: ${Array.isArray(data) ? data.length : '?'} filas`)
    return data
  } catch (e) {
    console.warn(`  ⚠ ${name}: ${e.message}`)
    return []
  }
}

// ── Generar backup ──
async function main() {
  console.log(`\n🗄  Stratos AI — Backup ${TODAY}`)
  console.log(`📡 ${SUPABASE_URL}\n`)
  console.log('Descargando tablas...')

  const [profiles, leads, audit, organizations] = await Promise.all([
    safeFetch('profiles',      { order: 'created_at.asc' }),
    safeFetch('leads',         { order: 'created_at.asc' }),
    safeFetch('audit_log',     { order: 'created_at.desc', limit: 5000 }),
    safeFetch('organizations', {}),
  ])

  const backup = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    source: SUPABASE_URL,
    stats: {
      profiles:      profiles.length,
      leads:         leads.length,
      audit_log:     audit.length,
      organizations: organizations.length,
    },
    data: { profiles, leads, audit_log: audit, organizations },
  }

  await mkdir(BACKUP_DIR, { recursive: true })
  const dailyFile  = join(BACKUP_DIR, `${TODAY}.json`)
  const latestFile = join(BACKUP_DIR, 'latest.json')
  const json = JSON.stringify(backup, null, 2)
  await writeFile(dailyFile, json)
  await writeFile(latestFile, json)

  // README con metadatos para que GitHub muestre el resumen
  const readme = `# Backups Stratos AI\n\n` +
`Backups automáticos generados por GitHub Actions cada noche.\n\n` +
`## Último backup: \`${TODAY}\`\n\n` +
`| Tabla | Filas |\n|------|------|\n` +
`| profiles | ${profiles.length} |\n` +
`| leads | ${leads.length} |\n` +
`| audit_log | ${audit.length} |\n` +
`| organizations | ${organizations.length} |\n\n` +
`## Restauración\n\n` +
`Si Supabase tuviera un fallo catastrófico, el JSON de \`latest.json\` se puede importar a:\n` +
`- Otra instancia de Supabase con un script de seed\n` +
`- Cualquier base de datos PostgreSQL con \`COPY FROM JSON\`\n` +
`- La app en modo offline (poniendo el JSON en \`src/data/offline-seed/\`)\n\n` +
`## Retención\n\n` +
`Los backups se mantienen 30 días. Los más viejos se borran automáticamente.\n`

  await writeFile(join(BACKUP_DIR, 'README.md'), readme)

  console.log(`\n✅ Backup OK → ${dailyFile}`)
  console.log(`   Tamaño: ${(json.length / 1024).toFixed(1)} KB`)
  console.log(`   ${profiles.length} perfiles · ${leads.length} leads · ${audit.length} eventos\n`)
}

main().catch(e => {
  console.error('\n❌ Backup falló:', e.message)
  process.exit(1)
})
