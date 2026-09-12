import { fusionarRails, compactarRails } from './rails-config';

/** Una instantánea por sesión/organización. Las respuestas tardías nunca cruzan de cuenta. */
export function crearRailsStore({ leer, escribir }) {
  const estados = new Map(), pendientes = new Map(), oyentes = new Set();
  function get(scope) {
    if (!estados.has(scope)) estados.set(scope, { cfg: fusionarRails(null), raw: null, cargada: false, error: null, guardando: false });
    return estados.get(scope);
  }
  function publicar(scope, parche) {
    estados.set(scope, { ...get(scope), ...parche });
    oyentes.forEach(fn => fn());
  }
  return {
    get,
    subscribe(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },
    async cargar(scope, orgId, force = false) {
      if (pendientes.has(scope)) return pendientes.get(scope);
      if (get(scope).guardando || (get(scope).cargada && !force)) return;
      const peticion = (async () => {
        try {
          const raw = await leer(orgId);
          publicar(scope, { cfg: fusionarRails(raw), raw: raw ?? null, orgId, cargada: true, error: null });
        } catch (e) {
          publicar(scope, { cargada: true, error: e.message || 'No se pudo leer el proceso.' });
        } finally { pendientes.delete(scope); }
      })();
      pendientes.set(scope, peticion);
      return peticion;
    },
    async guardar(scope, cfg, { demo = false, offline = false } = {}) {
      const previo = get(scope);
      if (offline) return { ok: false, error: 'Sin conexión. Tus cambios siguen aquí; vuelve a guardar al reconectar.' };
      if (previo.guardando || pendientes.has(scope)) return { ok: false, error: 'Espera a que termine la operación anterior.' };
      if (!demo && (!previo.cargada || previo.error)) return { ok: false, error: 'Recarga la configuración antes de guardar.' };
      publicar(scope, { guardando: true });
      try {
        const raw = demo ? compactarRails(fusionarRails(cfg)) : await escribir(compactarRails(fusionarRails(cfg)), previo.raw, previo.orgId);
        publicar(scope, { cfg: fusionarRails(raw), raw, cargada: true, error: null });
        return { ok: true, local: demo };
      } catch (e) {
        return { ok: false, error: e.message || 'No se pudo guardar. Conservamos tus cambios para reintentar.' };
      } finally { publicar(scope, { guardando: false }); }
    },
  };
}
