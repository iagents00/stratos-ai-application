/**
 * lib/lead-draft.js — Autosave del borrador del modal "Registrar cliente"
 * ─────────────────────────────────────────────────────────────────────────────
 * Garantiza que un draft a medio escribir NO se pierda si el navegador
 * crashea, el tab se cierra accidentalmente, o cae la batería del laptop.
 *
 * Estrategia:
 *   · En cada keystroke (con debounce 400ms) se persiste el draft completo
 *     en localStorage.
 *   · Al abrir el modal, si hay un draft con TTL válido, se ofrece restaurar.
 *   · Cuando el lead se registra exitosamente (saveLead OK o queued), el
 *     draft se borra.
 *   · TTL = 24h: drafts más viejos se descartan automáticamente.
 */

const KEY      = 'stratos_lead_draft'
const TTL_MS   = 24 * 60 * 60 * 1000

let _debounceTimer = null

export function saveDraft(draft) {
  if (!draft || typeof draft !== 'object') return
  // No persistir si está completamente vacío (evita crear drafts fantasma).
  const hasContent = Object.values(draft).some(v =>
    typeof v === 'string' ? v.trim().length > 0 : Boolean(v)
  )
  if (!hasContent) {
    clearDraft()
    return
  }
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        draft,
        saved_at: Date.now(),
      }))
    } catch (_) { /* quota exceeded — silencioso */ }
  }, 400)
}

/**
 * saveDraftImmediate(draft)
 * Variante sin debounce — usar cuando se cierra el modal o el browser
 * pierde foco, para garantizar que el último estado quedó persistido.
 */
export function saveDraftImmediate(draft) {
  if (!draft || typeof draft !== 'object') return
  const hasContent = Object.values(draft).some(v =>
    typeof v === 'string' ? v.trim().length > 0 : Boolean(v)
  )
  if (!hasContent) {
    clearDraft()
    return
  }
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null }
  try {
    localStorage.setItem(KEY, JSON.stringify({
      draft,
      saved_at: Date.now(),
    }))
  } catch (_) {}
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.draft || !parsed?.saved_at) return null
    if (Date.now() - parsed.saved_at > TTL_MS) {
      clearDraft()
      return null
    }
    return { draft: parsed.draft, saved_at: parsed.saved_at }
  } catch (_) {
    return null
  }
}

export function clearDraft() {
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null }
  try { localStorage.removeItem(KEY) } catch (_) {}
}
