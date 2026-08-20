/**
 * contexts/ClientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Provee la configuración del cliente activo (Duke, Grupo 28, TGenius, Vega)
 * a toda la app.
 *
 * WEB:
 *   El clientId se resuelve en main.jsx con resolveClientFromLocation() y se
 *   pasa como prop `config`. NO cambia en runtime — para cambiar de cliente se
 *   navega a la URL correspondiente (ClientOrgGuard hace el replace()).
 *
 * NATIVO (iOS/Android):
 *   No existe URL que identifique al tenant: la app siempre arranca en
 *   capacitor://localhost/ y por lo tanto siempre resuelve a "duke". Como es
 *   UNA sola app en el App Store para todos los clientes, el tenant se aplica
 *   en RUNTIME justo después del login, a partir de user.organizationId.
 *   Ese es el único caso donde setClientById() hace algo.
 *
 * USO en componentes:
 *   import { useClient } from "../hooks/useClient";
 *   const { config, isFeatureEnabled, clientId } = useClient();
 *
 * Para apagar un módulo según cliente:
 *   {isFeatureEnabled("rrhh") && <RRHHModule />}
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useMemo, useState, useCallback } from "react";
import { DEFAULT_CLIENT_CONFIG } from "../clients/_shared/defaults";
import { getClientConfig } from "../clients";
import { isNative } from "../lib/native";

export const ClientContext = createContext({
  config: DEFAULT_CLIENT_CONFIG,
  clientId: "default",
  isFeatureEnabled: () => true,
  setClientById: () => {},
});

export function ClientProvider({ config, children }) {
  // Override de tenant aplicado en runtime. Solo se llena en nativo; en web
  // queda null para siempre y el comportamiento es idéntico al de antes.
  const [nativeConfig, setNativeConfig] = useState(null);

  const active = (isNative ? nativeConfig : null) || config || DEFAULT_CLIENT_CONFIG;

  const setClientById = useCallback((clientId) => {
    // En web manda la URL: ignoramos la llamada para no dejar el path y el
    // tenant desincronizados (el usuario vería /grupo28 con datos de duke).
    if (!isNative) return;
    if (!clientId) return;
    setNativeConfig(getClientConfig(clientId));
  }, []);

  // useMemo obligatorio: sin él el objeto `value` se recrea en cada render y
  // React dispara re-render de TODOS los consumers (App, CRM, Dash, Sidebar).
  // Ver ZONA CRÍTICA — PERFORMANCE en CLAUDE.md.
  const value = useMemo(() => ({
    config: active,
    clientId: active.id,
    // Si el módulo no aparece en features, asumimos habilitado (compat con
    // código existente que no consulta features). Solo cuando el dev marca
    // explícitamente `false` apagamos el módulo.
    isFeatureEnabled: (moduleKey) => active.features?.[moduleKey] !== false,
    setClientById,
  }), [active, setClientById]);

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}
