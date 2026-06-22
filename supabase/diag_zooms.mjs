// Diagnóstico Fase 0 — estado de la data de Zooms. Read-only. Service role.
// ¿Es zoom_agendados usable hoy como fuente de verdad, o falta backfill?
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
function loadEnv() {
  const env = { ...process.env }
  try { const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
  return env
}
const env = loadEnv()
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
async function rows(path) {
  let out = [], from = 0
  while (true) {
    const res = await fetch(`${env.VITE_SUPABASE_URL}${path}`, { headers: { ...H, Range: `${from}-${from + 999}` } })
    if (!res.ok) { const t = await res.text(); throw new Error(`${res.status} ${t}`) }
    const chunk = await res.json(); out = out.concat(chunk)
    if (chunk.length < 1000) break; from += 1000
  }
  return out
}
const norm = s => (s == null ? '' : String(s).trim().toLowerCase())
const STRATOS_ORG = '00000000-0000-0000-0000-000000000001'

console.log('\n═══ DIAGNÓSTICO DE ZOOMS (Fase 0) ═══\n')

// ── 1) zoom_agendados ──
let zoom = []
try { zoom = await rows('/rest/v1/zoom_agendados?select=id,organization_id,lead_id,fecha_zoom,liner,presentador_principal,presentador_apoyo,cliente,estatus') }
catch (e) { console.log('⚠️  zoom_agendados NO existe en producción (migración 027 sin aplicar).\n'); }
const zDuke = zoom.filter(z => z.organization_id === STRATOS_ORG)
console.log(`A) Tabla zoom_agendados`)
console.log(`   Filas totales: ${zoom.length}   (Duke/Stratos: ${zDuke.length})`)
if (zDuke.length) {
  const byEstatus = {}
  for (const z of zDuke) { const k = z.estatus || '(vacío)'; byEstatus[k] = (byEstatus[k] || 0) + 1 }
  console.log(`   Por estatus:`)
  for (const [k, n] of Object.entries(byEstatus).sort((a,b)=>b[1]-a[1])) console.log(`      ${k}: ${n}`)
  const linked = zDuke.filter(z => z.lead_id).length
  console.log(`   Con lead_id (linkeadas al CRM): ${linked} / ${zDuke.length}  (${Math.round(linked/zDuke.length*100)}%)`)
  const conPres = zDuke.filter(z => z.presentador_principal && z.presentador_principal.trim()).length
  console.log(`   Con presentador_principal: ${conPres} / ${zDuke.length}`)
  const conFecha = zDuke.filter(z => z.fecha_zoom).length
  console.log(`   Con fecha_zoom: ${conFecha} / ${zDuke.length}`)
  // realizados = Asistió
  const asistio = zDuke.filter(z => norm(z.estatus) === 'asistió' || norm(z.estatus) === 'asistio')
  console.log(`   → "Zooms realizados" (estatus Asistió): ${asistio.length}`)
  // por presentador
  const byPres = {}
  for (const z of asistio) { const k = (z.presentador_principal||'(sin presentador)').trim(); byPres[k]=(byPres[k]||0)+1 }
  console.log(`   → Realizados por presentador:`)
  for (const [k,n] of Object.entries(byPres).sort((a,b)=>b[1]-a[1])) console.log(`      ${k}: ${n}`)
}

// ── 2) Pipeline: leads que pasaron por zoom (etapa actual o historial) ──
const ZOOM_STAGES = ['Zoom Concretado','Seguimiento','Apartó','Visita Agendada','Cierre','Postventa']
const leads = await rows('/rest/v1/leads?deleted_at=is.null&select=id,asesor_name,stage,action_history,organization_id,cal_event_id,selected_time,reminder_3h_sent_at,zoom_join_url')
const dukeLeads = leads.filter(l => l.organization_id === STRATOS_ORG)
const stageOf = l => l.stage || ''
console.log(`\nB) Pipeline (leads activos Duke: ${dukeLeads.length})`)
// etapa actual >= zoom
const enZoomAhora = dukeLeads.filter(l => ZOOM_STAGES.includes(stageOf(l)))
console.log(`   Etapa actual = pasó por Zoom (${ZOOM_STAGES.join('/')}): ${enZoomAhora.length}`)
console.log(`   Solo "Seguimiento" (métrica ACTUAL del código): ${dukeLeads.filter(l=>stageOf(l)==='Seguimiento').length}`)
console.log(`   Etapa actual "Zoom Agendado": ${dukeLeads.filter(l=>stageOf(l)==='Zoom Agendado').length}`)
// historial: alguna vez tocó una etapa de zoom
function touchedZoom(l) {
  if (ZOOM_STAGES.includes(stageOf(l))) return true
  const h = l.action_history
  if (Array.isArray(h)) {
    for (const e of h) { const s = JSON.stringify(e); if (ZOOM_STAGES.some(z => s.includes(z))) return true }
  }
  return false
}
const everZoom = dukeLeads.filter(touchedZoom)
console.log(`   Pasaron por Zoom alguna vez (etapa actual + historial): ${everZoom.length}`)
// por asesor actual
const byAsesor = {}
for (const l of everZoom) { const k=(l.asesor_name||'(sin asesor)').trim(); byAsesor[k]=(byAsesor[k]||0)+1 }
console.log(`   Por asesor actual (dueño hoy):`)
for (const [k,n] of Object.entries(byAsesor).sort((a,b)=>b[1]-a[1])) console.log(`      ${k}: ${n}`)

// ── 3) Señales de Cal.com (agendamiento real de Zoom) ──
console.log(`\nC) Señales de agendamiento real (Cal.com)`)
const conCal = dukeLeads.filter(l => l.cal_event_id)
const conSelected = dukeLeads.filter(l => l.selected_time)
const conRecord3h = dukeLeads.filter(l => l.reminder_3h_sent_at)
console.log(`   Leads con cal_event_id (Zoom agendado vía Cal): ${conCal.length}`)
console.log(`   Leads con selected_time (eligió horario): ${conSelected.length}`)
console.log(`   Leads con recordatorio 3h enviado (zoom llegó a ocurrir): ${conRecord3h.length}`)
console.log(`\n   Interpretación: hoy la ÚNICA fuente de verdad es el pipeline (stage)`)
console.log(`   + estas señales de Cal. zoom_agendados no existe en prod.`)

// ── 4) MÉTRICA NUEVA event-level (replica zoomEventsOf del front) ──
console.log(`\nD) Métrica nueva: Zooms acreditados a "quién lo dio" (by del evento)`)
const ZD = new Set(['Zoom Concretado','Seguimiento','Apartó','Visita Agendada','Cierre','Postventa'])
const tgt = a => { if (typeof a!=='string') return null; const p=a.split('→'); return p.length>1?p[p.length-1].trim():null }
function zoomEventsOf(l) {
  const hist = Array.isArray(l.action_history) ? l.action_history : []
  let scheduled=null, done=null
  for (const e of hist) {
    if (!e || e.type!=='etapa') continue
    const t = tgt(e.action); if (!t) continue
    if (t==='Zoom Agendado' && !scheduled) scheduled = { by: e.by || l.asesor_name }
    if (ZD.has(t) && !done) done = { by: e.by || l.asesor_name }
  }
  if (!scheduled && stageOf(l)==='Zoom Agendado') scheduled = { by: l.asesor_name }
  if (!done && ZD.has(stageOf(l))) done = { by: l.asesor_name }
  return { scheduled, done }
}
const doneBy={}, schedBy={}; let totalDone=0, totalSched=0
for (const l of dukeLeads) {
  const { scheduled, done } = zoomEventsOf(l)
  if (scheduled){ const k=(scheduled.by||'(s/d)').trim(); schedBy[k]=(schedBy[k]||0)+1; totalSched++ }
  if (done){ const k=(done.by||'(s/d)').trim(); doneBy[k]=(doneBy[k]||0)+1; totalDone++ }
}
console.log(`   TOTAL Zooms realizados (histórico, dedup x lead): ${totalDone}`)
console.log(`   TOTAL Zooms agendados (histórico): ${totalSched}`)
console.log(`   Realizados por quién lo dio:`)
for (const [k,n] of Object.entries(doneBy).sort((a,b)=>b[1]-a[1])) console.log(`      ${k}: ${n}`)
console.log('\n═══ FIN ═══\n')
