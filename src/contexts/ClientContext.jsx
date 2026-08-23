/**
 * contexts/ClientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Provee la configuración del cliente activo (Duke, Grupo 28, etc.) a toda la app.
 *
 * El clientId se resuelve en main.jsx con resolveClientFromLocation() y se pasa
 * a este provider como prop. NO se cambia en runtime — para cambiar de cliente
 * se navega a la URL correspondiente.
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
import { getClientConfig } from "../clients";
import { isNativeApp } from "../lib/native";
import { DEFAULT_CLIENT_CONFIG } from "../clients/_shared/defaults";

export const ClientContext = createContext({
  config: DEFAULT_CLIENT_CONFIG,
  clientId: "default",
  isFeatureEnabled: () => true,
});

export function ClientProvider({ config, children }) {
  // En WEB el cliente lo fija la URL y no cambia en runtime: ClientOrgGuard
  // redirige al path correcto. En la APP NATIVA no hay URL que lo fije —
  // siempre arranca en capacitor://localhost — así que el tenant se aplica en
  // memoria después del login, a partir de user.organizationId.
  const [configNativa, setConfigNativa] = useState(null);
  const activa = (isNativeApp() ? configNativa : null) || config;

  const setClientById = useCallback((clientId) => {
    if (!isNativeApp() || !clientId) return;   // en web manda la URL
    setConfigNativa(getClientConfig(clientId));
  }, []);

  const value = useMemo(() => {
    const cfg = activa || DEFAULT_CLIENT_CONFIG;
    return {
      activa: cfg,
      clientId: cfg.id,
      // Si el módulo no aparece en features, asumimos habilitado (compat con
      // código existente que no consulta features). Solo cuando el dev marca
      // explícitamente `false` apagamos el módulo.
      setClientById,
      isFeatureEnabled: (moduleKey) => cfg.features?.[moduleKey] !== false,
    };
  }, [activa]);

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}
