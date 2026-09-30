// Financial totals must never combine currencies or silently truncate history.
export const currencyCode = (value) => String(value || 'SIN MONEDA').trim().toUpperCase();

export function isCurrentMonth(value, now = new Date()) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth();
}

export function summarizeMovements(rows, currency, now = null) {
  let ing = 0, egr = 0, count = 0;
  for (const row of rows) {
    if (currencyCode(row.currency) !== currency) continue;
    if (now && !isCurrentMonth(row.spent_at, now)) continue;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    if (row.tipo === 'ingreso') ing += amount;
    else egr += amount;
    count++;
  }
  return { ing, egr, bal: ing - egr, count };
}

// A fresh builder and a stable unique order are required on every page.
export async function fetchAllRows(queryFactory, pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

// Quoting alone does not prevent spreadsheet formula execution.
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
