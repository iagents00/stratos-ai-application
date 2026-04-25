/**
 * lib/utils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilidades compartidas entre todas las vistas.
 * Extraído de App.jsx y CRM.jsx para eliminar duplicación.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * parseBudget — Convierte strings de presupuesto a números.
 * parseBudget("300k")     → 300000
 * parseBudget("1.5M")     → 1500000
 * parseBudget("2.5 mdd")  → 2500000
 * parseBudget("500 mil")  → 500000
 * parseBudget("$300,000") → 300000
 * parseBudget("750")      → 750
 */
export const parseBudget = (input) => {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return isFinite(input) ? input : 0;
  let s = String(input).trim().toLowerCase();
  if (!s) return 0;
  s = s.replace(/usd|mxn|dolares|dólares|pesos|\$|€|,|\s+$/g, "").trim();
  s = s.replace(/\s+/g, " ");

  let multiplier = 1;
  const suffixMatch = s.match(/([0-9.,]+)\s*(k|mil(?:es|lar|lares)?|m|mm|mdd|millon(?:es)?|millón|b|bn|billon(?:es)?|billón)$/);
  if (suffixMatch) {
    const suf = suffixMatch[2];
    if (suf === "k" || suf.startsWith("mil") || suf === "millar" || suf === "millares") multiplier = 1_000;
    else if (suf === "m" || suf === "mm" || suf === "mdd" || suf.startsWith("millon") || suf === "millón") multiplier = 1_000_000;
    else if (suf === "b" || suf === "bn" || suf.startsWith("billon") || suf === "billón") multiplier = 1_000_000_000;
    s = suffixMatch[1];
  }

  if (/^[0-9]+,[0-9]{1,2}$/.test(s)) s = s.replace(",", ".");
  s = s.replace(/,/g, "");

  const num = parseFloat(s);
  if (!isFinite(num)) return 0;
  return Math.round(num * multiplier);
};

/**
 * formatBudget — Formatea un número a string de presupuesto legible.
 * formatBudget(1500000) → "$1.5M USD"
 * formatBudget(300000)  → "$300K USD"
 */
export const formatBudget = (amount) => {
  const n = Number(amount) || 0;
  if (n === 0) return "";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, "")}M USD`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.?0+$/, "")}K USD`;
  }
  return `$${n.toLocaleString("en-US")} USD`;
};

/**
 * fmtNow — Devuelve la fecha/hora actual en formato "D Mes, H:MMam/pm"
 */
export const fmtNow = () => {
  const now = new Date();
  const mos = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const h = now.getHours(); const m = String(now.getMinutes()).padStart(2,"0");
  const ampm = h >= 12 ? "pm" : "am"; const h12 = (h % 12) || 12;
  return `${now.getDate()} ${mos[now.getMonth()]}, ${h12}:${m}${ampm}`;
};

/**
 * genId — Genera un ID único.
 */
export const genId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;

/**
 * buildTelegramSummary — Genera el resumen de un lead para Telegram.
 */
export const buildTelegramSummary = (lead) => {
  const lines = [];
  lines.push(`${lead.n || "Sin nombre"}${lead.budget ? ` · ${lead.budget}` : ""}`);
  if (lead.p)     lines.push(`Proyecto: ${lead.p}`);
  if (lead.phone) lines.push(`Tel: ${lead.phone}`);
  lines.push(`Etapa: ${lead.st || "Nuevo Registro"} · Score ${lead.sc ?? 0}`);
  if (lead.nextAction) {
    const fecha = lead.nextActionDate && lead.nextActionDate !== "Por definir" ? ` — ${lead.nextActionDate}` : "";
    lines.push(`Siguiente accion: ${lead.nextAction}${fecha}`);
  }
  const segStr = lead.seguimientos ? `${lead.seguimientos} seguimientos` : "Sin seguimientos";
  const asorStr = lead.asesor ? ` · Asesor: ${lead.asesor}` : "";
  lines.push(segStr + asorStr);
  if (lead.campana) lines.push(`Fuente: ${lead.campana}`);
  return lines.join("\n");
};
