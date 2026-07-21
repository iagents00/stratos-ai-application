/**
 * lib/auth.js — Autenticación con Supabase Auth
 * Misma interfaz { data, error } que antes.
 * Todas las funciones capturan errores de red y los devuelven de forma limpia.
 *
 * ⚠️  ZONA CRÍTICA — NO TOCAR sin leer CLAUDE.md → "ZONA CRÍTICA — CONFIG DE
 *     AUTH ESTABLE". Estos timeouts se calibraron para resolver el cuelgue
 *     del SDK que causaba "se sale al F5 y queda en Conectando..." en TODOS
 *     los navegadores. Cambiarlos puede regresar el bug.
 *
 * RESILIENCIA (valores calibrados Mayo 2026, SW v12):
 *  · GETSESSION_TIMEOUT = 3.5s — supabase.auth.getSession() puede colgarse
 *    >25s sin esto (auto-refresh interno + lock del SDK bloquea TODO el flujo).
 *  · PROFILE_TIMEOUT = 5s — query SELECT profiles tras getSession.
 *  · AUTH_TIMEOUT_MS = 20s — signInWithPassword (tolerar redes lentas).
 *  · TIMEOUT_MS = 8s — queries normales.
 *  · CACHE_TTL_MS = 30 días — sesión cacheada localmente. Si getSession/profile
 *    fallan o tardan, fallback a esta caché (_fromCache: true) en lugar de
 *    tirar al user al LoginScreen. (Era 24h → los usuarios de la app instalada
 *    quedaban en login tras un día sin abrir + una red lenta; 2026-07-17.)
 */
import { supabase } from './supabase'
import { logAuthEvent } from './audit'
import {
  isOfflineForced,
  signInOffline,
  getOfflineSession,
  signOutOffline,
  clearOfflineSession,
} from './offline-mode'

// ── Configuración de resiliencia ──────────────────────────────────────
// 12s cubre el cold-start de Supabase free tier (instancia dormida tras
// inactividad despierta en ~6-10s). Si supera eso, asumimos caída real.
//
// IMPORTANTE: estos timeouts cubren NETWORK RTT, no solo procesamiento de
// Supabase. Usuarios en redes lentas (móvil, wifi público, VPN) pueden
// tardar 20-30s en recibir la respuesta aunque el servidor responda en
// <500ms. Los logs de Supabase confirmaron que auth se completa siempre,
// pero el cliente cortaba a los 18s pensando que había timeout.
const TIMEOUT_MS         = 8000              // queries normales (read profile, leads)
const AUTH_TIMEOUT_MS    = 20000              // signInWithPassword: tolerar redes lentas
const GETSESSION_TIMEOUT = 3500               // supabase.auth.getSession() — solo lee storage + posible refresh interno
const PROFILE_TIMEOUT    = 5000               // SELECT profiles.* tras getSession
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000   // 30 días — la app instalada NO debe pedir login por pausas largas; el logout real es SIGNED_OUT (explícito), no el paso del tiempo
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
const TIMEOUT_MESSAGE = 'La conexión está tardando. Vuelve a intentar en unos segundos.'

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

/**
 * readSessionFromStorageSync() — lectura SÍNCRONA de la sesión cacheada.
 * Usada por AuthContext para inicializar `user` en el primer render del F5,
 * evitando que el usuario vea el LoginScreen mientras getStoredSession() hace
 * su trabajo asíncrono (3-5 s).
 *
 * Prioridad: demo > offline > caché Stratos (24h TTL).
 *
 * IMPORTANTE: nunca toca la red. Si el resultado no coincide con la sesión
 * real de Supabase, getStoredSession() lo corrige al terminar la hidratación
 * asíncrona en background.
 */
export function readSessionFromStorageSync() {
  try {
    if (sessionStorage.getItem('stratos_demo') === '1') {
      return DEMO_USER
    }
  } catch (_) { /* sessionStorage bloqueado */ }

  try {
    const offlineRaw = localStorage.getItem('stratos_offline_user')
    if (offlineRaw) {
      const parsed = JSON.parse(offlineRaw)
      if (parsed && parsed.id) return parsed
    }
  } catch (_) { /* noop */ }

  try {
    const cacheRaw = localStorage.getItem(SESSION_CACHE_KEY)
    if (!cacheRaw) return null
    const { profile, savedAt } = JSON.parse(cacheRaw)
    if (!profile || !profile.id) return null
    if (Date.now() - savedAt > CACHE_TTL_MS) return null
    return { ...profile, _fromCache: true }
  } catch (_) {
    return null
  }
}

/**
 * hasSupabaseAuthToken() — detecta SÍNCRONAMENTE si hay un JWT de Supabase
 * en localStorage. Indica "probablemente hay sesión válida", aunque la caché
 * Stratos haya expirado (24h) o el usuario sea de otro dispositivo.
 *
 * Usado para decidir si mostrar splash (hidratación probable) vs LoginScreen
 * (sin sesión) durante el primer render tras un F5.
 */
export function hasSupabaseAuthToken() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (/^sb-.*-auth-token$/.test(k)) return true
    }
  } catch (_) { /* noop */ }
  return false
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
    // Auth con timeout dedicado (18s — cubre cold start sin hacer
    // esperar al usuario eternamente). El warm-up de LoginScreen
    // mantiene la conexión caliente, así que en uso normal responde <3s.
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      AUTH_TIMEOUT_MS,
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
        .select('id, name, role, phone, active, organization_id, is_marketing_admin, view_all_leads, crm_only, crm_prefs')
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
      // Admin de MARKETING (ej. Alex): aunque sea super_admin, su casa es marketing.
      // Restringe su navegación a los módulos de marketing (ver navigation.js).
      isMarketingAdmin: profile.is_marketing_admin === true,
      viewAllLeads:   profile.view_all_leads === true,
      // Si crm_only=true, el usuario solo accede al módulo CRM + Perfil.
      // Usado para cuentas tipo bot/IA (iagents@stratos.ai) que no necesitan
      // los módulos admin pero conservan su rol para operaciones del CRM.
      crmOnly:        profile.crm_only === true,
      // crm_prefs vive en Supabase: pin, orden, descartados sobreviven entre dispositivos.
      crmPrefs:       profile.crm_prefs && typeof profile.crm_prefs === 'object' ? profile.crm_prefs : {},
    }
    // Cachear sesión 24h para resiliencia ante caídas futuras
    saveSessionCache(sessionUser)
    // Limpiar la sesión "offline" si quedó residual de un intento anterior —
    // así getStoredSession() en el siguiente refresh prefiere la sesión real
    // de Supabase y no nos deja atrapados en modo degradado.
    clearOfflineSession()
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

export async function signUp(name, email, password, recoveryEmail = '') {
  try {
    // El correo de recuperación se guarda en la metadata; el trigger handle_new_user
    // lo copia a profiles.recovery_email al crear el perfil (migración 055).
    const meta = { name, role: 'asesor' }
    const cleanRecovery = String(recoveryEmail || '').trim().toLowerCase()
    if (cleanRecovery) meta.recovery_email = cleanRecovery
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
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
    // CRITICAL: getSession() puede colgarse si el SDK trata de hacer auto-refresh
    // del access_token y el endpoint refresh tarda. Sin timeout, queda esperando
    // y bloquea TODO el lock interno del SDK → ningún signInWithPassword posterior
    // puede progresar ("Conectando con el servidor..." indefinido).
    // 3.5s es suficiente para una lectura de localStorage + refresh exitoso;
    // si tarda más, asumimos refresh atascado y caemos a la caché de 24h.
    let session = null
    try {
      const result = await withTimeout(
        supabase.auth.getSession(),
        GETSESSION_TIMEOUT,
        'getSession',
      )
      session = result?.data?.session ?? null
    } catch (e) {
      if (isTimeoutError(e)) {
        console.warn('[Stratos] getSession atascado >3.5s — uso caché local')
        const cached = readSessionCache()
        if (cached) return { ...cached, _fromCache: true }
        return null
      }
      throw e
    }

    if (!session) {
      // getSession sin sesión puede ser un LOGOUT real… o un refresh fallido por
      // red móvil (radio dormida, DNS, túnel al abrir la PWA). Distinguir por la
      // LLAVE persistida: si el token sb-*-auth-token sigue en storage, el usuario
      // NUNCA cerró sesión → devolver la caché local y dejar que el SDK reintente
      // el refresh en background. El logout REAL lo limpia el listener de
      // SIGNED_OUT/USER_DELETED (AuthContext), no este camino.
      let hasStoredToken = false
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) { hasStoredToken = true; break }
        }
      } catch (_) { /* noop */ }
      if (hasStoredToken) {
        const cached = readSessionCache()
        if (cached) {
          console.warn('[Stratos] Sesión aún no restaurada (¿refresh fallido por red?) — uso caché local')
          return { ...cached, _fromCache: true }
        }
      }
      clearSessionCache()
      return null
    }

    // Query del perfil con timeout corto (5s). Si tarda más, usar caché.
    let profile
    try {
      const result = await withTimeout(
        supabase
          .from('profiles')
          .select('id, name, role, phone, active, organization_id, is_marketing_admin, view_all_leads, crm_only, crm_prefs')
          .eq('id', session.user.id)
          .single(),
        PROFILE_TIMEOUT,
        'profile',
      )
      profile = result.data
    } catch (e) {
      if (isTimeoutError(e)) {
        // Supabase no respondió a tiempo — usar caché local si está vigente
        const cached = readSessionCache()
        if (cached && cached.id === session.user.id) {
          console.warn('[Stratos] Profile query lento, uso caché local')
          return { ...cached, _fromCache: true }
        }
      }
      throw e
    }

    // Sesión Supabase válida pero perfil null/error: puede ser RLS
    // transitorio (token aún propagándose tras un refresh), error de red
    // momentáneo, o profile realmente borrado. Si tenemos caché vigente,
    // preferimos eso a tirar al user al login. Solo si profile.active
    // viene explícitamente false (cuenta desactivada) limpiamos caché.
    if (!profile) {
      const cached = readSessionCache()
      if (cached && cached.id === session.user.id) {
        console.warn('[Stratos] Perfil no resuelto, devuelvo caché')
        return { ...cached, _fromCache: true }
      }
      return null
    }
    if (profile.active === false) {
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
      // Admin de MARKETING (ej. Alex): aunque sea super_admin, su casa es marketing.
      // Restringe su navegación a los módulos de marketing (ver navigation.js).
      isMarketingAdmin: profile.is_marketing_admin === true,
      viewAllLeads:   profile.view_all_leads === true,
      crmOnly:        profile.crm_only === true,
      crmPrefs:       profile.crm_prefs && typeof profile.crm_prefs === 'object' ? profile.crm_prefs : {},
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
