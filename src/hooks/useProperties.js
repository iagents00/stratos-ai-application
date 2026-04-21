import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useProperties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*');

      if (error) throw error;

      // Map DB columns to UI expectations
      // Assuming columns: name, units, sold, roi, price_range, location, status, color
      const mapped = data.map(p => ({
        n: p.name,
        u: p.units,
        s: p.sold,
        roi: p.roi,
        pr: p.price_range,
        loc: p.location,
        st: p.status,
        c: p.color || '#3B82F6',
      }));

      setProperties(mapped.length > 0 ? mapped : null); // Return null if empty to fallback to mock
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  return { properties, loading, error, refresh: fetchProperties };
}
