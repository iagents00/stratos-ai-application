/**
 * app/views/ZoomControl/dates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers de fecha del Control de Zooms, compartidos entre el panel CRUD
 * (index.jsx) y el Resumen (Resumen.jsx). Trabajan sobre strings YYYY-MM-DD
 * (comparación lexicográfica = cronológica, sin líos de zona horaria).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function todayStr() { return ymd(new Date()); }
export function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
// Semana actual de LUNES a domingo (así la pide el director comercial: los
// liners agendan a 5-7 días vista y el reporte semanal corre L-D).
export function weekRange() {
  const now = new Date();
  const dow = now.getDay();             // 0=Dom … 6=Sáb
  const back = (dow + 6) % 7;           // días desde el lunes
  const monday = addDays(now, -back);
  return { start: ymd(monday), end: ymd(addDays(monday, 6)), monday };
}
export function next7Range() {
  const now = new Date();
  return { start: ymd(now), end: ymd(addDays(now, 6)) };
}
// Quincena actual (1-15 / 16-fin) — el corte quincenal que pidió el director
// comercial para sus reportes.
export function quincenaRange() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const primera = now.getDate() <= 15;
  const first = primera ? new Date(y, m, 1) : new Date(y, m, 16);
  const last  = primera ? new Date(y, m, 15) : new Date(y, m + 1, 0);
  return { start: ymd(first), end: ymd(last), label: `${primera ? "1ra" : "2da"} qna. ${MON[m]}` };
}
// Mes calendario actual — para el reporte mensual que pide dirección.
export function monthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: ymd(first), end: ymd(last), label: `${MON[now.getMonth()]} ${now.getFullYear()}` };
}
export function inRange(dateStr, start, end) {
  return !!dateStr && dateStr >= start && dateStr <= end;
}
// "2026-06-03" → "mié 3 jun"
export const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function prettyDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]} ${d} ${MON[m - 1]}`;
}

// Nombres completos (para el export CSV con las columnas del sheet original).
export const DOW_FULL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const MES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// Número de semana ISO-8601 de un YYYY-MM-DD (la columna "Semana" del sheet,
// que a mano salía con errores; aquí es siempre consistente).
export function isoWeekNumber(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;             // lunes=1 … domingo=7
  date.setUTCDate(date.getUTCDate() + 4 - day);  // jueves de esa semana
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
