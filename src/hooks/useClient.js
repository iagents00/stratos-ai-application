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
import { crearValorCliente } from "../clients/_shared/client-value";
import { DEFAULT_CLIENT_CONFIG } from "../clients/_shared/defaults";

// Se construye una sola vez: es constante y evita re-renders si alguien lo usa
// fuera del Provider.
const SIN_PROVIDER = crearValorCliente(DEFAULT_CLIENT_CONFIG);

export function useClient() {
  const ctx = useContext(ClientContext);
  // Defensa: si alguien usa el hook sin Provider, devolvemos la misma forma que
  // devuelve el Provider — nunca un objeto a medias. Ver el comentario largo en
  // clients/_shared/client-value.js sobre por qué esto importa.
  return ctx || SIN_PROVIDER;
}
