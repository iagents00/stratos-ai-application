/**
 * lib/dev-monitor.js — Monitoreo de errores para el equipo dev
 * ─────────────────────────────────────────────────────────────────────────────
 * Captura errores críticos del cliente (window.onerror, unhandled promises,
 * console.error) y los envía a Telegram para que el equipo dev se entere
 * antes que los usuarios reporten problemas.
 *
 * SETUP (5 minutos):
 *   1. Crear bot en Telegram:
 *      • Abrir https://t.me/BotFather
 *      • Comando /newbot → seguir instrucciones
 *      • Guardar el TOKEN que devuelve (ej: 1234567890:ABC-DEF...)
 *
 *   2. Obtener tu CHAT_ID:
 *      • Abrir conversación con @userinfobot en Telegram
 *      • Te devuelve tu chat_id (ej: 987654321)
 *      • Mandar /start a tu bot creado para "activarlo"
 *
 *   3. Configurar como variables de entorno en Vercel:
 *      • Vercel Dashboard → Settings → Environment Variables
 *      • Add: VITE_TELEGRAM_BOT_TOKEN = <tu token>
 *      • Add: VITE_TELEGRAM_CHAT_ID   = <tu chat_id>
 *      • Redeploy
 *
 * COMPORTAMIENTO:
 *   · Solo se activa en producción (import.meta.env.PROD).
 *   · Solo notifica si las variables están configuradas.
 *   · Throttling: máximo 1 alerta del mismo error cada 5 minutos
 *     (evita spam si un error se dispara muchas veces).
 *   · No bloquea la app si Telegram falla (silent catch).
 *
 * USO:
 *   Se inicializa una vez en main.jsx con initDevMonitor().
 *   Después captura errores automáticamente sin intervención.
 */

const TELEGRAM_TOKEN = import.meta.env?.VITE_TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT  = import.meta.env?.VITE_TELEGRAM_CHAT_ID

// Throttle: clave = mensaje, valor = timestamp de último envío
const sentRecently = new Map()
const THROTTLE_MS = 5 * 60 * 1000   // 5 minutos

function shouldSend(message) {
  const key = (message || '').slice(0, 80)
  const last = sentRecently.get(key)
  const now  = Date.now()
  if (last && now - last < THROTTLE_MS) return false
  sentRecently.set(key, now)
  // Limpieza: borrar entradas viejas para no crecer indefinido
  if (sentRecently.size > 50) {
    for (const [k, ts] of sentRecently) {
      if (now - ts > THROTTLE_MS) sentRecently.delete(k)
    }
  }
  return true
}

/**
 * Envía un mensaje a Telegram. Silent fail si no hay credenciales o falla la red.
 */
export async function notifyTelegram(text, opts = {}) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return false
  if (!shouldSend(text)) return false

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...opts,
      }),
    })
    return true
  } catch (_) {
    return false
  }
}

/**
 * Formatea un error con contexto útil para el equipo dev.
 */
function formatError(type, error, extra = {}) {
  const time = new Date().toLocaleString('es-MX', { timeZone: 'America/Cancun' })
  const url  = window.location.href
  const ua   = navigator.userAgent.slice(0, 80)
  const msg  = (error?.message || error || 'Sin mensaje').toString().slice(0, 500)
  const stack = (error?.stack || '').toString().slice(0, 800)

  return [
    `🚨 <b>Stratos AI · ${type}</b>`,
    `⏰ ${time}`,
    `🌐 ${url}`,
    `🧑 ${extra.userEmail || 'sin sesión'}${extra.userRole ? ` (${extra.userRole})` : ''}`,
    ``,
    `<b>Error:</b>`,
    `<code>${msg}</code>`,
    stack ? `\n<b>Stack:</b>\n<code>${stack}</code>` : '',
    `\n<i>${ua}</i>`,
  ].filter(Boolean).join('\n')
}

/**
 * initDevMonitor() — instala los handlers globales.
 * Llamar una vez al inicio de la app (main.jsx).
 */
export function initDevMonitor(getUserContext = () => ({})) {
  if (!import.meta.env.PROD) return     // Solo en producción
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) {
    console.info('[dev-monitor] Telegram no configurado, monitoreo deshabilitado')
    return
  }

  // Errores no manejados de JavaScript
  window.addEventListener('error', (event) => {
    const ctx = getUserContext()
    notifyTelegram(formatError('Error JS', event.error || event.message, ctx))
  })

  // Promesas rechazadas sin .catch
  window.addEventListener('unhandledrejection', (event) => {
    const ctx = getUserContext()
    notifyTelegram(formatError('Promise rechazada', event.reason, ctx))
  })

  // Notificación de inicio (solo en primer load)
  notifyTelegram(`✅ <b>Stratos AI</b> iniciado · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Cancun' })}`)
}

/**
 * Helper para reportar manualmente eventos importantes (no errores).
 *   notifyEvent('LOGIN_FAIL', { email, reason })
 *   notifyEvent('IA_QUOTA_EXCEEDED', { tokens })
 */
export function notifyEvent(eventName, payload = {}, level = 'info') {
  const emoji = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : 'ℹ️'
  const time  = new Date().toLocaleString('es-MX', { timeZone: 'America/Cancun' })
  const text  = [
    `${emoji} <b>${eventName}</b>`,
    `⏰ ${time}`,
    Object.entries(payload).map(([k, v]) => `<b>${k}:</b> <code>${String(v).slice(0, 200)}</code>`).join('\n'),
  ].filter(Boolean).join('\n')
  notifyTelegram(text)
}
