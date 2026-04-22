import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * useLeads — Hook principal para obtener y gestionar leads desde Supabase
 * 
 * Mapea las columnas de la tabla LEADS (MAYÚSCULAS) al schema del frontend
 * (camelCase/alias), normalizando estatus, nombres y calculando campos
 * derivados como daysInactive, score, bio, etc.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── STAGE NORMALIZATION MAP ──────────────────────────────────────────────────
// Supabase stores status in UPPER CASE, frontend expects Title Case
const STAGE_NORMALIZE = {
  "NUEVO REGISTRO":     "Nuevo Registro",
  "PRIMER CONTACTO":    "Primer Contacto",
  "SEGUIMIENTO":        "Seguimiento",
  "ZOOM AGENDADO":      "Zoom Agendado",
  "ZOOM CONCRETADO":    "Zoom Concretado",
  "VISITA AGENDADA":    "Visita Agendada",
  "VISITA CONCRETADA":  "Visita Concretada",
  "NEGOCIACIÓN":        "Negociación",
  "NEGOCIACION":        "Negociación",
  "CIERRE":             "Cierre",
  "PERDIDO":            "Perdido",
  // fallback for already-normalized values
  "Nuevo Registro":     "Nuevo Registro",
  "Primer Contacto":    "Primer Contacto",
  "Seguimiento":        "Seguimiento",
  "Zoom Agendado":      "Zoom Agendado",
  "Zoom Concretado":    "Zoom Concretado",
  "Visita Agendada":    "Visita Agendada",
  "Visita Concretada":  "Visita Concretada",
  "Negociación":        "Negociación",
  "Cierre":             "Cierre",
  "Perdido":            "Perdido",
};

// Stages ordered by pipeline progression for score calculation
const STAGE_WEIGHT = {
  "Nuevo Registro":     15,
  "Primer Contacto":    30,
  "Seguimiento":        45,
  "Zoom Agendado":      60,
  "Zoom Concretado":    72,
  "Visita Agendada":    78,
  "Visita Concretada":  85,
  "Negociación":        92,
  "Cierre":             98,
  "Perdido":            10,
};

/**
 * Normalizes status from DB (UPPER CASE) to frontend (Title Case)
 */
function normalizeStatus(raw) {
  if (!raw) return "Nuevo Registro";
  const trimmed = raw.trim();
  // Try exact match first
  if (STAGE_NORMALIZE[trimmed]) return STAGE_NORMALIZE[trimmed];
  // Try uppercase
  if (STAGE_NORMALIZE[trimmed.toUpperCase()]) return STAGE_NORMALIZE[trimmed.toUpperCase()];
  // Fallback: best-effort title case match
  const upper = trimmed.toUpperCase();
  for (const [key, val] of Object.entries(STAGE_NORMALIZE)) {
    if (key.toUpperCase() === upper) return val;
  }
  // If all else fails, return as Title Case
  return trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Normalize advisor name: "EMMANUEL ORTIZ" → "Emmanuel Ortiz"
 */
function normalizeAsesor(raw) {
  if (!raw) return "Sin asignar";
  return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Parse a flexible date string (from DB) into a Date object.
 * Supports: "17 Abril 9:37 PM", "4/22/2026, 4:12:07 PM", "10 Abril 12:00 PM", etc.
 */
function parseFlexDate(str) {
  if (!str) return null;
  // Try native parsing first
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  
  // Try Spanish month format: "17 Abril 9:37 PM"
  const meses = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
    'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
  };
  const match = str.match(/(\d{1,2})\s+(\w+)\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    const [, day, monthStr, hours, mins, ampm] = match;
    const monthKey = monthStr.toLowerCase();
    const monthIdx = meses[monthKey];
    if (monthIdx !== undefined) {
      let h = parseInt(hours);
      if (ampm?.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;
      const result = new Date(2026, monthIdx, parseInt(day), h, parseInt(mins));
      return result;
    }
  }
  return null;
}

/**
 * Calculate days of inactivity from the most recent activity date
 */
function calcDaysInactive(fechaIngreso, notas) {
  const now = new Date();
  let lastDate = parseFlexDate(fechaIngreso);

  // Check notas for the most recent date
  if (Array.isArray(notas) && notas.length > 0) {
    for (const nota of notas) {
      if (nota.fecha) {
        const notaDate = parseFlexDate(nota.fecha);
        if (notaDate && (!lastDate || notaDate > lastDate)) {
          lastDate = notaDate;
        }
      }
    }
  }

  if (!lastDate) return 0;
  const diffMs = now - lastDate;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Extract the last activity description from notas
 */
function getLastActivity(notas, fechaIngreso) {
  if (Array.isArray(notas) && notas.length > 0) {
    // Find the most recent note
    const sorted = [...notas].sort((a, b) => {
      const da = parseFlexDate(a.fecha);
      const db = parseFlexDate(b.fecha);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
    const latest = sorted[0];
    const text = latest.nota || "";
    return text.length > 60 ? text.substring(0, 57) + "…" : text;
  }
  return `Ingresó: ${fechaIngreso || "Sin fecha"}`;
}

/**
 * Generate smart bio from notas content
 */
function extractBio(notas, nombre) {
  if (Array.isArray(notas) && notas.length > 0) {
    // Combine all notes
    const allNotes = notas.map(n => n.nota || "").filter(Boolean).join(" ");
    if (allNotes.length > 10) {
      return allNotes.length > 180 ? allNotes.substring(0, 177) + "…" : allNotes;
    }
  }
  return `Lead registrado en el sistema. Pendiente primer contacto.`;
}

/**
 * Calculate a more realistic score based on stage, budget, and activity
 */
function calcScore(normalizedStatus, presupuesto, daysInactive, notasCount) {
  let base = STAGE_WEIGHT[normalizedStatus] || 30;
  
  // Budget bonus: higher budget = slightly higher score
  if (presupuesto >= 1000000) base = Math.min(base + 8, 99);
  else if (presupuesto >= 500000) base = Math.min(base + 5, 99);
  else if (presupuesto >= 200000) base = Math.min(base + 2, 99);
  
  // Activity penalty: more days inactive = lower score
  if (daysInactive > 14) base = Math.max(base - 15, 10);
  else if (daysInactive > 7) base = Math.max(base - 8, 15);
  else if (daysInactive > 3) base = Math.max(base - 3, 20);
  
  // Notes bonus: more engagement = slightly higher
  if (notasCount >= 3) base = Math.min(base + 5, 99);
  else if (notasCount >= 1) base = Math.min(base + 2, 99);
  
  return Math.round(base);
}

/**
 * Format budget display with proper scale
 */
function formatBudget(amount) {
  if (!amount || amount === 0) return "$0";
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M USD`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K USD`;
  return `$${amount.toLocaleString()} USD`;
}

/**
 * Determine next action based on stage and activity
 */
function suggestNextAction(normalizedStatus, daysInactive, notas) {
  // If there are recent notes with action items, use them
  if (Array.isArray(notas) && notas.length > 0) {
    const latest = notas[notas.length - 1]?.nota || "";
    if (latest.length > 5) return latest.length > 80 ? latest.substring(0, 77) + "…" : latest;
  }
  
  const actions = {
    "Nuevo Registro":     "Realizar primer contacto en las próximas 24 horas",
    "Primer Contacto":    "Dar seguimiento y agendar presentación",
    "Seguimiento":        "Enviar información de proyectos y agendar Zoom",
    "Zoom Agendado":      "Preparar presentación personalizada para el Zoom",
    "Zoom Concretado":    "Enviar propuesta y agendar visita a la propiedad",
    "Visita Agendada":    "Confirmar visita y preparar recorrido",
    "Visita Concretada":  "Enviar propuesta formal de negociación",
    "Negociación":        "Preparar documentación de cierre",
    "Cierre":             "Coordinar firma ante notaría",
    "Perdido":            "Evaluar reactivación en 30 días",
  };
  
  if (daysInactive > 7) return `Reactivar contacto — ${daysInactive} días sin actividad`;
  return actions[normalizedStatus] || "Contactar cliente";
}

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Keep stable scores per lead id so they don't randomize on re-renders
  const scoreCache = useRef({});

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('LEADS')
        .select('*');

      if (error) throw error;

      // Map Supabase columns to the UI expectations
      // DB columns: FECHA INGRESO, ASESOR, NOMBRE DEL CLIENTE, TELEFONO, ESTATUS, PRESUPUESTO, PROYECTO DE INTERES, CAMPAÑA, id, NOTAS
      const mappedLeads = (data || []).map(l => {
        const rawStatus = l.ESTATUS || "";
        const normalizedStatus = normalizeStatus(rawStatus);
        const presupuesto = Number(l.PRESUPUESTO) || 0;
        const notasArr = Array.isArray(l.NOTAS) ? l.NOTAS : [];
        const daysInactive = calcDaysInactive(l["FECHA INGRESO"], notasArr);
        
        // Calculate score once per lead, cache it
        if (!scoreCache.current[l.id]) {
          scoreCache.current[l.id] = calcScore(normalizedStatus, presupuesto, daysInactive, notasArr.length);
        }
        const sc = scoreCache.current[l.id];
        
        // Detect hot leads: high budget + advanced stage OR low inactivity
        const isHot = (presupuesto >= 1000000 && ["Negociación", "Zoom Concretado", "Visita Concretada"].includes(normalizedStatus))
          || (daysInactive <= 2 && ["Zoom Concretado", "Visita Concretada", "Negociación"].includes(normalizedStatus));
        
        // New leads: entered within last 3 days
        const ingresoDate = parseFlexDate(l["FECHA INGRESO"]);
        const daysSinceIngreso = ingresoDate ? Math.floor((Date.now() - ingresoDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const isNew = daysSinceIngreso <= 3 || normalizedStatus === "Nuevo Registro";

        return {
          id: l.id,
          fechaIngreso: l["FECHA INGRESO"] || "Sin fecha",
          asesor: normalizeAsesor(l.ASESOR),
          n: l["NOMBRE DEL CLIENTE"] || "Sin nombre",
          phone: l.TELEFONO || "",
          st: normalizedStatus,
          presupuesto,
          budget: formatBudget(presupuesto),
          p: l["PROYECTO DE INTERES"] || "Sin proyecto",
          campana: l["CAMPAÑA"] || "Sin campaña",
          notas: notasArr.map(n => n.nota || "").filter(Boolean).join('\n') || "Sin notas",
          notasRaw: notasArr, // Keep raw notas for detail view
          sc,
          tag: normalizedStatus,
          bio: extractBio(notasArr, l["NOMBRE DEL CLIENTE"]),
          risk: daysInactive > 10 ? `${daysInactive} días sin contacto — riesgo de enfriamiento` : daysInactive > 5 ? "Contacto reciente perdiendo momentum" : "Sin riesgo aparente",
          friction: daysInactive > 10 ? "Alto" : daysInactive > 5 ? "Medio" : "Bajo",
          nextAction: suggestNextAction(normalizedStatus, daysInactive, notasArr),
          nextActionDate: daysInactive > 3 ? "Hoy — Urgente" : "Esta semana",
          lastActivity: getLastActivity(notasArr, l["FECHA INGRESO"]),
          daysInactive,
          isNew,
          hot: isHot,
          email: "",
        };
      });

      setLeads(mappedLeads);
    } catch (e) {
      setError(e.message);
      console.error("[useLeads] Error fetching leads:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateLead = async (id, updates) => {
    try {
      // Map back to DB columns
      const dbUpdates = {};
      // Normalize status back to UPPER CASE for DB storage
      if (updates.st) dbUpdates.ESTATUS = updates.st.toUpperCase();
      if (updates.asesor) dbUpdates.ASESOR = updates.asesor.toUpperCase();
      if (updates.n) dbUpdates["NOMBRE DEL CLIENTE"] = updates.n;
      if (updates.phone) dbUpdates.TELEFONO = updates.phone;
      if (updates.presupuesto !== undefined) dbUpdates.PRESUPUESTO = Number(updates.presupuesto) || 0;
      if (updates.p) dbUpdates["PROYECTO DE INTERES"] = updates.p;
      if (updates.campana) dbUpdates["CAMPAÑA"] = updates.campana;
      if (updates.notas) dbUpdates.NOTAS = updates.notas;

      // Clear cached score so it recalculates
      delete scoreCache.current[id];

      const { error } = await supabase
        .from('LEADS')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      // The real-time subscription will trigger a refresh
    } catch (e) {
      console.error("[useLeads] Error updating lead:", e.message);
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Subscribe to real-time changes
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
