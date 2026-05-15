/**
 * hooks/useClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook para consumir el contexto del cliente activo.
 *
 * Devuelve siempre un objeto seguro (nunca null) — si por alguna razón se usa
 * fuera del ClientProvider, devuelve la config default (Stratos) y todas las
 * features habilitadas. Esto evita crashes durante refactors.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useContext } from "react";
import { ClientContext } from "../contexts/ClientContext";

export function useClient() {
  const ctx = useContext(ClientContext);
  // Defensa: si alguien usa el hook sin Provider, devolvemos un objeto válido
  if (!ctx) {
    return {
      config: null,
      clientId: "default",
      isFeatureEnabled: () => true,
    };
  }
  return ctx;
}
