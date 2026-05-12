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
import { clearOfflineSession } from "../lib/offline-mode";

export const AuthContext = createContext(null);

const DEMO_SESSION_KEY = 'stratos_demo';
const isDemo = () => sessionStorage.getItem(DEMO_SESSION_KEY) === '1';

// Timeout duro de la hidratación inicial. Si la lectura de la sesión activa
// (que puede tener que refrescar el access token y consultar el perfil) no
// termina en este lapso, asumimos que algo se colgó (típicamente: refresh
// token corrupto/revocado en localStorage tras una race entre pestañas) y
// limpiamos el estado para mostrar el login. Sin esto, el usuario veía
// "Verificando…" indefinidamente.
const HYDRATION_TIMEOUT_MS = 12000;

/**
 * Limpia toda la sesión local de Supabase + caches de Stratos.
 * Se usa cuando detectamos un token corrupto o un error fatal de auth, para
 * que el siguiente intento de login arranque limpio.
 */
function clearLocalAuthState() {
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (/^sb-/i.test(k))                  localStorage.removeItem(k); // tokens de Supabase
      else if (/^stratos\.supabase/i.test(k)) localStorage.removeItem(k); // storageKey nuestro
      else if (k === 'stratos_session_cache') localStorage.removeItem(k);
      else if (k === 'stratos_offline_session') localStorage.removeItem(k);
    }
  } catch (_) { /* localStorage bloqueado en modo incógnito o por política — ignorar */ }
}

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
  /**
   * hydrationDoneRef — marca que la hidratación inicial ya terminó (sea por
   * éxito, error o timeout). Cualquier evento de Supabase que llegue después
   * usa la lógica normal del listener, sin pelear con esta primera resolución.
   */
  const hydrationDoneRef = useRef(false);

  useEffect(() => {
    seedDemoUser();

    let isMounted = true;

    // ── Hidratación inicial con timeout duro + cleanup ───────────────────
    // Si pasan 12s y nadie respondió, asumimos token corrupto y reseteamos
    // el estado. El usuario verá el login limpio en lugar de "Verificando…"
    // eterno. Esto resuelve el caso reportado: tras añadir un cliente y
    // recargar, el SDK quedaba colgado intentando refrescar un token
    // invalidado por reuse-detection.
    const hydrationTimer = setTimeout(() => {
      if (!isMounted || hydrationDoneRef.current || loginSettledRef.current) return;
      hydrationDoneRef.current = true;
      console.warn('[Stratos] Hidratación de sesión colgada → limpiando storage y mostrando login.');
      clearLocalAuthState();
      // Forzar al SDK a soltar la sesión actual también
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setUser(null);
      setLoading(false);
    }, HYDRATION_TIMEOUT_MS);

    getStoredSession()
      .then(session => {
        if (!isMounted || loginSettledRef.current) return;
        setUser(session);
      })
      .catch(e => {
        console.warn('[Stratos] Hidratación falló:', e?.message || e);
        if (!isMounted || loginSettledRef.current) return;
        // Si reventó, limpiar y mostrar login (no nos quedamos "Verificando…")
        clearLocalAuthState();
        setUser(null);
      })
      .finally(() => {
        clearTimeout(hydrationTimer);
        if (!isMounted) return;
        hydrationDoneRef.current = true;
        if (!loginSettledRef.current) setLoading(false);
      });

    // ── Listener Supabase en tiempo real ────────────────────────────────
    // Maneja eventos: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED,
    // PASSWORD_RECOVERY. Si el refresh falla, Supabase emite SIGNED_OUT con
    // session=null → limpiamos y mandamos a login (no "Verificando…").
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Nunca desloguear una sesión demo local por eventos de Supabase
        if (isDemo()) return;

        // Eventos de fin de sesión / token roto → cleanup completo
        if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
          clearLocalAuthState();
          setUser(null);
          return;
        }

        // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED → refrescar perfil
        // (TOKEN_REFRESHED es el caso más común: el SDK renovó el access
        // token automáticamente. Sólo refrescamos el perfil si pasó >5min
        // desde el último fetch para no martillar la BD.)
        try {
          const profile = await getStoredSession();
          if (isMounted && !isDemo()) setUser(profile);
        } catch (e) {
          console.warn('[Stratos] onAuthStateChange refresh perfil falló:', e?.message);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(hydrationTimer);
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

  /**
   * upgradeToOnline(profile) — transición silenciosa del usuario offline
   * a online cuando Supabase vuelve a estar disponible. La invoca App.jsx
   * después de un silentSignIn exitoso.
   */
  const upgradeToOnline = useCallback((profile) => {
    if (!profile) return;
    // Limpiar el snapshot offline para que el próximo refresh use la
    // sesión real de Supabase (sino getStoredSession lo prefiere y nos
    // deja atrapados en _offline:true para siempre).
    clearOfflineSession();
    setUser(profile);  // sin _offline → vuelve al modo normal
  }, []);

  const value = {
    user, loading, error,
    isAuthenticated: !!user,
    login, register, logout, resetPassword, clearError,
    hasRole, hasMinRole,
    upgradeToOnline,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
