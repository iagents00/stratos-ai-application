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
    if (error) return { messages: [], error: error.message }
    return { messages: Array.isArray(data) ? data : [], error: null }
  } catch (e) {
    return { messages: [], error: e?.message || 'Error de conexión' }
  }
}

const N8N_TELEGRAM_BOT_WEBHOOK = "https://personal-n8n.suwsiw.easypanel.host/webhook/3acfc71b-4861-4f8a-a7fa-a27459372fc7";

/**
 * COPILOT — envía un mensaje al asistente (mismo cerebro que el bot de Telegram).
 * El RPC copilot_send resuelve comandos rápidos deterministas (mis clientes, agenda,
 * kpis, pipeline, menu). Si el texto es libre, NLU, audios o preguntas complejas
 * (ej. manual de ventas, recomendaciones, crear cliente, confirmar), derivamos
 * al webhook de n8n (@Strato_sasistente_crm_bot) y consultamos vía getCopilotActivity
 * para eliminar el error "No conozco esa accion" y evitar errores 400/CORS.
 *
 * @param {string} text
 * @returns {Promise<{ reply: string|null, error: string|null }>}
 */
export async function sendCopilotMessage(text) {
  const cleanText = (text || "").trim();
  if (!cleanText) return { reply: null, error: null };

  try {
    const { data: { session } } = await withTimeout(supabase.auth.getSession(), GETSESSION_TIMEOUT, 'getSession');
    if (!session?.user?.id) return { reply: "Sesión expirada.", error: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', session.user.id)
      .single();

    if (!profile?.telegram_chat_id) return { reply: null, error: 'not_paired' };
    const chatId = Number(profile.telegram_chat_id);

    // Lista estricta de comandos deterministas que sí maneja copilot_send sin LLM
    const QUICK_COMMANDS = [
      'mis clientes', 'qué tengo hoy', 'que tengo hoy', 'cómo voy', 'como voy',
      'pipeline', 'menú', 'menu', 'kpis', 'agenda', 'buscar', 'ayuda'
    ];
    const isQuick = QUICK_COMMANDS.includes(cleanText.toLowerCase()) ||
                    /^buscar\s+[a-z0-9\s]{2,18}$/i.test(cleanText);

    if (isQuick) {
      const { data, error } = await supabase.rpc('copilot_send', { p_text: cleanText });
      if (error) return { reply: null, error: error.message };
      if (data === '__NOT_PAIRED__') return { reply: null, error: 'not_paired' };
      const replyText = typeof data === 'string' ? data : '';
      if (replyText && !replyText.toLowerCase().includes('no conozco esa accion') && !replyText.toLowerCase().includes('no conozco esa acción')) {
        return { reply: replyText, error: null };
      }
    } else {
      // Llamamos a copilot_send para que registre el intento en DB de forma segura (sin error 400 direct insert)
      try { await supabase.rpc('copilot_send', { p_text: cleanText }); } catch { /* noop */ }
    }

    // Disparamos el webhook del cerebro de IA en n8n usando mode 'no-cors' y text/plain
    // para evitar que el navegador bloquee la petición con preflight OPTIONS/CORS policy.
    try {
      await fetch(N8N_TELEGRAM_BOT_WEBHOOK, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          message: {
            from: { id: chatId },
            chat: { id: chatId },
            text: cleanText
          }
        })
      });
    } catch { /* noop */ }

    // Polling inteligente consultando vía RPC getCopilotActivity (Cero error 400)
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(r => setTimeout(r, 640));
      const { messages: recentList } = await getCopilotActivity(6);
      if (Array.isArray(recentList) && recentList.length > 0) {
        const newestAi = recentList.find(m => m.role === 'ai');
        if (newestAi && newestAi.content && !newestAi.content.toLowerCase().includes('no conozco esa accion') && !newestAi.content.toLowerCase().includes('no conozco esa acción')) {
          return { reply: newestAi.content, error: null };
        }
      }
    }

    // Si el LLM tarda un poco más en n8n (>3.2s), dejamos un mensaje de progreso elegante
    const progressMsg = "⚡ Procesando tu instrucción con el asistente IA en la nube (la respuesta aparecerá aquí y en Telegram en un momento)...";
    return { reply: progressMsg, error: null };
  } catch (e) {
    return { reply: null, error: e?.message || 'Error de conexión' };
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
