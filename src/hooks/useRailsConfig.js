/** Shared configuration, isolated by authenticated user + organization; refreshed on return and every minute. */
import { useSyncExternalStore, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { crearRailsStore, puedeConfigurarRails } from "../lib/rails-store";
let currentKey;
let currentStore;
export function useRailsConfig() {
  const { user } = useAuth();
  const key = `${user?.id || ""}:${user?.organizationId || ""}:${user?.role || ""}:${!!user?._offline}`;
  const sinBase =
    !user?.organizationId ||
    user?._offline ||
    user?.isDemo ||
    user?.id === "demo-user-local";
  const store = useMemo(() => {
    if (currentKey !== key) {
      currentKey = key;
      currentStore = crearRailsStore(supabase, user || {});
    }
    return currentStore;
    // key contains every scope field the store uses; exclude volatile profile identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const snap = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => {
    if (sinBase) return;
    store.load();
    const refresh = () => {
      if (!document.hidden) store.load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [store, sinBase]);
  return {
    ...snap,
    cargando: !sinBase && !snap.cargada && !snap.error,
    guardar: store.save,
    recargar: store.load,
    puedeGuardar: !sinBase && puedeConfigurarRails(user),
    sinBase,
  };
}
