export const SERVICE_UNAVAILABLE_MESSAGE =
  "El servicio de Stratos no está respondiendo en este momento. Tus credenciales no fueron rechazadas. Inténtalo de nuevo en unos minutos.";

/**
 * Supabase can surface an infrastructure outage as an Auth error, a failed
 * fetch, an HTTP 5xx response, or a timeout. Keep those failures separate from
 * an actual credentials rejection so the login UI never blames the user.
 */
export function isServiceUnavailableError(error) {
  const status = Number(
    error?.status ?? error?.statusCode ?? error?.context?.status ?? 0,
  );
  if (status >= 500 || [408, 522, 523, 524].includes(status)) return true;

  const code = String(error?.code || error?.name || "").toLowerCase();
  const message = String(error?.message || error || "").toLowerCase();
  const signal = `${code} ${message}`;

  return [
    "timeout",
    "timed out",
    "failed to fetch",
    "fetch failed",
    "network request failed",
    "connection terminated",
    "connection refused",
    "bad gateway",
    "service unavailable",
    "database error",
  ].some((pattern) => signal.includes(pattern));
}
