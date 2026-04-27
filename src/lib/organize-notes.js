/**
 * lib/organize-notes.js
 *
 * Toma texto libre/desordenado del asesor y lo organiza en campos
 * estructurados del CRM. Funciona en 2 niveles:
 *
 *   1. PARSER LOCAL (offline, gratis)
 *      Detecta patrones comunes con regex + heurística:
 *        objetivo, ubicación, presupuesto, próxima acción, notas.
 *      Funciona instantáneamente, sin API.
 *
 *   2. PARSER IA (online, Claude)
 *      Si el parser local no encuentra estructura clara, llama a la
 *      Edge Function `organize-lead-notes` que usa Claude para
 *      extraer la info de texto verdaderamente desordenado.
 *      Requiere VITE_SUPABASE_URL y la edge function deployada.
 *
 * USO:
 *   import { organizeNotes } from "../../lib/organize-notes";
 *   const result = await organizeNotes(textoLibre);
 *   // result = {
 *   //   objetivo, ubicacion, presupuesto, presupuesto_num,
 *   //   notas, next_action, next_action_date,
 *   //   confidence: 'high' | 'medium' | 'low',
 *   //   source: 'local' | 'ai'
 *   // }
 */
import { supabase } from "./supabase";

// ── Patrones para detección local ────────────────────────────
const LABELS = [
  "Objetivo", "Objectivo",
  "Ubicación", "Ubicacion", "Zona", "Lugar",
  "Presupuesto", "Budget",
  "Notas", "Nota", "Comentarios",
  "Meet", "Cita", "Próxima acción", "Proxima accion", "Llamada",
  "Teléfono", "Telefono", "Tel",
];

// Mes y día para detectar fechas en texto natural
const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic";
const DIAS  = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|hoy|mañana|manana|pasado|próxima|proxima";

const DATE_RE = new RegExp(
  `(?:` +
    `(?:${DIAS})\\s*\\d{0,2}` +                  // "lunes 5"
  `|\\d{1,2}\\s+de\\s+(?:${MESES})` +           // "5 de mayo"
  `|\\d{1,2}\\s+(?:${MESES})` +                 // "5 mayo"
  `|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?` +     // "5/12" o "5/12/2026"
  `|\\d{1,2}:\\d{2}\\s*(?:am|pm|hrs)?` +        // "10:30 am"
  `)`,
  "gi"
);

const MONEY_RE = /(?:USD?|MXN|pesos?|d[oó]lares?)?\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(K|MIL|M|MDD|MILLONES?|MILLON)?/gi;

// ── Parser regex/heurística (offline) ────────────────────────
function localParse(text) {
  if (!text || !text.trim()) return null;

  const out = {
    objetivo: "",
    ubicacion: "",
    presupuesto: "",
    presupuesto_num: 0,
    notas: "",
    next_action: "",
    next_action_date: "",
    confidence: "low",
    source: "local",
  };

  // 1. Detectar etiquetas explícitas tipo "Objetivo: X"
  const labelRe = new RegExp(`(${LABELS.join("|")})\\s*[:.]\\s*`, "gi");
  const parts = text.split(labelRe);

  let labeledFound = 0;
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i].toLowerCase();
    const content = (parts[i + 1] || "").trim();
    if (!content) continue;
    labeledFound++;

    if (label.startsWith("objet")) out.objetivo = content;
    else if (label.startsWith("ubicaci") || label === "zona" || label === "lugar") out.ubicacion = content;
    else if (label.startsWith("presupuesto") || label === "budget") {
      out.presupuesto = content;
      out.presupuesto_num = parseBudget(content);
    }
    else if (label.startsWith("not") || label === "comentarios") out.notas = content;
    else if (label === "meet" || label === "cita" || label.includes("acción") || label.includes("accion") || label === "llamada") {
      out.next_action = content;
      const m = content.match(DATE_RE);
      if (m) out.next_action_date = m[0];
    }
  }

  if (labeledFound >= 2) out.confidence = "high";
  else if (labeledFound === 1) out.confidence = "medium";

  // 2. Heurística: si NO se encontraron etiquetas, intentar extraer cosas del texto libre
  if (labeledFound === 0) {
    // Detectar presupuesto del texto general
    const moneyMatch = text.match(MONEY_RE);
    if (moneyMatch) {
      const first = moneyMatch[0];
      out.presupuesto = first.trim();
      out.presupuesto_num = parseBudget(first);
    }

    // Detectar fecha de próxima acción
    const dateMatch = text.match(DATE_RE);
    if (dateMatch) {
      out.next_action_date = dateMatch[0];
      // Buscar la frase que contiene la fecha
      const sentences = text.split(/[.!?]\s*/);
      const sentenceWithDate = sentences.find(s => s.match(DATE_RE));
      if (sentenceWithDate) out.next_action = sentenceWithDate.trim().slice(0, 120);
    }

    // Detectar ubicación común (Cancún, Tulum, Playa del Carmen, etc.)
    const ZONAS = /\b(canc[uú]n|tulum|playa del carmen|riviera maya|cozumel|holbox|isla mujeres|merida|m[eé]xico|cdmx|monterrey|guadalajara|miami|texas|new york|nyc)\b/i;
    const zMatch = text.match(ZONAS);
    if (zMatch) out.ubicacion = zMatch[0];

    // El resto del texto va a notas
    out.notas = text.trim();
    out.confidence = "low";
  }

  return out;
}

// ── Parse inteligente de presupuesto ─────────────────────────
function parseBudget(s) {
  if (!s) return 0;
  s = s.toUpperCase();
  // "200K", "200 mil", "1.5M", "1.5 millones"
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(K|MIL|M|MDD|MILLONES?|MILLON)?/);
  if (!m) return 0;
  const num = parseFloat(m[1].replace(",", "."));
  const unit = (m[2] || "").toUpperCase();
  if (unit === "K" || unit === "MIL") return Math.round(num * 1000);
  if (unit === "M" || unit === "MDD" || unit.startsWith("MILL")) return Math.round(num * 1000000);
  // Sin unidad — si el número es grande, asumir ya está en dólares; si es chico, asumir miles
  if (num >= 1000) return Math.round(num);
  return Math.round(num * 1000);
}

// ── Parser IA (Edge Function con Claude) ─────────────────────
async function aiParse(text) {
  try {
    const { data, error } = await supabase.functions.invoke("organize-lead-notes", {
      body: { text },
    });
    if (error) throw error;
    return {
      objetivo: data.objetivo || "",
      ubicacion: data.ubicacion || "",
      presupuesto: data.presupuesto || "",
      presupuesto_num: data.presupuesto_num || parseBudget(data.presupuesto || ""),
      notas: data.notas || "",
      next_action: data.next_action || "",
      next_action_date: data.next_action_date || "",
      confidence: data.confidence || "high",
      source: "ai",
    };
  } catch (e) {
    console.warn("[organize-notes] AI fallback failed:", e?.message);
    return null;
  }
}

// ── Función pública: organiza el texto, prefiere local y cae a IA ──
export async function organizeNotes(text, { useAI = true } = {}) {
  const local = localParse(text);
  if (!local) return null;

  // Si la confianza local es alta, devolver eso (gratis y rápido)
  if (local.confidence === "high") return local;

  // Si el usuario lo pide y la confianza es baja/media, intentar IA
  if (useAI && local.confidence !== "high") {
    const ai = await aiParse(text);
    if (ai) return ai;
  }

  // Fallback al parse local aunque sea bajo
  return local;
}

// Export el parser local también, por si se quiere usar sin async
export { localParse };

/**
 * Genera un resumen formateado para mostrar el preview antes de aplicar.
 * Útil para que el asesor vea qué se va a guardar.
 */
export function formatOrganized(o) {
  if (!o) return "";
  const lines = [];
  if (o.objetivo)         lines.push(`🎯 OBJETIVO\n${o.objetivo}`);
  if (o.ubicacion)        lines.push(`📍 UBICACIÓN\n${o.ubicacion}`);
  if (o.presupuesto)      lines.push(`💰 PRESUPUESTO\n${o.presupuesto}`);
  if (o.next_action)      lines.push(`📅 PRÓXIMA ACCIÓN\n${o.next_action}` + (o.next_action_date ? ` (${o.next_action_date})` : ""));
  if (o.notas)            lines.push(`📝 NOTAS\n${o.notas}`);
  return lines.join("\n\n");
}
