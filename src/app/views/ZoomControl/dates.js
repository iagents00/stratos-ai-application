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
