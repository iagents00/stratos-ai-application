/**
 * lib/lead-save.js — Guardado resiliente de leads con TRIPLE respaldo
 * ─────────────────────────────────────────────────────────────────────────────
 * Garantiza que un lead recién registrado NUNCA se pierda, aún si:
 *   · Supabase está caído / lento / con error transitorio
 *   · El navegador se cierra antes de que termine el insert
 *   · Hay un error de red intermitente
 *   · El usuario o el browser purga localStorage
 *   · El asesor está completamente offline
 *
 * Estrategia (4 capas):
 *   1. ESPEJO LOCAL DOBLE — escritura SÍNCRONA a localStorage Y append a
 *      IndexedDB (lib/lead-storage.js). LS garantiza que aunque el browser
 *      cierre el tab inmediatamente, la entry sobrevive al próximo arranque.
 *      IDB añade redundancia con cuotas mayores y datos por entry.
 *   2. INSERCIÓN A SUPABASE — vía supabase.rpc('create_lead'). Idempotente
 *      por ON CONFLICT (id) DO NOTHING. Si responde OK, marcamos la entrada
 *      del espejo como synced=true.
 *   3. COLA DE REINTENTOS — si Supabase falla, encolamos en la cola standard.
 *      Auto-recovery la reintenta cada 60s + en focus + manualmente.
 *   4. DEAD-LETTER QUEUE — si la cola falla 5 veces seguidas con el mismo
 *      payload, se mueve a stratos_leads_dead_letter para revisión manual
 *      (en lugar de reintentar para siempre y silenciar el error real).
 *
 * El espejo se purga periódicamente: sincronizados > 7 días se descartan
 * (siguen en Supabase). Pendientes NUNCA se purgan automáticamente.
 */

import { enqueueLeadInsert } from './offline-mode'
import {
  appendEntrySync,
  markSynced as storageMarkSynced,
  markFailed as storageMarkFailed,
  getAllEntries,
  getPendingEntries,
  pruneOldSynced,
  getDeadLetter as storageGetDeadLetter,
  clearDeadLetter as storageClearDeadLetter,
  verifyStorageHealth,
} from './lead-storage'

// 12s: Supabase paid plan no tiene cold-start, así que el INSERT real toma
// ~500ms-2s con los 5 triggers. 12s deja margen amplio para redes lentas
// pero no deja al usuario con spinner eterno si algo falla.
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

// ── API pública (re-exports y helpers de lectura) ───────────────────────────
export async function getPendingMirrorEntries() {
  return getPendingEntries()
}

export async function getMirrorSnapshot() {
  return getAllEntries()
}

export function getDeadLetterEntries() {
  return storageGetDeadLetter()
}

export function clearDeadLetterEntries() {
  return storageClearDeadLetter()
}

export async function getStorageHealth() {
  return verifyStorageHealth()
}

export async function purgeOldEntries(opts) {
  return pruneOldSynced(opts)
}

// Cuando la cola general flushea, esta función intenta marcar los espejos
// como sincronizados. Llamar después de un sync exitoso desde App.jsx.
export async function reconcileMirrorWithCloud(syncedIds) {
  if (!Array.isArray(syncedIds) || syncedIds.length === 0) return
  const all = await getAllEntries()
  const pendingByPayloadId = new Map()
  for (const e of all) {
    if (!e.synced && e.payload?.id) pendingByPayloadId.set(e.payload.id, e)
  }
  for (const id of syncedIds) {
    const entry = pendingByPayloadId.get(id)
    if (entry) await storageMarkSynced(entry.local_id, id)
  }
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

  // 2. ESPEJO LOCAL DOBLE — escritura SÍNCRONA a localStorage + IDB en
  //    background. Antes era deferred con requestIdleCallback, lo que abría
  //    una ventana donde un cierre rápido del tab perdía la entry. Ahora la
  //    escritura a LS termina antes de retornar — la entry sobrevive al
  //    próximo arranque sí o sí.
  appendEntrySync({
    local_id:        localId,
    payload:         fullPayload,
    user_id:         currentUser?.id || null,
    user_name:       currentUser?.name || null,
    created_at_local: Date.now(),
    synced:          false,
    synced_at:       null,
    real_id:         null,
    fail_count:      0,
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
  //    Usamos la RPC create_lead (migración 008) — ON CONFLICT (id) DO NOTHING
  //    la hace idempotente: doble clic, retry de red, replay de cola → la
  //    fila se crea una sola vez.
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('create_lead', { payload: fullPayload }).single(),
      INSERT_TIMEOUT_MS
    )

    if (error) {
      // Error duro de Supabase (RLS, validación, etc.).
      // Encolamos para reintento con el mismo id (la RPC es idempotente).
      enqueueLeadInsert(fullPayload, currentUser, { localId })
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
    storageMarkSynced(localId, realId)
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
    enqueueLeadInsert(fullPayload, currentUser, { localId })
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

/**
 * findLeadDuplicate(supabase, { email, phone })
 * ─────────────────────────────────────────────────────────────────────────
 * Llama a la RPC `find_lead_duplicate` (migración 013) y devuelve el lead
 * existente (mismo org) que matchea email o teléfono, incluso si pertenece
 * a OTRO asesor que el llamante no ve por RLS. La RPC es SECURITY DEFINER
 * y nunca cruza organizaciones.
 *
 * Uso típico: el modal de "Registrar cliente" llama esto con debounce
 * mientras el asesor escribe phone/email, para mostrar un banner antes de
 * crear un duplicado.
 *
 *   { email, phone } → al menos uno debe venir; si ambos vienen vacíos se
 *                      retorna { match: null }
 *   opts.signal      → AbortSignal opcional para cancelar la query si el
 *                      usuario sigue tipeando (evita race conditions)
 *
 * Retorno:
 *   { match: {lead_id, lead_name, lead_stage, lead_created_at, asesor_id,
 *             asesor_name, is_mine, match_type} | null, error }
 */
export async function findLeadDuplicate(supabase, { email, phone } = {}, opts = {}) {
  const e = (email || '').trim()
  const p = (phone || '').trim()
  if (!e && !p) return { match: null, error: null }

  try {
    let req = supabase.rpc('find_lead_duplicate', {
      p_email: e || null,
      p_phone: p || null,
    })
    if (opts.signal) req = req.abortSignal(opts.signal)

    const { data, error } = await req
    if (error) {
      // Si la RPC no existe (migración pendiente), no spammeamos. El frontend
      // degrada de forma silenciosa: solo no muestra el aviso.
      const msg = String(error.message || '').toLowerCase()
      if (msg.includes('does not exist') || msg.includes('function')) {
        return { match: null, error: null }
      }
      return { match: null, error: error.message || 'error_rpc' }
    }
    const row = Array.isArray(data) ? data[0] : data
    return { match: row || null, error: null }
  } catch (err) {
    if (err?.name === 'AbortError') return { match: null, error: null, aborted: true }
    return { match: null, error: err?.message || 'error_inesperado' }
  }
}
