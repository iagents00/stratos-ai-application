import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useTeam() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) throw error;

      // Map DB columns to UI expectations
      // Assuming columns: name, role, deals, revenue, efficiency, skills, color, whatsapp, calendly
      const mapped = data.map(t => ({
        n: t.name,
        r: t.role_display || t.role,
        d: t.deals || 0,
        rv: t.revenue || "$0",
        e: t.efficiency || 0,
        sk: t.skills_count || 0,
        role: t.role,
        c: t.color || '#8B5CF6',
        wa: t.whatsapp || "",
        cal: t.calendly || ""
      }));

      setTeam(mapped.length > 0 ? mapped : null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  return { team, loading, error, refresh: fetchTeam };
}
