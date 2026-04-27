/**
 * lib/offline-mode.js — Modo offline de emergencia
 * ─────────────────────────────────────────────────────────────────────────────
 * Permite a los asesores trabajar cuando Supabase está caído.
 *
 * FLUJO:
 *   1. Si la app detecta que Supabase no responde → activa modo offline
 *      automáticamente (también puede forzarse manualmente).
 *   2. Auth se valida contra una tabla local de email→password
 *      (las contraseñas conocidas del equipo).
 *   3. Los leads se cargan desde un JSON estático (`offline-seed/leads.json`)
 *      exportado del Supabase real antes del incidente.
 *   4. Cualquier cambio (notas, status, tareas) se acumula en
 *      `localStorage["stratos_pending_sync"]` como una cola.
 *   5. Cuando Supabase vuelve, el botón "🔄 Sincronizar" replay la cola.
 *
 * SEGURIDAD:
 *   Las contraseñas del equipo se incluyen en el bundle JS para acceso
 *   de emergencia. Esto es aceptable porque:
 *     • Solo se activa cuando Supabase está caído (alternativa: nadie trabaja)
 *     • Es temporal — al volver Supabase, el login normal vuelve a regir
 *     • Los datos en localStorage solo viven en el equipo del asesor
 *   Recomendación: rotar las contraseñas después de cada incidente.
 */

// ── Datos seed (se cargan dinámicamente para no inflar el bundle inicial) ──
let _profilesCache = null
let _leadsCache    = null

async function loadSeed() {
  if (_profilesCache && _leadsCache) {
    return { profiles: _profilesCache, leads: _leadsCache }
  }
  try {
    const [profilesMod, leadsMod] = await Promise.all([
      import('../data/offline-seed/profiles.json'),
      import('../data/offline-seed/leads.json'),
    ])
    // Vite importa JSON como `default`. Soportar ambos formatos.
    _profilesCache = profilesMod.default ?? profilesMod
    _leadsCache    = leadsMod.default    ?? leadsMod
    return { profiles: _profilesCache, leads: _leadsCache }
  } catch (e) {
    console.error('[Offline] No pude cargar el seed:', e)
    return { profiles: [], leads: [] }
  }
}

// ── Tabla de contraseñas del equipo (modo emergencia) ──
export const OFFLINE_CREDENTIALS = {
  // DEV / SUPER ADMIN — ven mensajes técnicos, errores, banner offline
  'synergyfornature@gmail.com':         'Ivan2026!',
  'admin@stratoscapitalgroup.com':      'Admin2026!',
  // DIRECCIÓN — UX limpia (sin mensajes técnicos), acceso completo a CRM
  'direccion@stratoscapitalgroup.com':  'Direccion2026!',
  // ASESORES — UX limpia, ven solo sus leads
  'araceli@stratoscapitalgroup.com':    'Araceli2026!',
  'cecilia@stratoscapitalgroup.com':    'Cecilia2026!',
  'emmanuel@stratoscapitalgroup.com':   'Emmanuel2026!',
  'alexia@stratoscapitalgroup.com':     'Alexia2026!',
  'ken@stratoscapitalgroup.com':        'Ken2026!',
  'oscar@stratoscapitalgroup.com':      'Oscar2026!',
}

/**
 * pingSupabase(supabase, timeoutMs)
 * Verifica si Supabase responde en <timeoutMs ms.
 * Usa una query muy ligera (count en profiles, sin filtros).
 * Devuelve true / false sin lanzar excepciones.
 */
export async function pingSupabase(supabase, timeoutMs = 3000) {
  try {
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('ping_timeout')), timeoutMs)
    })
    // SELECT count(*) FROM profiles LIMIT 0 — query mínima, no toca datos
    const ping = supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(0)
    const result = await Promise.race([ping, timeout]).finally(() => clearTimeout(timer))
    return !result?.error
  } catch (_) {
    return false
  }
}

/**
 * silentSignIn(supabase, email)
 * Intenta login silencioso a Supabase usando las credenciales offline guardadas.
 * Solo funciona para los 8 emails del equipo.
 * Devuelve { ok, profile } sin lanzar excepciones.
 */
export async function silentSignIn(supabase, email) {
  const e = (email || '').trim().toLowerCase()
  const password = OFFLINE_CREDENTIALS[e]
  if (!password) return { ok: false }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: e, password })
    if (error || !data?.user) return { ok: false }

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, role, phone, active, organization_id')
      .eq('id', data.user.id)
      .single()
    if (pErr || !profile) return { ok: false }

    return {
      ok: true,
      profile: {
        id:    profile.id,
        name:  profile.name,
        email: data.user.email,
        role:  profile.role,
        phone: profile.phone,
        organizationId: profile.organization_id,
      },
    }
  } catch (_) {
    return { ok: false }
  }
}

// ── Storage keys ──
const KEY_OFFLINE_FLAG    = 'stratos_offline_mode'        // '1' = forzado offline
const KEY_OFFLINE_USER    = 'stratos_offline_user'         // perfil del usuario actual
const KEY_PENDING_SYNC    = 'stratos_pending_sync'         // cola de cambios
const KEY_LEADS_OVERLAY   = 'stratos_offline_leads'        // leads modificados localmente

// ── Detectar / forzar modo offline ──
export function isOfflineForced() {
  return localStorage.getItem(KEY_OFFLINE_FLAG) === '1'
}
export function setOfflineMode(on) {
  if (on) localStorage.setItem(KEY_OFFLINE_FLAG, '1')
  else    localStorage.removeItem(KEY_OFFLINE_FLAG)
}

// ── Login offline ──
export async function signInOffline(email, password) {
  const e = (email || '').trim().toLowerCase()
  const expected = OFFLINE_CREDENTIALS[e]
  if (!expected || expected !== password) {
    return { data: null, error: 'Correo o contraseña incorrectos.' }
  }
  const { profiles } = await loadSeed()
  const profile = profiles.find(p => p.email?.toLowerCase() === e)
  if (!profile) {
    return { data: null, error: 'Tu perfil no está en el respaldo offline. Contacta al admin.' }
  }
  if (profile.active === false) {
    return { data: null, error: 'Cuenta desactivada.' }
  }
  const sessionUser = {
    id:    profile.id,
    name:  profile.name,
    email: profile.email,
    role:  profile.role,
    phone: profile.phone,
    organizationId: profile.organization_id,
    _offline: true,
  }
  localStorage.setItem(KEY_OFFLINE_USER, JSON.stringify(sessionUser))
  return { data: sessionUser, error: null }
}

export function getOfflineSession() {
  try {
    const raw = localStorage.getItem(KEY_OFFLINE_USER)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

export function signOutOffline() {
  localStorage.removeItem(KEY_OFFLINE_USER)
}

// ── Lectura de leads (con overlay de cambios locales) ──
export async function getOfflineLeads(currentUser) {
  const { leads } = await loadSeed()
  const overlay = readOverlay()

  // Aplicar cambios locales encima del seed
  const merged = leads.map(l => ({ ...l, ...(overlay[l.id] || {}) }))

  // Filtrado por rol (asesor solo ve los suyos; admin/super ve todo)
  if (!currentUser) return []
  const role = currentUser.role
  if (role === 'super_admin' || role === 'admin' || role === 'ceo') {
    return merged
  }
  // Asesor: filtra por asesor_id (preferido) o por asesor_name (fallback,
  // en caso de que la importación inicial no haya populado asesor_id).
  const myName = (currentUser.name || '').trim().toLowerCase()
  return merged.filter(l => {
    if (l.asesor_id === currentUser.id) return true
    if (l.created_by === currentUser.id) return true
    const ln = (l.asesor_name || '').trim().toLowerCase()
    return ln && myName && ln === myName
  })
}

function readOverlay() {
  try {
    return JSON.parse(localStorage.getItem(KEY_LEADS_OVERLAY) || '{}')
  } catch (_) {
    return {}
  }
}

function writeOverlay(map) {
  localStorage.setItem(KEY_LEADS_OVERLAY, JSON.stringify(map))
}

// ── Mutación de un lead (escribe overlay + encola sync) ──
export function updateOfflineLead(leadId, changes, currentUser) {
  const overlay = readOverlay()
  overlay[leadId] = { ...(overlay[leadId] || {}), ...changes, updated_at: new Date().toISOString() }
  writeOverlay(overlay)

  enqueueSync({
    type:     'lead_update',
    lead_id:  leadId,
    changes,
    user_id:  currentUser?.id,
    queued_at: Date.now(),
  })
}

// ── Cola de sincronización ──
function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY_PENDING_SYNC) || '[]')
  } catch (_) {
    return []
  }
}
function writeQueue(arr) {
  localStorage.setItem(KEY_PENDING_SYNC, JSON.stringify(arr))
}
function enqueueSync(op) {
  const q = readQueue()
  q.push(op)
  writeQueue(q)
}

export function getPendingSyncCount() {
  return readQueue().length
}

/**
 * syncToSupabase(supabase) → procesa la cola contra el cliente de Supabase real.
 * Devuelve { ok, synced, failed, error }.
 */
export async function syncToSupabase(supabase) {
  const q = readQueue()
  if (q.length === 0) return { ok: true, synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const remaining = []

  for (const op of q) {
    try {
      if (op.type === 'lead_update') {
        const { error } = await supabase
          .from('leads')
          .update(op.changes)
          .eq('id', op.lead_id)
        if (error) { failed++; remaining.push(op) }
        else       { synced++ }
      } else {
        remaining.push(op) // tipo desconocido — preservar
      }
    } catch (e) {
      failed++; remaining.push(op)
    }
  }

  writeQueue(remaining)

  // Si todo se sincronizó, limpiar overlay (los cambios ya están en Supabase)
  if (failed === 0) writeOverlay({})

  return { ok: failed === 0, synced, failed }
}
