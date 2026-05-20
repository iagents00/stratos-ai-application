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
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  signIn,
  signUp,
  signOut,
  resetPassword as authResetPassword,
  getStoredSession,
  seedDemoUser,
  readSessionFromStorageSync,
  hasSupabaseAuthToken,
} from "../lib/auth";
import { clearOfflineSession } from "../lib/offline-mode";

export const AuthContext = createContext(null);

const DEMO_SESSION_KEY = 'stratos_demo';
const isDemo = () => sessionStorage.getItem(DEMO_SESSION_KEY) === '1';

// Timeout SUAVE de la hidratación inicial. Tras ajustar los timeouts internos
// de auth.js (getSession=3.5s, profile=5s), getStoredSession resuelve en <9s
// en el peor caso. Subimos un poco de margen (12s) por si la red está lenta
// pero NUNCA llegamos a 25s. Si dispara, mostramos login pero conservamos
// storage — la promesa puede aún resolver y entonces el .then setea user.
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
      else if (/^stratos\.leads\.cache\./i.test(k)) localStorage.removeItem(k); // cache CRM por user
      else if (k === 'stratos_session_cache') localStorage.removeItem(k);
      else if (k === 'stratos_offline_session') localStorage.removeItem(k);
    }
  } catch (_) { /* localStorage bloqueado en modo incógnito o por política — ignorar */ }
}

export function AuthProvider({ children }) {
  // HIDRATACIÓN SÍNCRONA — el F5 ya no muestra LoginScreen mientras
  // getStoredSession() corre. Si hay sesión cacheada (24h) la usamos
  // como user inicial; la validación asíncrona en background la reemplaza
  // por la versión fresca o la limpia si la sesión ya no es válida.
  const [user, setUser] = useState(() => readSessionFromStorageSync());
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // bootHydrating — "todavía estamos restaurando la sesión inicial".
  // Distinto de `loading` (que también se activa durante login/register).
  // App.jsx lo usa para mostrar splash en vez de LoginScreen cuando hay
  // probabilidad alta de tener sesión (JWT presente) pero la caché Stratos
  // ya expiró y getStoredSession aún no resolvió.
  // Si tenemos user de la caché SYNC, no necesitamos splash → false.
  // Si hay JWT pero no caché → true (mostrar splash).
  // Si no hay ninguno → false (LoginScreen de inmediato).
  const [bootHydrating, setBootHydrating] = useState(() => {
    // Si ya tenemos user sync, no hay nada que esperar para mostrar app.
    // El effect setea bootHydrating=false en su finally por consistencia.
    const cached = readSessionFromStorageSync();
    if (cached) return false;
    return hasSupabaseAuthToken();
  });

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
  /**
   * userLogoutRef — true SOLO cuando el usuario clickea Cerrar sesión.
   * Permite distinguir un SIGNED_OUT intencional de uno espontáneo (fallo
   * transitorio de refresh de JWT). Si es espontáneo, intentamos refrescar
   * la sesión antes de botar al usuario. Esto resuelve el bug "estoy en el
   * CRM y de la nada me bota al login".
   */
  const userLogoutRef = useRef(false);

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
      console.warn('[Stratos] Hidratación tardando >12s, mostrando login pero conservando storage');
      // NO marcar hydrationDoneRef=true: dejamos que la promesa de getStoredSession()
      // siga corriendo y, si responde después, la lógica del .then la usa.
      // Sí bajamos bootHydrating: pasado el timeout, mejor mostrar LoginScreen
      // que mantener al usuario eternamente en splash.
      setBootHydrating(false);
      setLoading(false);
    }, HYDRATION_TIMEOUT_MS);

    getStoredSession()
      .then(session => {
        if (!isMounted || loginSettledRef.current) return;
        // Sincronizar el user con el resultado real:
        //   · Si Supabase devuelve sesión válida → reemplazar la versión
        //     cacheada por la fresca (puede traer cambios en role/prefs).
        //   · Si Supabase devuelve null → la caché que usamos en el render
        //     inicial estaba obsoleta (signOut desde otra pestaña, cuenta
        //     desactivada, JWT expirado). Limpiamos para mostrar LoginScreen.
        setUser(session ?? null);
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
        setBootHydrating(false);
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

        // USER_DELETED y logout explícito → cleanup directo, sin reintento.
        if (event === 'USER_DELETED' || (event === 'SIGNED_OUT' && userLogoutRef.current)) {
          userLogoutRef.current = false;
          clearLocalAuthState();
          setUser(null);
          return;
        }

        // SIGNED_OUT espontáneo (no fue el usuario quien lo provocó) →
        // intentar UN refresh silencioso antes de botar. Esto cubre fallos
        // transitorios de refresh de JWT (red blip, cold start de Supabase,
        // race entre pestañas) que antes nos botaban al login en medio del
        // trabajo. Si el refresh recupera sesión, ignoramos el SIGNED_OUT.
        if (event === 'SIGNED_OUT') {
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (data?.session && !error && isMounted) {
              const profile = await getStoredSession();
              if (profile && isMounted) {
                setUser(profile);
                return;
              }
            }
          } catch (_) { /* fall through: refresh falló → aceptar logout */ }
          if (!isMounted) return;
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
    userLogoutRef.current = true;    // marca: el SIGNED_OUT que viene es intencional
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

  // FIX (perf): sin useMemo, cada render del AuthProvider creaba un nuevo
  // objeto `value` → React.Context dispara re-render de TODOS los consumers
  // que usan useAuth() (App.jsx, CRM, Dash, Sidebar, etc.). Como user es
  // estable durante una sesión y todas las callbacks ya tienen useCallback,
  // el objeto memoizado cambia solo cuando realmente cambia algo relevante.
  const value = useMemo(() => ({
    user, loading, error,
    bootHydrating,
    isAuthenticated: !!user,
    login, register, logout, resetPassword, clearError,
    hasRole, hasMinRole,
    upgradeToOnline,
  }), [user, loading, error, bootHydrating, login, register, logout, resetPassword, clearError, hasRole, hasMinRole, upgradeToOnline]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
