/**
 * hooks/useTeam.js
 * ─────────────────────────────────────────────────────────────────────────────
 * El equipo REAL de la organización, leído de `profiles`.
 *
 * Por qué existe: hasta ahora toda lista de asesores de la app se derivaba de
 * los leads (`new Set(leads.map(l => l.asesor))`). Consecuencia: un asesor
 * recién dado de alta era invisible — no aparecía para reasignarle leads, ni en
 * el selector de "Nuevo cliente", ni en la vista de Asesores — hasta que
 * alguien le asignaba su primer lead a mano. Huevo y gallina.
 *
 * No hace falta RPC ni filtrar por organización: la policy `profiles_select_org_scoped`
 * ya limita el SELECT a los perfiles de la org del usuario logueado, y existe el
 * índice `idx_profiles_org_role (organization_id, role) WHERE active = true`.
 *
 * Falla en silencio devolviendo [] (modo demo, offline o sesión caída). Los
 * consumidores deben UNIR esta lista con la derivada de leads, nunca sustituirla:
 * así nadie desaparece si esta query no responde.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/** Roles que pueden tener leads asignados (los demás son áreas de soporte). */
export const SALES_ROLES = ['asesor', 'director', 'ceo'];

export function useTeam() {
  const [team, setTeam]       = useState([]);   // SIEMPRE array, nunca null
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from('profiles')
        .select('id, name, role, active')
        .eq('active', true)
        .order('name');
      if (qErr) throw qErr;
      setTeam((data || []).filter(p => p.name && p.name.trim()));
      setError(null);
    } catch (e) {
      // Silencioso a propósito: sin sesión/offline el consumidor cae a su
      // lista derivada de leads y la UI sigue funcionando igual que antes.
      setTeam([]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  // Referencia estable: los consumidores la meten en deps de useMemo.
  const asesores = useMemo(
    () => team.filter(p => SALES_ROLES.includes(p.role)).map(p => p.name),
    [team]
  );

  return { team, asesores, loading, error, refresh: fetchTeam };
}
