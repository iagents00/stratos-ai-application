/**
 * contexts/ClientOrgGuard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Watcher que redirige al usuario al cliente correcto según su organización.
 *
 * Reglas:
 *   - Si user.organizationId mapea a un clientId distinto del de la URL actual,
 *     redirige al path correcto preservando query y hash.
 *   - Si la org del user no está en el registry → carga la entrada neutral
 *     /tenant, evitando que una empresa nueva herede la marca de Duke.
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
import { resolveRedirectForUser, getClientIdByOrgId } from "../clients";
import { isNativeApp } from "../lib/native";

export function ClientOrgGuard() {
  const { user } = useAuth();
  const { clientId, setClientById } = useClient();
  // Evita redirects múltiples si el componente re-renderea durante la
  // navegación (replace() es asíncrono en la práctica).
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (!user?.organizationId) return;

    // El modo offline no tiene una organización verificable. La cuenta demo
    // clásica tampoco trae organizationId y ya salió por el guard de arriba.
    // La cuenta de App Review SÍ trae la org ficticia de Inmobiliaria Aurora:
    // debe recorrer el mismo mapeo que una cuenta real para que Apple nunca
    // caiga en la configuración por defecto de un cliente productivo.
    if (user?._offline) return;

    // APP NATIVA: es UN binario para todos los clientes, servido desde
    // capacitor://localhost. No hay path que cambiar, y un location.replace()
    // a capacitor://localhost/grupo28 daría 404 (no hay servidor que rutee):
    // el usuario quedaría con pantalla en blanco. Acá el tenant se aplica en
    // memoria y el árbol re-renderea con la config correcta.
    if (isNativeApp()) {
      const destino = getClientIdByOrgId(user.organizationId) || "tenant";
      if (destino && destino !== clientId) setClientById(destino);
      return;
    }

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
  }, [user, clientId, setClientById]);

  return null;
}
