import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export function useBoard(orgId, userId) {
  const [data, setData] = useState({ projects: [], tasks: [], people: [], brands: [] });
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const sequence = useRef(0), busy = useRef(false);
  const load = useCallback(async () => {
    if (!orgId) return;
    const request = ++sequence.current; setLoading(true); setError('');
    try {
      // Page through tasks rather than silently losing a growing backlog at the API row cap.
      const allTasks = []; let offset = 0;
      for (;;) {
        const r = await supabase.from('mkt_tasks').select('*').eq('organization_id', orgId).is('deleted_at', null).order('created_at').order('id').range(offset, offset + 499);
        if (r.error) throw r.error;
        allTasks.push(...r.data); if (r.data.length < 500) break; offset += 500;
      }
      const results = await Promise.all([
        supabase.from('mkt_projects').select('*').eq('organization_id', orgId).is('deleted_at', null).order('orden').order('created_at'),
        supabase.from('profiles').select('id,name,role').eq('organization_id', orgId),
        supabase.from('mkt_brands').select('id,nombre').eq('organization_id', orgId).eq('activo', true).order('orden'),
      ]);
      for (const r of results) if (r.error) throw r.error;
      if (request === sequence.current) setData({ projects: results[0].data, tasks: allTasks, people: results[1].data, brands: results[2].data });
    } catch { if (request === sequence.current) setError('No se pudo cargar tu tablero. Reintenta con Actualizar.'); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [orgId]);
  useEffect(() => { setData({ projects: [], tasks: [], people: [], brands: [] }); load(); return () => { sequence.current++; }; }, [load]);
  const save = async (table, payload, existing) => {
    if (busy.current || !orgId || !userId) return false;
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const row = { ...payload, updated_at: new Date().toISOString() };
      let query;
      if (existing) query = supabase.from(table).update(row).eq('id', existing.id).eq('organization_id', orgId).eq('updated_at', existing.updated_at).is('deleted_at', null);
      else query = supabase.from(table).insert({ ...row, organization_id: orgId, created_by: userId });
      const result = await query.select('id').single();
      if (result.error || !result.data) throw new Error(existing ? 'No se guardó: la tarea o el proyecto cambió en otra sesión. Copia tu borrador, pulsa Actualizar, cierra el editor y vuelve a abrirlo para revisar los cambios antes de guardar.' : 'No se pudo guardar. Tu borrador sigue aquí; revisa la conexión y reintenta.');
      setNotice('Guardado en I Space.'); await load(); return true;
    } catch (e) { setError(e.message); return false; }
    finally { busy.current = false; setSaving(false); }
  };
  return { ...data, loading, saving, error, setError, notice, load, save };
}
