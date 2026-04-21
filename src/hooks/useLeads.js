import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('LEADS')
        .select('*');

      if (error) throw error;

      // Map Supabase columns to the UI expectations if needed
      // Current Supabase columns: FECHA INGRESO, ASESOR, NOMBRE DEL CLIENTE, TELEFONO, ESTATUS, PRESUPUESTO, PROYECTO DE INTERES, CAMPAÑA, id, NOTAS
      const mappedLeads = data.map(l => ({
        id: l.id,
        fechaIngreso: l["FECHA INGRESO"],
        asesor: l.ASESOR,
        n: l["NOMBRE DEL CLIENTE"],
        phone: l.TELEFONO,
        st: l.ESTATUS,
        presupuesto: l.PRESUPUESTO,
        budget: `$${(l.PRESUPUESTO / 1000).toFixed(0)}K USD`,
        p: l["PROYECTO DE INTERES"],
        campana: l["CAMPAÑA"],
        notas: Array.isArray(l.NOTAS) ? l.NOTAS.map(n => n.nota).join('\n') : l.NOTAS,
        // Mocking some fields not yet in DB to maintain UI compatibility
        sc: l.sc || Math.floor(Math.random() * 40) + 60,
        tag: l.tag || "Nuevo Prospecto",
        bio: l.bio || "Cargado desde base de datos.",
        risk: l.risk || "Sin riesgo aparente.",
        friction: l.friction || "Bajo",
        nextAction: l.nextAction || "Contactar cliente",
        nextActionDate: l.nextActionDate || "Hoy",
        isNew: l.isNew ?? false,
        hot: l.hot ?? false,
      }));

      setLeads(mappedLeads);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateLead = async (id, updates) => {
    try {
      // Map back to DB columns if necessary
      const dbUpdates = {};
      if (updates.st) dbUpdates.ESTATUS = updates.st;
      if (updates.asesor) dbUpdates.ASESOR = updates.asesor;
      if (updates.n) dbUpdates["NOMBRE DEL CLIENTE"] = updates.n;
      if (updates.phone) dbUpdates.TELEFONO = updates.phone;
      if (updates.presupuesto) dbUpdates.PRESUPUESTO = updates.presupuesto;
      if (updates.p) dbUpdates["PROYECTO DE INTERES"] = updates.p;
      if (updates.campana) dbUpdates["CAMPAÑA"] = updates.campana;
      
      // If we have explicit NOTAS as string, we might need translation back to JSON
      // but for now let's just keep it simple.

      const { error } = await supabase
        .from('LEADS')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      // The real-time subscription will trigger a refresh
    } catch (e) {
      console.error("Error updating lead:", e.message);
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Subscribe to changes
    const subscription = supabase
      .channel('public:LEADS')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'LEADS' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return { leads, loading, error, refresh: fetchLeads, updateLead };
}

