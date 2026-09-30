const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const DATE_PRESETS = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "last30", label: "30 días" },
  { id: "custom", label: "Personalizado" },
  { id: "all", label: "Histórico" },
];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endExclusive(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function dateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDateInput(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function resolveDateRange(preset = "month", customFrom = "", customTo = "", now = new Date()) {
  if (preset === "all") return { from: null, to: null, fromTs: null, toTs: null };

  let from = startOfDay(now);
  let to = endExclusive(now);

  if (preset === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  } else if (preset === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (preset === "last30") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  } else if (preset === "custom") {
    const parsedFrom = parseDateInput(customFrom);
    const parsedTo = parseDateInput(customTo);
    if (parsedFrom) from = startOfDay(parsedFrom);
    if (parsedTo) to = endExclusive(parsedTo);
    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      from = startOfDay(parsedTo);
      to = endExclusive(parsedFrom);
    }
  }

  return { from, to, fromTs: from.getTime(), toTs: to.getTime() };
}

export function dateRangeLabel(range) {
  if (!range || range.fromTs === null) return "todo el histórico";
  const fmt = (date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  const visibleTo = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1);
  if (dateInputValue(range.from) === dateInputValue(visibleTo)) return fmt(range.from);
  return `${fmt(range.from)} – ${fmt(visibleTo)}`;
}

export function timestampInRange(value, range) {
  if (!range || range.fromTs === null) return true;
  const timestamp = toTimestamp(value);
  return timestamp !== null && timestamp >= range.fromTs && timestamp < range.toTs;
}

// PostgreSQL DATE is a local calendar day, not UTC midnight.
export function toTimestamp(value) {
  if (value == null || value === "") return null;
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseDateInput(value) : new Date(value);
  const timestamp = date?.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function createDefaultDateFilter() {
  const now = new Date();
  return {
    preset: "month",
    customFrom: dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    customTo: dateInputValue(now),
  };
}
