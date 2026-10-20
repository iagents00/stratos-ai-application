// La entrada compartida conserva su URL. Las rutas y dominios de clientes
// existentes siguen resolviendo sus propias portadas y redirecciones.
const PLATFORM_HOSTS = new Set([
  "app.getstratosai.com",
  "stratoscapitalgroup.com", "app.stratoscapitalgroup.com",
]);

export function isCommonEntryLocation(location) {
  const pathname = location?.pathname || "/";
  if (pathname === "/login" || pathname === "/login/") return true;
  if (pathname !== "/") return false;
  const params = new URLSearchParams(location?.search || "");
  if (params.has("client")) return false;
  const hostname = (location?.hostname || "").toLowerCase();
  return PLATFORM_HOSTS.has(hostname)
    || hostname.endsWith(".vercel.app")
    || ((hostname === "localhost" || hostname === "127.0.0.1") && params.has("app"));
}

const COMMON_VIEW_PREFIX = "stratos.common-entry.";
const isRestorableView = (view, { canAccess, isPersistable }) => typeof view === "string"
  && view !== "1" && view.length > 0 && isPersistable(view) && canAccess(view);

// La antigua marca "1" solo indicaba que esta pestaña ya había entrado. Ahora
// la misma llave guarda su vista: ninguna lectura depende de otra pestaña.
export function readCommonEntryView(userId, options) {
  if (!userId || !isCommonEntryLocation(options.location)) return null;
  try {
    const saved = (options.storage || globalThis.sessionStorage)?.getItem(`${COMMON_VIEW_PREFIX}${userId}`);
    if (isRestorableView(saved, options)) return saved;
  } catch { /* almacenamiento no disponible: aplicar el destino permitido */ }
  return isRestorableView("c", options) ? "c" : null;
}

export function writeCommonEntryView(userId, view, options) {
  if (!userId || !isCommonEntryLocation(options.location) || !isRestorableView(view, options)) return false;
  try {
    const storage = options.storage || globalThis.sessionStorage;
    if (!storage) return false;
    storage.setItem(`${COMMON_VIEW_PREFIX}${userId}`, view);
    return true;
  } catch { return false; }
}

// Solo logout explícito limpia estas preferencias. Una hidratación tardía o
// recuperación de sesión conserva la vista elegida en esta pestaña.
export function clearCommonEntryViews(storage) {
  try {
    const target = storage || globalThis.sessionStorage;
    if (!target) return;
    const keys = Array.from({ length: target.length }, (_, index) => target.key(index));
    for (const key of keys) if (key?.startsWith(COMMON_VIEW_PREFIX)) target.removeItem(key);
  } catch { /* almacenamiento bloqueado */ }
}
