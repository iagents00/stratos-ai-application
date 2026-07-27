/**
 * useCatalogo — el catálogo de desarrollos que ven Proyectos y Create.
 * ─────────────────────────────────────────────────────────────────────────────
 * Lee la tabla `catalogo_proyectos` de Supabase (fuente de verdad, la misma que
 * usa el asistente de Telegram) y cae a la SEMILLA del repo
 * (src/app/data/catalogoProyectos.js) si Supabase falla o la tabla está vacía.
 * Así el módulo nunca queda en blanco, ni siquiera sin conexión.
 *
 *   const { items, loading, source, canEdit, save, toggleVisible, refresh } = useCatalogo();
 *
 * `source` dice de dónde salieron los datos: 'db' (vivo, editable) o 'seed'
 * (respaldo del repo, solo lectura) — la UI lo avisa para no mentirle al equipo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { CATALOGO_SECCIONES } from '../app/data/catalogoProyectos';
import {
  fetchCatalogo, saveProyecto, setProyectoVisible, explainSaveError, SECCION_CRM,
} from '../lib/catalogo-proyectos';

// Roles que la RLS de Supabase acepta para escribir en el catálogo
// (política `catalogo_insert_admin` → public.is_admin_or_above()).
const EDITOR_ROLES = ['super_admin', 'admin', 'ceo', 'director'];

/** Semilla del repo aplanada al mismo shape que devuelve Supabase. */
const seedItems = () => {
  const out = [];
  (CATALOGO_SECCIONES || []).forEach((sec) => {
    if (sec.id !== SECCION_CRM) return; // solo la pestaña visible, igual que en prod
    (sec.items || []).forEach((it, idx) => {
      out.push({
        ...it,
        id: `seed:${sec.id}:${idx}`,
        seccion: sec.id,
        seccionNombre: sec.nombre,
        visible: true,
        source: 'seed',
      });
    });
  });
  return out;
};

export function useCatalogo() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('seed');
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const seed = useMemo(seedItems, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { items: live, total, error: fetchError } = await fetchCatalogo();
      if (!alive.current) return;
      if (fetchError || total === 0) {
        // Sin tabla cargada o sin conexión → catálogo del repo, solo lectura.
        setItems(seed);
        setSource('seed');
        setError(fetchError ? explainSaveError(fetchError) : null);
      } else {
        setItems(live);
        setSource('db');
        setError(null);
      }
    } catch (e) {
      if (!alive.current) return;
      setItems(seed);
      setSource('seed');
      setError(e?.message || 'No se pudo leer el catálogo.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [seed]);

  useEffect(() => {
    alive.current = true;
    refresh();
    return () => { alive.current = false; };
  }, [refresh]);

  const canEdit = EDITOR_ROLES.includes(user?.role);

  /** Alta o edición. Devuelve { ok, message }. Refresca el catálogo si sale bien. */
  const save = useCallback(async (item) => {
    const { data, error: saveError } = await saveProyecto(item, {
      organizationId: user?.organizationId,
      userName: user?.name,
    });
    if (saveError) return { ok: false, message: explainSaveError(saveError) };
    // Actualización optimista + refresco (el orden lo pone Supabase).
    if (data && alive.current) {
      setItems((prev) => {
        const exists = prev.some((p) => p.id === data.id);
        return exists ? prev.map((p) => (p.id === data.id ? data : p)) : [data, ...prev];
      });
      setSource('db');
    }
    refresh();
    return { ok: true, message: '' };
  }, [user?.organizationId, user?.name, refresh]);

  /** Mostrar/ocultar (NO borra). Devuelve { ok, message }. */
  const toggleVisible = useCallback(async (id, visible) => {
    const { error: visError } = await setProyectoVisible(id, visible);
    if (visError) return { ok: false, message: explainSaveError(visError) };
    if (alive.current && !visible) setItems((prev) => prev.filter((p) => p.id !== id));
    return { ok: true, message: '' };
  }, []);

  return { items, loading, source, error, canEdit, save, toggleVisible, refresh };
}

export default useCatalogo;
