/**
 * clients/_shared/client-value.js
 * ─────────────────────────────────────────────────────────────────────────────
 * LA FORMA DEL CONTEXTO DE CLIENTE — una sola fábrica.
 *
 * El contexto de cliente se materializa en tres lugares distintos: el default de
 * createContext, el value del ClientProvider, y el fallback de useClient() para
 * cuando alguien lo usa fuera del árbol. Las tres tienen que devolver EXACTAMENTE
 * las mismas llaves.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 * En PR #666 el Provider renombró `config` a `activa` y los otros dos se
 * quedaron con `config`. Como los 13 componentes que lo consumen leen
 * `clientConfig?.algo` con optional chaining, nada crasheó: simplemente TODA la
 * personalización por cliente se apagó en silencio — branding del login, bot de
 * Telegram por tenant, nombre legal en los tableros directivos, KPIs y etiquetas
 * del CRM, la pestaña de Zoom Control. Un bug mudo, que es el peor tipo.
 *
 * Con la fábrica acá, agregar una llave se hace UNA vez y las tres formas la
 * reciben. No se puede volver a desincronizar.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { DEFAULT_CLIENT_CONFIG } from "./defaults";

export function crearValorCliente(cfg, setClientById = () => {}) {
  const activa = cfg || DEFAULT_CLIENT_CONFIG;
  return {
    config: activa,
    clientId: activa.id || "default",
    setClientById,
    // Si el módulo no aparece en features, asumimos habilitado (compat con
    // código existente que no consulta features). Solo cuando el dev marca
    // explícitamente `false` apagamos el módulo.
    isFeatureEnabled: (moduleKey) => activa.features?.[moduleKey] !== false,
  };
}
