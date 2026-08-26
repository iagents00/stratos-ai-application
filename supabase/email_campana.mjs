/**
 * email_campana.mjs — Operación de campañas de correo de Stratos.
 * ─────────────────────────────────────────────────────────────────────────────
 * Una sola herramienta para toda la secuencia. Sin dependencias.
 *
 * FLUJO DE LA SEMANA:
 *   node supabase/email_campana.mjs validar                   # limpia la lista (una vez)
 *   node supabase/email_campana.mjs crear                     # da de alta las campañas del JSON
 *   node supabase/email_campana.mjs render  <slug>            # mete el HTML a la campaña
 *   node supabase/email_campana.mjs audiencia <slug> [--segmentos A,B]
 *   node supabase/email_campana.mjs enviar  <slug> [--lote 100] [--max 100] [--dry-run]
 *   node supabase/email_campana.mjs reporte <slug>
 *
 * CREDENCIALES (.env.local, que está en .gitignore):
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Notas:
 *   · `enviar` se detiene solo si el rebote pasa de 5% o las quejas de 0.3%.
 *     Quemar el dominio por apurar un envío no vale ningún webinar.
 *   · `validar` NO modifica correos sin `--aplicar`. Primero enseña qué haría.
 *   · Todo es idempotente: correrlo dos veces no duplica ni reenvía.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveMx } from 'node:dns/promises'

const ORG_DUKE = '00000000-0000-0000-0000-000000000001'

// Umbrales de aborto. No los subas sin entender qué estás arriesgando.
const TOPE_REBOTE = 0.05   // 5%
const TOPE_QUEJA  = 0.003  // 0.3%
const MUESTRA_MIN = 40     // debajo de esto los porcentajes no dicen nada

// Dedazos que se repiten en toda base capturada a mano.
const DEDAZOS = {
  'gmial.com': 'gmail.com',      'gmai.com': 'gmail.com',
  'gmil.com': 'gmail.com',       'gmail.con': 'gmail.com',
  'gamil.com': 'gmail.com',      'gmaill.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',  'hotmil.com': 'hotmail.com',
  'yahho.com': 'yahoo.com',      'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',      'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',   'iclod.com': 'icloud.com',
  'icloud.con': 'icloud.com',    'prontonmail.com': 'protonmail.com',
  'protonmai.com': 'protonmail.com',
}

// ── Utilidades ───────────────────────────────────────────────────────────────

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

const env = loadEnv()
const BASE = env.VITE_SUPABASE_URL
const KEY  = env.SUPABASE_SERVICE_ROLE_KEY

if (!BASE || !KEY) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) throw new Error(`${res.status} — ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  return body
}

async function fn(nombre, payload) {
  const res = await fetch(`${BASE}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) throw new Error(`edge ${res.status} — ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  return body
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—')

function flag(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`)
  return i > -1 ? (process.argv[i + 1] ?? true) : porDefecto
}
const tiene = (n) => process.argv.includes(`--${n}`)

async function campañaPorSlug(slug) {
  const r = await api(`email_campaigns?organization_id=eq.${ORG_DUKE}&slug=eq.${encodeURIComponent(slug)}&select=*`)
  if (!r.length) throw new Error(`No existe la campaña "${slug}". Corre: crear`)
  return r[0]
}

// ── validar ──────────────────────────────────────────────────────────────────
// Sintaxis, dedazos y MX real. Lo que no tiene servidor de correo no se envía:
// rebota, y el rebote es lo que mancha la reputación de un dominio nuevo.

async function cmdValidar() {
  const aplicar = tiene('aplicar')

  const audiencia = await api(
    `rpc/fn_email_audiencia`,
    { method: 'POST', body: JSON.stringify({ p_org: ORG_DUKE, p_segmentos: ['A', 'B', 'C'] }) }
  )

  console.log(`\nRevisando ${audiencia.length} correos elegibles...\n`)

  const cacheMx = new Map()
  const correcciones = []
  const invalidos = []

  for (const p of audiencia) {
    const [usuario, dominioRaw] = p.email.split('@')
    const dominio = (dominioRaw || '').toLowerCase()

    if (DEDAZOS[dominio]) {
      correcciones.push({ ...p, sugerido: `${usuario}@${DEDAZOS[dominio]}` })
      continue
    }

    if (!cacheMx.has(dominio)) {
      try {
        const mx = await resolveMx(dominio)
        cacheMx.set(dominio, Array.isArray(mx) && mx.length > 0)
      } catch {
        cacheMx.set(dominio, false)
      }
    }

    if (!cacheMx.get(dominio)) invalidos.push(p)
  }

  console.log(`Dedazos detectados:  ${correcciones.length}`)
  for (const c of correcciones) console.log(`  · ${c.email}  →  ${c.sugerido}`)

  console.log(`\nDominios sin servidor de correo: ${invalidos.length}`)
  for (const i of invalidos) console.log(`  · ${i.email}`)

  const limpios = audiencia.length - correcciones.length - invalidos.length
  console.log(`\nQuedan limpios: ${limpios} de ${audiencia.length}`)

  if (!aplicar) {
    console.log('\nEsto fue un ensayo. Para escribir los cambios: --aplicar\n')
    return
  }

  for (const c of correcciones) {
    await api(`leads?id=eq.${c.lead_id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ email: c.sugerido }),
    })
    console.log(`corregido: ${c.email} → ${c.sugerido}`)
  }

  for (const i of invalidos) {
    await api('email_suppressions', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        organization_id: ORG_DUKE,
        email: i.email,
        motivo: 'invalido',
        detalle: 'el dominio no tiene registros MX',
      }),
    })
    console.log(`excluido: ${i.email}`)
  }

  console.log(`\nListo. ${correcciones.length} corregidos, ${invalidos.length} excluidos.\n`)
}

// ── crear ────────────────────────────────────────────────────────────────────

async function cmdCrear() {
  const ruta = flag('archivo', 'supabase/email_campanas_webinar.json')
  const def = JSON.parse(readFileSync(resolve(process.cwd(), ruta), 'utf8'))

  for (const c of def.campanas) {
    const existe = await api(
      `email_campaigns?organization_id=eq.${ORG_DUKE}&slug=eq.${encodeURIComponent(c.slug)}&select=id`
    )

    const fila = {
      organization_id: ORG_DUKE,
      slug: c.slug,
      nombre: c.nombre,
      asunto: c.asunto,
      asunto_b: c.asunto_b ?? null,
      preheader: c.preheader ?? null,
      from_name: def.from_name,
      from_email: def.from_email,
      reply_to: def.reply_to ?? def.from_email,
      plantilla: c.plantilla,
      segmentos: c.segmentos ?? ['A', 'B', 'C'],
      metadata: c.metadata ?? {},
    }

    if (existe.length) {
      await api(`email_campaigns?id=eq.${existe[0].id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(fila),
      })
      console.log(`actualizada: ${c.slug}`)
    } else {
      await api('email_campaigns', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(fila),
      })
      console.log(`creada: ${c.slug}`)
    }
  }
  console.log('')
}

// ── render ───────────────────────────────────────────────────────────────────

async function cmdRender(slug) {
  const c = await campañaPorSlug(slug)
  const ruta = flag('archivo', 'supabase/email_campanas_webinar.json')
  const def = JSON.parse(readFileSync(resolve(process.cwd(), ruta), 'utf8'))
  const datos = def.datos ?? {}

  const dir = (f) => resolve(process.cwd(), `src/emails/${f}`)

  if (!existsSync(dir(`${c.plantilla}.html`))) {
    throw new Error(`No encuentro src/emails/${c.plantilla}.html`)
  }

  // El armazón de tabla vive una sola vez en _base. Las plantillas son solo
  // el contenido: así el pie legal y el enlace de baja no se pueden olvidar.
  // Cada campaña elige su armazón: "_base" (diseñado) o "_base-plano"
  // (parece nota personal). El plano contesta más; el diseñado luce más.
  const armazón = def.campanas.find((x) => x.slug === slug)?.base ?? '_base'

  const componer = (ext) => {
    const frag = existsSync(dir(`${c.plantilla}.${ext}`))
      ? readFileSync(dir(`${c.plantilla}.${ext}`), 'utf8')
      : null
    if (frag === null) return null
    const base = existsSync(dir(`${armazón}.${ext}`)) ? readFileSync(dir(`${armazón}.${ext}`), 'utf8') : '{{contenido}}'
    return base.replace('{{contenido}}', frag)
  }

  let cuerpoHtml  = componer('html')
  let cuerpoTexto = componer('txt')

  // Los datos del webinar se inyectan aquí. {{nombre}} y {{unsub_url}} NO:
  // esos cambian por destinatario y los resuelve la edge function.
  // Las resuelve el motor al enviar, no el JSON: no son error si siguen aquí.
  const porRecipiente = new Set(['nombre', 'unsub_url', 'gancho', 'preheader'])
  const sustituir = (t) =>
    t.replace(/\{\{(\w+)\}\}/g, (m, k) =>
      porRecipiente.has(k) ? m : (datos[k] ?? c[k] ?? m)
    )

  cuerpoHtml = sustituir(cuerpoHtml)
  if (cuerpoTexto) cuerpoTexto = sustituir(cuerpoTexto)

  // ── Guardas antes de dejar la campaña lista ──────────────────────────────
  const problemas = []

  if (!cuerpoHtml.includes('{{unsub_url}}')) {
    problemas.push('la plantilla no tiene {{unsub_url}} — sin enlace de baja no se envía')
  }

  const pendientes = [...cuerpoHtml.matchAll(/PENDIENTE[_A-Z]*/g)].map((m) => m[0])
  if (pendientes.length) {
    problemas.push(`quedan ${pendientes.length} datos sin definir: ${[...new Set(pendientes)].join(', ')}`)
  }

  const sinResolver = [...cuerpoHtml.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1])
    .filter((k) => !porRecipiente.has(k))
  if (sinResolver.length) {
    problemas.push(`variables sin valor en el JSON: ${[...new Set(sinResolver)].join(', ')}`)
  }

  const kb = (cuerpoHtml.length / 1024).toFixed(1)
  console.log(`\n${slug} — ${kb} KB${cuerpoTexto ? ' + texto plano' : ''}`)

  if (cuerpoHtml.length > 102400) console.log('AVISO: arriba de 100 KB Gmail recorta el correo.')
  if (!cuerpoTexto) console.log('AVISO: sin alternativa en texto plano pierdes puntos de entregabilidad.')

  // Se guarda el cuerpo siempre (para poder previsualizar), pero la campaña
  // solo pasa a "listo" si no hay nada pendiente.
  const estado = problemas.length ? c.estado : 'listo'

  await api(`email_campaigns?id=eq.${c.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ cuerpo_html: cuerpoHtml, cuerpo_texto: cuerpoTexto, estado }),
  })

  if (problemas.length) {
    console.log('\nNO queda lista para enviar:')
    for (const p of problemas) console.log(`  · ${p}`)
    console.log(`\nEstado: ${estado}\n`)
    return
  }

  console.log('Estado: listo\n')
}

// ── previsualizar ────────────────────────────────────────────────────────────
// No toca la base. Sirve para revisar el correo antes de que exista nada en
// producción, y para abrirlo en el navegador tal como lo va a ver la persona.

function componerLocal(plantilla, datos, campana) {
  const dir = (f) => resolve(process.cwd(), `src/emails/${f}`)
  const armazón = campana.base ?? '_base'
  const arma = (ext) => {
    if (!existsSync(dir(`${plantilla}.${ext}`))) return null
    const frag = readFileSync(dir(`${plantilla}.${ext}`), 'utf8')
    const base = existsSync(dir(`${armazón}.${ext}`)) ? readFileSync(dir(`${armazón}.${ext}`), 'utf8') : '{{contenido}}'
    return base.replace('{{contenido}}', frag)
  }
  // Las resuelve el motor al enviar, no el JSON: no son error si siguen aquí.
  const porRecipiente = new Set(['nombre', 'unsub_url', 'gancho', 'preheader'])
  const sustituir = (t) =>
    t.replace(/\{\{(\w+)\}\}/g, (m, k) =>
      porRecipiente.has(k) ? m : (datos[k] ?? campana[k] ?? m))
  return { html: arma('html') && sustituir(arma('html')), texto: arma('txt') && sustituir(arma('txt')) }
}

async function cmdPrevisualizar(slug) {
  const ruta = flag('archivo', 'supabase/email_campanas_webinar.json')
  const def = JSON.parse(readFileSync(resolve(process.cwd(), ruta), 'utf8'))
  const salida = String(flag('salida', 'preview-emails'))

  const objetivo = slug ? def.campanas.filter((c) => c.slug === slug) : def.campanas
  if (!objetivo.length) throw new Error(`No encuentro la campaña "${slug}" en ${ruta}`)

  mkdirSync(resolve(process.cwd(), salida), { recursive: true })

  // Datos de muestra para que se vea como el correo real, no como una plantilla.
  const muestra = { nombre: 'Carmen', unsub_url: '#baja', preheader: '', gancho: def.datos?._gancho_muestra ?? 'La última vez que platicamos preguntabas por Bay View Grand.' }
  const enlaces = []

  for (const c of objetivo) {
    const { html, texto } = componerLocal(c.plantilla, def.datos, c)
    if (!html) { console.log(`sin plantilla: ${c.slug}`); continue }

    const conMuestra = html.replace(/\{\{(\w+)\}\}/g, (m, k) => muestra[k] ?? m)
    const archivo = resolve(process.cwd(), salida, `${c.slug}.html`)
    writeFileSync(archivo, conMuestra, 'utf8')

    const kb = (html.length / 1024).toFixed(1)
    const faltan = [...new Set([...conMuestra.matchAll(/PENDIENTE[_A-Z]*/g)].map((m) => m[0]))]
    console.log(`${c.slug.padEnd(26)} ${kb.padStart(5)} KB  ${texto ? '+txt' : '    '}  ${faltan.length ? `· faltan ${faltan.length} datos` : '· completo'}`)
    enlaces.push({ slug: c.slug, asunto: c.asunto, archivo: `${c.slug}.html`, faltan })
  }

  // Índice para revisarlos todos de un jalón.
  const indice = `<!doctype html><meta charset="utf-8"><title>Correos del webinar</title>
<style>body{font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#141a21}
h1{font-size:19px;margin:0 0 6px}p.s{color:#6b7684;margin:0 0 28px;font-size:14px}
a{display:block;padding:14px 16px;margin:0 0 8px;border:1px solid #e3e6ea;border-radius:10px;text-decoration:none;color:#141a21}
a:hover{border-color:#1f6f6b}small{color:#8b95a1}em{color:#b4442e;font-style:normal}
@media(prefers-color-scheme:dark){body{background:#0b0f14;color:#e6eaf0}a{border-color:#26303a;color:#e6eaf0}}</style>
<h1>Correos del webinar</h1><p class="s">Vista previa local. Datos de muestra: nombre "Carmen".</p>
${enlaces.map((e) => `<a href="${e.archivo}"><strong>${e.asunto}</strong><br><small>${e.slug}${e.faltan.length ? ` · <em>faltan ${e.faltan.length} datos</em>` : ''}</small></a>`).join('\n')}`
  writeFileSync(resolve(process.cwd(), salida, 'index.html'), indice, 'utf8')

  console.log(`\nAbre ${salida}/index.html\n`)
}

// ── audiencia ────────────────────────────────────────────────────────────────

async function correosDeCampana(slug, filtro) {
  const c = await campañaPorSlug(slug)
  let q = `email_recipients?campaign_id=eq.${c.id}&select=email`
  if (filtro === 'no-abrieron') q += '&opened_at=is.null&estado=in.(enviado,entregado)'
  if (filtro === 'abrieron')    q += '&opened_at=not.is.null'
  const filas = await api(q)
  return new Set(filas.map((f) => f.email.toLowerCase()))
}

async function cmdAudiencia(slug) {
  const c = await campañaPorSlug(slug)
  const segs = String(flag('segmentos', c.segmentos.join(','))).split(',').map((s) => s.trim())

  let audiencia = await api('rpc/fn_email_audiencia', {
    method: 'POST',
    body: JSON.stringify({ p_org: ORG_DUKE, p_segmentos: segs }),
  })

  const notas = []

  // Reenvío a los que no abrieron, con otro asunto. Es la táctica más barata
  // que existe: recupera entre 30% y 50% de aperturas extra sobre gente que
  // ya está en la lista y no costó nada conseguir.
  const noAbrieron = flag('no-abrieron')
  if (noAbrieron) {
    const set = await correosDeCampana(String(noAbrieron), 'no-abrieron')
    audiencia = audiencia.filter((p) => set.has(p.email.toLowerCase()))
    notas.push(`solo los que NO abrieron "${noAbrieron}" (${set.size} candidatos)`)
  }

  const abrieron = flag('abrieron')
  if (abrieron) {
    const set = await correosDeCampana(String(abrieron), 'abrieron')
    audiencia = audiencia.filter((p) => set.has(p.email.toLowerCase()))
    notas.push(`solo los que SÍ abrieron "${abrieron}" (${set.size} candidatos)`)
  }

  // Para no volver a invitar a quien ya se registró.
  const excluir = flag('excluir')
  if (excluir) {
    const set = await correosDeCampana(String(excluir))
    audiencia = audiencia.filter((p) => !set.has(p.email.toLowerCase()))
    notas.push(`excluyendo a los de "${excluir}" (${set.size})`)
  }

  // Lista puntual, para la prueba semilla.
  const solo = flag('solo')
  if (solo) {
    const set = new Set(String(solo).split(',').map((e) => e.trim().toLowerCase()))
    audiencia = audiencia.filter((p) => set.has(p.email.toLowerCase()))
    notas.push(`solo ${set.size} correos indicados a mano`)
  }

  // Variante A/B: reparto estable por correo, no aleatorio. Así el mismo
  // contacto cae siempre del mismo lado y la comparación no se ensucia.
  const hayAB = Boolean(c.asunto_b)
  const ladoB = (email) =>
    [...email].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2, 7) === 1

  const filas = audiencia.map((p) => ({
    campaign_id: c.id,
    organization_id: ORG_DUKE,
    lead_id: p.lead_id,
    email: p.email,
    nombre: p.nombre,
    segmento: p.segmento,
    variante: hayAB && ladoB(p.email) ? 'b' : 'a',
  }))

  if (!filas.length) {
    console.log('\nLa audiencia salió vacía. Revisa segmentos, filtros y lista de exclusión.\n')
    return
  }

  // El índice único (campaign_id, lower(email)) hace esto idempotente.
  let insertados = 0
  for (let i = 0; i < filas.length; i += 200) {
    const trozo = filas.slice(i, i + 200)
    const r = await api('email_recipients', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(trozo),
    })
    insertados += Array.isArray(r) ? r.length : 0
  }

  const porSeg = {}
  for (const f of filas) porSeg[f.segmento] = (porSeg[f.segmento] ?? 0) + 1

  console.log(`\n${slug} — segmentos ${segs.join(', ')}`)
  for (const n of notas) console.log(`  · ${n}`)
  console.log(`Audiencia elegible: ${filas.length}`)
  for (const [sg, n] of Object.entries(porSeg).sort()) console.log(`  ${sg}: ${n}`)
  if (hayAB) {
    const b = filas.filter((f) => f.variante === 'b').length
    console.log(`Prueba A/B de asunto: ${filas.length - b} con A, ${b} con B`)
  }
  console.log(`Nuevos en la campaña: ${insertados} (el resto ya estaba)\n`)
}

// ── enviar ───────────────────────────────────────────────────────────────────

async function cmdEnviar(slug) {
  const lote   = Number(flag('lote', 100))
  const max    = Number(flag('max', 100000))
  const espera = Number(flag('espera', 3000))
  const dry    = tiene('dry-run')

  const c = await campañaPorSlug(slug)
  console.log(`\n${c.nombre}`)
  console.log(`Asunto: "${c.asunto}"`)
  console.log(`De: ${c.from_name} <${c.from_email}>`)
  console.log(dry ? 'MODO ENSAYO — no se manda nada\n' : `Lotes de ${lote}, tope de ${max}\n`)

  let enviados = 0

  while (enviados < max) {
    const r = await fn('email-dispatch', {
      organization_id: ORG_DUKE,
      campaign_slug: slug,
      limit: Math.min(lote, max - enviados),
      dry_run: dry,
    })

    if (dry) {
      console.log(`Prepararía ${r.prepararía} correos. Omitidos por exclusión: ${r.omitidos}`)
      if (r.muestra) console.log(`Muestra → ${r.muestra.to} · ${r.muestra.bytes_html} bytes\n`)
      return
    }

    enviados += r.enviados ?? 0
    console.log(`enviados ${r.enviados}  ·  omitidos ${r.omitidos}  ·  quedan ${r.restantes}`)

    if (!r.enviados || !r.restantes) break

    // Los eventos del webhook llegan con retraso, pero entre lote y lote ya
    // hay señal suficiente para frenar antes de quemar el dominio.
    const salud = await saludCampaña(c.id)
    if (salud.muestra >= MUESTRA_MIN) {
      if (salud.tasaRebote > TOPE_REBOTE) {
        console.error(`\nALTO: rebote en ${pct(salud.rebotes, salud.muestra)} (tope ${TOPE_REBOTE * 100}%).`)
        console.error('La campaña queda pausada. Limpia la lista antes de seguir.\n')
        await api(`email_campaigns?id=eq.${c.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ estado: 'pausado' }),
        })
        process.exit(2)
      }
      if (salud.tasaQueja > TOPE_QUEJA) {
        console.error(`\nALTO: quejas de spam en ${pct(salud.quejas, salud.muestra)} (tope ${TOPE_QUEJA * 100}%).`)
        console.error('Esto es lo que mata un dominio. Campaña pausada.\n')
        await api(`email_campaigns?id=eq.${c.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ estado: 'pausado' }),
        })
        process.exit(2)
      }
    }

    await pausa(espera)
  }

  console.log(`\nTotal enviado en esta corrida: ${enviados}\n`)
}

async function saludCampaña(campaignId) {
  const filas = await api(`email_recipients?campaign_id=eq.${campaignId}&select=estado`)
  const muestra = filas.filter((f) => f.estado !== 'pendiente' && f.estado !== 'omitido').length
  const rebotes = filas.filter((f) => f.estado === 'rebote').length
  const quejas  = filas.filter((f) => f.estado === 'queja').length
  return {
    muestra, rebotes, quejas,
    tasaRebote: muestra ? rebotes / muestra : 0,
    tasaQueja:  muestra ? quejas / muestra : 0,
  }
}

// ── reporte ──────────────────────────────────────────────────────────────────

async function cmdReporte(slug) {
  const c = await campañaPorSlug(slug)
  const filas = await api(
    `email_recipients?campaign_id=eq.${c.id}&select=estado,segmento,variante,opened_at,clicked_at,aperturas,clics`
  )

  const total     = filas.length
  const enviados  = filas.filter((f) => !['pendiente', 'omitido'].includes(f.estado)).length
  const entregados= filas.filter((f) => ['entregado'].includes(f.estado)).length
  const abiertos  = filas.filter((f) => f.opened_at).length
  const clics     = filas.filter((f) => f.clicked_at).length
  const rebotes   = filas.filter((f) => f.estado === 'rebote').length
  const quejas    = filas.filter((f) => f.estado === 'queja').length
  const pendientes= filas.filter((f) => f.estado === 'pendiente').length

  console.log(`\n${c.nombre}   [${c.estado}]`)
  console.log(`"${c.asunto}"\n`)
  console.log(`  En la lista    ${total}`)
  console.log(`  Enviados       ${enviados}`)
  console.log(`  Entregados     ${entregados}   ${pct(entregados, enviados)}`)
  console.log(`  Abiertos       ${abiertos}   ${pct(abiertos, enviados)}`)
  console.log(`  Clics          ${clics}   ${pct(clics, enviados)}`)
  console.log(`  Rebotes        ${rebotes}   ${pct(rebotes, enviados)}${rebotes / (enviados || 1) > TOPE_REBOTE ? '   ← ARRIBA DEL TOPE' : ''}`)
  console.log(`  Quejas         ${quejas}   ${pct(quejas, enviados)}${quejas / (enviados || 1) > TOPE_QUEJA ? '   ← ARRIBA DEL TOPE' : ''}`)
  console.log(`  Pendientes     ${pendientes}`)

  if (c.asunto_b) {
    console.log(`\n  Prueba A/B de asunto`)
    for (const v of ['a', 'b']) {
      const g = filas.filter((f) => f.variante === v)
      const env = g.filter((f) => !['pendiente', 'omitido'].includes(f.estado)).length
      const ab  = g.filter((f) => f.opened_at).length
      const asunto = v === 'a' ? c.asunto : c.asunto_b
      console.log(`    ${v.toUpperCase()}  ${String(ab).padStart(3)}/${String(env).padEnd(3)} ${pct(ab, env).padStart(6)}   "${asunto}"`)
    }
  }
  console.log('')
}

// ── main ─────────────────────────────────────────────────────────────────────

const comando = process.argv[2]
// El tercer argumento es el slug, salvo que sea una opción.
const arg     = process.argv[3]?.startsWith('--') ? undefined : process.argv[3]

const ayuda = `
Uso: node supabase/email_campana.mjs <comando> [slug] [opciones]

  validar                    revisa sintaxis, dedazos y MX de toda la base
                             --aplicar   escribe las correcciones y exclusiones
  crear                      da de alta las campañas del JSON de definición
                             --archivo <ruta>
  previsualizar [slug]       arma los correos en disco para verlos (no toca la base)
                             --salida <carpeta>
  render    <slug>           carga el HTML de src/emails/ y deja la campaña lista
  audiencia <slug>           llena los destinatarios elegibles
                             --segmentos A,B
                             --no-abrieron <slug>    reenvío a quien no abrió otra campaña
                             --abrieron <slug>       solo a quien sí la abrió
                             --excluir <slug>        quita a los de otra campaña
                             --solo a@b.com,c@d.com  para la prueba semilla
  enviar    <slug>           manda en lotes, con freno automático
                             --lote 100  --max 100  --espera 3000  --dry-run
  reporte   <slug>           resultados de la campaña
`

try {
  switch (comando) {
    case 'validar':   await cmdValidar(); break
    case 'crear':     await cmdCrear(); break
    case 'render':    await cmdRender(arg); break
    case 'previsualizar': await cmdPrevisualizar(arg); break
    case 'audiencia': await cmdAudiencia(arg); break
    case 'enviar':    await cmdEnviar(arg); break
    case 'reporte':   await cmdReporte(arg); break
    default: console.log(ayuda); process.exit(comando ? 1 : 0)
  }
} catch (e) {
  console.error(`\nError: ${e.message}\n`)
  process.exit(1)
}
