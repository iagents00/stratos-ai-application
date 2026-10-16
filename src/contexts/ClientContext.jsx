/**
 * contexts/ClientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Provee la configuración del cliente activo (Duke, Grupo 28, NSG, Vega…) a
 * toda la app.
 *
 * El clientId se resuelve en main.jsx. En /login y la entrada común se aplica
 * después la empresa del perfil sin cambiar de URL; las entradas white-label
 * conservan sus rutas específicas.
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
import { createContext, useMemo, useState, useCallback, useEffect } from "react";
import { getClientConfig } from "../clients";
import { isNativeApp } from "../lib/native";
import { isCommonEntryLocation } from "../lib/common-entry";
import { DEFAULT_CLIENT_CONFIG } from "../clients/_shared/defaults";
import { crearValorCliente } from "../clients/_shared/client-value";

export const ClientContext = createContext(crearValorCliente(DEFAULT_CLIENT_CONFIG));

export function ClientProvider({ config, children }) {
  // Las entradas compartidas y el binario aplican la empresa del perfil en
  // memoria. Las rutas white-label conservan la resolución por URL.
  const inMemory = isNativeApp() || isCommonEntryLocation(typeof window !== "undefined" ? window.location : null);
  const [configMemoria, setConfigMemoria] = useState(null);
  const [organizationFeatures, setOrganizationFeaturesState] = useState(null);
  const base = (inMemory ? configMemoria : null) || config;
  const activa = useMemo(() => base?.id === "tenant" && organizationFeatures
    ? { ...base, features: { ...base.features, ...organizationFeatures.features } }
    : base, [base, organizationFeatures]);

  const setClientById = useCallback((clientId) => {
    if (!inMemory || !clientId) return;
    setConfigMemoria(getClientConfig(clientId));
    setOrganizationFeaturesState(null);
  }, [inMemory]);

  useEffect(() => {
    if (!inMemory || !base) return;
    document.documentElement.setAttribute("data-client", base.id);
    document.title = `${base.name} — Plataforma`;
  }, [inMemory, base]);

  const setOrganizationFeatures = useCallback((organizationId, features, managed = false) => {
    setOrganizationFeaturesState({ organizationId, features, managed });
  }, []);

  const value = useMemo(
    () => crearValorCliente(activa, setClientById, setOrganizationFeatures, organizationFeatures?.organizationId || null, organizationFeatures?.managed || false),
    [activa, setClientById, setOrganizationFeatures, organizationFeatures?.organizationId, organizationFeatures?.managed],
  );

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}
