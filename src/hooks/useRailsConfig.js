/**
 * hooks/useRailsConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lee y guarda la configuración de Stratos Rails de la organización.
 * Vive en `organizations.meta_config.rails`.
 *
 * ── POR QUÉ UNA TIENDA COMPARTIDA Y NO ESTADO POR COMPONENTE ─────────────────
 * Dos pantallas distintas consumen esto: la de ajustes (Proceso) y el CRM. Con
 * un useState por componente cada una tenía su propia copia — se probó y el
 * síntoma fue exacto: prender el interruptor en Ajustes decía "Prendido", y al
 * entrar al CRM seguía sin aparecer Mi Día, porque esa otra copia nunca se
 * enteró. Además ambas consultaban la base por separado.
 *
 * Con `useSyncExternalStore` hay UNA sola verdad en memoria: quien la cambia la
 * cambia para todos, y la consulta se hace una vez por organización.
 *
 * ── SEGURIDAD ────────────────────────────────────────────────────────────────
 * La RLS `organizations_update_meta` ya limita la escritura a super_admin/admin
 * de la misma org, así que el control de acceso no se reimplementa acá: si un
 * asesor intentara guardar, Supabase lo rechaza y devolvemos el error.
 *
 * ── NUNCA A MEDIAS ───────────────────────────────────────────────────────────
 * Siempre devuelve una config completa y usable. Mientras carga, sin sesión, o
 * si la consulta falla, se usan los defaults (`activo: false`, o sea el CRM de
 * siempre). Una falla de red no puede cambiarle la pantalla a nadie.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useSyncExternalStore, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { fusionarRails, compactarRails } from "../lib/rails-config";

const VACIA = fusionarRails(null);

// La instantánea es inmutable: useSyncExternalStore compara por referencia, así
// que se reemplaza entera en cada cambio y nunca se muta en el lugar.
let estado = { orgId: null, cfg: VACIA, cargada: false };
const oyentes = new Set();
let pidiendo = null;   // consulta en vuelo, para no preguntarle dos veces a la base

function publicar(siguiente) {
  estado = siguiente;
  for (const avisar of oyentes) avisar();
}
function suscribir(avisar) {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
}
const instantanea = () => estado;

function cargar(orgId) {
  if (pidiendo) return pidiendo;
  pidiendo = supabase
    .from("organizations").select("meta_config").eq("id", orgId).maybeSingle()
    .then(({ data, error }) => {
      if (error) console.warn("[Rails] no se pudo leer la configuración:", error.message);
      // Aun con error se marca cargada: con los defaults el CRM se ve como
      // siempre, que es exactamente lo que debe pasar si falla la red.
      publicar({ orgId, cfg: fusionarRails(data?.meta_config?.rails), cargada: true });
    })
    .finally(() => { pidiendo = null; });
  return pidiendo;
}

export function useRailsConfig() {
  const { user } = useAuth();
  const orgId = user?.organizationId || null;
  const sinBase = !orgId || user?._offline || user?.id === "demo-user-local";

  const snap = useSyncExternalStore(suscribir, instantanea, instantanea);

  useEffect(() => {
    if (sinBase) return;
    if (estado.orgId === orgId && estado.cargada) return;
    // Al cambiar de organización, lo anterior deja de valer en el acto.
    if (estado.orgId !== orgId) publicar({ orgId, cfg: VACIA, cargada: false });
    cargar(orgId);
  }, [orgId, sinBase]);

  /**
   * Guarda. Lee meta_config ENTERO justo antes de escribir y solo reemplaza la
   * clave `rails` — si escribiéramos `{ rails }` a secas nos llevaríamos por
   * delante plan, protocol, brand y campaign_aliases de esa empresa.
   */
  const guardar = useCallback(async (siguiente) => {
    publicar({ orgId, cfg: siguiente, cargada: true });   // optimista: responde al instante
    if (sinBase) return { ok: true, local: true };

    const { data, error: leer } = await supabase
      .from("organizations").select("meta_config").eq("id", orgId).maybeSingle();
    if (leer) return { ok: false, error: leer.message };

    const { error } = await supabase
      .from("organizations")
      .update({ meta_config: { ...(data?.meta_config || {}), rails: compactarRails(siguiente) } })
      .eq("id", orgId);

    if (error) {
      console.warn("[Rails] no se pudo guardar:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }, [orgId, sinBase]);

  return {
    cfg: snap.cfg,
    cargando: !sinBase && !snap.cargada,
    guardar,
    puedeGuardar: !sinBase,
  };
}
