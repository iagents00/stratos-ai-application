/**
 * contexts/ClientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Provee la configuración del cliente activo (Duke, Grupo 28, NSG, Vega…) a
 * toda la app.
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
 *
 * La FORMA del value (qué llaves expone) vive en
 * clients/_shared/client-value.js, compartida con useClient(). Ahí está el
 * porqué — se desincronizó una vez y apagó toda la personalización por cliente.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useMemo, useState, useCallback } from "react";
import { getClientConfig } from "../clients";
import { isNativeApp } from "../lib/native";
import { DEFAULT_CLIENT_CONFIG } from "../clients/_shared/defaults";
import { crearValorCliente } from "../clients/_shared/client-value";

export const ClientContext = createContext(crearValorCliente(DEFAULT_CLIENT_CONFIG));

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

  const value = useMemo(
    () => crearValorCliente(activa, setClientById),
    [activa, setClientById],
  );

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}
