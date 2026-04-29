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

/**
 * Lee el estado actual de pareo del usuario autenticado.
 * Usa SELECT directo (RLS profiles_select_own ya permite leer el propio perfil).
 *
 * @returns {Promise<{ paired: boolean, pairedAt: string|null, error: string|null }>}
 */
export async function getPairingStatus() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
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
 * Desempareja el Telegram del perfil. El bot dejará de reconocer al usuario.
 * Útil si el asesor cambia de teléfono o quiere bloquear el acceso del bot.
 *
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function unpairTelegram() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
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
