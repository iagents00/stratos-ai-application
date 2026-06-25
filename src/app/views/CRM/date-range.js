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
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function resolveDateRange(preset = "month", customFrom = "", customTo = "") {
  if (preset === "all") return { from: null, to: null, fromTs: null, toTs: null };

  const now = new Date();
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
    if (from.getTime() >= to.getTime()) to = endExclusive(from);
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
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp >= range.fromTs && timestamp < range.toTs;
}

export function createDefaultDateFilter() {
  const now = new Date();
  return {
    preset: "month",
    customFrom: dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    customTo: dateInputValue(now),
  };
}
