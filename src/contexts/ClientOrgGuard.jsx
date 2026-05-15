/**
 * contexts/ClientOrgGuard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Watcher que redirige al usuario al cliente correcto según su organización.
 *
 * Reglas:
 *   - Si user.organizationId mapea a un clientId distinto del de la URL actual,
 *     redirige al path correcto preservando query y hash.
 *   - Si la org del user no está en el registry → no redirige (cliente nuevo
 *     que aún no fue agregado a src/clients/).
 *   - Si no hay user → no hace nada (el LoginScreen se encarga).
 *
 * Por qué un componente separado y no lógica en AuthContext:
 *   El AuthContext maneja muchos edge cases (hidratación, demo, F5, refresh).
 *   Meter el redirect ahí adentro lo vuelve frágil. Como componente aparte
 *   tiene una sola responsabilidad y es fácil de remover si en el futuro
 *   decidimos otra estrategia (modal de "¿querés cambiar de cliente?", etc.).
 *
 * Por qué replace() y no href:
 *   replace() no agrega entry al history → el botón "atrás" del navegador no
 *   trae al usuario de vuelta al cliente equivocado.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useClient } from "../hooks/useClient";
import { resolveRedirectForUser } from "../clients";

export function ClientOrgGuard() {
  const { user } = useAuth();
  const { clientId } = useClient();
  // Evita redirects múltiples si el componente re-renderea durante la
  // navegación (replace() es asíncrono en la práctica).
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (!user?.organizationId) return;

    // Las cuentas demo no tienen una org "real" — saltearlas.
    if (user?._offline || user?.id === "demo-user-local") return;

    const redirectUrl = resolveRedirectForUser(user, clientId, window.location);
    if (redirectUrl) {
      redirectedRef.current = true;
      // Log informativo solo en dev — en prod no inflamos consola del usuario.
      if (import.meta.env.DEV) {
        console.info(
          `[Stratos] Redirect: org ${user.organizationId} pertenece a otro cliente. ` +
          `Cambiando ${window.location.pathname} → ${new URL(redirectUrl).pathname}`
        );
      }
      window.location.replace(redirectUrl);
    }
  }, [user, clientId]);

  return null;
}
