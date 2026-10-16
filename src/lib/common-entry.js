// La entrada compartida conserva su URL. Las rutas y dominios de clientes
// existentes siguen resolviendo sus propias portadas y redirecciones.
const PLATFORM_HOSTS = new Set([
  "getstratosai.com", "app.getstratosai.com",
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
