#!/usr/bin/env node
/**
 * scripts/enrich-leads-priority.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Lee `src/data/offline-seed/leads.json` y para cada lead:
 *
 *   1. Deriva una NEXT_ACTION INTELIGENTE basada en las notas reales del sheet,
 *      reemplazando placeholders genéricos como "Pendiente — primer contacto".
 *      Reglas de prioridad descendente:
 *        a) "sin respuesta", "no contesta" → "Reintento de contacto — sin respuesta previa"
 *        b) "discovery no concluido" → "Completar discovery call"
 *        c) Fecha próxima detectada (jueves/15 abril/etc) → "Confirmar [fecha]"
 *        d) "viene en [mes]" → "Seguimiento — cliente llega en [mes]"
 *        e) "le mande mensaje" / "le marqué" → "Re-marcar si no responde en 24-48h"
 *        f) Presupuesto + ubicación claros y stage=Primer Contacto → "Enviar opciones [ubicación]"
 *        g) Default por stage (Primer Contacto/Seguimiento/Zoom/Cierre)
 *
 *   2. Construye una task estructurada con esa next_action.
 *
 *   3. Calcula priority (alta/media/baja) basada en señales:
 *        · Hot, score alto, stage final → alta
 *        · Keywords de urgencia en notas → alta
 *        · Días sin actividad ≥ 14 → alta (recuperación)
 *        · "sin respuesta" + ≥ 7 días → alta
 *        · Días 7-13 → media
 *        · Resto → baja
 *
 *   4. Calcula priority_order numérico para sort estable.
 *
 * Output:
 *   · Sobreescribe src/data/offline-seed/leads.json (con backup en .bak)
 *   · Genera scripts/enrich-leads-priority.sql para sincronizar a Supabase
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const LEADS_PATH = 'src/data/offline-seed/leads.json'
const SQL_OUTPUT = 'scripts/enrich-leads-priority.sql'

// ── Helpers ──────────────────────────────────────────────────────────────
const lower = (s) => (s || '').toString().toLowerCase()
const text  = (l) => `${lower(l.notas)} ${lower(l.bio)}`

// ── Patterns de detección ────────────────────────────────────────────────
const PATTERNS = {
  sinRespuesta:   /\b(sin respuesta|no responde|no contesta|no respondio|no ha respondido|fantasma|tercer intento|cuarto intento|silenc|ghost)\b/i,
  segundoIntento: /\b(segundo intento|segundo seguimiento|2do intento|le marqué de nuevo|le marque de nuevo)\b/i,
  hablaIngles:    /\b(habla ingl|english|english only|en ingles|prefer english)\b/i,
  vienePronto:    /\b(viene en|viene el|llega en|llega el|en julio|en agosto|en septiembre|en octubre|en noviembre|en diciembre|en enero|en febrero|en marzo|en abril|en mayo|en junio)\s*(\d{0,2}|de)?/i,
  citaConcretada: /\b(zoom concretado|zoom agendado|cita concretada|cita agendada|reunion agendad|reuni[óo]n agendad)\b/i,
  reagendar:      /\b(reagend|re-agend|reprogram|reprogamar)\b/i,
  discovery:      /\b(discovery (?:no|sin) (?:concluido|terminado|completo)|incomplet|falt[óo] (?:el )?discovery|no terminamos)\b/i,
  mensajeEnviado: /\b(mande mensaje|envi[éeo] mensaje|mensaje de seguimiento|le marqu[éeo]|le mand[ée]|le envi[éeo])\b/i,
  whatsapp:       /\b(whats|wsp|por whats|por whatsapp|wa\b)\b/i,
  preventa:       /\b(preventa|pre venta|pre-venta)\b/i,
  entregaInmediata:/\b(entrega inmediata|listo para vivir|disponible inmediato|llave en mano)\b/i,
  inversion:      /\b(inversion|inversi[óo]n|plusval|airbnb|renta vacacional)\b/i,
  disfrute:       /\b(disfrute|vivir|primera casa|familiar|para vacacionar|segunda casa)\b/i,
  listoComprar:   /\b(listo para comprar|quiere comprar|va a comprar|cerrar la compra|firmar)\b/i,
  presupuestoListo: /\b(tiene para enganche|tiene el dinero|recursos listos|liquido)\b/i,
  fechaEspecifica: /(\b\d{1,2}\s*(de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)|\b(jueves|viernes|s[áa]bado|domingo|lunes|martes|mi[ée]rcoles)\b)/i,
}

const HIGH_PRIORITY_KEYWORDS = [
  'urgente', 'urgent', 'hoy', 'ahora', 'inmediat',
  'esta semana', 'esta tarde', 'mañana', 'manana',
  'cierre', 'cerrar', 'apartar', 'firma', 'pago', 'depós', 'depos',
  'listo para comprar', 'quiere comprar', 'va a comprar',
]

const FINAL_STAGES = ['cierre', 'compra', 'apartado', 'firma']

/**
 * Extrae la primera fecha o día de la semana mencionada en el texto.
 * Devuelve string presentable ("jueves 9 de abril", "martes 14") o null.
 */
function extractFecha(s) {
  if (!s) return null
  const m = s.match(/\b((lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)(\s+\d{1,2}\s*(de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?)\b/i)
  if (m) return m[0].toLowerCase()
  const m2 = s.match(/\b\d{1,2}\s*(de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i)
  if (m2) return m2[0].toLowerCase()
  return null
}

/**
 * Extrae el mes mencionado tras "viene en", "llega en"
 */
function extractMesLlegada(s) {
  const m = s.match(/\b(viene en|llega en|viaja (?:el|en)?)\s*(\d{0,2}\s*(de)?\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i)
  return m ? m[3] : null
}

/**
 * Extrae ubicación mencionada en bio o notas (Playa del Carmen, Tulum, etc).
 */
function extractUbicacion(s) {
  if (!s) return null
  const m = s.match(/(playa del carmen|tulum|cancún|cancun|cozumel|riviera maya|bacalar|isla mujeres|holbox|akumal|puerto morelos|puerto aventuras|mahahual)/i)
  return m ? m[0].toLowerCase().replace(/^./, c => c.toUpperCase()) : null
}

/**
 * Extrae presupuesto del texto (250k, 500K USD, 1M, etc).
 */
function extractPresupuesto(s) {
  if (!s) return null
  const m = s.match(/(\$?\s*\d{1,4}\s*(k|m|mil)\s*(usd|mxn|d[óo]lares|pesos)?)/i)
  if (m) return m[0].trim()
  const m2 = s.match(/(\d{1,4}\s*(?:millones|millon))/i)
  return m2 ? m2[0] : null
}

/**
 * NEXT_ACTION INTELIGENTE — Lee notas + bio + stage y deriva qué hacer.
 * Devuelve objeto { action, date }.
 */
function deriveSmartNextAction(lead) {
  const t      = text(lead)
  const stage  = lower(lead.stage)
  const days   = Number(lead.days_inactive || 0)

  // Si el lead YA tiene una next_action específica y útil (no genérica), respétala
  const current = (lead.next_action || '').trim()
  const isGeneric = !current ||
    /^pendiente\s*[—-]\s*primer contacto/i.test(current) ||
    current.toLowerCase() === 'pendiente' ||
    current.toLowerCase() === 'sin acción' ||
    current.toLowerCase() === 'sin próxima acción registrada.'
  if (!isGeneric) return { action: current, date: lead.next_action_date || '' }

  // Reglas en orden de prioridad
  // 1) Sin respuesta → reintento
  if (PATTERNS.sinRespuesta.test(t)) {
    if (days >= 14) return { action: 'Llamada en frío de recuperación — más de 2 semanas sin contacto', date: '' }
    if (days >= 7)  return { action: 'Reintento de contacto — sin respuesta hace varios días', date: '' }
    return { action: 'Reintento de contacto — sin respuesta previa', date: '' }
  }

  // 2) Cita reagendada
  if (PATTERNS.reagendar.test(t)) {
    const fecha = extractFecha(t)
    if (fecha) return { action: `Reagendar zoom — propuesta: ${fecha}`, date: fecha }
    return { action: 'Reagendar zoom con cliente', date: '' }
  }

  // 3) Cita ya concretada con fecha
  if (PATTERNS.citaConcretada.test(t) || (stage.includes('zoom') && extractFecha(t))) {
    const fecha = extractFecha(t)
    if (fecha) return { action: `Confirmar zoom para ${fecha} — preparar propuesta`, date: fecha }
    return { action: 'Confirmar zoom y preparar propuesta', date: '' }
  }

  // 4) Cliente que viene físicamente en X mes
  const mesLlegada = extractMesLlegada(t)
  if (mesLlegada) {
    return { action: `Seguimiento programado — cliente llega en ${mesLlegada}, mantener engagement`, date: mesLlegada }
  }

  // 5) Discovery incompleto
  if (PATTERNS.discovery.test(t)) {
    return { action: 'Completar discovery call — entender objetivo y presupuesto exacto', date: '' }
  }

  // 6) Listo para comprar
  if (PATTERNS.listoComprar.test(t)) {
    return { action: 'Cerrar venta — cliente listo para comprar, agendar firma', date: '' }
  }

  // 7) Mensaje enviado, esperando respuesta
  if (PATTERNS.mensajeEnviado.test(t) && days < 7) {
    return { action: 'Esperar respuesta del cliente — re-marcar en 48h si no contesta', date: '' }
  }

  // 8) Por stage + datos disponibles
  const ubicacion = extractUbicacion(t)
  const presupuesto = extractPresupuesto(t)

  if (stage.includes('primer contacto') || stage.includes('nuevo')) {
    if (ubicacion && presupuesto) {
      return { action: `Discovery call — confirmar interés en ${ubicacion} y presupuesto ${presupuesto}`, date: '' }
    }
    return { action: 'Llamar para hacer discovery — entender objetivo, ubicación y presupuesto', date: '' }
  }

  if (stage.includes('seguimiento')) {
    if (PATTERNS.inversion.test(t) && ubicacion) {
      return { action: `Llamada de seguimiento — enviar opciones de inversión en ${ubicacion}`, date: '' }
    }
    if (PATTERNS.entregaInmediata.test(t) && ubicacion) {
      return { action: `Enviar opciones de entrega inmediata en ${ubicacion}`, date: '' }
    }
    if (PATTERNS.preventa.test(t) && ubicacion) {
      return { action: `Enviar pre-ventas disponibles en ${ubicacion}`, date: '' }
    }
    return { action: 'Llamada de seguimiento — re-enganchar y avanzar etapa', date: '' }
  }

  if (stage.includes('zoom')) {
    return { action: 'Agendar/confirmar zoom — preparar propuesta personalizada', date: '' }
  }

  if (stage.includes('cierre') || stage.includes('compra')) {
    return { action: 'Cerrar venta — agendar firma de contrato', date: '' }
  }

  if (stage.includes('descartado') || stage.includes('perdido')) {
    return { action: 'Re-engagement frío — intentar reactivar en 30 días', date: '' }
  }

  // Default
  return { action: 'Llamada de seguimiento general', date: '' }
}

/**
 * Determina priority + priority_order.
 */
function inferPriority(lead, smartNext) {
  const tt    = `${lower(smartNext.action)} ${text(lead)} ${lower(lead.next_action_date)}`
  const stage = lower(lead.stage)
  const hot   = lead.hot === true
  const days  = Number(lead.days_inactive || 0)
  const score = Number(lead.score || 0)

  let priority = 'baja'
  let order    = 80

  if (hot) {
    priority = 'alta'
    order = 5 + (100 - score) / 10
  }

  if (FINAL_STAGES.some(s => stage.includes(s))) {
    priority = 'alta'
    order = Math.min(order, 8)
  }

  if (HIGH_PRIORITY_KEYWORDS.some(k => tt.includes(k))) {
    priority = 'alta'
    order = Math.min(order, 12)
  }

  if (days >= 14) {
    priority = 'alta'
    order = Math.min(order, 15 + Math.max(0, 30 - Math.min(days, 30)))
  } else if (days >= 7) {
    if (priority === 'baja') {
      priority = 'media'
      order = 30 + (14 - days)
    }
  }

  // Sin respuesta + algunos días = alta urgencia
  if (PATTERNS.sinRespuesta.test(text(lead)) && days >= 5 && priority !== 'alta') {
    priority = 'alta'
    order = Math.min(order, 18)
  }

  // Cita confirmada con fecha = alta
  if (PATTERNS.citaConcretada.test(text(lead))) {
    priority = 'alta'
    order = Math.min(order, 10)
  }

  // Listo para comprar = alta
  if (PATTERNS.listoComprar.test(text(lead))) {
    priority = 'alta'
    order = Math.min(order, 6)
  }

  if (score >= 80 && priority !== 'alta') {
    priority = 'alta'
    order = Math.min(order, 18)
  } else if (score >= 60 && priority === 'baja') {
    priority = 'media'
    order = Math.min(order, 55)
  }

  // Stages activos van por delante de "Descartado"
  if (stage.includes('descartado') || stage.includes('perdido')) {
    priority = 'baja'
    order = 90
  }

  return { priority, priority_order: Math.round(order) }
}

function buildTask(action, date, lead) {
  if (!action) return null
  return {
    id: randomUUID(),
    action,
    date: date || lead.next_action_date || '',
    source: 'imported_from_sheet',
    completed: false,
    created_at: lead.created_at || new Date().toISOString(),
    completed_at: null,
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Stratos AI — Enriquecimiento inteligente de prioridades\n')

  const raw = await readFile(LEADS_PATH, 'utf8')
  const leads = JSON.parse(raw)
  console.log(`Leídos ${leads.length} leads de ${LEADS_PATH}`)

  await copyFile(LEADS_PATH, `${LEADS_PATH}.bak`)
  console.log(`✓ Backup en ${LEADS_PATH}.bak`)

  let smartActionsAdded = 0
  let priorityCalc = 0
  const updates = []

  const enriched = leads.map(lead => {
    const updated = { ...lead }

    // 1. Deriva next_action inteligente
    const smart = deriveSmartNextAction(lead)
    const isOriginalGeneric = !lead.next_action ||
      /^pendiente\s*[—-]\s*primer contacto/i.test(lead.next_action) ||
      lead.next_action === 'Pendiente'
    if (smart.action && smart.action !== lead.next_action) {
      updated.next_action = smart.action
      updated.next_action_date = smart.date || lead.next_action_date || ''
      if (isOriginalGeneric) smartActionsAdded++
    }

    // 2. Tasks estructuradas (siempre actualizar para reflejar la nueva next_action)
    const existingTasks = Array.isArray(lead.tasks) ? lead.tasks : []
    const fromSheet = existingTasks.filter(t => t.source !== 'imported_from_sheet')
    const newTask = buildTask(smart.action, smart.date, lead)
    updated.tasks = newTask ? [newTask, ...fromSheet] : existingTasks

    // 3. Priority inteligente
    const { priority, priority_order } = inferPriority(lead, smart)
    if (priority !== lead.priority || priority_order !== lead.priority_order) {
      updated.priority = priority
      updated.priority_order = priority_order
      priorityCalc++
    }

    updated.updated_at = new Date().toISOString()

    updates.push({
      id: lead.id,
      next_action: updated.next_action,
      next_action_date: updated.next_action_date || '',
      tasks: updated.tasks,
      priority: updated.priority,
      priority_order: updated.priority_order,
    })

    return updated
  })

  // Estadísticas
  const byPriority = enriched.reduce((acc, l) => {
    acc[l.priority || 'sin'] = (acc[l.priority || 'sin'] || 0) + 1
    return acc
  }, {})
  const byActionType = enriched.reduce((acc, l) => {
    const head = (l.next_action || '').split('—')[0].trim().slice(0, 50)
    acc[head] = (acc[head] || 0) + 1
    return acc
  }, {})

  console.log(`\n✓ Next-actions específicas derivadas (reemplazaron placeholder): ${smartActionsAdded}`)
  console.log(`✓ Prioridades calculadas: ${priorityCalc}`)
  console.log(`\n📊 Distribución por prioridad:`)
  for (const [p, n] of Object.entries(byPriority)) {
    const emoji = p === 'alta' ? '🔴' : p === 'media' ? '🟡' : p === 'baja' ? '🟢' : '⚪'
    console.log(`   ${emoji} ${p}: ${n}`)
  }
  console.log(`\n📋 Top tipos de próxima acción derivadas:`)
  Object.entries(byActionType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([action, count]) => console.log(`   (${count}) ${action}`))

  // Top 10 más urgentes
  const sorted = [...enriched].sort((a, b) => (a.priority_order || 999) - (b.priority_order || 999))
  console.log(`\n🚨 Top 10 más urgentes:`)
  for (const l of sorted.slice(0, 10)) {
    console.log(`   [${l.priority}|${l.priority_order}] ${l.name} (${l.asesor_name || 'sin asesor'})`)
    console.log(`     → ${(l.next_action || '').slice(0, 90)}`)
  }

  await writeFile(LEADS_PATH, JSON.stringify(enriched, null, 2))
  console.log(`\n✓ ${LEADS_PATH} actualizado`)

  // Generar SQL
  const sqlLines = [
    '-- Sincronizar enriquecimiento de tasks + priority + next_action a Supabase',
    '-- Generado por scripts/enrich-leads-priority.mjs',
    '-- Ejecutar en Supabase SQL Editor cuando esté disponible.',
    '',
    'BEGIN;',
    '',
  ]
  for (const u of updates) {
    const tasksJson = JSON.stringify(u.tasks || []).replace(/'/g, "''")
    const action = (u.next_action || '').replace(/'/g, "''")
    const actionDate = (u.next_action_date || '').replace(/'/g, "''")
    sqlLines.push(
      `UPDATE leads SET next_action = '${action}', next_action_date = '${actionDate}', tasks = '${tasksJson}'::jsonb, priority = '${u.priority}', priority_order = ${u.priority_order}, updated_at = now() WHERE id = '${u.id}';`,
    )
  }
  sqlLines.push('', 'COMMIT;', '')
  await writeFile(SQL_OUTPUT, sqlLines.join('\n'))
  console.log(`✓ ${SQL_OUTPUT} generado (${updates.length} UPDATEs)\n`)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
