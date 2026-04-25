/**
 * contexts/AuthContext.jsx
 * Estado global de autenticación — conectado a Supabase Auth.
 *
 * Manejo especial de sesión demo:
 *  · El modo demo (demo@stratos.ai / demo2027) se resuelve localmente en auth.js
 *    y nunca toca Supabase Auth.
 *  · Para evitar que eventos de Supabase o la hidratación inicial sobreescriban
 *    al usuario demo, usamos el ref `loginSettledRef` como barrera de una sola vez.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

const DEMO_SESSION_KEY = 'stratos_demo';
const isDemo = () => sessionStorage.getItem(DEMO_SESSION_KEY) === '1';

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /**
   * loginSettledRef — se pone a `true` en el momento en que el usuario
   * invoca explícitamente `login()`.  Esto previene que la resolución
   * tardía de `getStoredSession()` (que puede tardar 1-2 s con Supabase real)
   * sobreescriba el usuario ya autenticado.
   */
  const loginSettledRef = useRef(false);

  useEffect(() => {
    seedDemoUser();

    let isMounted = true;

    // ── Hidratación inicial: leer sesión activa ──────────────────────────
    getStoredSession().then(session => {
      if (!isMounted || loginSettledRef.current) return;   // login ya ocurrió → no pisar
      setUser(session);
      setLoading(false);
    });

    // ── Listener Supabase en tiempo real ────────────────────────────────
    // Solo reacciona a eventos de auth de Supabase (no demo).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Nunca desloguear una sesión demo local por eventos de Supabase
        if (isDemo()) return;

        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          return;
        }

        // Usuario real de Supabase: refrescar perfil
        const profile = await getStoredSession();
        if (isMounted && !isDemo()) setUser(profile);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password, opts) => {
    // Marcar ANTES del await: si getStoredSession() sigue pendiente,
    // su .then() verá este flag y no sobreescribirá al usuario.
    loginSettledRef.current = true;

    setError(null);
    setLoading(true);

    let data, authError;
    if (opts?.isRegister) {
      ({ data, error: authError } = await signUp(opts.name ?? "", email, password));
    } else {
      ({ data, error: authError } = await signIn(email, password));
    }

    if (authError) {
      setError(authError);
      loginSettledRef.current = false; // permitir que un intento posterior funcione
    } else {
      setUser(data);
    }
    setLoading(false);
    return { data, error: authError };
  }, []);

  const register = useCallback(async (name, email, password) => {
    loginSettledRef.current = true;
    setError(null);
    setLoading(true);
    const { data, error: authError } = await signUp(name, email, password);
    if (authError) {
      setError(authError);
      loginSettledRef.current = false;
    } else {
      setUser(data);
    }
    setLoading(false);
    return { data, error: authError };
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    loginSettledRef.current = false; // resetear para permitir nuevo login
    await signOut();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    setError(null);
    return authResetPassword(email);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const hasRole = useCallback((role) => user?.role === role, [user]);

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
