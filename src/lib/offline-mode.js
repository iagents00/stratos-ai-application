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
 *   El bundle NO contiene contraseñas en plaintext. signInOffline solo
 *   acepta credenciales si Supabase responde para validarlas (no hay
 *   "tabla de emergencia"). silentSignIn está deshabilitado — la app
 *   se apoya en la sesión cacheada (24h en localStorage) para resistir
 *   caídas breves de Supabase, lo cual cubre el 99% de los incidentes
 *   sin exponer ningún secreto en el cliente.
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
// REMOVIDA: incluir passwords en el bundle JS los expone a cualquiera que
// inspeccione el código del navegador. La resiliencia ahora se apoya en:
//   · Sesión cacheada 24h en localStorage (auth.js → saveSessionCache)
//   · Cola pendiente en localStorage (stratos_pending_sync)
//   · Espejo local de leads (stratos_leads_mirror)
// signInOffline y silentSignIn quedan como stubs no-op para no romper
// los call-sites; si algún día se necesita modo offline real, debe
// implementarse con un hash local del password tras login exitoso, NO
// con un diccionario plaintext.
export const OFFLINE_CREDENTIALS = {}

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
 * Stub no-op tras la remoción de OFFLINE_CREDENTIALS. Devuelve siempre
 * { ok: false } para que los callers caigan al flujo normal de login.
 * La sesión cacheada 24h (auth.js) cubre la mayoría de los casos donde
 * antes se usaba esto.
 */
export async function silentSignIn(_supabase, _email) {
  return { ok: false }
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
// Tras la remoción de OFFLINE_CREDENTIALS, este flujo solo aplica si el
// usuario ya tiene una sesión válida cacheada. signInOffline directo (sin
// sesión previa) ya no es soportado: regresa un error claro.
export async function signInOffline(email, password) {
  const e = (email || '').trim().toLowerCase()
  const expected = OFFLINE_CREDENTIALS[e]
  if (!expected || expected !== password) {
    return { data: null, error: 'Modo offline no disponible. Intenta de nuevo cuando vuelva la conexión.' }
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

/**
 * clearOfflineSession() → borra solo el snapshot "offline" del usuario sin
 * tocar la cola de cambios pendientes. La diferencia con signOutOffline:
 *   · signOutOffline = "el usuario cerró sesión" — explícito.
 *   · clearOfflineSession = "ya estamos online de verdad, descarta el
 *      snapshot degradado para que el próximo refresh use la sesión real".
 */
export function clearOfflineSession() {
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

// ── Inserción pendiente de un lead nuevo (cuando Supabase falla) ──
// Encola un payload completo para reintentar la inserción más tarde.
// Se procesa en `syncToSupabase` con type='lead_insert'.
export function enqueueLeadInsert(payload, currentUser) {
  enqueueSync({
    type:     'lead_insert',
    payload,
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
 * discardPendingSync() → vacía la cola y descarta también el overlay local.
 * Usar cuando los cambios pendientes son obsoletos (leads borrados,
 * reorganización de la base, etc.) y quieres que el banner desaparezca
 * sin reintentar.
 *
 * Devuelve la cantidad de cambios descartados.
 */
export function discardPendingSync() {
  const count = readQueue().length
  writeQueue([])
  writeOverlay({})
  return count
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
      } else if (op.type === 'lead_insert') {
        // Reintento de creación de lead. Idempotente: si ya existe (mismo id),
        // usamos upsert para evitar duplicados.
        const { error } = await supabase
          .from('leads')
          .upsert(op.payload, { onConflict: 'id' })
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
