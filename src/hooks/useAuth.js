/**
 * hooks/useAuth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook para consumir AuthContext desde cualquier componente.
 *
 * USO:
 *   import { useAuth } from "../hooks/useAuth";
 *
 *   function MyComponent() {
 *     const { user, login, logout, loading, error } = useAuth();
 *     ...
 *   }
 *
 * LANZA un error si se usa fuera de <AuthProvider> (fail-fast, ayuda en dev).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "[useAuth] Este hook debe usarse dentro de <AuthProvider>.\n" +
      "Asegúrate de envolver tu árbol de componentes con <AuthProvider> en main.jsx."
    );
  }
  return ctx;
}
