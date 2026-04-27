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

// ═══════════════════════════════════════════════════════════════════════
// PLAYBOOK GENERATOR — Genera 4-5 acciones específicas por lead alineadas
// con el Protocolo Duke del Caribe. Cada acción incluye:
//   • action:    qué hacer (una frase imperativa)
//   • technique: técnica de venta usada (BANT, manejo objeción, etc)
//   • reason:    por qué hacerlo ahora (contexto del expediente)
//   • category:  reactivacion | calificacion | cita | propuesta | cierre | retencion
//   • icon:      emoji visual
//   • order:     orden de ejecución sugerido
// ═══════════════════════════════════════════════════════════════════════

function buildPlaybook(lead) {
  const t       = fullText(lead)
  const stage   = canonicalStage(lead.stage)
  const days    = Number(lead.days_inactive || 0)
  const temp    = temperaturaLead(lead)
  const score   = Number(lead.score || 0)
  const ubi     = extractUbicacion(t)
  const pres    = extractPresupuesto(t)
  const ubiText = ubi || 'la zona objetivo'
  const presText= pres || 'el presupuesto'

  const items = []
  const push = (item) => items.push({
    id: randomUUID(),
    order: items.length + 1,
    completed: false,
    ...item,
  })

  // ── A. SITUACIONES CRÍTICAS (anteceden al stage) ──

  // A1. 3er intento sin respuesta = RIESGO
  if (P.tercerIntento.test(t)) {
    push({ icon: '🚨', category: 'reactivacion', action: 'Escalar al director — caso de riesgo (3er intento sin respuesta)', technique: 'Escalation', reason: 'El protocolo marca riesgo después de 3 intentos. Director puede aportar perspectiva nueva.' })
    push({ icon: '💎', category: 'reactivacion', action: 'Mensaje con valor exclusivo: descuento o oferta limitada', technique: 'Manejo de objeción', reason: 'Para romper el silencio se necesita un motivo nuevo y tangible.' })
    push({ icon: '⏰', category: 'reactivacion', action: 'Crear urgencia con escasez: "Últimas X unidades a este precio"', technique: 'Escasez', reason: 'La urgencia bien calibrada reactiva clientes silenciosos.' })
    push({ icon: '📞', category: 'reactivacion', action: 'Llamada en frío con guión específico de reactivación', technique: 'Llamada en frío', reason: 'Cambiar canal de WhatsApp a llamada puede destrabar respuesta.' })
    push({ icon: '❄️', category: 'reactivacion', action: 'Si no responde a esto → marcar como frío y re-engagement en 30 días', technique: 'Cierre de proceso', reason: 'No abandonar pero tampoco insistir sin estrategia.' })
    return items
  }

  // A2. Sin respuesta + frío (5+ días)
  if (P.sinRespuesta.test(t) && days >= 5) {
    push({ icon: '🔥', category: 'reactivacion', action: 'Reactivación inmediata — cambiar canal (WhatsApp ↔ llamada)', technique: 'Cambio de canal', reason: `Llevan ${days} días sin respuesta. El SLA del protocolo marca reactivación inmediata.` })
    push({ icon: '💎', category: 'reactivacion', action: `Mensaje con valor nuevo: oferta del mes en ${ubiText}`, technique: 'Aportar valor', reason: 'Cada toque debe aportar valor — no repetir mensajes anteriores.' })
    push({ icon: '🎁', category: 'reactivacion', action: 'Ofrecer tour virtual gratis o visita VIP con traslado', technique: 'Reducir fricción', reason: 'Bajar la barrera de entrada con experiencia gratuita reactiva interés.' })
    push({ icon: '📊', category: 'reactivacion', action: 'Enviar comparativo de ROI sin esperar respuesta (push)', technique: 'Push de información', reason: 'Mostrar números concretos sin pedir nada genera reciprocidad.' })
    push({ icon: '⏰', category: 'reactivacion', action: 'Crear urgencia: precio sube +8% anual, esperar = pagar más', technique: 'Manejo objeción precio', reason: 'Recordatorio de costo de oportunidad para mover decisión.' })
    return items
  }

  // A3. Sin respuesta reciente (menos de 5 días)
  if (P.sinRespuesta.test(t)) {
    push({ icon: '🔄', category: 'reactivacion', action: 'Cambiar canal — si fue WhatsApp, llamar; si fue llamada, mensaje', technique: 'Cambio de canal', reason: 'Variar canal aumenta la probabilidad de respuesta.' })
    push({ icon: '💎', category: 'reactivacion', action: 'Aportar valor nuevo: info exclusiva, foto de avance, oferta', technique: 'Aportar valor', reason: 'Cada toque suma valor — no enviar el mismo mensaje dos veces.' })
    push({ icon: '🎁', category: 'reactivacion', action: 'Ofrecer tour virtual o visita VIP con traslado incluido', technique: 'Reducir fricción', reason: 'Experiencia gratuita reactiva el interés del cliente.' })
    push({ icon: '📅', category: 'reactivacion', action: `Próximo intento en ${temp === 'caliente' ? '24h' : temp === 'medio' ? '48h' : '3-5 días'}`, technique: 'Frecuencia por temperatura', reason: `Lead ${temp}: el protocolo marca esa cadencia.` })
    push({ icon: '🎯', category: 'reactivacion', action: 'Cerrar mensaje con SIGUIENTE PASO concreto y fecha', technique: 'Avance del protocolo', reason: 'Toda comunicación debe tener próximo paso definido.' })
    return items
  }

  // ── B. POR STAGE DEL PIPELINE ──

  if (stage === 'lead_nuevo') {
    push({ icon: '⚡', category: 'cita', action: 'SLA <2h: Enviar primer WhatsApp con tono cálido y profesional', technique: 'Velocidad de respuesta', reason: 'El protocolo marca <5 min ideal, máximo 30 min, absoluto 2h.' })
    push({ icon: '📞', category: 'cita', action: 'Llamada directa 30 min después si no responde el WhatsApp', technique: 'Doble canal', reason: 'WhatsApp + llamada maximiza la tasa de contacto inicial.' })
    push({ icon: '🎤', category: 'calificacion', action: 'Discovery 30 min: presupuesto, autoridad, necesidad, timeline, financiamiento', technique: 'BANT-F', reason: 'Calificación completa antes de avanzar evita perder tiempo.' })
    push({ icon: '📋', category: 'propuesta', action: `Enviar dossier del proyecto que más se ajuste según ${presText}`, technique: 'Personalización', reason: 'Mostrar opciones específicas vs presentar todo el portafolio.' })
    push({ icon: '🎯', category: 'cita', action: 'Cerrar conversación con SIGUIENTE PASO: Zoom o tour agendado', technique: 'Avance del protocolo', reason: 'Toda conversación debe terminar con próximo paso definido.' })
    return items
  }

  if (stage === 'contactado') {
    push({ icon: '🎤', category: 'calificacion', action: 'Discovery 30 min — completar BANT (Budget · Authority · Need · Timeline · Financing)', technique: 'BANT-F', reason: 'Sin BANT completo, propuestas son disparos al aire.' })
    push({ icon: '👥', category: 'calificacion', action: 'Confirmar quién más decide (esposa, familia, asesor financiero)', technique: 'BANT-Authority', reason: 'Authority no validada = riesgo de tener que reiniciar el ciclo.' })
    push({ icon: '🎯', category: 'calificacion', action: 'Identificar si es para inversión o disfrute (cambia presentación)', technique: 'BANT-Need', reason: 'Inversión = mostrar ROI; Disfrute = mostrar lifestyle.' })
    push({ icon: '📋', category: 'propuesta', action: `Enviar dossier del proyecto en ${ubiText} alineado a ${presText}`, technique: 'Personalización', reason: 'Material específico genera más engagement que material genérico.' })
    push({ icon: '📅', category: 'cita', action: 'Cerrar con Zoom agendado o tour físico (fecha concreta)', technique: 'Avance del protocolo', reason: 'Conversación sin siguiente paso = lead estancado.' })
    return items
  }

  if (stage === 'conversacion') {
    push({ icon: '🎯', category: 'cita', action: 'Cerrar la conversación con SIGUIENTE PASO concreto y fecha', technique: 'Avance del protocolo', reason: 'Sin siguiente paso, el lead se enfría y se pierde.' })
    push({ icon: '📅', category: 'cita', action: 'Proponer 2 fechas concretas para Zoom o tour (no opciones abiertas)', technique: 'Decisión binaria', reason: 'Opciones cerradas convierten más que opciones abiertas.' })
    push({ icon: '💼', category: 'propuesta', action: `Preparar comparativos personalizados de ${ubiText}`, technique: 'Personalización', reason: 'Material específico al cliente vs catálogo genérico.' })
    push({ icon: '📊', category: 'propuesta', action: 'Tener listos números de ROI y plan de pagos para la siguiente cita', technique: 'Anticipación', reason: 'Los números cierran ventas — tenerlos listos siempre.' })
    push({ icon: '✅', category: 'calificacion', action: 'Validar BANT pendiente si quedó algo sin confirmar', technique: 'BANT-F', reason: 'Cualquier dato BANT faltante puede tirar la negociación al final.' })
    return items
  }

  if (stage === 'zoom_agendado') {
    push({ icon: '📅', category: 'cita', action: 'Confirmar Zoom 24h antes (recordatorio escrito + valor agregado)', technique: 'Anti no-show', reason: 'Recordatorio reduce no-shows en ~50%.' })
    push({ icon: '📅', category: 'cita', action: 'Confirmar Zoom 2h antes (mensaje breve + link)', technique: 'Anti no-show', reason: 'Doble confirmación maximiza asistencia.' })
    push({ icon: '📊', category: 'propuesta', action: `Preparar 3 comparativos personalizados de ${ubiText}`, technique: 'Preparación', reason: 'Tener opciones listas vs improvisar.' })
    push({ icon: '💼', category: 'propuesta', action: 'Dossier con ROI proyectado, plan de pagos, fotos y videos', technique: 'Material persuasivo', reason: 'Material visual + financiero genera decisión.' })
    push({ icon: '🎯', category: 'cita', action: 'Plan del Zoom: 5min rapport, 15min proyecto, 10min cierre con siguiente paso', technique: 'Estructura de venta', reason: 'Zoom estructurado convierte 3x más que conversación libre.' })
    return items
  }

  if (stage === 'recorrido') {
    push({ icon: '📨', category: 'propuesta', action: 'SLA <24h: Enviar resumen escrito del Zoom con puntos clave', technique: 'Velocidad post-cita', reason: 'El SLA del protocolo es <24h después del Zoom Concretado.' })
    push({ icon: '📋', category: 'propuesta', action: 'Enviar propuesta formal con ROI, plan de pagos y comparativos', technique: 'Propuesta personalizada', reason: 'Pasar de hablado a escrito formaliza el avance.' })
    push({ icon: '🏖️', category: 'cita', action: 'Proponer visita presencial — ofrecer traslado/hospedaje', technique: 'Reducir fricción', reason: 'Visita física aumenta conversión 3x vs solo Zoom.' })
    push({ icon: '📞', category: 'propuesta', action: 'Llamada 48h después del Zoom para confirmar avance', technique: 'Seguimiento activo', reason: 'No esperar respuesta — provocarla con seguimiento.' })
    push({ icon: '🎯', category: 'cita', action: 'Cerrar siguiente paso: visita o segunda llamada con familia', technique: 'Avance del protocolo', reason: 'Mantener el momentum del Zoom con próximo paso claro.' })
    return items
  }

  if (stage === 'seguimiento') {
    const freq = FRECUENCIA[temp]
    if (P.faltaAuthority.test(t)) {
      push({ icon: '👥', category: 'calificacion', action: 'Incluir a la pareja/familiar en próxima conversación', technique: 'BANT-Authority', reason: 'Authority sin validar = decisión incompleta del cliente.' })
      push({ icon: '📨', category: 'propuesta', action: 'Enviar resumen para que el otro decisor lo revise antes', technique: 'Pre-venta a 2do decisor', reason: 'El otro decisor llega informado y avanza más rápido.' })
      push({ icon: '📅', category: 'cita', action: 'Agendar Zoom familiar conjunto (no solo con el contacto)', technique: 'Cita inclusiva', reason: 'Decidir juntos evita objeciones de "tengo que consultar".' })
      push({ icon: '💼', category: 'propuesta', action: 'Preparar 2 versiones de propuesta si los perfiles son distintos', technique: 'Personalización doble', reason: 'Cada decisor tiene prioridades distintas.' })
      push({ icon: '🎯', category: 'propuesta', action: 'No avanzar a propuesta final hasta confirmar Authority', technique: 'BANT-F', reason: 'Avanzar sin Authority = riesgo de tener que volver al inicio.' })
      return items
    }
    if (P.inversion.test(t)) {
      push({ icon: '📊', category: 'propuesta', action: `${freq}: Enviar opciones de inversión en ${ubiText} con ROI 8-12%`, technique: 'Frecuencia por temperatura', reason: `Lead ${temp}: cadencia óptima sin saturar.` })
      push({ icon: '🏖️', category: 'propuesta', action: 'Compartir programa de renta vacacional (10-12% adicional)', technique: 'Aumentar valor percibido', reason: 'Renta vacacional convierte propiedad en flujo de caja.' })
      push({ icon: '📈', category: 'propuesta', action: 'Mostrar histórico de apreciación de Riviera Maya', technique: 'Prueba social', reason: 'Datos históricos refuerzan la decisión de inversión.' })
      push({ icon: '⏰', category: 'propuesta', action: 'Crear urgencia: precio sube +8% anual, esperar = pagar más', technique: 'Costo de oportunidad', reason: 'Mover de "lo voy a pensar" a "decido ahora".' })
      push({ icon: '🎯', category: 'cita', action: 'Cerrar con visita VIP o Zoom de propuesta concreta', technique: 'Avance del protocolo', reason: 'Mantener el momentum con siguiente paso claro.' })
      return items
    }
    push({ icon: '💎', category: 'reactivacion', action: `${freq}: Mensaje de valor con info nueva (no repetir anteriores)`, technique: 'Frecuencia por temperatura', reason: `Lead ${temp}: cadencia ideal según protocolo.` })
    push({ icon: '🎁', category: 'reactivacion', action: 'Ofrecer experiencia gratuita: tour virtual o visita VIP', technique: 'Reducir fricción', reason: 'Experiencia gratis reactiva interés.' })
    push({ icon: '📊', category: 'propuesta', action: `Enviar comparativo personalizado de ${ubiText}`, technique: 'Personalización', reason: 'Material específico vs catálogo genérico.' })
    push({ icon: '✅', category: 'calificacion', action: 'Validar BANT que no se haya completado en discovery anterior', technique: 'BANT-F', reason: 'Lead estancado a veces es por dato BANT faltante.' })
    push({ icon: '🎯', category: 'cita', action: 'Cerrar con SIGUIENTE PASO concreto y fecha', technique: 'Avance del protocolo', reason: 'Toda comunicación debe terminar con próximo paso.' })
    return items
  }

  if (stage === 'apartado') {
    push({ icon: '💰', category: 'cierre', action: 'Revisar condiciones de pago en detalle con el cliente', technique: 'Cierre suave', reason: 'Validar que ambas partes están alineadas en términos.' })
    push({ icon: '⚖️', category: 'cierre', action: 'Conectar con notaría aliada (lista pre-aprobada de Stratos)', technique: 'Reducir fricción', reason: 'Notaría aliada acelera el proceso de cierre.' })
    push({ icon: '💵', category: 'cierre', action: 'Validar costos notariales y honorarios con el cliente', technique: 'Transparencia', reason: 'Costos sorpresivos en cierre rompen la confianza.' })
    push({ icon: '📋', category: 'cierre', action: 'Preparar expediente completo de cierre (legal + financiero)', technique: 'Anticipación', reason: 'Tener todo listo evita demoras en firma.' })
    push({ icon: '🎁', category: 'retencion', action: 'Solicitar 2-3 referidos calificados al firmar', technique: 'Cierre ampliado', reason: 'Mejor momento para pedir referidos: justo después de cerrar.' })
    return items
  }

  if (stage === 'venta_cerrada' || stage === 'post_venta') {
    push({ icon: '🎉', category: 'retencion', action: 'Confirmar entrega exitosa con el cliente y bienvenida', technique: 'Post-venta', reason: 'Cliente satisfecho = referidos y futuras ventas.' })
    push({ icon: '🤝', category: 'retencion', action: 'Solicitar 2-3 referidos calificados específicos', technique: 'Programa de referidos', reason: 'Referidos calificados = nueva pipeline gratuita.' })
    push({ icon: '⭐', category: 'retencion', action: 'Pedir testimonio escrito o video para usar como prueba social', technique: 'Prueba social', reason: 'Testimonios reales convierten futuros leads.' })
    push({ icon: '📅', category: 'retencion', action: 'Agendar check-in de satisfacción a 30 / 90 / 180 días', technique: 'Mantener relación', reason: 'Cliente satisfecho a largo plazo = ventas recurrentes.' })
    push({ icon: '🎁', category: 'retencion', action: 'Invitar a eventos exclusivos de Stratos (open house, lanzamientos)', technique: 'Comunidad', reason: 'Mantener al cliente conectado refuerza relación y referidos.' })
    return items
  }

  if (stage === 'descartado') {
    push({ icon: '❄️', category: 'reactivacion', action: 'Re-engagement en 30 días con mensaje de valor (no insistir)', technique: 'Re-engagement frío', reason: 'No abandonar, pero respetar tiempo del cliente.' })
    push({ icon: '💎', category: 'reactivacion', action: 'Compartir cambio de oferta o nueva opción que se ajuste', technique: 'Aportar valor', reason: 'Razón nueva = excusa válida para retomar contacto.' })
    push({ icon: '🎁', category: 'reactivacion', action: 'Invitar a evento exclusivo (open house, lanzamiento)', technique: 'Reducir fricción', reason: 'Evento sin compromiso reactiva interés.' })
    push({ icon: '📊', category: 'reactivacion', action: 'Validar si su situación cambió (nuevo presupuesto, timeline)', technique: 'BANT-F', reason: 'A veces el "no" es temporal y la situación cambió.' })
    push({ icon: '🔄', category: 'reactivacion', action: 'Si después de 90 días sin respuesta → cerrar como perdido', technique: 'Cierre de proceso', reason: 'No saturar al cliente — cerrar con dignidad.' })
    return items
  }

  // ── DEFAULT (cualquier stage no cubierto) ──
  const freq = FRECUENCIA[temp]
  push({ icon: '📞', category: 'reactivacion', action: `${freq}: Llamada de seguimiento — definir siguiente paso con fecha`, technique: 'Frecuencia por temperatura', reason: `Lead ${temp}: cadencia ideal según protocolo.` })
  push({ icon: '💎', category: 'propuesta', action: 'Aportar valor en cada toque: no repetir mensajes anteriores', technique: 'Aportar valor', reason: 'El protocolo prohíbe repetir mensajes.' })
  push({ icon: '✅', category: 'calificacion', action: 'Validar BANT pendiente si hay dudas en algún punto', technique: 'BANT-F', reason: 'Datos BANT incompletos generan estancamiento.' })
  push({ icon: '🎯', category: 'cita', action: 'Cerrar comunicación con SIGUIENTE PASO concreto', technique: 'Avance del protocolo', reason: 'Toda interacción debe terminar con próximo paso definido.' })
  return items
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

    // PLAYBOOK personalizado: 4-5 acciones específicas para esta situación
    u.playbook = buildPlaybook(lead)

    const { priority, priority_order } = inferPriority(lead, smart)
    u.priority = priority
    u.priority_order = priority_order
    u.updated_at = new Date().toISOString()

    updates.push({
      id: lead.id,
      next_action: u.next_action,
      next_action_date: u.next_action_date,
      tasks: u.tasks,
      playbook: u.playbook,
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
    '-- Crear columna playbook si no existe',
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS playbook jsonb DEFAULT '[]'::jsonb;`,
    '',
    'BEGIN;',
    '',
  ]
  for (const u of updates) {
    const tasksJson    = JSON.stringify(u.tasks || []).replace(/'/g, "''")
    const playbookJson = JSON.stringify(u.playbook || []).replace(/'/g, "''")
    const action       = (u.next_action || '').replace(/'/g, "''")
    const actionDate   = (u.next_action_date || '').replace(/'/g, "''")
    sqlLines.push(
      `UPDATE leads SET next_action = '${action}', next_action_date = '${actionDate}', tasks = '${tasksJson}'::jsonb, playbook = '${playbookJson}'::jsonb, priority = '${u.priority}', priority_order = ${u.priority_order}, updated_at = now() WHERE id = '${u.id}';`,
    )
  }
  sqlLines.push('', 'COMMIT;', '')
  await writeFile(SQL_OUTPUT, sqlLines.join('\n'))
  console.log(`✓ ${SQL_OUTPUT} (${updates.length} UPDATEs listos para Supabase)\n`)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
