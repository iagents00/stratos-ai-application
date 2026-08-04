/**
 * hooks/useTeam.js
 * ─────────────────────────────────────────────────────────────────────────────
 * El equipo REAL de la organización, leído de `profiles`.
 *
 * Por qué existe: toda lista de asesores de la app se derivaba de los leads
 * (`new Set(leads.map(l => l.asesor))`). Consecuencia: un asesor recién dado de
 * alta era invisible — no aparecía para reasignarle leads, ni en el selector de
 * "Nuevo cliente", ni en la vista de Asesores — hasta que alguien le asignaba su
 * primer lead a mano. Y no se le podía asignar porque no aparecía. Huevo y gallina.
 *
 * No hace falta RPC ni filtrar por organización: la policy
 * `profiles_select_org_scoped` ya limita el SELECT a los perfiles de la org del
 * usuario logueado, y existe el índice
 * `idx_profiles_org_role (organization_id, role) WHERE active = true`.
 *
 * Falla en silencio devolviendo [] (demo, offline o sesión caída). Los
 * consumidores deben UNIR esta lista con la derivada de leads, nunca
 * sustituirla: así nadie desaparece si esta query no responde.
 *
 * La versión anterior de este archivo mapeaba columnas que no existen en el
 * esquema (deals, revenue, efficiency, skills_count, color, whatsapp) y devolvía
 * `null` cuando no había filas; nunca tuvo consumidores.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

/** Roles que pueden tener leads asignados (los demás son áreas de soporte). */
export const SALES_ROLES = ['asesor', 'director', 'ceo'];

export function useTeam() {
  const [team, setTeam]       = useState([]);   // SIEMPRE array, nunca null
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const alive = useRef(true);

  // Sin setState síncrono: el primer statement es el await, así que llamarla
  // desde el efecto no dispara renders en cascada.
  const fetchTeam = useCallback(async () => {
    try {
      const { data, error: qErr } = await supabase
        .from('profiles')
        .select('id, name, role, active, crm_only')
        .eq('active', true)
        .order('name');
      if (!alive.current) return;
      if (qErr) throw qErr;
      setTeam((data || []).filter(p => p.name && p.name.trim()));
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setTeam([]);
      setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    fetchTeam();
    return () => { alive.current = false; };
  }, [fetchTeam]);

  // Referencia estable: los consumidores la meten en deps de useMemo.
  const asesores = useMemo(
    () => team.filter(p => SALES_ROLES.includes(p.role)).map(p => p.name),
    [team]
  );

  return { team, asesores, loading, error, refresh: fetchTeam };
}
