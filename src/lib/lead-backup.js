/**
 * lib/lead-backup.js — Backup exportable y verificación de integridad
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de "seguro contra catástrofe":
 *   · exportAllLeadsJson(supabase, currentUser) → genera y descarga un .json
 *     con TODOS los leads visibles del usuario (cloud + pendientes locales),
 *     incluso aquellos en dead letter. Sirve como red de seguridad final
 *     manual: si todo lo demás falla, el asesor tiene un archivo concreto.
 *
 *   · auditCloudVsLocal(supabase, currentUser) → compara count cliente vs
 *     count cloud para el usuario actual. Si hay discrepancia significativa,
 *     loguea en consola y devuelve el reporte para mostrar UI.
 *
 *   · forceReconcile(supabase) → reintenta INSERT idempotente para CADA
 *     entry no sincronizada del espejo (incluyendo dead letter). Útil
 *     para una recuperación manual masiva tras un incidente de red.
 */

import { getAllEntries, getDeadLetter, getPendingEntries } from './lead-storage'
import { getQueueDeadLetter } from './offline-mode'

// ── Descarga client-side de un JSON ──
function downloadJson(filename, data) {
  try {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return true
  } catch (e) {
    console.error('[backup] download failed', e)
    return false
  }
}

/**
 * exportAllLeadsJson(supabase, currentUser, opts)
 * Descarga un JSON consolidado: cloud + mirror + pending + dead letters.
 * El asesor puede archivarlo offline; el admin puede usarlo para reimportar
 * tras un incidente.
 *
 * Devuelve { ok, count_cloud, count_pending, count_dead, error }.
 */
export async function exportAllLeadsJson(supabase, currentUser, opts = {}) {
  const isAdmin = ['super_admin', 'admin', 'ceo'].includes(currentUser?.role)
  const filename = opts.filename || `stratos-leads-backup-${new Date().toISOString().slice(0, 10)}.json`

  // 1. Cloud — solo lo que el RLS deja ver al usuario actual.
  let cloudLeads = []
  let cloudErr   = null
  if (supabase && currentUser?.id !== 'demo-user-local' && !currentUser?.isDemo) {
    try {
      // Si es admin, traer todos; si no, solo los suyos vía RLS.
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) cloudErr = error.message
      else       cloudLeads = data || []
    } catch (e) {
      cloudErr = e?.message || 'cloud_fetch_failed'
    }
  }

  // 2. Mirror local (incluye pendientes y sincronizados recientes)
  let mirror = []
  try { mirror = await getAllEntries() } catch (_) {}

  // 3. Dead letters
  const deadStorage = getDeadLetter()
  const deadQueue   = getQueueDeadLetter()

  const payload = {
    exported_at: new Date().toISOString(),
    user: {
      id:    currentUser?.id || null,
      name:  currentUser?.name || null,
      email: currentUser?.email || null,
      role:  currentUser?.role || null,
      is_admin: isAdmin,
    },
    counts: {
      cloud:           cloudLeads.length,
      mirror_total:    mirror.length,
      mirror_pending:  mirror.filter(e => !e.synced).length,
      mirror_synced:   mirror.filter(e =>  e.synced).length,
      dead_storage:    deadStorage.length,
      dead_queue:      deadQueue.length,
    },
    cloud_leads:      cloudLeads,
    mirror_entries:   mirror,
    dead_letters: {
      storage: deadStorage,
      queue:   deadQueue,
    },
    cloud_error: cloudErr,
  }

  const ok = downloadJson(filename, payload)
  return {
    ok,
    count_cloud:   cloudLeads.length,
    count_pending: payload.counts.mirror_pending,
    count_dead:    deadStorage.length + deadQueue.length,
    error: ok ? null : 'download_failed',
  }
}

/**
 * auditCloudVsLocal(supabase, currentUser)
 * Devuelve { cloud_count, local_count, pending_count, dead_count, in_sync }.
 * `in_sync = true` si cloud_count >= (local_count - pending - dead).
 */
export async function auditCloudVsLocal(supabase, currentUser) {
  let cloudCount = 0
  if (supabase && currentUser?.id !== 'demo-user-local' && !currentUser?.isDemo) {
    try {
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
      if (!error) cloudCount = count || 0
    } catch (_) {}
  }

  const mirror = await getAllEntries()
  const pending = mirror.filter(e => !e.synced).length
  const synced  = mirror.filter(e =>  e.synced).length
  const dead    = getDeadLetter().length + getQueueDeadLetter().length

  // El cloud debe tener AL MENOS los sincronizados del mirror.
  // Si hay discrepancia (cloud < synced) algo se borró/corrompió.
  const in_sync = cloudCount >= synced

  const report = {
    cloud_count: cloudCount,
    local_synced: synced,
    pending_count: pending,
    dead_count: dead,
    in_sync,
    discrepancy: in_sync ? 0 : (synced - cloudCount),
  }

  if (!in_sync) {
    console.warn('[lead-backup] DISCREPANCIA DETECTADA — cloud tiene menos leads que el espejo local sincronizado.', report)
  }
  return report
}

/**
 * forceReconcile(supabase, opts)
 * Reintenta el INSERT idempotente para todas las entries pendientes
 * (incluyendo dead letter si opts.includeDead=true). Útil tras un
 * incidente para recuperación manual.
 */
export async function forceReconcile(supabase, opts = {}) {
  const includeDead = !!opts.includeDead
  const pending = await getPendingEntries()
  const dead    = includeDead ? getDeadLetter() : []
  const all     = [...pending, ...dead]

  let synced = 0
  let failed = 0
  const errors = []

  for (const e of all) {
    if (!e.payload?.id) continue
    try {
      const { error } = await supabase.rpc('create_lead', { payload: e.payload })
      if (error) {
        // Rechazo permanente (cliente ya existe con otro asesor; 42501): no es
        // un fallo a reintentar — el lead legítimamente no debe crearse. Lo
        // saltamos sin contarlo como error.
        if (error.code === '42501' ||
            /ya está registrado|solo un administrador/i.test(error.message || '')) {
          continue
        }
        failed++
        errors.push({ local_id: e.local_id, error: error.message })
      } else {
        synced++
      }
    } catch (err) {
      failed++
      errors.push({ local_id: e.local_id, error: err?.message || 'unknown' })
    }
  }

  return { synced, failed, total: all.length, errors }
}
