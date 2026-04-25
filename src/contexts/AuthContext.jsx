/**
 * contexts/AuthContext.jsx
 * Estado global de autenticación — conectado a Supabase Auth.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  signIn,
  signUp,
  signOut,
  resetPassword as authResetPassword,
  getStoredSession,
  seedDemoUser,
} from "../lib/auth";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    seedDemoUser();

    // Hidratación inicial — leer sesión activa de Supabase
    getStoredSession().then(session => {
      setUser(session);
      setLoading(false);
    });

    // Listener en tiempo real: login / logout / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          return;
        }
        const profile = await getStoredSession();
        setUser(profile);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password, opts) => {
    setError(null);
    setLoading(true);
    let data, authError;
    if (opts?.isRegister) {
      ({ data, error: authError } = await signUp(opts.name, email, password));
    } else {
      ({ data, error: authError } = await signIn(email, password));
    }
    if (authError) setError(authError);
    else setUser(data);
    setLoading(false);
    return { data, error: authError };
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError(null);
    setLoading(true);
    const { data, error: authError } = await signUp(name, email, password);
    if (authError) setError(authError);
    else setUser(data);
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
  const hasRole    = useCallback((role) => user?.role === role, [user]);
  const hasMinRole = useCallback((minLevel) => {
    const levels = { super_admin: 1, admin: 1, ceo: 2, director: 3, asesor: 4 };
    return (levels[user?.role] ?? 99) <= minLevel;
  }, [user]);

  const value = {
    user, loading, error,
    isAuthenticated: !!user,
    login, register, logout, resetPassword, clearError,
    hasRole, hasMinRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
