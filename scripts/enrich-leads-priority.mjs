#!/usr/bin/env node
/**
 * scripts/enrich-leads-priority.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Enriquecimiento de leads según el PROTOCOLO DUKE DEL CARIBE
 * (Stratos Capital Group · Sistema de ventas consultivo · Riviera Maya).
 *
 * REGLAS DEL PROTOCOLO QUE APLICAMOS:
 *
 * SLAs:
 *   · Nuevo lead → primer contacto en < 2h
 *   · Zoom concretado → propuesta en < 24h
 *   · Sin actividad ≥ 5 días → reactivación inmediata
 *   · Negociación activa → seguimiento diario (24h)
 *
 * Frecuencia de seguimiento por nivel:
 *   · Caliente: cada 24h
 *   · Medio: cada 48h
 *   · Frío: cada 3-5 días
 *
 * Reglas operativas:
 *   · 3 intentos sin respuesta → RIESGO
 *   · 24h sin avance → ALERTA
 *   · 5 días sin actividad → FRÍO
 *
 * Pipeline 10 etapas (Stratos):
 *   Lead nuevo → Contactado → Conversación → Zoom agendado → Recorrido →
 *   Seguimiento → Apartado → Venta cerrada → Post-venta → Referidos
 *
 * Calificación BANT en cada conversación:
 *   Budget · Authority · Need · Timeline · Financing
 *
 * Output:
 *   · src/data/offline-seed/leads.json (sobreescrito)
 *   · scripts/enrich-leads-priority.sql (UPDATEs para Supabase)
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const LEADS_PATH = 'src/data/offline-seed/leads.json'
const SQL_OUTPUT = 'scripts/enrich-leads-priority.sql'

const lower = (s) => (s || '').toString().toLowerCase()
const fullText = (l) => `${lower(l.notas)} ${lower(l.bio)}`

// ── Patterns ──────────────────────────────────────────────────────────────
const P = {
  sinRespuesta:    /\b(sin respuesta|no responde|no contesta|no respondi[oó]|no ha respondido|fantasma|silenc|ghost)\b/i,
  segundoIntento:  /\b(segundo intento|segundo seguimiento|2do intento)\b/i,
  tercerIntento:   /\b(tercer intento|tercera vez|tercer seguimiento|3er intento|3ra vez)\b/i,
  reagendar:       /\b(reagend|re-agend|reprogram)\b/i,
  citaConcretada:  /\b(zoom concretado|zoom agendado|cita agendada|reuni[óo]n agendad)\b/i,
  discovery:       /\b(discovery (?:no|sin) (?:concluido|terminado|completo)|incomplet|no terminamos|falt[óo] (?:el )?discovery)\b/i,
  mensajeEnviado:  /\b(mande mensaje|envi[éeo] mensaje|mensaje de seguimiento|le marqu[éeo]|le mand[ée]|le envi[éeo])\b/i,
  preventa:        /\b(preventa|pre venta|pre-venta)\b/i,
  entregaInmediata:/\b(entrega inmediata|listo para vivir|disponible inmediato|llave en mano)\b/i,
  inversion:       /\b(inversi[óo]n|plusval|airbnb|renta vacacional|inversionista)\b/i,
  disfrute:        /\b(disfrute|vivir|primera casa|familiar|para vacacionar|segunda casa)\b/i,
  listoComprar:    /\b(listo para comprar|quiere comprar|va a comprar|cerrar la compra|firmar)\b/i,
  hablaIngles:     /\b(habla ingl|english|english only|en ingles|prefer english)\b/i,
  vienePronto:     /\b(viene en|llega en|viaja (?:el|en)?)\s*(?:\d{0,2}\s*(?:de)?\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
  whatsapp:        /\b(whats|wsp|por whats|por whatsapp|wa\b)\b/i,
  presupuestoListo:/\b(tiene para enganche|tiene el dinero|recursos listos|liquido)\b/i,
  bantCompleto:    /\b(presupuesto|budget|cap acredit|cr[ée]dito|hipoteca|financ)\b/i,
  faltaAuthority:  /\b(consultar (?:con )?(?:su |la )?(esposa|esposo|hermana|hermano|familia|abogado)|toma decisi[óo]n con|decide con su)\b/i,
  faltaTimeline:   /\b(no tiene prisa|no urge|sin (?:fecha|prisa)|para el a[ñn]o|m[áa]s adelante)\b/i,
}

// ── Stages canónicos del Protocolo Duke ──────────────────────────────────
const STAGE_ALIASES = {
  'lead nuevo':      'lead_nuevo',
  'nuevo':           'lead_nuevo',
  'nuevo registro':  'lead_nuevo',
  'contactado':      'contactado',
  'primer contacto': 'contactado',
  'conversación':    'conversacion',
  'conversacion':    'conversacion',
  'zoom agendado':   'zoom_agendado',
  'zoom concretado': 'recorrido',
  'recorrido':       'recorrido',
  'seguimiento':     'seguimiento',
  'apartado':        'apartado',
  'negociación':     'apartado',
  'negociacion':     'apartado',
  'cierre':          'venta_cerrada',
  'venta cerrada':   'venta_cerrada',
  'post-venta':      'post_venta',
  'descartado':      'descartado',
  'perdido':         'descartado',
}

function canonicalStage(stage) {
  return STAGE_ALIASES[lower(stage)] || 'seguimiento'
}

// ── Nivel de temperatura del lead (caliente/medio/frío) ──────────────────
function temperaturaLead(lead) {
  const score = Number(lead.score || 0)
  const days  = Number(lead.days_inactive || 0)
  if (lead.hot === true || score >= 70) return 'caliente'
  if (days >= 5)                         return 'frio'
  if (score >= 40)                       return 'medio'
  return 'frio'
}

// ── Frecuencia de seguimiento según nivel ────────────────────────────────
const FRECUENCIA = {
  caliente: 'cada 24h',
  medio:    'cada 48h',
  frio:     'cada 3-5 días',
}

// ── Extracción de fechas / ubicación / presupuesto ───────────────────────
function extractFecha(s) {
  if (!s) return null
  const m = s.match(/\b((lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)(\s+\d{1,2}\s*(de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?)\b/i)
  if (m) return m[0].toLowerCase()
  const m2 = s.match(/\b\d{1,2}\s*(de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i)
  return m2 ? m2[0].toLowerCase() : null
}
function extractMesLlegada(s) {
  const m = s.match(/\b(viene en|llega en|viaja (?:el|en)?)\s*(?:\d{0,2}\s*(?:de)?\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i)
  return m ? m[2] : null
}
function extractUbicacion(s) {
  if (!s) return null
  const m = s.match(/(playa del carmen|tulum|canc[úu]n|cozumel|riviera maya|bacalar|isla mujeres|holbox|akumal|puerto morelos|puerto aventuras|mahahual)/i)
  return m ? m[0].replace(/\b\w/g, c => c.toUpperCase()) : null
}
function extractPresupuesto(s) {
  if (!s) return null
  const m = s.match(/(\$?\s*\d{1,4}\s*(k|m|mil)\s*(usd|mxn|d[óo]lares|pesos)?)/i)
  if (m) return m[0].trim()
  const m2 = s.match(/(\d{1,4}\s*(?:millones|mill[óo]n))/i)
  return m2 ? m2[0] : null
}

/**
 * deriveSmartNextAction — núcleo del protocolo.
 * Cruza stage canónica + señales de notas + temperatura para producir
 * UNA próxima acción específica alineada con el Protocolo Duke del Caribe.
 */
function deriveSmartNextAction(lead) {
  const t       = fullText(lead)
  const stage   = canonicalStage(lead.stage)
  const days    = Number(lead.days_inactive || 0)
  const temp    = temperaturaLead(lead)
  const ubi     = extractUbicacion(t)
  const pres    = extractPresupuesto(t)

  const current = (lead.next_action || '').trim()
  const isGeneric = !current ||
    /^pendiente\s*[—-]\s*primer contacto/i.test(current) ||
    current.toLowerCase() === 'pendiente' ||
    current.toLowerCase() === 'sin acción' ||
    current.toLowerCase() === 'sin próxima acción registrada.'

  // Si el lead YA tiene una next_action específica del sheet, respétala
  if (!isGeneric) return { action: current, date: lead.next_action_date || '' }

  // ── REGLAS DE ALERTA (anteceden a stage) ──────────────────────────────
  if (P.tercerIntento.test(t)) {
    return { action: '⚠️ RIESGO: 3er intento sin respuesta — escalar al director y considerar reactivación con valor agregado', date: '' }
  }

  if (P.sinRespuesta.test(t)) {
    if (days >= 14) return { action: '🔥 FRÍO: 2+ semanas sin contacto. Reactivación con cambio de canal (llamada en frío + mensaje de valor)', date: '' }
    if (days >= 5)  return { action: '🟡 ALERTA: sin respuesta 5+ días. Reactivación inmediata con propuesta concreta o valor nuevo', date: '' }
    return { action: 'Reintento de contacto — variar canal (WhatsApp ↔ llamada) y aportar valor en cada toque', date: '' }
  }

  // ── Cita agendada / reagendar ─────────────────────────────────────────
  if (P.reagendar.test(t)) {
    const fecha = extractFecha(t)
    if (fecha) return { action: `📅 Reagendar Zoom — propuesta: ${fecha}. Confirmar 2h antes`, date: fecha }
    return { action: '📅 Reagendar Zoom con cliente (proponer 2 fechas concretas)', date: '' }
  }

  if (P.citaConcretada.test(t) || (stage === 'zoom_agendado' && extractFecha(t))) {
    const fecha = extractFecha(t)
    if (fecha) return { action: `🎯 Confirmar Zoom ${fecha} 2h antes + preparar comparativos del proyecto`, date: fecha }
    return { action: '🎯 Confirmar Zoom y preparar presentación + comparativos', date: '' }
  }

  // ── Cliente que viene físicamente ─────────────────────────────────────
  const mes = extractMesLlegada(t)
  if (mes) {
    return { action: `✈️ Cliente llega en ${mes} — mantener engagement con valor cada ${FRECUENCIA[temp]}, agendar tour para su llegada`, date: mes }
  }

  // ── Discovery incompleto (BANT) ───────────────────────────────────────
  if (P.discovery.test(t) || stage === 'conversacion') {
    return { action: '🎤 Completar discovery (BANT): presupuesto, autoridad, necesidad, timeline, financiamiento', date: '' }
  }

  // ── Listo para comprar ────────────────────────────────────────────────
  if (P.listoComprar.test(t) || stage === 'apartado') {
    return { action: '💰 Cierre: enviar contrato + coordinar firma con notaría aliada + confirmar depósito inicial', date: '' }
  }

  // ── Mensaje enviado, esperando respuesta (siempre con SLA) ────────────
  if (P.mensajeEnviado.test(t) && days < 2) {
    return { action: 'Esperar respuesta — re-marcar en 24h si no contesta (variar canal)', date: '' }
  }

  // ── Por stage canónica del protocolo ──────────────────────────────────
  switch (stage) {
    case 'lead_nuevo':
      return { action: '⚡ SLA <2h: Primer contacto WhatsApp + llamada. Calificar BANT en discovery de 30 min', date: 'hoy' }

    case 'contactado': {
      if (ubi && pres) {
        return { action: `🎤 Discovery 30min — confirmar interés en ${ubi}, presupuesto ${pres}, timeline y financiamiento`, date: '' }
      }
      if (ubi) {
        return { action: `🎤 Discovery 30min — confirmar interés en ${ubi}, presupuesto exacto y timeline`, date: '' }
      }
      return { action: '🎤 Discovery 30min — calificar BANT (presupuesto, autoridad, necesidad, timeline, financiamiento)', date: '' }
    }

    case 'conversacion':
      return { action: '➡️ Cerrar conversación con SIGUIENTE PASO concreto: agendar Zoom o recorrido con fecha', date: '' }

    case 'zoom_agendado':
      return { action: '🎯 Preparar Zoom: presentación personalizada + comparativos. Recordatorio 24h y 2h antes', date: '' }

    case 'recorrido': // incluye Zoom Concretado en el alias
      return { action: '📨 SLA <24h post-Zoom: enviar resumen + propuesta formal + proponer visita presencial', date: '' }

    case 'seguimiento': {
      const nivel = temp === 'caliente' ? '🔴 CALIENTE'
                  : temp === 'medio'    ? '🟡 MEDIO'
                  :                        '🔵 FRÍO'
      const freq = FRECUENCIA[temp]
      // Tipo de mensaje según señal
      if (P.inversion.test(t) && ubi) {
        return { action: `${nivel} (${freq}): enviar opciones de inversión en ${ubi} con números de ROI`, date: '' }
      }
      if (P.entregaInmediata.test(t) && ubi) {
        return { action: `${nivel} (${freq}): enviar opciones de entrega inmediata en ${ubi}`, date: '' }
      }
      if (P.preventa.test(t) && ubi) {
        return { action: `${nivel} (${freq}): enviar pre-ventas disponibles en ${ubi} con plan de pagos`, date: '' }
      }
      if (P.faltaAuthority.test(t)) {
        return { action: `${nivel} (${freq}): incluir a la pareja/familiar en próxima conversación (Authority)`, date: '' }
      }
      return { action: `${nivel} (${freq}): mensaje de valor + cerrar con siguiente paso concreto`, date: '' }
    }

    case 'apartado':
      return { action: '💰 Negociación activa (SLA 24h): revisar pago, conectar notaría, validar costos, preparar expediente', date: '' }

    case 'venta_cerrada':
      return { action: '🎉 Post-venta: confirmar entrega, solicitar referido, mantener relación para venta futura', date: '' }

    case 'post_venta':
      return { action: '🤝 Solicitar 2-3 referidos calificados + revisar satisfacción', date: '' }

    case 'descartado':
      return { action: '❄️ Re-engagement frío en 30 días con mensaje de valor (nueva oferta, baja de precio, etc)', date: '' }

    default:
      return { action: 'Llamada de seguimiento — definir siguiente paso con fecha concreta', date: '' }
  }
}

// ── Priority calculator alineado con SLAs del protocolo ──────────────────
function inferPriority(lead, smartNext) {
  const t      = `${lower(smartNext.action)} ${fullText(lead)}`
  const stage  = canonicalStage(lead.stage)
  const hot    = lead.hot === true
  const days   = Number(lead.days_inactive || 0)
  const score  = Number(lead.score || 0)
  const temp   = temperaturaLead(lead)

  let priority = 'baja'
  let order    = 80

  // PROTOCOLO: stages finales = MÁXIMA prioridad
  if (stage === 'apartado' || stage === 'venta_cerrada') {
    priority = 'alta'; order = 4
  }

  // PROTOCOLO: SLA crítico — Nuevo lead requiere contacto en <2h
  if (stage === 'lead_nuevo') {
    priority = 'alta'; order = Math.min(order, 5)
  }

  // PROTOCOLO: Recorrido/Zoom Concretado → propuesta en <24h (alta)
  if (stage === 'recorrido') {
    priority = 'alta'; order = Math.min(order, 7)
  }

  // PROTOCOLO: Zoom agendado → preparar (alta si fecha próxima)
  if (stage === 'zoom_agendado' && extractFecha(t)) {
    priority = 'alta'; order = Math.min(order, 9)
  }

  // PROTOCOLO: 3er intento sin respuesta → riesgo (escalar)
  if (P.tercerIntento.test(fullText(lead))) {
    priority = 'alta'; order = Math.min(order, 11)
  }

  // PROTOCOLO: 5+ días sin actividad = frío, requiere reactivación inmediata
  if (days >= 5) {
    priority = priority === 'alta' ? 'alta' : 'alta'
    order = Math.min(order, 14 + Math.max(0, 30 - Math.min(days, 30)))
  }

  // Hot leads o score alto
  if (hot && priority !== 'alta') {
    priority = 'alta'; order = Math.min(order, 13)
  }
  if (score >= 80 && priority !== 'alta') {
    priority = 'alta'; order = Math.min(order, 17)
  }

  // PROTOCOLO: Listo para comprar (señal directa)
  if (P.listoComprar.test(fullText(lead))) {
    priority = 'alta'; order = Math.min(order, 6)
  }

  // 24h sin avance pero menos de 5 días → media
  if (priority === 'baja' && days >= 1 && days < 5) {
    priority = 'media'
    order = 40 + (5 - days)
  }

  // Frío sin urgencia particular → media
  if (priority === 'baja' && temp === 'frio') {
    priority = 'media'
    order = Math.min(order, 60)
  }

  // Descartados al fondo
  if (stage === 'descartado') {
    priority = 'baja'; order = 95
  }

  return { priority, priority_order: Math.round(order) }
}

function buildTask(action, date, lead) {
  if (!action) return null
  return {
    id: randomUUID(),
    action,
    date: date || lead.next_action_date || '',
    source: 'imported_from_sheet_protocolo_duke',
    completed: false,
    created_at: lead.created_at || new Date().toISOString(),
    completed_at: null,
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Stratos AI — Enriquecimiento con Protocolo Duke del Caribe\n')

  const raw = await readFile(LEADS_PATH, 'utf8')
  const leads = JSON.parse(raw)
  console.log(`Leídos ${leads.length} leads`)

  await copyFile(LEADS_PATH, `${LEADS_PATH}.bak`)

  const updates = []
  const enriched = leads.map(lead => {
    const u = { ...lead }
    const smart = deriveSmartNextAction(lead)
    u.next_action      = smart.action
    u.next_action_date = smart.date || lead.next_action_date || ''

    // Reemplazar tasks generadas (mantener manuales del usuario)
    const manualTasks = (Array.isArray(lead.tasks) ? lead.tasks : [])
      .filter(t => t.source !== 'imported_from_sheet' && t.source !== 'imported_from_sheet_protocolo_duke')
    const newTask = buildTask(smart.action, smart.date, lead)
    u.tasks = newTask ? [newTask, ...manualTasks] : manualTasks

    const { priority, priority_order } = inferPriority(lead, smart)
    u.priority = priority
    u.priority_order = priority_order
    u.updated_at = new Date().toISOString()

    updates.push({
      id: lead.id,
      next_action: u.next_action,
      next_action_date: u.next_action_date,
      tasks: u.tasks,
      priority: u.priority,
      priority_order: u.priority_order,
    })
    return u
  })

  // Stats
  const byPriority = enriched.reduce((acc, l) => { acc[l.priority] = (acc[l.priority] || 0) + 1; return acc }, {})
  const bySLA = enriched.reduce((acc, l) => {
    const a = l.next_action || ''
    if (a.includes('SLA <2h'))     acc.sla_2h++
    else if (a.includes('SLA <24h'))acc.sla_24h++
    else if (a.includes('RIESGO'))  acc.riesgo++
    else if (a.includes('FRÍO'))    acc.frio++
    else if (a.includes('ALERTA'))  acc.alerta++
    else if (a.includes('💰'))      acc.cierre++
    else if (a.includes('🎯'))      acc.zoom++
    else if (a.includes('🎤'))      acc.discovery++
    else if (a.includes('CALIENTE'))acc.caliente++
    else if (a.includes('MEDIO'))   acc.medio++
    return acc
  }, { sla_2h: 0, sla_24h: 0, riesgo: 0, frio: 0, alerta: 0, cierre: 0, zoom: 0, discovery: 0, caliente: 0, medio: 0 })

  console.log(`\n📊 Distribución por prioridad:`)
  for (const [p, n] of Object.entries(byPriority)) {
    const e = p === 'alta' ? '🔴' : p === 'media' ? '🟡' : '🟢'
    console.log(`   ${e} ${p}: ${n}`)
  }

  console.log(`\n📋 Distribución por tipo de acción del Protocolo:`)
  console.log(`   ⚡ SLA <2h (lead nuevo):       ${bySLA.sla_2h}`)
  console.log(`   📨 SLA <24h (post-Zoom):       ${bySLA.sla_24h}`)
  console.log(`   ⚠️  RIESGO (3er intento):       ${bySLA.riesgo}`)
  console.log(`   🟡 ALERTA (5+ días):            ${bySLA.alerta}`)
  console.log(`   🔥 FRÍO (2+ semanas):           ${bySLA.frio}`)
  console.log(`   💰 Cierre (apartado):          ${bySLA.cierre}`)
  console.log(`   🎯 Zoom (preparar/confirmar):  ${bySLA.zoom}`)
  console.log(`   🎤 Discovery (calificar BANT): ${bySLA.discovery}`)
  console.log(`   🔴 CALIENTE (seguimiento 24h): ${bySLA.caliente}`)
  console.log(`   🟡 MEDIO (seguimiento 48h):    ${bySLA.medio}`)

  // Top 10 más urgentes
  const sorted = [...enriched].sort((a, b) => (a.priority_order || 999) - (b.priority_order || 999))
  console.log(`\n🚨 Top 10 más urgentes según protocolo:`)
  for (const l of sorted.slice(0, 10)) {
    console.log(`   [${l.priority}|${l.priority_order}] ${l.name} (${l.asesor_name || '-'})`)
    console.log(`     → ${(l.next_action || '').slice(0, 110)}`)
  }

  await writeFile(LEADS_PATH, JSON.stringify(enriched, null, 2))
  console.log(`\n✓ ${LEADS_PATH} actualizado`)

  // SQL
  const sqlLines = [
    '-- Sincronización de Protocolo Duke del Caribe a Supabase',
    '-- Generado por scripts/enrich-leads-priority.mjs',
    '',
    'BEGIN;',
    '',
  ]
  for (const u of updates) {
    const tasksJson  = JSON.stringify(u.tasks || []).replace(/'/g, "''")
    const action     = (u.next_action || '').replace(/'/g, "''")
    const actionDate = (u.next_action_date || '').replace(/'/g, "''")
    sqlLines.push(
      `UPDATE leads SET next_action = '${action}', next_action_date = '${actionDate}', tasks = '${tasksJson}'::jsonb, priority = '${u.priority}', priority_order = ${u.priority_order}, updated_at = now() WHERE id = '${u.id}';`,
    )
  }
  sqlLines.push('', 'COMMIT;', '')
  await writeFile(SQL_OUTPUT, sqlLines.join('\n'))
  console.log(`✓ ${SQL_OUTPUT} (${updates.length} UPDATEs listos para Supabase)\n`)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
