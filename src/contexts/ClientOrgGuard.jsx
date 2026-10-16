/**
 * contexts/ClientOrgGuard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Watcher que redirige al usuario al cliente correcto según su organización.
 * Mientras redirige en web, no monta la interfaz del tenant equivocado.
 *
 * Reglas:
 *   - En /login y la entrada compartida aplica la empresa en memoria sin
 *     cambiar la URL; no monta el CRM hasta aplicar su configuración.
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
import { resolveClientTransitionForUser } from "../clients";
import { isNativeApp } from "../lib/native";
import { isCommonEntryLocation } from "../lib/common-entry";

export function ClientOrgGuard({ enabled = true, children = null }) {
  const { user } = useAuth();
  const { clientId, setClientById } = useClient();
  // Evita redirects múltiples si el componente re-renderea durante la
  // navegación (replace() es asíncrono en la práctica).
  const redirectedRef = useRef(false);
  // Solo un usuario web online con organización comprobable bloquea el render.
  const transition = enabled
    ? resolveClientTransitionForUser(user, clientId, window.location, { native: isNativeApp() })
    : null;
  const redirectUrl = transition?.redirectUrl;
  const memoryClientId = transition?.inMemory ? transition.clientId : null;

  useEffect(() => {
    if (!enabled || redirectedRef.current) return;
    if (!user && isCommonEntryLocation(window.location)) {
      if (clientId !== "tenant") setClientById("tenant");
      return;
    }
    // El binario y la entrada común conservan su URL. La configuración proviene
    // de la organización autenticada o de la demo local explícita.
    if (memoryClientId) {
      setClientById(memoryClientId);
      return;
    }
    if (!user?.organizationId) return;

    // El modo offline no tiene una organización verificable. La cuenta demo
    // clásica tampoco trae organizationId y ya salió por el guard de arriba.
    // La cuenta de App Review SÍ trae la org ficticia de Inmobiliaria Aurora:
    // debe recorrer el mismo mapeo que una cuenta real para que Apple nunca
    // caiga en la configuración por defecto de un cliente productivo.
    if (user?._offline) return;

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
  }, [enabled, user, clientId, setClientById, redirectUrl, memoryClientId]);

  return redirectUrl || memoryClientId ? null : children;
}
