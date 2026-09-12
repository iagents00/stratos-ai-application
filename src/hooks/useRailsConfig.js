import { useSyncExternalStore, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { crearRailsStore } from '../lib/rails-store';

const store = crearRailsStore({
  async leer(orgId) {
    const { data, error } = await supabase.from('organizations').select('meta_config').eq('id', orgId).single();
    if (error) throw error;
    return data?.meta_config?.rails ?? null;
  },
  async escribir(cfg, esperada, orgId) {
    const { data, error } = await supabase.rpc('rails_guardar_config', { p_config: cfg, p_esperada: esperada, p_organization: orgId });
    if (error) throw error;
    return data;
  },
});

export function useRailsConfig() {
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const demo = user?.id === 'demo-user-local';
  const offline = !demo && (!orgId || !!user?._offline);
  const scope = `${user?.id || 'sin-sesion'}:${orgId || 'sin-org'}:${demo ? 'demo' : offline ? 'offline' : 'online'}`;
  const snapshot = useCallback(() => store.get(scope), [scope]);
  const snap = useSyncExternalStore(store.subscribe, snapshot, snapshot);
  const recargar = useCallback(() => {
    if (!offline && !demo) return store.cargar(scope, orgId, true);
  }, [scope, orgId, offline, demo]);
  useEffect(() => {
    if (!offline && !demo) store.cargar(scope, orgId);
    window.addEventListener('focus', recargar);
    return () => window.removeEventListener('focus', recargar);
  }, [scope, orgId, offline, demo, recargar]);
  const guardar = useCallback(cfg => store.guardar(scope, cfg, { demo, offline }), [scope, demo, offline]);
  return { cfg: snap.cfg, cargando: !demo && !offline && !snap.cargada,
    guardando: snap.guardando, error: snap.error, guardar, recargar, scope,
    puedeGuardar: !offline, demo };
}
