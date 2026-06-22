/**
 * import_zooms.mjs — Carga del Excel "control_zooms_agendados_roles" a la tabla
 * public.zoom_agendados (migración 027), para el panel "Control de Zooms".
 * ─────────────────────────────────────────────────────────────────────────────
 * USO:
 *   node supabase/import_zooms.mjs supabase/zooms_batch.json [--dry-run]
 *
 * El batch.json (generado desde el Excel) tiene la forma:
 *   {
 *     "organizationId": "00000000-0000-0000-0000-000000000001",   // Duke
 *     "zooms": [
 *       { "fecha_agendado": "2026-05-17"|null, "fecha_zoom": "2026-05-19",
 *         "hora": "11:00", "liner": "...", "presentador_principal": "...",
 *         "presentador_apoyo": null, "cliente": "...", "proyecto": null,
 *         "estatus": "Agendado", "comentarios": null }, ...
 *     ]
 *   }
 *
 * CREDENCIALES (leídas de .env.local, que está en .gitignore):
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← necesaria para insertar saltando RLS
 *
 * Notas:
 *   · organization_id se fija explícito desde el batch (default = org de Duke).
 *   · Idempotente: omite Zooms cuya clave (fecha_zoom|hora|cliente|liner) ya
 *     exista en esa org — re-correr el script no duplica filas.
 *   · --dry-run no toca la red: valida el batch e imprime el plan.
 *   · REQUIERE que la migración 027 ya esté aplicada (la tabla debe existir).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DRY_RUN = process.argv.includes('--dry-run')
const batchPath = process.argv[2]

if (!batchPath || batchPath.startsWith('--')) {
  console.error('Uso: node supabase/import_zooms.mjs <batch.json> [--dry-run]')
  process.exit(1)
}

const DUKE_ORG = '00000000-0000-0000-0000-000000000001'

// ── Cargar .env.local (parser mínimo, sin dependencias) ──────────────────────
function loadEnv() {
  const env = { ...process.env }
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* sin .env.local: usamos process.env */ }
  return env
}

function clean(v) {
  if (v === undefined || v === null) return null
  const t = String(v).trim()
  return t === '' ? null : t
}

// Clave de de-dupe: identifica un Zoom de forma estable sin depender del id.
function zoomKey(z) {
  return [z.fecha_zoom || '', z.hora || '', (z.cliente || '').toLowerCase(), (z.liner || '').toLowerCase()].join('|')
}

async function api(env, path, opts = {}) {
  const url = `${env.VITE_SUPABASE_URL}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }
  return body
}

async function main() {
  const env = loadEnv()
  const batch = JSON.parse(readFileSync(resolve(process.cwd(), batchPath), 'utf8'))

  const orgId = batch.organizationId || DUKE_ORG
  const rawZooms = Array.isArray(batch.zooms) ? batch.zooms : []

  // Normalizar + de-duplicar dentro del propio batch
  const seen = new Set()
  const zooms = []
  for (const z of rawZooms) {
    const row = {
      fecha_agendado:        clean(z.fecha_agendado),
      fecha_zoom:            clean(z.fecha_zoom),
      hora:                  clean(z.hora),
      liner:                 clean(z.liner),
      presentador_principal: clean(z.presentador_principal),
      presentador_apoyo:     clean(z.presentador_apoyo),
      cliente:               clean(z.cliente),
      proyecto:              clean(z.proyecto),
      estatus:               clean(z.estatus) || 'Agendado',
      comentarios:           clean(z.comentarios),
    }
    if (!row.fecha_zoom && !row.cliente) { console.warn('· omito fila vacía:', JSON.stringify(z)); continue }
    const k = zoomKey(row)
    if (seen.has(k)) { console.warn(`· omito duplicado en el batch: ${row.cliente} ${row.fecha_zoom} ${row.hora}`); continue }
    seen.add(k)
    zooms.push(row)
  }

  console.log(`\nBatch: ${batchPath}`)
  console.log(`Organización: ${orgId}`)
  console.log(`Zooms en el archivo: ${rawZooms.length}  →  válidos/únicos: ${zooms.length}`)

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] No se toca la red. Plan de inserción:')
    zooms.forEach((z, i) => console.log(`  ${String(i + 1).padStart(2, ' ')}. ${z.fecha_zoom} ${z.hora || '--:--'}  ${z.cliente || '(sin cliente)'}  · ${z.liner || ''} → ${z.presentador_principal || ''}  [${z.estatus}]`))
    console.log(`\n[DRY-RUN] Total a insertar (antes de checar duplicados en BD): ${zooms.length}`)
    return
  }

  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌ Faltan credenciales. Agrega a .env.local:')
    console.error('   VITE_SUPABASE_URL=https://glulgyhkrqpykxmujodb.supabase.co')
    console.error('   SUPABASE_SERVICE_ROLE_KEY=<service_role key de Supabase → Settings → API>')
    process.exit(1)
  }

  // 1. Zooms ya existentes en esa org (para idempotencia)
  let existing = []
  try {
    existing = await api(env, `/rest/v1/zoom_agendados?organization_id=eq.${orgId}&select=fecha_zoom,hora,cliente,liner`)
  } catch (err) {
    if (/relation .*zoom_agendados.* does not exist|could not find the table|42P01|PGRST205/i.test(err.message)) {
      console.error('\n❌ La tabla public.zoom_agendados no existe todavía.')
      console.error('   Aplica primero la migración:  supabase/migrations/027_zoom_agendados.sql')
      process.exit(1)
    }
    throw err
  }
  const existingKeys = new Set((existing || []).map(zoomKey))

  const toInsert = zooms.filter(z => !existingKeys.has(zoomKey(z)))
  const skipped = zooms.length - toInsert.length
  if (skipped) console.log(`Omitidos por ya existir en la BD: ${skipped}`)

  if (toInsert.length === 0) {
    console.log('\nNada nuevo que insertar. ✅')
    return
  }

  // 2. Insertar en bloque (service_role salta RLS; fijamos org explícito)
  const rows = toInsert.map(z => ({ ...z, organization_id: orgId }))
  const inserted = await api(env, '/rest/v1/zoom_agendados', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })

  console.log(`\n✅ Insertados: ${inserted.length} Zooms en la org ${orgId}.`)
  inserted.slice(0, 5).forEach(r => console.log(`   · ${r.fecha_zoom} ${r.hora || ''}  ${r.cliente || ''}  [${r.estatus}]`))
  if (inserted.length > 5) console.log(`   … y ${inserted.length - 5} más.`)
}

main().catch(err => { console.error('\n❌ Error:', err.message); process.exit(1) })
