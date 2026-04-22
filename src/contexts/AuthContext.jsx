/**
 * contexts/AuthContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Estado global de autenticación de Stratos IA.
 *
 * ARQUITECTURA:
 *   - AuthProvider envuelve toda la app en main.jsx
 *   - Expone: user, loading, error, login, register, logout, resetPassword
 *   - Usa lib/auth.js como capa de datos (intercambiable con Supabase)
 *
 * MIGRACIÓN A SUPABASE:
 *   - Solo lib/auth.js cambia. Este contexto NO necesita modificaciones.
 *   - Agregar: supabase.auth.onAuthStateChange para sesión en tiempo real.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  signIn,
  signUp,
  signOut,
  resetPassword as authResetPassword,
  getStoredSession,
  seedDemoUser,
} from "../lib/auth";
// ─── CONTEXTO ────────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);

// ─── PROVIDER ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Hidratación: leer sesión de localStorage + sembrar usuarios demo
  useEffect(() => {
    seedDemoUser();
    const session = getStoredSession();
    // Validar que la sesión tenga rol correcto (descartar sesiones de Supabase anteriores)
    if (session && session.role) {
      setUser(session);
    } else {
      // Sesión inválida o de formato antiguo — limpiar y pedir login de nuevo
      localStorage.removeItem("stratos_user");
      setUser(null);
    }
    setLoading(false);
  }, []);

  // ─── ACCIONES ────────────────────────────────────────────────────────────

  const login = useCallback(async (email, password, opts) => {
    setError(null);
    setLoading(true);
    let data, authError;
    if (opts?.isRegister) {
      ({ data, error: authError } = await signUp(opts.name, email, password));
    } else {
      ({ data, error: authError } = await signIn(email, password));
    }
    if (authError) {
      setError(authError);
    } else {
      setUser(data);
    }
    setLoading(false);
    return { data, error: authError };
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError(null);
    setLoading(true);
    const { data, error: authError } = await signUp(name, email, password);
    if (authError) {
      setError(authError);
    } else {
      setUser(data);
    }
    setLoading(false);
    return { data, error: authError };
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await signOut();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    setError(null);
    return authResetPassword(email);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ─── HELPERS DE ROL ──────────────────────────────────────────────────────
  const hasRole = useCallback((role) => user?.role === role, [user]);

  const hasMinRole = useCallback((minLevel) => {
    const levels = { super_admin: 1, admin: 1, ceo: 2, director: 3, asesor: 4 };
    return (levels[user?.role] ?? 99) <= minLevel;
  }, [user]);

  // ─── VALOR DEL CONTEXTO ──────────────────────────────────────────────────
  const value = {
    // Estado
    user,
    loading,
    error,
    isAuthenticated: !!user,

    // Acciones
    login,
    register,
    logout,
    resetPassword,
    clearError,

    // Helpers de rol (preparados para RBAC con Supabase)
    hasRole,
    hasMinRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
