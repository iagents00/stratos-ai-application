#!/usr/bin/env node
/**
 * scripts/duke_setup_advisor.mjs
 *
 * Monta una campaña de Duke para UN asesor: su pool directo en Supabase, las
 * reglas de etiquetado del desarrollo, y su landing con link corto. Replica
 * exactamente lo que hoy está en producción para Marco / Mondrian.
 *
 * USO
 *   node scripts/duke_setup_advisor.mjs \
 *     --asesor "Ken Duke" --clave ken --telefono +529842181660 \
 *     --proyecto "Bay View Grand" --slug bayview [--dry-run]
 *
 * Necesita en .env.local (o en el entorno):
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY      (NO la anon key)
 *
 * ES IDEMPOTENTE: correrlo dos veces con los mismos datos no duplica nada.
 *
 * QUÉ HACE
 *   1. Busca el perfil del asesor en `profiles`. Si no existe, aborta: sin
 *      `asesor_id` real el lead cae en el CRM con el nombre pero fuera de la
 *      cuenta del asesor, que es justo lo que hay que evitar.
 *   2. Crea/actualiza el pool `duke_ads_<clave>` con ese único miembro. Ese
 *      pool ES la configuración que lee la Edge Function `duke-lead-router`:
 *      no hay nada hardcodeado que haya que redesplegar.
 *   3. Registra las reglas de `meta_ads_lead_routing_overrides` para que todo
 *      lead del desarrollo entre con project/tag correctos y a ese pool.
 *   4. Genera `public/duke/<slug>/index.html` a partir de la landing de
 *      Mondrian, con el píxel, el registro de clic y el WhatsApp del asesor.
 *   5. Agrega el rewrite de `/<slug>` en vercel.json.
 *
 * LO QUE NO HACE (a propósito)
 *   La campaña en Meta. Eso se hace a mano; la skill
 *   `.claude/skills/duke-campana-asesor/SKILL.md` trae la receta exacta.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PLANTILLA = 'public/duke/mondrian/index.html'
const HERO_PLANTILLA = 'public/duke/mondrian/hero-1000.jpg'

// ---------------------------------------------------------------- utilidades

function argumentos() {
  const out = { dryRun: false, soloLanding: false }
  const a = process.argv.slice(2)
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--dry-run') { out.dryRun = true; continue }
    if (a[i] === '--solo-landing') { out.soloLanding = true; continue }
    if (!a[i].startsWith('--')) continue
    out[a[i].slice(2)] = a[i + 1]
    i++
  }
  return out
}

function morir(msg) {
  console.error(`\n  ✗ ${msg}\n`)
  process.exit(1)
}

function cargarEnv() {
  const f = resolve(RAIZ, '.env.local')
  if (!existsSync(f)) return
  for (const linea of readFileSync(f, 'utf8').split('\n')) {
    const s = linea.trim()
    if (!s || s.startsWith('#') || !s.includes('=')) continue
    const i = s.indexOf('=')
    const k = s.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}

/** Clave de asesor: minúsculas, sin acentos, sin nada raro. */
const normalizarClave = (v) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/** Teléfono a E.164 sin espacios. Duke opera en México. */
function normalizarTelefono(v) {
  const d = String(v || '').replace(/[^0-9]/g, '')
  if (!d) return null
  if (d.length === 10) return `+52${d}`
  if (d.startsWith('52')) return `+${d}`
  return `+${d}`
}

// ------------------------------------------------------------------- proceso

async function main() {
  cargarEnv()
  const arg = argumentos()

  const asesor = (arg.asesor || '').trim()
  const clave = normalizarClave(arg.clave || asesor.split(' ')[0])
  const telefono = normalizarTelefono(arg.telefono)
  const proyecto = (arg.proyecto || '').trim()
  const slug = normalizarClave(arg.slug || proyecto).replace(/_/g, '-')

  if (!asesor) morir('Falta --asesor "Nombre Apellido" (debe coincidir con profiles.name)')
  if (!clave) morir('Falta --clave (ej: ken). Se usa para el pool duke_ads_<clave> y el ?advisor=')
  if (!telefono) morir('Falta --telefono (ej: +529842181660)')
  if (!proyecto) morir('Falta --proyecto "Nombre del desarrollo"')
  if (!slug) morir('Falta --slug (ej: bayview). Es el link corto stratoscapitalgroup.com/<slug>')

  // La service role key normalmente NO está en local. Con --solo-landing el
  // script genera la landing y el link corto, y la parte de Supabase se hace
  // por MCP con el SQL que trae la skill. Es el camino habitual.
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!arg.soloLanding && (!url || !key)) {
    morir(
      'Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.\n' +
      '    Si no tienes la service role key a la mano, corre con --solo-landing\n' +
      '    y haz la parte de Supabase con el SQL de la skill duke-campana-asesor.',
    )
  }

  const db = arg.soloLanding ? null : createClient(url, key, { auth: { persistSession: false } })

  console.log(`\n  Asesor    ${asesor}  (clave: ${clave})`)
  console.log(`  WhatsApp  ${telefono}`)
  console.log(`  Proyecto  ${proyecto}`)
  console.log(`  Landing   https://stratoscapitalgroup.com/${slug}`)
  console.log(`  Pool      duke_ads_${clave}`)
  if (arg.dryRun) console.log('\n  (--dry-run: no se escribe nada)')

  // 1 ─ El perfil tiene que existir. Sin asesor_id el lead no cae en su cuenta.
  let perfil = null
  if (db) {
  const { data: p, error: errPerfil } = await db
    .from('profiles').select('id, name, role')
    .eq('organization_id', ORG_ID).eq('name', asesor).maybeSingle()

  if (errPerfil) morir(`Error consultando profiles: ${errPerfil.message}`)
  perfil = p
  if (!perfil) {
    morir(
      `No existe un perfil con name exactamente "${asesor}" en la org de Duke.\n` +
      `    El nombre debe coincidir tal cual con profiles.name. Revisa cómo está\n` +
      `    escrito en el CRM: sin ese id el lead entra con el nombre pero fuera\n` +
      `    de la cuenta del asesor.`,
    )
  }
  console.log(`\n  ✓ Perfil encontrado: ${perfil.name} (${perfil.role}) — ${perfil.id}`)
  }

  if (arg.dryRun) {
    console.log('\n  Dry run listo. Nada escrito.\n')
    return
  }

  const poolKey = `duke_ads_${clave}`
  const campaign = `Duke ${proyecto} - ${asesor.split(' ')[0]} - Lead Ads`

  // 2 ─ Pool directo. Es la config que lee la Edge Function.
  if (db) {
  let { data: pool } = await db.from('lead_assignment_pools')
    .select('id').eq('organization_id', ORG_ID).eq('pool_key', poolKey).maybeSingle()

  if (!pool) {
    const { data, error } = await db.from('lead_assignment_pools')
      .insert({
        organization_id: ORG_ID, pool_key: poolKey,
        label: `Duke Ads — ${asesor}`, strategy: 'round_robin',
        default_stage: 'Contáctame Ya', active: true,
      }).select('id').single()
    if (error) morir(`No se pudo crear el pool: ${error.message}`)
    pool = data
    console.log(`  ✓ Pool creado: ${poolKey}`)
  } else {
    console.log(`  · Pool ya existía: ${poolKey}`)
  }

  const { data: miembro } = await db.from('lead_assignment_pool_members')
    .select('id').eq('pool_id', pool.id).eq('asesor_id', perfil.id).maybeSingle()

  if (!miembro) {
    const { error } = await db.from('lead_assignment_pool_members').insert({
      pool_id: pool.id, asesor_id: perfil.id, asesor_name: perfil.name,
      advisor_phone_e164: telefono, active: true, weight: 1, sort_order: 10,
      assigned_count: 0,
    })
    if (error) morir(`No se pudo agregar el miembro al pool: ${error.message}`)
    console.log(`  ✓ ${asesor} agregado al pool con ${telefono}`)
  } else {
    const { error } = await db.from('lead_assignment_pool_members')
      .update({ advisor_phone_e164: telefono, asesor_name: perfil.name, active: true, updated_at: new Date().toISOString() })
      .eq('id', miembro.id)
    if (error) morir(`No se pudo actualizar el miembro: ${error.message}`)
    console.log(`  · Miembro ya existía; teléfono actualizado a ${telefono}`)
  }

  // 3 ─ Reglas de etiquetado. La de tipo `contains` es la que dispara desde la
  //     landing, porque el campaign que manda lleva el nombre del proyecto.
  const { error: errRegla } = await db.from('meta_ads_lead_routing_overrides').upsert({
    organization_id: ORG_ID, match_type: 'contains',
    match_value: proyecto.toLowerCase(),
    project: proyecto, campaign, tag: proyecto,
    pool_key: poolKey, priority: 50, active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,match_type,match_value' })
  if (errRegla) morir(`No se pudo registrar la regla de etiquetado: ${errRegla.message}`)
  console.log(`  ✓ Regla de etiquetado: cualquier lead con "${proyecto.toLowerCase()}" → project/tag ${proyecto}, pool ${poolKey}`)
  } else {
    console.log(`\n  · --solo-landing: la parte de Supabase queda pendiente (ver la skill)`)
  }

  // 4 ─ Landing a partir de la de Mondrian.
  const plantilla = resolve(RAIZ, PLANTILLA)
  if (!existsSync(plantilla)) morir(`No encuentro la plantilla ${PLANTILLA}`)

  const destinoDir = resolve(RAIZ, 'public/duke', slug)
  mkdirSync(destinoDir, { recursive: true })

  const heroDestino = resolve(destinoDir, 'hero-1000.jpg')
  if (!existsSync(heroDestino)) {
    copyFileSync(resolve(RAIZ, HERO_PLANTILLA), heroDestino)
    console.log(`  · Hero copiado de Mondrian. Reemplázala por la foto del desarrollo.`)
  }

  const telSinMas = telefono.replace('+', '')
  let html = readFileSync(plantilla, 'utf8')
  const sust = [
    ['Mondrian Riviera Maya | Duke del Caribe', `${proyecto} | Duke del Caribe`],
    ['https://stratoscapitalgroup.com/mondrian', `https://stratoscapitalgroup.com/${slug}`],
    ['https://stratoscapitalgroup.com/duke/mondrian/hero-1000.jpg', `https://stratoscapitalgroup.com/duke/${slug}/hero-1000.jpg`],
    ['/duke/mondrian/hero-1000.jpg', `/duke/${slug}/hero-1000.jpg`],
    ['Vi el anuncio de Mondrian y me gustaría conocerlo.', `Vi el anuncio de ${proyecto} y me gustaría conocerlo.`],
    ['content_name: "Mondrian Riviera Maya"', `content_name: "${proyecto}"`],
    ['project: "Mondrian"', `project: "${proyecto}"`],
    ['campaign: "Duke Mondrian - Marco - Lead Ads"', `campaign: "${campaign}"`],
    ['|| "marco").toLowerCase()', `|| "${clave}").toLowerCase()`],
    ['phoneByAdvisor[advisor] || phoneByAdvisor.marco', `phoneByAdvisor[advisor] || "${telSinMas}"`],
  ]
  for (const [de, a] of sust) {
    if (!html.includes(de)) morir(`La plantilla cambió: no encontré "${de.slice(0, 45)}…". Actualiza este script.`)
    html = html.split(de).join(a)
  }
  // El asesor entra al mapa para que ?advisor=<clave> funcione desde cualquier landing.
  html = html.replace(
    /var phoneByAdvisor = \{([^}]*)\}/,
    (_m, cuerpo) => cuerpo.includes(`${clave}:`)
      ? `var phoneByAdvisor = {${cuerpo}}`
      : `var phoneByAdvisor = {${cuerpo.trimEnd().replace(/,?$/, '')}, ${clave}: "${telSinMas}" }`,
  )

  writeFileSync(resolve(destinoDir, 'index.html'), html)
  console.log(`  ✓ Landing generada: public/duke/${slug}/index.html`)

  // 5 ─ Link corto.
  const vercelPath = resolve(RAIZ, 'vercel.json')
  const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'))
  const yaEsta = vercel.rewrites.some((r) => r.source === `/${slug}`)
  if (!yaEsta) {
    vercel.rewrites.unshift({ source: `/${slug}`, destination: `/duke/${slug}/index.html` })
    writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n')
    console.log(`  ✓ Link corto /${slug} agregado a vercel.json`)
  } else {
    console.log(`  · El rewrite /${slug} ya existía`)
  }

  console.log(`
  ─────────────────────────────────────────────────────────
  Listo del lado de Stratos. Falta:

    1. Cambiar la foto:  public/duke/${slug}/hero-1000.jpg
    2. Ajustar el copy si el desarrollo lo pide
    3. Bumpear CACHE_VERSION en public/sw.js
    4. Commit → PR → merge → verificar deploy
    5. Crear la campaña en Meta (ver la skill duke-campana-asesor)

  Prueba cuando esté desplegado:
    https://stratoscapitalgroup.com/${slug}
  ─────────────────────────────────────────────────────────
`)
}

main().catch((e) => morir(e.message))
