/**
 * lib/chunk-recovery.js — recuperación de "chunk viejo tras deploy"
 * ─────────────────────────────────────────────────────────────────────────────
 * Síntoma: "Algo salió mal / Importing a module script failed" (o "Failed to
 * fetch dynamically imported module" en Chrome). Pasa cuando una pestaña abierta
 * durante un deploy hace un lazy-import de un chunk cuyo hash cambió: el shell
 * viejo pide un archivo que ya no está, o el Service Worker sirve un asset viejo
 * desde su caché (los chunks van cache-first / stale-while-revalidate).
 *
 * Antes: recargábamos UNA vez (`location.reload()`). Pero si el SW sigue
 * sirviendo el shell/chunk viejo desde su caché, el reload cae en lo mismo y el
 * usuario queda ATASCADO en la pantalla de error ("no me abre").
 *
 * Ahora la recuperación ESCALA:
 *   1º fallo  → reload suave (el index.html es network-first: toma el nuevo).
 *   2º fallo (<90s) → recuperación DURA: borra Cache Storage + desregistra el
 *                     SW y recarga → fuerza bajar TODO fresco de Vercel.
 *   3º+       → se muestra el error real (evita bucle si de verdad no hay red).
 *
 * ⚠️ 05-ago-2026: el presupuesto de recargas ya NO es propio de este archivo.
 * Se pide al ÁRBITRO ÚNICO que vive en index.html (`window.__stratosReload`),
 * compartido con los otros vigilantes de arranque. Antes cada uno llevaba su
 * cuenta por separado, así que "una recarga" para cada uno eran tres seguidas
 * para el usuario. Ver [guard:RELOAD-ARBITER] en index.html. Los contadores
 * locales quedan solo como respaldo por si el árbitro no cargó.
 *
 * IMPORTANTE: NUNCA toca localStorage/IndexedDB → la sesión de Supabase
 * (`sb-<ref>-auth-token`) se conserva. Solo limpia cachés de assets del SW.
 */

const GUARD_KEY = "stratos.chunk.reloaded.at";
const COUNT_KEY = "stratos.chunk.reload.count";
const WINDOW_MS = 90_000;

export function isStaleChunkError(error) {
  const msg = String((error && (error.message || error)) || "");
  return /importing a module script failed|dynamically imported module|failed to fetch dynamically|chunkloaderror|loading chunk|error loading dynamically/i.test(msg);
}

// Borra las cachés del SW y lo desregistra. No toca localStorage (sesión intacta).
async function nukeCachesAndSW() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (_) { /* noop */ }
  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (_) { /* noop */ }
}

// Recuperación DURA e inmediata (para los botones "Reintentar"/"Recargar"):
// limpia cachés + SW y recarga fresco. Siempre saca al usuario del atasco.
// La pidió el USUARIO con un botón → no consume presupuesto de recargas.
export async function hardRecover() {
  try { sessionStorage.removeItem(GUARD_KEY); sessionStorage.removeItem(COUNT_KEY); } catch (_) { /* noop */ }
  if (typeof window !== "undefined" && typeof window.__stratosReload === "function") {
    window.__stratosReload("boton-usuario-chunk", true, true);
    return;
  }
  await nukeCachesAndSW();   // respaldo: el árbitro de index.html no cargó
  window.location.reload();
}

// Auto-recuperación escalonada. Devuelve true si tomó acción (recargó/limpió).
export function recoverFromStaleChunk() {
  // Camino normal: el árbitro único de index.html lleva el presupuesto que se
  // comparte con los vigilantes de arranque. Si dice que no queda, devolvemos
  // false y el ErrorBoundary muestra el error de verdad (con sus botones).
  if (typeof window !== "undefined" && typeof window.__stratosReload === "function") {
    const quedan = window.__stratosReloadQuedan();
    if (quedan <= 0) return false;
    // Con presupuesto de sobra, primero el reload suave; en el último tiro se
    // hace la limpieza dura, que es la que de verdad saca de un caché podrido.
    return window.__stratosReload("chunk-viejo", quedan === 1, false);
  }

  // ── Respaldo (el árbitro no cargó): contadores propios, como antes ──
  let last = 0, count = 0;
  try {
    last = Number(sessionStorage.getItem(GUARD_KEY) || 0);
    count = Number(sessionStorage.getItem(COUNT_KEY) || 0);
  } catch (_) { /* noop */ }
  const now = Date.now();
  const within = last && (now - last < WINDOW_MS);
  const attempt = within ? count + 1 : 1;
  if (within && count >= 2) return false; // ya intentamos suave+duro hace poco → mostrar el error real
  try {
    sessionStorage.setItem(GUARD_KEY, String(now));
    sessionStorage.setItem(COUNT_KEY, String(attempt));
  } catch (_) { /* noop */ }
  if (attempt >= 2) {
    hardRecover();          // el reload suave no alcanzó → limpieza dura
  } else {
    window.location.reload(); // 1er intento: el index network-first trae lo nuevo
  }
  return true;
}
