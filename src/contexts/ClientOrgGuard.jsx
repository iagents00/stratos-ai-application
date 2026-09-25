/**
 * contexts/ClientOrgGuard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Redirige al usuario al cliente de su organización. Como envuelve la app,
 * impide montarla con la configuración de otro tenant durante la navegación.
 * Las rutas públicas quedan fuera del guard mediante enabled=false.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useClient } from "../hooks/useClient";
import { resolveRedirectForUser, getClientIdByOrgId } from "../clients";
import { isNativeApp } from "../lib/native";

export function ClientOrgGuard({ enabled = true, children = null }) {
  const { user } = useAuth();
  const { clientId, setClientById } = useClient();
  // Evita redirects múltiples si el componente re-renderea antes de navegar.
  const redirectedRef = useRef(false);
  const native = isNativeApp();
  // El perfil offline viene de un respaldo local: solo usamos su org para
  // escoger ruta cuando ya está registrada. Una org desconocida conserva
  // el comportamiento offline anterior hasta volver a autenticarla.
  const canRoute = !!user?.organizationId &&
    (!user?._offline || !!getClientIdByOrgId(user.organizationId));
  const redirectUrl = enabled && !native && canRoute
    ? resolveRedirectForUser(user, clientId, window.location)
    : null;

  useEffect(() => {
    if (!enabled || redirectedRef.current || !canRoute) return;

    // La app nativa vive en capacitor://localhost: no navega a /nsg.
    // Conservamos el fallback neutral /tenant para orgs desconocidas online.
    if (native) {
      const destino = getClientIdByOrgId(user.organizationId) || "tenant";
      if (destino !== clientId) setClientById(destino);
      return;
    }

    if (!redirectUrl) return;
    redirectedRef.current = true;
    if (import.meta.env.DEV) {
      console.info(
        `[Stratos] Redirect: org ${user.organizationId} pertenece a otro cliente. ` +
        `Cambiando ${window.location.pathname} → ${new URL(redirectUrl).pathname}`
      );
    }
    window.location.replace(redirectUrl);
  }, [enabled, user, clientId, setClientById, native, canRoute, redirectUrl]);

  // No montar App, UpdatePill ni sus hooks con la config de otro tenant.
  return redirectUrl ? null : children;
}
