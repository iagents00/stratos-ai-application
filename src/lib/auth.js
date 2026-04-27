/**
 * lib/auth.js — Autenticación con Supabase Auth
 * Misma interfaz { data, error } que antes.
 * Todas las funciones capturan errores de red y los devuelven de forma limpia.
 *
 * RESILIENCIA:
 *  · Toda llamada a Supabase tiene timeout de 8 segundos (TIMEOUT_MS).
 *    Si el servicio está caído o lento, devolvemos error claro en lugar
 *    de quedarnos cargando para siempre.
 *  · La sesión y los leads se cachean en localStorage 24h (CACHE_TTL_MS)
 *    para que un incidente de Supabase no tire la app completa.
 */
import { supabase } from './supabase'
import { logAuthEvent } from './audit'
import {
  isOfflineForced,
  signInOffline,
  getOfflineSession,
  signOutOffline,
} from './offline-mode'

// ── Configuración de resiliencia ──────────────────────────────────────
const TIMEOUT_MS   = 8000        // 8 segundos — más allá de eso, asumimos que Supabase está caído
const CACHE_TTL_MS = 24 * 60 * 60 * 1000   // 24 horas — sesión cacheada localmente
const SESSION_CACHE_KEY = 'stratos_session_cache'

/**
 * withTimeout(promise, ms, label) → resuelve con la promesa o rechaza
 * tras `ms` milisegundos con un error de timeout etiquetado.
 */
function withTimeout(promise, ms = TIMEOUT_MS, label = 'operación') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`__TIMEOUT__:${label}`)),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Mensaje amigable cuando el servicio no responde a tiempo.
 * Sin mencionar Supabase ni servicios técnicos — el asesor no debe
 * ver detalles de infraestructura.
 */
const TIMEOUT_MESSAGE = 'Servicio temporalmente lento. Intenta de nuevo en 1 minuto.'

/**
 * Detecta si un error vino del wrapper withTimeout.
 */
const isTimeoutError = (e) => e?.message?.startsWith?.('__TIMEOUT__')

// ── Caché local de sesión (modo degradado) ──────────────────────────
function saveSessionCache(profile) {
  try {
    localStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ profile, savedAt: Date.now() }),
    )
  } catch (_) { /* localStorage lleno o bloqueado — ignorar */ }
}

function readSessionCache() {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const { profile, savedAt } = JSON.parse(raw)
    if (Date.now() - savedAt > CACHE_TTL_MS) {
      localStorage.removeItem(SESSION_CACHE_KEY)
      return null
    }
    return profile
  } catch (_) {
    return null
  }
}

function clearSessionCache() {
  try { localStorage.removeItem(SESSION_CACHE_KEY) } catch (_) { /* noop */ }
}

// ── Usuario demo local — permite verificar la interfaz sin Supabase configurado ──
const DEMO_EMAIL    = 'demo@stratos.ai'
const DEMO_PASSWORD = 'demo2027'
const DEMO_USER = {
  id:     'demo-user-local',
  name:   'Usuario Demo',
  email:  DEMO_EMAIL,
  role:   'admin',
  phone:  null,
  isDemo: true,
}

export function seedDemoUser() {
  // No-op — usuarios viven en Supabase (o modo demo local)
}

export async function signIn(email, password) {
  // Modo demo local — siempre funciona sin necesitar Supabase
  if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
    sessionStorage.setItem('stratos_demo', '1')
    return { data: DEMO_USER, error: null }
  }

  // Modo offline forzado por el usuario (toggle manual)
  if (isOfflineForced()) {
    return signInOffline(email, password)
  }

  try {
    // Auth con timeout — si Supabase no responde en 8s, fallo claro
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      TIMEOUT_MS,
      'auth',
    )
    if (error) {
      logAuthEvent('LOGIN_FAIL', null, { email, reason: error.message })
      const msg = error.message?.toLowerCase() || ""
      if (msg.includes("invalid login credentials") || msg.includes("invalid email or password"))
        return { data: null, error: "Correo o contraseña incorrectos." }
      if (msg.includes("email not confirmed"))
        return { data: null, error: "Confirma tu correo antes de iniciar sesión." }
      if (msg.includes("too many requests"))
        return { data: null, error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }
      return { data: null, error: "Error al iniciar sesión. Verifica tus datos e inténtalo de nuevo." }
    }

    // Perfil con timeout — query simple a profiles SIN JOIN
    const { data: profile, error: profileError } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, name, role, phone, active, organization_id')
        .eq('id', data.user.id)
        .single(),
      TIMEOUT_MS,
      'profile',
    )

    if (profileError || !profile) {
      logAuthEvent('LOGIN_FAIL', data.user.id, { email, reason: 'profile_not_found' })
      return { data: null, error: 'No se encontró tu perfil. Contacta al administrador.' }
    }
    if (profile.active === false) {
      logAuthEvent('LOGIN_FAIL', data.user.id, { email, reason: 'account_disabled' })
      return { data: null, error: 'Cuenta desactivada. Contacta al administrador.' }
    }

    logAuthEvent('LOGIN', profile.id, { email, name: profile.name, role: profile.role })
    const sessionUser = {
      id:    profile.id,
      name:  profile.name,
      email: data.user.email,
      role:  profile.role,
      phone: profile.phone,
      organizationId: profile.organization_id,
    }
    // Cachear sesión 24h para resiliencia ante caídas futuras
    saveSessionCache(sessionUser)
    return { data: sessionUser, error: null }
  } catch (e) {
    if (isTimeoutError(e)) {
      // Supabase no responde — intentar modo offline automáticamente
      const offline = await signInOffline(email, password)
      if (offline.data) {
        // Marcar sesión como offline para que el resto de la app lo sepa
        return offline
      }
      return { data: null, error: TIMEOUT_MESSAGE }
    }
    return { data: null, error: 'Error de conexión. Verifica tu internet e inténtalo de nuevo.' }
  }
}

export async function signUp(name, email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'asesor' } },
    })
    if (error) return { data: null, error: error.message }

    logAuthEvent('SIGNUP', data.user?.id || null, { email, name, role: 'asesor' })
    return {
      data: {
        id:    data.user.id,
        name,
        email: data.user.email,
        role:  'asesor',
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: 'Error de conexión al registrarse. Inténtalo de nuevo.' }
  }
}

export async function signOut() {
  sessionStorage.removeItem('stratos_demo')
  signOutOffline()
  clearSessionCache()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      await logAuthEvent('LOGOUT', session.user.id, { email: session.user.email })
    }
    await withTimeout(supabase.auth.signOut(), TIMEOUT_MS, 'signOut')
  } catch (e) {
    console.warn('[Stratos] signOut error (ignorado):', e.message)
  }
  return { error: null }
}

export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=true`,
    })
    if (error) return { data: null, error: error.message }
    logAuthEvent('PASSWORD_RESET', null, { email })
    return {
      data: { message: 'Revisa tu correo — te enviamos el link para restablecer tu contraseña.' },
      error: null,
    }
  } catch (e) {
    return { data: null, error: 'Error de conexión. Verifica tu internet e inténtalo de nuevo.' }
  }
}

export async function getStoredSession() {
  // Recuperar sesión demo local tras un refresh
  if (sessionStorage.getItem('stratos_demo') === '1') {
    return DEMO_USER
  }

  // Recuperar sesión offline (modo emergencia)
  const offlineSession = getOfflineSession()
  if (offlineSession) return offlineSession

  try {
    // getSession() lee de localStorage (no toca red) → no le ponemos timeout
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      // Sin sesión activa de Supabase → limpiar caché vieja
      clearSessionCache()
      return null
    }

    // Query del perfil CON timeout — si Supabase está lento, usamos caché
    let profile
    try {
      const result = await withTimeout(
        supabase
          .from('profiles')
          .select('id, name, role, phone, active, organization_id')
          .eq('id', session.user.id)
          .single(),
        TIMEOUT_MS,
        'profile',
      )
      profile = result.data
    } catch (e) {
      if (isTimeoutError(e)) {
        // Supabase no respondió a tiempo — usar caché local si está vigente
        const cached = readSessionCache()
        if (cached && cached.id === session.user.id) {
          console.warn('[Stratos] Supabase lento, usando caché local de sesión')
          return { ...cached, _fromCache: true }
        }
      }
      throw e
    }

    if (!profile || profile.active === false) {
      clearSessionCache()
      return null
    }

    const sessionUser = {
      id:    profile.id,
      name:  profile.name,
      email: session.user.email,
      role:  profile.role,
      phone: profile.phone,
      organizationId: profile.organization_id,
    }
    saveSessionCache(sessionUser)
    return sessionUser
  } catch (e) {
    console.warn('[Stratos] getStoredSession error:', e.message)
    // Último recurso: si hay caché reciente, devolverla en modo degradado
    const cached = readSessionCache()
    if (cached) {
      console.warn('[Stratos] Devolviendo sesión cacheada por error de red')
      return { ...cached, _fromCache: true }
    }
    return null
  }
}

/* ── Funciones admin ─────────────────────────────────────── */
export async function adminGetAllUsers() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, phone, active, created_at')
      .order('created_at')
    return error ? [] : data
  } catch (e) {
    console.warn('[Stratos] adminGetAllUsers error:', e.message)
    return []
  }
}

export async function adminUpdateUser(id, updates) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  } catch (e) {
    return { data: null, error: 'Error de conexión al actualizar usuario.' }
  }
}

export async function adminDeleteUser(id, currentUserId) {
  if (id === currentUserId) return { error: 'No puedes desactivar tu propia cuenta.' }
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ active: false })
      .eq('id', id)
    return { error: error?.message ?? null }
  } catch (e) {
    return { error: 'Error de conexión al desactivar usuario.' }
  }
}

export function adminCreateUser() {
  return { data: null, error: 'Crear usuarios desde Supabase Dashboard → Authentication → Users' }
}
export function adminResetPassword() {
  return { data: null, error: 'Resetear desde Supabase Dashboard → Authentication → Users' }
}
