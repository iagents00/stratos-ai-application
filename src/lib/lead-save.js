/**
 * lib/lead-save.js — Guardado resiliente de leads con doble respaldo
 * ─────────────────────────────────────────────────────────────────────────────
 * Garantiza que un lead recién registrado NUNCA se pierda, aún si:
 *   · Supabase está caído / lento / con error transitorio
 *   · El navegador se cierra antes de que termine el insert
 *   · Hay un error de red intermitente
 *
 * Estrategia (3 capas):
 *   1. ESPEJO LOCAL APPEND-ONLY — antes de tocar la red, escribimos el
 *      payload completo a `localStorage["stratos_leads_mirror"]`. Es la
 *      copia inmutable de respaldo. Si todo falla, el lead vive ahí
 *      hasta que se reintente.
 *   2. INSERCIÓN A SUPABASE — el camino feliz. Si responde OK, marcamos
 *      la entrada del espejo como `synced=true` con el id real.
 *   3. COLA DE REINTENTOS — si Supabase falla, encolamos `lead_insert`
 *      en la cola estándar de offline-mode.js. El loop de auto-recovery
 *      en App.jsx la reintenta cada 60s + en focus + manualmente con
 *      el botón "Sincronizar".
 *
 * El espejo se mantiene acotado a los últimos LOCAL_MIRROR_LIMIT registros
 * para no llenar localStorage. Cualquier lead ya sincronizado y > 7 días
 * se purga del espejo (sigue en Supabase, ahí es la fuente de verdad).
 */

import { enqueueLeadInsert } from './offline-mode'

const KEY_LEADS_MIRROR     = 'stratos_leads_mirror'
const LOCAL_MIRROR_LIMIT   = 500
const SYNCED_TTL_MS        = 7 * 24 * 60 * 60 * 1000 // 7 días
const INSERT_TIMEOUT_MS    = 12000

// ── UUID ──
function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback. No es UUID v4 estricto pero Postgres acepta cualquier uuid válido,
  // así que generamos uno con la forma correcta.
  const hex = (n) => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, '0')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}

// ── Espejo local (append-only) ──
function readMirror() {
  try {
    const raw = localStorage.getItem(KEY_LEADS_MIRROR)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

function writeMirror(arr) {
  // Purga: descartamos sincronizados antiguos (> 7 días). Los pendientes
  // (synced=false) NUNCA se purgan, viven hasta que se sincronicen.
  const now = Date.now()
  const purged = arr.filter(e => {
    if (!e.synced) return true
    return (now - (e.synced_at || e.created_at_local || now)) < SYNCED_TTL_MS
  })
  // Cap por tamaño: si excede, descartamos los más antiguos sincronizados.
  let final = purged
  if (final.length > LOCAL_MIRROR_LIMIT) {
    const pending = final.filter(e => !e.synced)
    const synced  = final.filter(e =>  e.synced)
                         .sort((a, b) => (b.synced_at || 0) - (a.synced_at || 0))
    final = [...pending, ...synced.slice(0, Math.max(0, LOCAL_MIRROR_LIMIT - pending.length))]
  }
  try {
    localStorage.setItem(KEY_LEADS_MIRROR, JSON.stringify(final))
  } catch (e) {
    // Quota exceeded: como último recurso, conservamos solo los pendientes.
    try {
      const pending = final.filter(x => !x.synced)
      localStorage.setItem(KEY_LEADS_MIRROR, JSON.stringify(pending))
    } catch (_) { /* nada que hacer */ }
  }
}

function appendToMirror(entry) {
  const arr = readMirror()
  arr.push(entry)
  writeMirror(arr)
}

function markMirrorSynced(localId, realId) {
  const arr = readMirror()
  const idx = arr.findIndex(e => e.local_id === localId)
  if (idx === -1) return
  arr[idx].synced     = true
  arr[idx].synced_at  = Date.now()
  arr[idx].real_id    = realId || arr[idx].payload?.id
  writeMirror(arr)
}

export function getPendingMirrorEntries() {
  return readMirror().filter(e => !e.synced)
}

export function getMirrorSnapshot() {
  return readMirror()
}

// Cuando la cola general flushea, esta función intenta marcar los espejos
// como sincronizados. Llamar después de un sync exitoso desde App.jsx.
export function reconcileMirrorWithCloud(syncedIds) {
  if (!Array.isArray(syncedIds) || syncedIds.length === 0) return
  const arr = readMirror()
  let dirty = false
  for (const id of syncedIds) {
    const idx = arr.findIndex(e => e.payload?.id === id && !e.synced)
    if (idx !== -1) {
      arr[idx].synced    = true
      arr[idx].synced_at = Date.now()
      arr[idx].real_id   = id
      dirty = true
    }
  }
  if (dirty) writeMirror(arr)
}

// ── Wrapper de timeout ──
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('lead_insert_timeout')), ms)
    promise
      .then(v => { clearTimeout(t); resolve(v) })
      .catch(e => { clearTimeout(t); reject(e) })
  })
}

/**
 * saveLead(supabase, payload, currentUser, opts)
 * ─────────────────────────────────────────────────────────────────────────
 * Guarda un lead con doble respaldo. NUNCA lanza excepciones — siempre
 * retorna { id, savedToCloud, queuedForRetry, error }.
 *
 *   payload          → Objeto con las columnas del lead (sin id; lo generamos).
 *                      Pueden venir todas las columnas que acepta `leads`.
 *   currentUser      → { id, isDemo? } — para saber si saltamos el insert.
 *   opts.skipCloud   → true en modo demo para no tocar Supabase.
 *
 * Retorno:
 *   id              → UUID asignado (real si guardó en Supabase, local si no)
 *   savedToCloud    → true si Supabase confirmó el insert
 *   queuedForRetry  → true si está en la cola para reintentar
 *   error           → mensaje legible si Supabase falló (null si OK o demo)
 *   savedRow        → fila tal como la devolvió Supabase (con triggers
 *                     aplicados: organization_id, phone_normalized, etc.)
 *                     null si no se guardó en la nube.
 */
export async function saveLead(supabase, payload, currentUser, opts = {}) {
  const skipCloud = !!opts.skipCloud || currentUser?.id === 'demo-user-local' || currentUser?.isDemo

  // 1. Generamos id local determinista. Si Supabase responde con un id distinto
  //    (improbable porque mandamos el nuestro), lo reconciliamos en el espejo.
  const id = payload?.id || newId()
  const fullPayload = { ...payload, id }
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // 2. ESPEJO LOCAL — primero, siempre, antes de tocar la red.
  appendToMirror({
    local_id:        localId,
    payload:         fullPayload,
    user_id:         currentUser?.id || null,
    user_name:       currentUser?.name || null,
    created_at_local: Date.now(),
    synced:          false,
    synced_at:       null,
    real_id:         null,
  })

  // 3. Modo demo / sin red: marcamos como guardado localmente y salimos.
  if (skipCloud) {
    return {
      id,
      savedToCloud:   false,
      queuedForRetry: false,
      error:          null,
      savedRow:       null,
    }
  }

  // 4. Intento de inserción en Supabase con timeout duro.
  //    Usamos la RPC create_lead (migración 008) en lugar de
  //    .from('leads').insert(...).select().single() — la RPC hace
  //    ON CONFLICT (id) DO NOTHING, así que si llega 2+ veces con el mismo
  //    id (doble clic, retry de red, etc.) sólo crea la fila la primera
  //    vez. Además devuelve sólo {lead_id, lead_created_at,
  //    lead_organization_id, was_inserted} en vez de SELECT * — más liviano.
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('create_lead', { payload: fullPayload }).single(),
      INSERT_TIMEOUT_MS
    )

    if (error) {
      // Error duro de Supabase (RLS, validación, etc.).
      // Encolamos para reintento con el mismo id (la RPC es idempotente).
      enqueueLeadInsert(fullPayload, currentUser)
      return {
        id,
        savedToCloud:   false,
        queuedForRetry: true,
        error:          error.message || 'error_supabase',
        savedRow:       null,
      }
    }

    // Éxito en la nube — marcamos el espejo y devolvemos los datos clave.
    // data: { lead_id, lead_created_at, lead_organization_id, was_inserted }
    const realId = data?.lead_id || id
    markMirrorSynced(localId, realId)
    return {
      id:             realId,
      savedToCloud:   true,
      queuedForRetry: false,
      error:          null,
      savedRow: data ? {
        id:              data.lead_id,
        created_at:      data.lead_created_at,
        organization_id: data.lead_organization_id,
        was_inserted:    data.was_inserted,
      } : null,
    }
  } catch (e) {
    // Timeout o excepción inesperada → cola de reintentos.
    enqueueLeadInsert(fullPayload, currentUser)
    return {
      id,
      savedToCloud:   false,
      queuedForRetry: true,
      error:          e?.message === 'lead_insert_timeout'
        ? 'Tiempo de espera agotado. Guardado local — se reintentará automáticamente.'
        : (e?.message || 'error_inesperado'),
      savedRow:       null,
    }
  }
}
