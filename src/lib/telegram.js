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
      { label: 'Ya lo contacte', action: `proact_inact:contacte:${leadId}`, primary: true },
      { label: 'Reagendar seguimiento', action: `proact_inact:reagendar:${leadId}`, primary: false },
      { label: 'Ver ficha del cliente', action: `proact_inact:ficha:${leadId}`, primary: false },
    ]
  }

  if (tipo === 'next_action_10min') {
    return [
      { label: 'Si, listo', action: `proact_next:listo:${leadId}`, primary: true },
      { label: 'Posponer 30 min', action: `proact_next:posponer30:${leadId}`, primary: false },
      { label: 'Cancelar', action: `proact_next:cancelar:${leadId}`, primary: false },
    ]
  }

  if (tipo === 'zoom_brief' || tipo === 'next_action_3h' || tipo.startsWith('next_action')) {
    return [
      { label: 'Ya estudie, este es mi plan', action: `proact_plan:${leadId}`, primary: true },
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

  if (tipo === 'team_action') {
    const due = payload.due_at ? new Date(payload.due_at) : null
    const dueTxt = due && !Number.isNaN(due.getTime())
      ? due.toLocaleString('es-MX', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'hora programada'
    return [
      `Hola ${reminder?.asesor_name || 'Admin Stratos'} - Recordatorio de tu agenda:`,
      '',
      `Tarea: ${text || 'Tarea pendiente'}`,
      `Vence: ${dueTxt}`,
      '',
      'Como vas?',
    ].join('\n')
  }

  if (tipo === 'next_action_10min') {
    return `Estas listo y preparado para la accion con ${payload.lead_name || 'tu cliente'}?\nAccion: ${text || 'sin descripcion'}`
  }

  if (text) return `STRATOS ASISTENTE Recordatorio:\n${text}`
  if (tipo === 'inactividad' || tipo === 'inactividad_insist') return 'IMPORTANTE\n\nTienes un cliente sin movimiento; revisalo en el CRM.'
  if (tipo === 'zoom_brief' || tipo.startsWith('next_action')) return 'Tienes una alerta proactiva del asistente.'
  return ''
}

function attachReminderToMessages(messages, reminderMessage) {
  const buttons = reminderMessage.buttons || []
  const content = reminderMessage.content || ''
  const textProbe = String(reminderMessage.probe || content).trim()
  const reminderTime = new Date(reminderMessage.occurred_at || 0).getTime()

  let idx = messages.findIndex((m) =>
    m.role === 'ai' &&
    m.content &&
    (m.content === content || (textProbe && m.content.includes(textProbe)))
  )

  if (idx < 0 && buttons.length && reminderTime) {
    idx = messages.findIndex((m) => {
      if (m.role !== 'ai' || !m.occurred_at || Array.isArray(m.buttons)) return false
      const delta = Math.abs(new Date(m.occurred_at).getTime() - reminderTime)
      return delta <= 10 * 60 * 1000
    })
  }

  if (idx >= 0) {
    if (buttons.length && (!Array.isArray(messages[idx].buttons) || messages[idx].buttons.length === 0)) {
      messages[idx] = { ...messages[idx], buttons }
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

    if (error) return { paired: false, pairedAt: null, error: error.message }

    return {
      paired:   data?.telegram_chat_id != null,
      pairedAt: data?.telegram_paired_at || null,
      error:    null,
    }
  } catch (e) {
    return { paired: false, pairedAt: null, error: e?.message || 'Error de conexión' }
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
export async function getCopilotActivity(limit = 40) {
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
                probe: txt
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

    return { messages: messages.slice(0, limit), error: null }
  } catch (e) {
    return { messages: [], error: e?.message || 'Error de conexión' }
  }
}

const N8N_COPILOT_WEBHOOK = "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-transcribe";

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
  const cleanText = (rawText || "").trim();
  if (!cleanText && !options.callback_data) return { reply: null, error: null };

  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), GETSESSION_TIMEOUT, 'getSession');
    if (!session?.user?.id) return { reply: "Sesión expirada.", error: null };

    // 1. Detección directa de solicitud de manual / guía / instrucciones
    if (!options.callback_data && /^(?:dame |mandame |enviame |enviar |ver |mostrar |necesito |pasame )?(?:el |la )?(?:manual|guía|guia|instrucciones|ayuda)(?:\s|$)/i.test(cleanText)) {
      return {
        reply: "📖 **Manual Oficial del Asistente Stratos IA & Telegram**\n\nConsulta aquí todas las funcionalidades, comandos de voz y texto para sacarle el máximo partido al sistema:",
        buttons: [
          { label: "📖 Abrir Manual Completo", action: "https://app.stratoscapitalgroup.com/manual-asistente-telegram", isUrl: true, primary: true }
        ],
        error: null
      };
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', session.user.id)
      .single();

    if (!profile?.telegram_chat_id) return { reply: null, error: 'not_paired' };
    const chatId = Number(profile.telegram_chat_id);

    // Si es un click en botón inline (callback_data), va directo al webhook (o RPC callback) sin evaluar QUICK_COMMANDS
    if (!options.callback_data) {
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
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(N8N_COPILOT_WEBHOOK, {
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
      }
    } catch (err) {
      console.warn('[Copilot] webhook error:', err?.name || err?.message);
    }

    return { reply: "El asistente IA está procesando tu solicitud. Por favor intenta de nuevo en unos segundos.", buttons: [], error: null };
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
