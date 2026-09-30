/** Store scoped to one authenticated person and organization. Never publishes an unconfirmed write. */
import { fusionarRails, compactarRails } from "./rails-config";
export const puedeConfigurarRails = (user) =>
  ["admin", "super_admin"].includes(user?.role);
export function vistaPreviaRails(user, search = "") {
  if (!puedeConfigurarRails(user)) return null;
  const value = new URLSearchParams(search).get("rails");
  return value === "1" ? true : value === "0" ? false : null;
}
const same = (a, b) =>
  JSON.stringify(compactarRails(fusionarRails(a))) ===
  JSON.stringify(compactarRails(fusionarRails(b)));
export function crearRailsStore(client, scope) {
  let snap = {
    cfg: fusionarRails(null),
    cargada: false,
    cargando: false,
    error: null,
    guardando: false,
  };
  let pending;
  let generation = 0;
  const listeners = new Set();
  const publish = (patch) => {
    snap = { ...snap, ...patch };
    listeners.forEach((fn) => fn());
  };
  const read = () =>
    client
      .from("organizations")
      .select("meta_config")
      .eq("id", scope.organizationId)
      .abortSignal(AbortSignal.timeout(10000))
      .maybeSingle();
  const load = () => {
    if (pending) return pending;
    if (snap.guardando) return Promise.resolve();
    const epoch = generation;
    publish({ cargando: true });
    pending = (async () => {
      try {
        const { data, error } = await read();
        if (epoch !== generation) return;
        if (error || !data)
          throw new Error(
            "El servicio de Stratos no respondió. Tu internet puede estar bien; reintenta en unos minutos.",
          );
        // Preserve identity unless configuration really changed (seller list stays stable).
        publish({
          cfg: same(snap.cfg, data.meta_config?.rails)
            ? snap.cfg
            : fusionarRails(data.meta_config?.rails),
          cargada: true,
          error: null,
        });
      } catch (e) {
        if (epoch === generation) publish({ error: e.message });
      } finally {
        publish({ cargando: false });
        pending = null;
      }
    })();
    return pending;
  };
  return {
    getSnapshot: () => snap,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    load,
    async save(next, expected = snap.cfg) {
      if (
        !puedeConfigurarRails(scope) ||
        !scope.id ||
        !scope.organizationId ||
        scope._offline ||
        scope.isDemo ||
        scope.id === "demo-user-local"
      )
        return {
          ok: false,
          error: "Solo un administrador conectado puede publicar el proceso.",
        };
      if (snap.guardando)
        return { ok: false, error: "Espera a que termine el guardado actual." };
      if (!snap.cargada || snap.error)
        return {
          ok: false,
          error: "Primero vuelve a cargar la configuración vigente.",
        };
      generation++;
      publish({ guardando: true });
      try {
        const { data, error } = await read();
        if (error || !data)
          throw new Error(
            "No se pudo verificar la configuración. Tus cambios siguen en el borrador.",
          );
        if (!same(expected, data.meta_config?.rails))
          throw new Error(
            "Otro administrador cambió el proceso. Recarga la configuración antes de publicar.",
          );
        const meta = {
          ...(data.meta_config || {}),
          rails: compactarRails(fusionarRails(next)),
        };
        let query = client
          .from("organizations")
          .update({ meta_config: meta })
          .eq("id", scope.organizationId);
        // Compare-and-swap: preserves concurrently edited plan/brand/protocol AND other admin changes.
        query =
          data.meta_config == null
            ? query.is("meta_config", null)
            : query.eq("meta_config", JSON.stringify(data.meta_config));
        const saved = await query
          .select("meta_config")
          .abortSignal(AbortSignal.timeout(10000))
          .maybeSingle();
        if (saved.error || !saved.data)
          throw new Error(
            "No se confirmó el guardado: revisa permisos o recarga si otra persona cambió la configuración.",
          );
        publish({
          cfg: fusionarRails(saved.data.meta_config?.rails),
          cargada: true,
          error: null,
        });
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error:
            e.message || "No se confirmó el guardado. Conservamos tu borrador.",
        };
      } finally {
        publish({ guardando: false });
      }
    },
  };
}
