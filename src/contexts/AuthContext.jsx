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

// Timeout SUAVE de la hidratación inicial. Si la lectura de la sesión tarda,
// mostramos el login pero NO destruimos storage ni hacemos signOut — eso
// cerraba sesiones legítimas (red lenta, cold start de Supabase, etc.).
// Si la promesa eventualmente resuelve con sesión válida, la lógica del
// .then la usa igual. Subimos de 12s a 25s para tolerar redes lentas.
const HYDRATION_TIMEOUT_MS = 25000;

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

    // ── Hidratación inicial con timeout SUAVE (no destructivo) ──────────
    // CRITICAL FIX: el timeout anterior limpiaba storage + llamaba signOut
    // si la hidratación tardaba >12s. Eso cerraba sesiones LEGÍTIMAS de
    // usuarios con red lenta (México→us-west-2 RTT alto, cold start de
    // Supabase, etc.). Ahora el timeout sólo muestra el login si la promesa
    // tarda, PERO NO TOCA STORAGE NI HACE SIGNOUT. Si la hidratación
    // eventualmente resuelve con sesión válida, el listener SIGNED_IN del
    // SDK reconstituye al usuario automáticamente. Resultado: aunque haya
    // un timeout transitorio, el F5 mantiene la sesión.
    const hydrationTimer = setTimeout(() => {
      if (!isMounted || hydrationDoneRef.current || loginSettledRef.current) return;
      console.warn('[Stratos] Hidratación tardando >25s, mostrando login pero conservando storage');
      // NO marcar hydrationDoneRef=true: dejamos que la promesa de getStoredSession()
      // siga corriendo y, si responde después, la lógica del .then la usa.
      setLoading(false);
    }, HYDRATION_TIMEOUT_MS);

    getStoredSession()
      .then(session => {
        if (!isMounted || loginSettledRef.current) return;
        // Si llegó después del timeout (loading ya está en false), pero hay
        // sesión válida, restauramos al usuario igual.
        if (session) setUser(session);
      })
      .catch(e => {
        console.warn('[Stratos] Hidratación falló (no destructivo):', e?.message || e);
        // NO limpiamos storage aquí. Si fue un error transitorio de red,
        // el próximo refresh del SDK puede recuperarse. Si fue un error
        // permanente (token revocado), el listener SIGNED_OUT lo manejará.
      })
      .finally(() => {
        clearTimeout(hydrationTimer);
        if (!isMounted) return;
        hydrationDoneRef.current = true;
        if (!loginSettledRef.current) setLoading(false);
      });

    // ── Listener Supabase en tiempo real ────────────────────────────────
    // FIX: SÓLO limpiar storage en SIGNED_OUT explícito o USER_DELETED.
    // El comportamiento anterior limpiaba en CUALQUIER evento con
    // session=null (incluyendo TOKEN_REFRESHED transitorios) lo que mataba
    // sesiones legítimas durante refresh races entre pestañas o realtime.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Nunca desloguear una sesión demo local por eventos de Supabase
        if (isDemo()) return;

        // SÓLO eventos EXPLÍCITOS de fin de sesión → cleanup destructivo
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          clearLocalAuthState();
          setUser(null);
          return;
        }

        // Otros eventos sin sesión (ej. TOKEN_REFRESHED transitorio) →
        // NO destruir storage. Sólo mostrar login si no había usuario.
        if (!session) {
          // Si previamente teníamos user pero session viene null, es probable
          // un evento de refresh en curso. Mantenemos el user hasta que llegue
          // un evento definitivo (SIGNED_IN nuevo o SIGNED_OUT).
          return;
        }

        // SIGNED_IN, TOKEN_REFRESHED con sesión, USER_UPDATED → refrescar perfil
        try {
          const profile = await getStoredSession();
          if (isMounted && !isDemo() && profile) setUser(profile);
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
