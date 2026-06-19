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
 * nowLocalDateTime — Devuelve "AHORA" formateado como input[type="datetime-local"]
 * (YYYY-MM-DDTHH:MM), en HORARIO LOCAL del browser. Sirve para usarse como
 * atributo `min` de un input datetime-local y bloquear la seleccion de fechas
 * pasadas. Razon: un asesor que registre una proxima accion en el pasado
 * pierde el recordatorio sin saberlo.
 *
 * Nota timezone: el input datetime-local es por diseño LOCAL al browser, no
 * UTC. El "ahora" sigue siendo coherente con el reloj del asesor.
 */
export const nowLocalDateTime = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * genId — Genera un ID único.
 */
export const genId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;

/**
 * STAGES_CON_CITA — Etapas del pipeline donde el lead tiene una fecha/hora
 * concreta de reunión con el cliente (Zoom o visita). En estas etapas la
 * "próxima acción" ES la cita, así que la mostramos formateada con palabras
 * y la usamos para ordenar por proximidad.
 */
export const STAGES_CON_CITA = new Set([
  "Zoom Agendado", "Reactivar Zoom", "Visita Agendada", "Zoom Concretado",
]);

/**
 * parseFechaToTime — Convierte una fecha a timestamp (ms) o null si no parsea.
 * Acepta:
 *   - Date
 *   - ISO ("2026-06-20T14:30:00Z", "2026-06-20T14:30")
 *   - "2026-06-20 14:30" (formato del modal de Zoom; hora local del browser)
 * Texto libre ("Hoy", "Esta semana") → null.
 */
export const parseFechaToTime = (input) => {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date) {
    const t = input.getTime();
    return Number.isFinite(t) ? t : null;
  }
  let s = String(input).trim();
  if (!s) return null;
  // "2026-06-20 14:30[:ss]" → ISO local. El separador con espacio lo parsea
  // distinto cada browser; normalizar a 'T' lo hace consistente y local.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) s = s.replace(" ", "T");
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * formatFechaLarga — Fecha "completa con palabras" en español, para que el
 * cliente la lea sin ambigüedad. Ej: "Sábado 20 de junio, 2:30 p.m."
 * Devuelve "" si el input no es una fecha parseable (el texto libre lo respeta
 * quien llama). Por defecto sin año; pasar { conAnio: true } para incluirlo.
 */
export const formatFechaLarga = (input, { conAnio = false } = {}) => {
  const t = parseFechaToTime(input);
  if (t === null) return "";
  const opts = {
    weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
  };
  if (conAnio) opts.year = "numeric";
  const out = new Date(t).toLocaleString("es-MX", opts);
  // es-MX devuelve el día de la semana en minúscula ("sábado…"); capitalizamos
  // la inicial para que se vea como título.
  return out.charAt(0).toUpperCase() + out.slice(1);
};

/**
 * getZoomTime — Timestamp (ms) de la cita/zoom de un lead, o null si la etapa
 * no tiene cita o la fecha no es parseable. Prioriza selected_time (cita real
 * de Cal.com) → next_action_at → next_action_date. Sirve para ordenar por
 * proximidad ("los más próximos a Zoom que se vean arriba").
 */
export const getZoomTime = (lead) => {
  if (!lead) return null;
  const stage = lead.st ?? lead.stage;
  if (!STAGES_CON_CITA.has(stage)) return null;
  return (
    parseFechaToTime(lead.selected_time) ??
    parseFechaToTime(lead.next_action_at) ??
    parseFechaToTime(lead.next_action_date)
  );
};

/**
 * buildTelegramSummary — Genera el resumen de un lead para Telegram.
 */
export const buildTelegramSummary = (lead) => {
  const lines = [];
  lines.push(`${lead.n || "Sin nombre"}${lead.budget ? ` · ${lead.budget}` : ""}`);
  if (lead.p)     lines.push(`Proyecto: ${lead.p}`);
  if (lead.phone) lines.push(`Tel: ${lead.phone}`);
  lines.push(`Etapa: ${lead.st || "Contáctame ya"} · Score ${lead.sc ?? 0}`);
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
