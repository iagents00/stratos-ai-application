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

const N8N_COPILOT_WEBHOOK = "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-transcribe";

/**
 * COPILOT — envía un mensaje al asistente IA del CRM.
 *
 * Estrategia DEFINITIVA (15-jul v3):
 *   1. Si es un comando rápido conocido → RPC copilot_send (stratos-prod, ~100ms).
 *   2. Para TODO lo demás (texto libre, crear cliente, cambiar etapa, preguntas) →
 *      webhook de n8n (AI Agent con GPT-4o) y se LEE LA RESPUESTA DIRECTA del body.
 *      NO se llama a copilot_send para texto libre porque esa función SQL inserta
 *      "No conozco esa acción" en la DB instantáneamente.
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
        'pipeline', 'menú', 'menu', 'kpis', 'agenda', 'ayuda'
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
              const buttons = Array.isArray(reply.inline_keyboard)
                ? reply.inline_keyboard.flat().map(b => ({
                    label: b.text,
                    action: b.callback_data || b.text,
                    isUrl: !!b.url,
                    primary: true
                  }))
                : [];
              return { reply: text, buttons, error: null };
            }
            if (reply && typeof reply === 'string' && reply.length > 2) {
              return { reply, buttons: [], error: null };
            }
          } catch {
            if (raw.length > 5 && !raw.includes('<html')) {
              return { reply: raw, buttons: [], error: null };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Copilot] webhook error:', err?.name || err?.message);
    }

    return { reply: "El asistente IA está procesando. Intentá de nuevo en unos segundos.", buttons: [], error: null };
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
