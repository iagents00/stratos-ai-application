/**
 * lib/lead-storage.js — Espejo robusto de leads en IndexedDB
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa primaria de persistencia local para el espejo de leads. Existe para
 * resolver dos fallas reales del modelo solo-localStorage:
 *
 *   1. localStorage tiene quota baja (~5MB) y JSON.stringify de un array
 *      grande bloquea el main thread (lag visible al registrar lead).
 *   2. localStorage es UNO solo: si el navegador purga storage o el usuario
 *      hace "limpiar datos", se pierde TODO el espejo. Sin segunda copia,
 *      pendientes no sincronizados desaparecen.
 *
 * Solución:
 *   · IndexedDB como fuente PRIMARIA (cuotas mayores, escritura por entry,
 *     transacciones, no bloquea el thread).
 *   · localStorage como ESPEJO secundario (fallback automático, redundante).
 *   · API completamente síncrona desde el callsite — escribe en LS sync
 *     (espejo redundante mínimo) y luego encola el commit a IDB.
 *
 * NO requiere npm install — usa la API nativa del browser.
 *
 * Schema:
 *   db: 'stratos_lead_storage'  (version 1)
 *   store: 'leads_mirror'        keyPath: 'local_id'
 *     index: 'by_synced'         (synced)
 *     index: 'by_created'        (created_at_local)
 */

const DB_NAME    = 'stratos_lead_storage'
const DB_VERSION = 1
const STORE      = 'leads_mirror'

const LS_MIRROR_KEY = 'stratos_leads_mirror'   // espejo redundante (legacy compat + fallback)
const LS_DEAD_KEY   = 'stratos_leads_dead_letter'

// ── Promise-based open (memoizado) ──────────────────────────────────────────
let _dbPromise = null
let _idbAvailable = null

function isIDBAvailable() {
  if (_idbAvailable !== null) return _idbAvailable
  try {
    _idbAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch (_) {
    _idbAvailable = false
  }
  return _idbAvailable
}

function openDB() {
  if (!isIDBAvailable()) return Promise.resolve(null)
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve) => {
    let req
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (e) {
      // Modo incógnito de algunos browsers / política restrictiva
      _idbAvailable = false
      return resolve(null)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'local_id' })
        store.createIndex('by_synced',  'synced',           { unique: false })
        store.createIndex('by_created', 'created_at_local', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => {
      _idbAvailable = false
      resolve(null)
    }
    req.onblocked = () => resolve(null)
  })
  return _dbPromise
}

// ── Helpers IDB ─────────────────────────────────────────────────────────────
function tx(db, mode = 'readonly') {
  return db.transaction(STORE, mode).objectStore(STORE)
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ── Espejo en localStorage (siempre se mantiene como segunda copia) ─────────
function lsRead() {
  try {
    const raw = localStorage.getItem(LS_MIRROR_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

function lsWrite(arr) {
  try {
    localStorage.setItem(LS_MIRROR_KEY, JSON.stringify(arr))
    return true
  } catch (_) {
    // Quota exceeded: conservar solo pendientes.
    try {
      const pending = arr.filter(x => !x.synced)
      localStorage.setItem(LS_MIRROR_KEY, JSON.stringify(pending))
      return true
    } catch (_) { return false }
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * appendEntrySync(entry)
 * Inserta una entry en AMBAS capas (IDB + LS). La escritura a LS es
 * síncrona y se completa antes de retornar — eso garantiza que aún si
 * el browser cierra el tab inmediatamente después de retornar, la entry
 * vive al menos en LS para el próximo arranque.
 */
export function appendEntrySync(entry) {
  // 1. LS síncrono — garantía mínima (no esperar a IDB).
  const arr = lsRead()
  arr.push(entry)
  lsWrite(arr)

  // 2. IDB en background — no bloquea, redundancia más robusta.
  openDB().then(db => {
    if (!db) return
    try {
      const store = tx(db, 'readwrite')
      store.put(entry)
    } catch (_) { /* IDB no disponible — LS ya tiene la entry */ }
  })
}

/**
 * markSynced(localId, realId)
 * Marca una entry como sincronizada en AMBAS capas.
 */
export async function markSynced(localId, realId) {
  // 1. LS
  const arr = lsRead()
  const idx = arr.findIndex(e => e.local_id === localId)
  if (idx !== -1) {
    arr[idx].synced    = true
    arr[idx].synced_at = Date.now()
    arr[idx].real_id   = realId || arr[idx].payload?.id
    lsWrite(arr)
  }

  // 2. IDB
  const db = await openDB()
  if (!db) return
  try {
    const store = tx(db, 'readwrite')
    const existing = await reqToPromise(store.get(localId))
    if (existing) {
      existing.synced    = true
      existing.synced_at = Date.now()
      existing.real_id   = realId || existing.payload?.id
      store.put(existing)
    }
  } catch (_) { /* ignore */ }
}

/**
 * markFailed(localId, errorMsg)
 * Incrementa el contador de fallos. Si supera FAIL_THRESHOLD se mueve
 * a la dead letter queue y se elimina del mirror activo.
 */
const FAIL_THRESHOLD = 5

export async function markFailed(localId, errorMsg) {
  const arr = lsRead()
  const idx = arr.findIndex(e => e.local_id === localId)
  if (idx === -1) return { movedToDeadLetter: false }

  arr[idx].fail_count = (arr[idx].fail_count || 0) + 1
  arr[idx].last_error = errorMsg || 'unknown'
  arr[idx].last_error_at = Date.now()

  if (arr[idx].fail_count >= FAIL_THRESHOLD) {
    // Mover a dead letter
    const dead = arr[idx]
    pushDeadLetter(dead)
    arr.splice(idx, 1)
    lsWrite(arr)

    const db = await openDB()
    if (db) {
      try { tx(db, 'readwrite').delete(localId) } catch (_) {}
    }
    return { movedToDeadLetter: true, entry: dead }
  }

  lsWrite(arr)

  const db = await openDB()
  if (db) {
    try {
      const store = tx(db, 'readwrite')
      store.put(arr[idx])
    } catch (_) {}
  }
  return { movedToDeadLetter: false }
}

// ── Dead letter (items con N fallos consecutivos) ───────────────────────────
function pushDeadLetter(entry) {
  try {
    const raw = localStorage.getItem(LS_DEAD_KEY)
    const arr = raw ? JSON.parse(raw) : []
    arr.push({ ...entry, dead_at: Date.now() })
    // Cap dead letter a 50 items (los más nuevos primero)
    const capped = arr.slice(-50)
    localStorage.setItem(LS_DEAD_KEY, JSON.stringify(capped))
  } catch (_) {}
}

export function getDeadLetter() {
  try {
    const raw = localStorage.getItem(LS_DEAD_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) { return [] }
}

export function clearDeadLetter() {
  try { localStorage.removeItem(LS_DEAD_KEY) } catch (_) {}
}

/**
 * getAllEntries()
 * Devuelve la unión de IDB + LS, dedup por local_id.
 * Si una entry está en ambos, prefiere la versión más reciente (mayor
 * synced_at o created_at_local).
 */
export async function getAllEntries() {
  const lsArr = lsRead()
  const map = new Map(lsArr.map(e => [e.local_id, e]))

  const db = await openDB()
  if (db) {
    try {
      const store = tx(db, 'readonly')
      const all = await reqToPromise(store.getAll())
      for (const e of all) {
        const existing = map.get(e.local_id)
        if (!existing) {
          map.set(e.local_id, e)
        } else {
          // Preferir la versión más actualizada
          const ts1 = existing.synced_at || existing.created_at_local || 0
          const ts2 = e.synced_at || e.created_at_local || 0
          if (ts2 > ts1) map.set(e.local_id, e)
        }
      }
    } catch (_) {}
  }
  return [...map.values()]
}

export async function getPendingEntries() {
  const all = await getAllEntries()
  return all.filter(e => !e.synced)
}

/**
 * pruneOldSynced(ttlMs, maxEntries)
 * Limpia entries sincronizadas más viejas que ttlMs. Cap al total de
 * entries por maxEntries (los pendientes NUNCA se purgan).
 */
export async function pruneOldSynced({ ttlMs = 7 * 24 * 60 * 60 * 1000, maxEntries = 200 } = {}) {
  const now = Date.now()
  const all = await getAllEntries()

  const keep = all.filter(e => {
    if (!e.synced) return true
    const t = e.synced_at || e.created_at_local || now
    return (now - t) < ttlMs
  })

  // Cap por tamaño: pendientes siempre, sincronizados los más recientes.
  let final = keep
  if (final.length > maxEntries) {
    const pending = final.filter(e => !e.synced)
    const synced  = final.filter(e =>  e.synced)
                         .sort((a, b) => (b.synced_at || 0) - (a.synced_at || 0))
    final = [...pending, ...synced.slice(0, Math.max(0, maxEntries - pending.length))]
  }

  // Reemplazar LS
  lsWrite(final)

  // Reemplazar IDB
  const db = await openDB()
  if (db) {
    try {
      const store = tx(db, 'readwrite')
      const allKeys = await reqToPromise(store.getAllKeys())
      const keepIds = new Set(final.map(e => e.local_id))
      for (const k of allKeys) {
        if (!keepIds.has(k)) store.delete(k)
      }
      for (const e of final) store.put(e)
    } catch (_) {}
  }

  return { kept: final.length, purged: all.length - final.length }
}

/**
 * verifyStorageHealth()
 * Diagnóstico: compara count IDB vs LS. Útil para audit/debugging.
 */
export async function verifyStorageHealth() {
  const lsArr = lsRead()
  let idbCount = 0
  let idbAvail = isIDBAvailable()
  if (idbAvail) {
    const db = await openDB()
    if (db) {
      try {
        const store = tx(db, 'readonly')
        idbCount = await reqToPromise(store.count())
      } catch (_) { idbAvail = false }
    } else {
      idbAvail = false
    }
  }
  return {
    ls_count:  lsArr.length,
    ls_pending: lsArr.filter(e => !e.synced).length,
    idb_count: idbCount,
    idb_available: idbAvail,
    dead_letter_count: getDeadLetter().length,
  }
}
