/**
 * lib/telegram.js — Pareo del bot de Telegram con el perfil del asesor.
 *
 * El bot vive en n8n (Stratos AI — Telegram CRM Bot v3). Para que sepa
 * quién le está hablando, cada asesor empareja su Telegram con su perfil
 * usando un código de 6 dígitos generado desde el web.
 *
 * Flujo:
 *   1. Asesor entra a Perfil → click "Generar código" → requestPairingCode()
 *   2. Recibe 6 dígitos vigentes 10 min
 *   3. Manda al bot: /conectar XXXXXX
 *   4. Bot llama consume_telegram_pairing_code (RPC, vía service_role)
 *   5. La columna profiles.telegram_chat_id queda con su chat_id de Telegram
 *
 * Migración relacionada: supabase/migrations/007_telegram_bot_asesor_mode.sql
 */
import { supabase } from './supabase'
import { resolveClientFromLocation, getClientConfigByOrgId } from '../clients'

// ── Puerta del chat por TENANT (white-label) ─────────────────────────────────
// Un tenant cuyo Copilot opera el motor de TAREAS (crear/empezar/terminar/
// posponer sin fricción + segundo cerebro) lo declara en su config con
// `features.copilotBrain: "tareas"` y, si tiene flujo propio,
// `tenant.copilotWebhook` (caso NSG → flujo Claude `copilot-nsg`). Va por
// CONFIG, nunca hardcodeado por org (regla white-label #15 de la skill).
//
// `copilotBrain` distinto de 'crm' = el tenant tiene CEREBRO PROPIO y no es una
// inmobiliaria: no debe pasar por las capas de VENTAS (quick commands de
// `copilot_send`, callbacks proactivos de zoom/inactividad, awaiting-plan) ni
// recibir el manual inmobiliario. Antes eso se lograba solo con `tasksBrain`,
// así que un rubro nuevo (ej. `dental`) caía en el Copilot de ventas y le
// hablaba de leads y Zooms. `customBrain` generaliza esa puerta a cualquier
// rubro; `copilotHelp` deja que cada tenant escriba su propio "¿qué puedes
// hacer?" en vez de heredar el de Duke.
function tenantCopilotShape(cfg) {
  const brain = cfg?.features?.copilotBrain || 'crm'
  return {
    brain,
    tasksBrain: brain === 'tareas',
    customBrain: brain !== 'crm',
    webhook: cfg?.tenant?.copilotWebhook || null,
    helpText: cfg?.tenant?.copilotHelp || null,
    mktLabel: cfg?.navLabels?.mkt || 'Marketing',
  }
}
// Resolución por URL (sirve antes de conocer el perfil; mismo patrón que
// labels.js/pipeline.js). La AUTORIDAD final es la ORG del usuario (ver inner).
function getTenantCopilotConfig() {
  try { return tenantCopilotShape(resolveClientFromLocation()) }
  catch { return { brain: 'crm', tasksBrain: false, customBrain: false, webhook: null, helpText: null, mktLabel: 'Marketing' } }
}

// getSession() puede colgarse si el SDK auto-refresca un token caducado.
// Mismo wrapper que auth.js — 3.5s es suficiente para lectura local + refresh.
const GETSESSION_TIMEOUT = 3500
function withTimeout(promise, ms = GETSESSION_TIMEOUT, label = 'op') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[telegram] ${label} timeout >${ms}ms`)), ms),
    ),
  ])
}

function flatKeyboard(inlineKeyboard = []) {
  if (!Array.isArray(inlineKeyboard)) return []
  return inlineKeyboard.flat().filter(Boolean).map((b) => ({
    label: b.text || b.label || 'Abrir',
    action: b.callback_data || b.action || b.url || b.text || b.label,
    isUrl: !!b.url || !!b.isUrl,
    primary: b.primary !== false,
  }))
}

function buildReminderButtons(reminder) {
  const tipo = String(reminder?.tipo || '')
  const payload = reminder?.payload || {}
  const leadId = reminder?.lead_id || payload.lead_id
  const actionId = payload.action_id || payload.team_action_id

  if ((tipo === 'team_action' || tipo === 'personal') && actionId) {
    return [
      { label: 'Ya la hice', action: `team_action:done:${actionId}`, primary: true },
      { label: 'En proceso', action: `team_action:inprocess:${actionId}`, primary: false },
      { label: 'No la hice', action: `team_action:notdone:${actionId}`, primary: false },
    ]
  }

  if (!leadId) return []

  if (tipo === 'inactividad' || tipo === 'inactividad_insist') {
    return [
      { label: 'Ya lo contacté', action: `proact_inact:contacte:${leadId}`, primary: true },
      { label: 'Reagendar seguimiento', action: `proact_inact:reagendar:${leadId}`, primary: false },
      { label: 'Ver ficha del cliente', action: `proact_inact:ficha:${leadId}`, primary: false },
    ]
  }

  if (tipo === 'next_action_10min') {
    return [
      { label: 'Sí, listo', action: `proact_next:listo:${leadId}`, primary: true },
      { label: 'Posponer 30 min', action: `proact_next:posponer30:${leadId}`, primary: false },
      { label: 'Cancelar', action: `proact_next:cancelar:${leadId}`, primary: false },
    ]
  }

  if (tipo === 'zoom_brief' || tipo === 'next_action_3h' || tipo.startsWith('next_action')) {
    return [
      { label: 'Ya estudié, este es mi plan', action: `proact_plan:${leadId}`, primary: true },
      { label: 'Reagendar', action: `proact_reagendar:${leadId}`, primary: false },
      { label: 'Ver expediente', action: `proact_next:ficha:${leadId}`, primary: false },
    ]
  }

  return []
}

function buildReminderContent(reminder) {
  const payload = reminder?.payload || {}
  const tipo = String(reminder?.tipo || '')
  const text = payload.text || payload.message_hint || payload.next_action || ''

  /* El texto de la base ya viene con el formato de la casa (encabezado «▸» en
     menta, un punto menta por dato y el dato que importa entre «»). Cuando
     existe se devuelve TAL CUAL: envolverlo en un encabezado propio lo rompía y
     además impedía que este aviso se emparejara con el mensaje del chat.
     Lo de abajo solo corre cuando el aviso no trae texto. */
  if (tipo === 'team_action') {
    const due = payload.due_at ? new Date(payload.due_at) : null
    const dueTxt = due && !Number.isNaN(due.getTime())
      ? due.toLocaleString('es-MX', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'hora programada'
    return [
      '▸ Recordatorio de tu agenda',
      `· «${text || 'Tarea pendiente'}»`,
      `· Vence: «${dueTxt}»`,
      '· ¿Cómo vas?',
    ].join('\n')
  }

  if (tipo === 'next_action_10min') {
    return [
      `▸ ${payload.lead_name || 'Tu cliente'}`,
      `· ${text || 'Acción programada'}`,
      '· Es en 10 minutos. ¿Estás listo?',
    ].join('\n')
  }

  if (text) return text
  if (tipo === 'inactividad' || tipo === 'inactividad_insist') {
    return '▸ Tienes clientes sin movimiento\n· Retómalos desde el CRM, o dime «ya lo contacté».'
  }
  if (tipo === 'zoom_brief' || tipo.startsWith('next_action')) {
    return '▸ Tienes algo agendado con un cliente\n· Repasa su ficha antes de entrar.'
  }
  return ''
}

/* Para comparar dos versiones del MISMO aviso hay que ignorar la ropa.
   El aviso viaja por dos caminos: el que guarda el historial (que vuelve de
   Telegram ya sin los `**`) y el que llega de proactive_reminders (que los
   conserva). Comparando el texto crudo no se reconocían, y el chat mostraba el
   mismo aviso DOS VECES — una sin botones y otra con ellos (Ángel, 3-ago).
   Se comparan sin marcas de formato, sin acentos y sin espacios de más. */
function mismaEsencia(a, b) {
  const limpio = (t) => String(t || '')
    .replace(/\*\*/g, '')
    .replace(/[«»"']/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  const x = limpio(a), y = limpio(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

function attachReminderToMessages(messages, reminderMessage) {
  const buttons = reminderMessage.buttons || []
  const content = reminderMessage.content || ''
  const textProbe = String(reminderMessage.probe || content).trim()
  const reminderTime = new Date(reminderMessage.occurred_at || 0).getTime()

  let idx = messages.findIndex((m) =>
    m.role === 'ai' &&
    m.content &&
    (mismaEsencia(m.content, content) || (textProbe && mismaEsencia(m.content, textProbe)))
  )

  if (idx < 0 && buttons.length && reminderTime) {
    idx = messages.findIndex((m) => {
      if (m.role !== 'ai' || !m.occurred_at || Array.isArray(m.buttons)) return false
      const delta = Math.abs(new Date(m.occurred_at).getTime() - reminderTime)
      return delta <= 10 * 60 * 1000
    })
  }

  if (idx >= 0) {
    if ((buttons.length && (!Array.isArray(messages[idx].buttons) || messages[idx].buttons.length === 0))
        || (reminderMessage.media_path && !messages[idx].media_path)) {
      /* Al emparejar el aviso con el mensaje ya guardado se conservaban solo los
         botones; la FOTO se perdía ahí (Ángel, 4-ago). */
      messages[idx] = { ...messages[idx],
        buttons: buttons.length ? buttons : messages[idx].buttons,
        media_path: messages[idx].media_path || reminderMessage.media_path || null,
        media_type: messages[idx].media_type || reminderMessage.media_type || 'foto' }
    }
    return false
  }

  messages.push(reminderMessage)
  return true
}

/**
 * Lee el estado actual de pareo del usuario autenticado.
 * Usa SELECT directo (RLS profiles_select_own ya permite leer el propio perfil).
 *
 * @returns {Promise<{ paired: boolean, pairedAt: string|null, error: string|null }>}
 */
export async function getPairingStatus() {
  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), GETSESSION_TIMEOUT, 'getSession')
    if (!session) return { paired: false, pairedAt: null, error: 'no_session' }

    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id, telegram_paired_at')
      .eq('id', session.user.id)
      .single()

    if (error) return { paired: false, telegramConnected: false, pairedAt: null, error: error.message }

    // Identidad del asistente:
    //  · chat != null  → tiene identidad (el Copilot funciona). Puede ser REAL
    //    (Telegram, chat > 0) o SINTÉTICA (chat < 0, asignada para que el Copilot
    //    ande sin obligar a conectar Telegram).
    //  · telegramConnected → SOLO Telegram real (chat > 0). Lo usa Perfil para
    //    mostrar "Conectado" vs ofrecer conectar Telegram (opcional, el "plus").
    const rawChat = data?.telegram_chat_id
    const chatNum = rawChat == null ? null : Number(rawChat)
    return {
      paired:            rawChat != null,
      telegramConnected: chatNum != null && chatNum > 0,
      pairedAt:          data?.telegram_paired_at || null,
      error:             null,
    }
  } catch (e) {
    return { paired: false, telegramConnected: false, pairedAt: null, error: e?.message || 'Error de conexión' }
  }
}

/**
 * Solicita un código de pareo (6 dígitos, vigente 10 min).
 * El RPC actualiza profiles.telegram_pairing_code y telegram_pairing_expires_at.
 *
 * @returns {Promise<{ code: string|null, expiresAt: string|null, error: string|null }>}
 */
export async function requestPairingCode() {
  try {
    const { data, error } = await supabase.rpc('request_telegram_pairing_code')
    if (error) return { code: null, expiresAt: null, error: error.message }
    if (data?.error) return { code: null, expiresAt: null, error: data.error }
    return {
      code:      data?.code || null,
      expiresAt: data?.expires_at || null,
      error:     null,
    }
  } catch (e) {
    return { code: null, expiresAt: null, error: e?.message || 'Error de conexión' }
  }
}

/**
 * Devuelve las últimas N interacciones (humano + bot) del chat actual del
 * asesor con el bot de Telegram. Útil para que el asesor revise lo que
 * pidió y cómo respondió el bot, sin abrir Telegram.
 *
 * La RPC corre con SECURITY DEFINER y filtra internamente por el
 * telegram_chat_id del perfil autenticado, así que cada usuario solo ve
 * su propio historial.
 *
 * @param {number} limit  máximo de mensajes a devolver (default 20, máx 100)
 * @returns {Promise<{ messages: Array<{id:number, occurred_at:string, role:string, content:string}>, error: string|null }>}
 */
export async function getRecentBotActivity(limit = 20) {
  try {
    const { data, error } = await supabase.rpc('get_my_telegram_activity', {
      p_limit: limit,
    })
    if (error) return { messages: [], error: error.message }
    return { messages: Array.isArray(data) ? data : [], error: null }
  } catch (e) {
    return { messages: [], error: e?.message || 'Error de conexión' }
  }
}

/**
 * COPILOT — historial LIMPIO de la conversación con el asistente.
 * Lee de tg_bot_activity (role user/ai + texto real), no de n8n_chat_histories
 * (que guarda el JSON del clasificador). Devuelve más reciente primero.
 *
 * @param {number} limit  máximo de mensajes (default 40, máx 200)
 * @returns {Promise<{ messages: Array<{id:number, occurred_at:string, role:string, content:string}>, error: string|null }>}
 */
export async function getCopilotActivity(limit = 50) {
  try {
    const { data, error } = await supabase.rpc('get_my_copilot_activity', { p_limit: limit })
    let messages = Array.isArray(data) ? [...data] : []
    if (error && messages.length === 0) return { messages: [], error: error.message }

    // Sincronización en tiempo real con recordatorios proactivos programados (proactive_reminders)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        const nowIso = new Date().toISOString()
        const { data: proact } = await supabase
          .from('proactive_reminders')
          .select('id, lead_id, asesor_name, tipo, scheduled_at, sent_at, status, payload, dedupe_key')
          .eq('asesor_id', session.user.id)
          .or(`status.eq.sent,and(status.eq.pending,scheduled_at.lte.${nowIso})`)
          .order('scheduled_at', { ascending: false })
          .limit(30)

        if (Array.isArray(proact) && proact.length > 0) {
          let hasNewSync = false
          for (const p of proact) {
            const txt = p?.payload?.text || p?.payload?.message_hint || p?.payload?.next_action || ''
            const buttons = buildReminderButtons(p)
            const content = buildReminderContent(p)
            if (!content && buttons.length === 0) continue
            const occ = p.sent_at || p.scheduled_at
            if (occ && new Date(occ).getTime() <= Date.now() + 60000) {
              const added = attachReminderToMessages(messages, {
                id: -(new Date(occ).getTime() || Math.floor(Math.random() * 999999)),
                occurred_at: occ,
                role: 'ai',
                content,
                buttons,
                probe: txt,
                /* La FOTO del aviso. Un asesor cierra una tarea con evidencia y al
                   admin le llegaba solo el texto: el aviso traía la ruta, pero al
                   convertirlo en mensaje no se copiaba, y más abajo solo se firman
                   los que tienen `media_path` (Ángel, 4-ago). */
                media_path: p?.payload?.media_path || null,
                media_type: p?.payload?.media_type || 'foto'
              })
              if (added) hasNewSync = true
            }
          }
          if (hasNewSync) {
            messages.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
          }
        }
      }
    } catch (remErr) {
      console.warn('[Stratos AI] sync proactive_reminders error:', remErr?.message)
    }

    // Evidencia (bucket privado 'evidencia'): firmamos una URL temporal para cada mensaje que
    // trae adjunto → la foto/video SE VE en el chat y se puede abrir a pantalla completa (estilo
    // WhatsApp). Mismo bucket/política que el módulo: cualquier marketing de la org puede firmarla.
    try {
      const withMedia = messages.filter((m) => m && m.media_path)
      if (withMedia.length > 0) {
        await Promise.all(withMedia.map(async (m) => {
          try {
            const { data: signed } = await supabase.storage.from('evidencia').createSignedUrl(m.media_path, 3600)
            const url = signed?.signedUrl
            if (url) {
              if (String(m.media_type || 'foto') === 'video') m.videoUrl = url
              else m.imageUrl = url
            }
          } catch { /* best-effort: si una no firma, el resto del chat igual carga */ }
        }))
      }
    } catch { /* noop */ }

    // Dedup de seguridad por VENTANA DE TIEMPO: si el mismo mensaje (role+contenido)
    // se logueó dos veces en <15s (ej. frontend + un camino de backend), se muestra una
    // sola vez. Repeticiones legítimas (mismo texto minutos después) se conservan.
    const seenAt = new Map()
    const deduped = []
    for (const m of messages) {
      if (m.media_path || m.imageUrl || m.videoUrl) { deduped.push(m); continue } // adjuntos: cada foto/video es único, nunca colapsar
      const key = (m.role || '') + '|' + String(m.content || '')
      const t = new Date(m.occurred_at || m.created_at || 0).getTime() || 0
      const prevT = seenAt.get(key)
      if (prevT !== undefined && Math.abs(prevT - t) < 15000) continue
      seenAt.set(key, t)
      deduped.push(m)
    }
    return { messages: deduped.slice(0, limit), error: null }
  } catch (e) {
    return { messages: [], error: e?.message || 'Error de conexión' }
  }
}

const N8N_COPILOT_WEBHOOK = "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-transcribe";
// COPILOT DE MARKETING (F3, jul-2026): el rol `marketing` usa su PROPIO flujo n8n
// (webhook independiente → cerebro mkt_nlu_dispatch en stratos-prod). Flujo duplicado
// a propósito para NO tocar el Copilot de asesores. Ver migraciones 107/108.
const N8N_COPILOT_WEBHOOK_MKT = "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-marketing";

function normalizeAgendaText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeCopilotAgendaCreateIntent(text) {
  const norm = normalizeAgendaText(text);
  if (!norm) return false;
  if (/^(agenda|pendientes|mis pendientes|que tengo hoy|que tengo en agenda)$/.test(norm)) return false;

  const hasCreateVerb = /\b(recuerdame|recordame|recuestame|agendame|agenda me|anotame|ponme|programame|creame|agrega|agregame)\b/.test(norm);
  if (!hasCreateVerb) return false;

  return (
    /\b(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(norm) ||
    /\b(a\s*las|alas|para\s*las|hora)\s*\d{1,2}(?:(?::|\s+)\d{2})?\b/.test(norm) ||
    /\ben\s+\d+\s*(minuto|minutos|min|mins|hora|horas|hr|hrs|dia|dias)\b/.test(norm)
  );
}

function extractRpcReplyText(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  return data?.reply?.text || data?.text || '';
}

/**
 * COPILOT — envía un mensaje al asistente IA del CRM.
 *
 * Estrategia DEFINITIVA (15-jul v4):
 *   1. Si solicita el manual o guía → envío inmediato y directo de links oficiales.
 *   2. Si solicita links, drive o catálogo de propiedades → entrega instantánea del portafolio.
 *   3. Si es un comando rápido conocido → RPC copilot_send (stratos-prod, ~100ms).
 *   4. Para TODO lo demás (texto libre, crear cliente, cambiar etapa, preguntas) →
 *      webhook de n8n (AI Agent con GPT-4o) con neutralización de menú intrusivo.
 *
 * @param {string} rawText
 * @param {object} options
 * @returns {Promise<{ reply: string|null, buttons?: Array, error: string|null }>}
 */
export async function sendCopilotMessage(rawText, options = {}) {
  // PERSISTENCIA: el turno del USUARIO se guarda AL ENVIAR, no al final. Antes se
  // guardaba después de la respuesta y, con la base lenta, el motor registraba su
  // respuesta PRIMERO → el historial quedaba persistido al revés y al refrescar el
  // chat «se reordenaba» (Ángel, 30-jul). Fire-and-forget: no bloquea ni rompe el envío.
  const userText = (rawText || "").trim();
  if (userText) {
    supabase.rpc('copilot_log_msg', { p_role: 'user', p_content: userText }).then(() => {}, () => {});
  }
  const r = await _sendCopilotMessageInner(rawText, options);
  // La respuesta directa (cuando no la registra el propio flujo) se guarda igual que
  // siempre. Best-effort (no bloquea la UI).
  try {
    if (r && typeof r.reply === 'string' && r.reply.trim()) {
      await supabase.rpc('copilot_log_msg', { p_role: 'ai', p_content: r.reply });
    }
  } catch { /* logging best-effort, nunca romper el envío */ }
  return r;
}

async function _sendCopilotMessageInner(rawText, options = {}) {
  const cleanText = (rawText || "").trim();
  if (!cleanText && !options.callback_data) return { reply: null, error: null };

  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), GETSESSION_TIMEOUT, 'getSession');
    if (!session?.user?.id) return { reply: "Sesión expirada.", error: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, role, is_marketing_admin, organization_id')
      .eq('id', session.user.id)
      .single();

    if (!profile?.telegram_chat_id) return { reply: null, error: 'not_paired' };
    const chatId = Number(profile.telegram_chat_id);
    // Lado MARKETING → su propio flujo/cerebro; NO pasa por las capas CRM de asesores
    // (quick commands copilot_send, callbacks proactivos, awaiting-plan). Cubre tanto al
    // rol `marketing` (operadores: Yazz, Luis, Emmanuel) como al ADMIN de marketing
    // (Alex es super_admin pero opera del lado marketing → is_marketing_admin=true, mig 113).
    // Sin esto, Alex caía en el Copilot de VENTAS (leads/brokers/emojis). Ventas intacto:
    // ningún admin de ventas tiene is_marketing_admin (default false).
    // `tenant.tasksBrain` (config del cliente, ej. NSG): TODO el Copilot del tenant
    // habla con el cerebro de tareas — misma ruta que marketing, sin tocar ventas.
    // La URL da la 1ª foto; la ORG del usuario logueado es la AUTORIDAD (inmune a
    // bundle cacheado, URL vieja o app instalada apuntando a la raíz).
    let tenant = getTenantCopilotConfig();
    try {
      const orgCfg = getClientConfigByOrgId(profile?.organization_id);
      if (orgCfg) tenant = tenantCopilotShape(orgCfg);
    } catch { /* noop — se queda la resolución por URL */ }
    // COLABORADOR de área (Comercial, Operativo, Administrativo, Finanzas, RRHH):
    // habla con el MISMO cerebro de tareas que marketing, porque es el que sabe de
    // pendientes, bitácora del día y «ya terminé X». El cerebro de ventas no le
    // sirve: no tiene leads ni cartera. Ventas queda intacto — nadie de ventas
    // entra por esta rama (su rol es `asesor`, no `colaborador`).
    const esColaborador = profile?.role === 'colaborador';
    const isMarketing = profile?.role === 'marketing' || profile?.is_marketing_admin === true || esColaborador || tenant.tasksBrain;

    // Recordatorios claros del Copilot web: se crean directo en team_actions para
    // que aparezcan en Mi Espacio -> Agenda y no pasen por n8n dos veces.
    if (!options.callback_data && !isMarketing && !tenant.customBrain && looksLikeCopilotAgendaCreateIntent(cleanText)) {
      try {
        const { data: agendaData, error: agendaError } = await supabase.rpc('copilot_agenda_create_from_text', {
          p_text: cleanText,
          p_category: null,
        });
        const agendaReply = extractRpcReplyText(agendaData);
        if (!agendaError && agendaReply) {
          return { reply: agendaReply, error: null };
        }
        if (agendaError && !/function .* does not exist|could not find/i.test(agendaError.message || '')) {
          console.warn('[Copilot agenda] direct create failed:', agendaError.message);
        }
      } catch (e) {
        console.warn('[Copilot agenda] direct create exception:', e?.message || e);
      }
    }

    // 1. Detección directa de solicitud de manual / guía / instrucciones — o "¿qué puedes hacer?"
    const wantsManual = /^(?:dame |mandame |enviame |enviar |ver |mostrar |necesito |pasame )?(?:el |la )?(?:manual|guía|guia|instrucciones|ayuda)(?:\s|$)/i.test(cleanText);
    const wantsCapabilities = /(qu[eé]\s+(tanto\s+)?(cosas\s+)?(me\s+)?(puedes?|pod[eé]s|sabes?|sab[eé]s)\s+hacer|qu[eé]\s+haces|qu[eé]\s+(otras\s+)?funcion(es|alidades)|para\s+qu[eé]\s+sirves?|en\s+qu[eé]\s+(me\s+)?(puedes?|pod[eé]s)\s+ayudar|c[oó]mo\s+(me\s+)?(puedes?\s+)?ayud)/i.test(cleanText);
    // Tenant que escribió su propio "¿qué puedes hacer?" en la config
    // (`tenant.copilotHelp`, ej. una clínica dental). Va PRIMERO: sin esto caía
    // al manual inmobiliario de más abajo y le hablaba de leads y Zooms.
    if (tenant.helpText && !options.callback_data && (wantsManual || wantsCapabilities)) {
      return { reply: tenant.helpText, buttons: [], error: null };
    }
    // Tenant con cerebro de TAREAS (ej. NSG): ayuda propia, sin el branding de
    // marketing de Duke (marcas/videos). Va ANTES del bloque isMarketing.
    if (tenant.tasksBrain && !options.callback_data && (wantsManual || wantsCapabilities)) {
      return {
        reply: `Esto es lo que puedo hacer por ti:\n\n• Decirte qué tienes hoy — "¿qué tengo hoy?"\n• Crear tareas sin fricción — "ponme una tarea: enviar el reporte mañana a las 10" o "créale una tarea a Iván: llamar al prospecto"\n• Avance por texto — "ya empecé …", "ya terminé …", "pospón … para mañana a las 3"\n• Pendientes de una persona — "¿qué tiene pendiente Ángel?"\n• Consultar el segundo cerebro — "¿en qué estamos?", "¿qué se hizo hoy?", el plan de NSG, promesas, informes y reuniones\n• Registrar solicitudes y asignarlas — "necesito … para el viernes"\n\nTodo por voz o texto. Lo que creo aparece al instante en el módulo ${tenant.mktLabel}, y el sistema persigue cada tarea hasta que se cierra (avisos 1h y 10min antes de vencer, y "¿ya pudiste comenzar?").`,
        buttons: [],
        error: null
      };
    }
    // Colaborador de área: mismo cerebro que marketing, pero su ayuda NO habla de
    // marcas ni de videos —eso es del mundo de Alex y solo lo confundiría—, sino
    // de su plan, sus pendientes y su bitácora. Va ANTES del bloque isMarketing.
    if (esColaborador && !options.callback_data && (wantsManual || wantsCapabilities)) {
      return {
        reply: "Esto es lo que puedo hacer por ti:\n\n• Decirte qué tienes hoy — \"¿qué tengo hoy?\"\n• Anotar tu reporte del día y tu Plan de Trabajo Semanal — \"hoy revisé las facturas de junio, 2 horas\" (también lo puedes escribir en **Actividades**, la primera sección al entrar)\n• Crear tus tareas — \"ponme una tarea: entregar el corte de caja el viernes a las 10\"\n• Avanzarlas — \"ya empecé el reporte\", \"ya terminé el corte\", \"pospón eso para mañana a las 3\"\n• Perseguir lo que vence — te aviso 1 hora antes, 10 minutos antes y a la hora exacta\n• Ver tus pendientes — \"¿qué tengo pendiente?\"\n• Adjuntar evidencia — con el botón de cámara subes la foto de lo que entregaste\n\nTodo por voz o texto, y lo que registro aparece al instante en tu espacio.",
        buttons: [],
        error: null
      };
    }
    if (isMarketing && !options.callback_data && (wantsManual || wantsCapabilities)) {
      return {
        reply: "Esto es lo que puedo hacer por ti:\n\n• Decirte qué tienes hoy — \"¿qué tengo hoy?\"\n• Crear tareas para el equipo — \"créale una tarea a Luis: editar Casa Banana para el viernes\"\n• Marcar tus tareas como hechas — \"ya terminé los copys\" (y ahí mismo te invito a subir la evidencia)\n• Mover propiedades del pipeline — \"mueve Bay View Grand 2 a lista\"\n• Registrar solicitudes de diseño — \"necesito un flyer AA para Mueblería el sábado\"\n• Asignar una solicitud — \"asígnale el flyer a Emmanuel\"\n• Cómo va el pipeline de videos — \"¿cómo van los videos?\"\n• Pendientes de una persona — \"¿qué tiene pendiente Emmanuel?\"\n• Pasarte el Drive de una propiedad — \"pásame el drive de Bay View Grand\"\n• La ficha de una propiedad — \"¿cómo va Casa Lago?\" te da su etapa, precio, tipo, fechas y todos sus enlaces\n• Guardar datos de una propiedad — \"los crudos de Casa Lago están en <enlace>\", \"el precio de X es 22 millones\", \"X se publicó el 25 de julio\" (esto reemplazó al Excel de grabaciones)\n• Anotar tu reporte de actividades — también lo puedes llenar en la sección **Actividades**, que es la primera al entrar — cuéntame qué hiciste (\"hoy edité Casa Lago 3 hrs y grabé en Brasa y Piedra\") y queda registrado tal cual; si me pasas el enlace de la carpeta, se lo agrego\n• Ver qué reportó el equipo — \"¿qué reportó el equipo hoy?\" o \"¿qué reportó Yazz ayer?\"\n• Adjuntar evidencia — con el botón de cámara del chat subes una foto o video de una tarea terminada\n\nSolo manejo lo de marketing (no clientes ni ventas). Todo por voz o texto, y lo que creo aparece al instante en tu módulo Marketing. El manual completo: [Manual de Marketing](https://app.stratoscapitalgroup.com/manual-marketing)",
        buttons: [
          { label: "Abrir Manual de Marketing", action: "https://app.stratoscapitalgroup.com/manual-marketing", isUrl: true, primary: true }
        ],
        error: null
      };
    }
    // Manual INMOBILIARIO (Duke y demás tenants de venta). Un tenant con cerebro
    // propio nunca debe llegar acá: si no declaró `copilotHelp`, que le conteste
    // su propio cerebro, no el manual de leads y Zooms.
    if (!options.callback_data && !tenant.customBrain && (wantsManual || wantsCapabilities)) {
      const reply = wantsCapabilities
        ? "🤖 **Esto es lo que puedo hacer por ti:**\n\n• Registrar clientes y mover su etapa (por nombre o por número: \"tercera etapa\")\n• Buscar una ficha por nombre o teléfono\n• Programar actividades para el equipo dictando varias de una vez — te muestro el plan y tú confirmas o corriges\n• Recordarte cada actividad con botones: 1 hora antes, 10 minutos antes y a la hora\n• Recomendarte propiedades según el presupuesto y la zona de un lead\n• Enviarte el catálogo y los drives por presupuesto o ubicación\n• Consultar la cartera de un asesor (si eres admin)\n• Recordatorios personales (\"recuérdame en 2 horas…\") y avisos de tus Zooms y visitas\n\nTodo por voz o texto — con el micrófono, Enter envía el audio. Aquí está el manual completo con ejemplos:"
        : "📖 **Manual Oficial del Asistente Stratos IA & Telegram**\n\nConsulta aquí todas las funcionalidades, comandos de voz y texto para sacarle el máximo partido al sistema:";
      return {
        reply,
        buttons: [
          { label: "📖 Abrir Manual Completo", action: "https://app.stratoscapitalgroup.com/manual-asistente-telegram", isUrl: true, primary: true }
        ],
        error: null
      };
    }
    // BOTONES DE RECORDATORIOS PROACTIVOS — paridad TOTAL con Telegram.
    // Todos los callbacks de proactivos los resuelve `copilot_handle_callback` en la DB
    // (el webhook del Copilot es solo audio→texto y NO orquesta estos estados; antes solo
    // estaba cableado "Ya estudié, este es mi plan" y el resto caía al webhook, que leía la
    // ETIQUETA como texto libre → "Ya lo contacté" salía sin cliente ("expediente de : .")
    // y "Ver ficha del cliente" caía en el catálogo). Cubre: Ya lo contacté · Ver ficha del
    // cliente · Reagendar · Sí listo/Posponer 30/Cancelar · Ya estudié este es mi plan ·
    // tareas de equipo (done/en proceso/no la hice). Devuelve {text, buttons} para reofrecer
    // los botones de seguimiento (ej. tras la ficha). El texto que el asesor escribe DESPUÉS
    // (la fecha para reagendar, o el plan) lo captura `copilot_handle_pending`, más abajo.
    if (!isMarketing && !tenant.customBrain && options.callback_data && /^(proact_inact|proact_next|proact_plan|proact_reagendar|team_action):/.test(options.callback_data)) {
      try {
        const { data: cb } = await supabase.rpc('copilot_handle_callback', { p_callback_data: options.callback_data });
        if (cb && typeof cb === 'object') {
          const text = typeof cb.text === 'string' ? cb.text : '';
          const buttons = Array.isArray(cb.buttons) ? cb.buttons : [];
          if (text || buttons.length) return { reply: text || 'Listo.', buttons, error: null };
        }
      } catch { /* si falla, cae al webhook normal */ }
    }

    // Si es un click en botón inline (callback_data), va directo al webhook (o RPC callback) sin evaluar QUICK_COMMANDS
    if (!options.callback_data && !isMarketing && !tenant.customBrain) {
      const lower = cleanText.toLowerCase();
      const QUICK_COMMANDS = [
        'mis clientes', 'qué tengo hoy', 'que tengo hoy', 'cómo voy', 'como voy',
        'pipeline', 'menú', 'menu', 'kpis', 'agenda'
      ];
      const isQuickCommand = QUICK_COMMANDS.includes(lower) ||
                             /^buscar\s+[a-záéíóúñ0-9\s]{2,18}$/i.test(cleanText);

      if (isQuickCommand) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('copilot_send', { p_text: cleanText });
          if (!rpcError && rpcData && typeof rpcData === 'string') {
            const isGenericError =
              rpcData.toLowerCase().includes('no conozco esa accion') ||
              rpcData.toLowerCase().includes('no conozco esa acción');
            if (!isGenericError) {
              return { reply: rpcData, error: null };
            }
          }
        } catch { /* RPC falló, caemos al webhook */ }
      }
    }

    // AWAITING_PLAN (paridad con Telegram): si el asesor tocó "Ya estudié, este es
    // mi plan", el próximo texto ES el plan → lo capturamos acá ANTES del webhook
    // (que lo trataría como una nota). Si no está en ese estado, devuelve null y
    // el mensaje sigue su curso normal. Cubre el plan de Zoom y el de próxima acción.
    if (!isMarketing && !tenant.customBrain && !options.callback_data && cleanText) {
      try {
        const { data: pendingReply } = await supabase.rpc('copilot_handle_pending', { p_text: cleanText });
        if (pendingReply && typeof pendingReply === 'string' && pendingReply.trim()) {
          return { reply: pendingReply, error: null };
        }
      } catch { /* si falla, sigue al webhook normal */ }
    }

    // Función auxiliar para neutralizar menú intrusivo en consultas libres
    const filterIntrusiveReply = (repText, repBtns) => {
      if (!repText || typeof repText !== 'string') return { reply: 'Listo.', buttons: [] };
      const l = repText.toLowerCase();
      const isIntrusive = l.includes('stratos assist') || l.includes('elige una opci') || l.includes('escríbeme libremente') || l.includes('no conozco esa acci');
      if (isIntrusive && !/^men[uú]$/i.test(cleanText) && !options.callback_data) {
        if (/clientes de|tiene|quién|quien|cuál|cual|cómo|como/i.test(cleanText)) {
          return {
            reply: `Estoy procesando tu consulta en el CRM: "${cleanText}". Puedes afinar la búsqueda por asesor o cliente en la sección **Personas / Buscar**, o preguntarme por un nombre o teléfono específico para abrir su ficha al instante.`,
            buttons: [
              { label: "👥 Ir a Fichas / Personas", action: "buscar", isUrl: false, primary: true },
              { label: "📖 Ver Manual Completo", action: "https://app.stratoscapitalgroup.com/manual-asistente-telegram", isUrl: true, primary: false }
            ]
          };
        }
        return {
          reply: `Anotado: "${cleanText}". Si deseas registrar un cliente, programar un recordatorio ("recuérdame en 15 minutos llamar a Juan") o ver tus pendientes, indícamelo en lenguaje natural o consulta el manual.`,
          buttons: []
        };
      }
      return { reply: repText, buttons: repBtns || [] };
    };

    // Webhook n8n con AI Agent GPT-4o o Router
    //
    // REINTENTO AUTOMÁTICO (3-ago, pedido de Ángel: «que eso no ocurra de nuevo»).
    // El cartel rojo «Tu mensaje no llegó al motor» salía ante cualquier hipo de
    // red o un 502/503 del proxy, y el asesor tenía que reescribir su pregunta.
    // Pero ese error significa, POR DEFINICIÓN, que el motor nunca recibió nada
    // — es la misma razón por la que el cartel dice «no se guardó nada». Si
    // reenviar es seguro para la persona, también lo es para nosotros: ahora se
    // reintenta solo (3 intentos, esperando 400 ms y 1,2 s) y el cartel queda
    // para cuando de verdad no se pudo.
    //
    // Lo que NUNCA se reintenta: un corte por tiempo (AbortError) y un 504. En
    // esos dos casos el motor SÍ tomó el mensaje y sigue trabajando; reenviar
    // ahí duplicaría la acción — justo el accidente del 29-jul con la tarea que
    // casi se crea dos veces.
    // Webhook por tenant: si el tenant declaró el suyo en la config, manda ese
    // — vale para NSG (cerebro de tareas) y para cualquier rubro nuevo (ej. la
    // clínica dental). Antes la condición exigía además `tasksBrain`, así que
    // un cerebro distinto de 'tareas' terminaba en el flujo de ventas aunque
    // tuviera webhook propio.
    const webhookUrl = tenant.webhook
      ? tenant.webhook
      : (isMarketing ? N8N_COPILOT_WEBHOOK_MKT : N8N_COPILOT_WEBHOOK);
    const esperaEntreIntentos = [400, 1200];
    for (let intento = 0; intento < 3; intento++) {
      try {
        const ctrl = new AbortController();
        // 40s para TODOS los cerebros (antes: 40s marketing / 15s ventas).
        //
        // El 29-jul Ángel escribió desde su cuenta de admin "asignale una tarea a
        // asesor prueba para que revise el asistente mañana a las 12" y vio
        // "El asistente IA está procesando tu solicitud, intenta de nuevo".
        // Pero en la base quedó: "Listo. Acción de equipo creada: revise el
        // asistente · responsable: Asesor Prueba · vence Mié 29 jul, 12:00 p.m."
        // O sea: FUNCIONÓ, y le dijimos que no. Volvió a mandarlo → casi crea la
        // tarea dos veces.
        //
        // El cerebro de ventas es más grande que el de marketing (más tools, más
        // ruteo): darle 15s cuando a marketing le dábamos 40 no tenía ninguna
        // razón, solo quedó así. Un aborto del cliente NO cancela el flujo: n8n
        // sigue corriendo del lado del servidor y guarda igual.
        const timeout = setTimeout(() => ctrl.abort(), 40000);
        // Webhook por tenant (NSG → su flujo Claude propio); si no hay override,
        // la ruta de siempre: marketing → cerebro mkt · resto → cerebro de ventas.
        const res = await fetch(webhookUrl, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: cleanText,
            callback_data: options.callback_data || undefined,
            original_type: options.callback_data ? "callback" : "text"
          })
        });
        clearTimeout(timeout);

        if (res.ok) {
          const raw = await res.text();
          if (raw && raw.length > 2) {
            try {
              const json = JSON.parse(raw);
              const reply = json?.reply || json?.output || (typeof json === 'string' ? json : null);
              if (reply && typeof reply === 'object') {
                const text = reply.text || reply.content || 'Listo.';
                const buttons = flatKeyboard(reply.inline_keyboard);
                const filtered = filterIntrusiveReply(text, buttons);
                return { reply: filtered.reply, buttons: filtered.buttons, error: null };
              }
              if (reply && typeof reply === 'string' && reply.length > 2) {
                const filtered = filterIntrusiveReply(reply, []);
                return { reply: filtered.reply, buttons: filtered.buttons, error: null };
              }
            } catch {
              if (raw.length > 5 && !raw.includes('<html')) {
                const filtered = filterIntrusiveReply(raw, []);
                return { reply: filtered.reply, buttons: filtered.buttons, error: null };
              }
            }
          }
          // Respondió bien pero sin nada aprovechable en el cuerpo: el motor lo
          // tomó igual, así que se sigue por el camino "slow" (no se reintenta).
          break;
        }
        if (res.status === 504) break;   // el motor lo tomó y sigue → camino "slow"
        // 502/503 del proxy: el motor NO tomó el mensaje. Se reintenta.
        console.warn('[Copilot] el motor no tomó el mensaje (HTTP ' + res.status + '), intento ' + (intento + 1) + ' de 3');
      } catch (err) {
        console.warn('[Copilot] webhook error:', err?.name || err?.message, '· intento', intento + 1, 'de 3');
        // Abort (40s) = n8n SÍ recibió y sigue trabajando → camino "slow" (la
        // respuesta la deja el propio flujo en el historial). NO se reintenta.
        if (err?.name === 'AbortError') break;
        // Un fallo de RED: el POST murió en tránsito y el motor NUNCA lo recibió.
        // Se reintenta abajo; si se acaban los intentos, recién ahí se avisa.
      }
      // Llegar acá = este intento no entró al motor.
      if (intento === 2) return { reply: null, buttons: [], error: 'no_llego' };
      await new Promise((r) => setTimeout(r, esperaEntreIntentos[intento]));
      }

    // Fallback cuando el webhook no respondió a tiempo o dio error.
    //
    // Es el MISMO mensaje para todos los cerebros, y dice la verdad: el flujo
    // corre del lado del servidor aunque el cliente corte, así que lo más
    // probable es que la acción YA esté guardada. El mensaje viejo de ventas
    // ("intenta de nuevo en unos segundos") invitaba a repetir a ciegas — y el
    // 29-jul casi duplica una tarea que se había creado bien.
    //
    // Regla: cuando no sabemos si algo se guardó, se dice que NO sabemos y se
    // manda a mirar. Nunca se pide reintentar una acción que escribe.
    // Desde el 30-jul el motor GUARDA cada respuesta en el historial del chat
    // (fn_log_proactive_copilot) — aunque el cliente corte, la respuesta llega
    // sola al hilo. Por eso acá ya no se muestra ninguna disculpa: se avisa
    // `slow` y el chat recarga hasta que la respuesta aparezca.
    return { reply: null, buttons: [], error: null, slow: true };
  } catch (e) {
    return { reply: null, buttons: [], error: e?.message || 'Error de conexión' };
  }
}

/**
 * Desempareja el Telegram del perfil. El bot dejará de reconocer al usuario.
 * Útil si el asesor cambia de teléfono o quiere bloquear el acceso del bot.
 *
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function unpairTelegram() {
  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), GETSESSION_TIMEOUT, 'getSession')
    if (!session) return { ok: false, error: 'no_session' }

    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id:            null,
        telegram_pairing_code:       null,
        telegram_pairing_expires_at: null,
        telegram_paired_at:          null,
      })
      .eq('id', session.user.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e?.message || 'Error de conexión' }
  }
}
