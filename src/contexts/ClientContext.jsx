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
import { createContext, useMemo } from "react";
import { DEFAULT_CLIENT_CONFIG } from "../clients/_shared/defaults";

export const ClientContext = createContext({
  config: DEFAULT_CLIENT_CONFIG,
  clientId: "default",
  isFeatureEnabled: () => true,
});

export function ClientProvider({ config, children }) {
  const value = useMemo(() => {
    const cfg = config || DEFAULT_CLIENT_CONFIG;
    return {
      config: cfg,
      clientId: cfg.id,
      // Si el módulo no aparece en features, asumimos habilitado (compat con
      // código existente que no consulta features). Solo cuando el dev marca
      // explícitamente `false` apagamos el módulo.
      isFeatureEnabled: (moduleKey) => cfg.features?.[moduleKey] !== false,
    };
  }, [config]);

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}
