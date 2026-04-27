/**
 * lib/suggest-actions.js
 *
 * Cliente del agente IA "co-pilot" que sugiere próximas acciones
 * para un lead, usando el protocolo Duke del Caribe + técnicas de venta.
 *
 * Filosofía: companion of the asesor, not boss. Tono colaborativo,
 * técnica explícita en cada sugerencia, asesor decide.
 */
import { supabase } from "./supabase";

/**
 * Pide al agente IA sugerencias de próximas acciones.
 *
 * @param {object} lead - Lead data (name, bio, stage, score, notas, etc.)
 * @param {Array} tasks - Tasks actuales del lead (para no repetir)
 * @returns {Promise<{suggestions: Array, summary_one_line: string, error?: string}>}
 */
export async function suggestNextActions(lead, tasks = []) {
  if (!lead) return { suggestions: [], error: "lead requerido" };
  try {
    const { data, error } = await supabase.functions.invoke("suggest-next-actions", {
      body: { lead, tasks },
    });
    if (error) {
      console.warn("[suggest-actions] error:", error?.message);
      return { suggestions: [], error: error?.message };
    }
    return {
      suggestions: data?.suggestions || [],
      summary_one_line: data?.summary_one_line || "",
      tokens_used: data?.tokens_used || 0,
    };
  } catch (e) {
    return { suggestions: [], error: e?.message || "Error de conexión" };
  }
}

/**
 * Convierte una sugerencia del agente en una task del CRM.
 */
export function suggestionToTask(suggestion, source = "ai") {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    action: suggestion.action,
    date: suggestion.date || "",
    completed: false,
    created_at: new Date().toISOString(),
    completed_at: null,
    source,
    technique: suggestion.technique || "",
    reason: suggestion.reason || "",
    priority: suggestion.priority || "media",
  };
}
