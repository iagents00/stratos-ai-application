/** Display helpers shared by the client dossier and its verification. */
export function safePortfolioUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function portfolioPrice(property) {
  if (property.ticket?.trim()) return property.ticket.trim();
  const from = Number(property.priceFrom);
  const to = Number(property.priceTo);
  const format = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  if (!Number.isFinite(from) || from <= 0) return 'Consultar precio';
  return Number.isFinite(to) && to > from ? `${format(from)} – ${format(to)}` : `Desde ${format(from)}`;
}

export function portfolioWhatsApp(phone, advisor, properties) {
  const digits = String(phone || '').replace(/\D/g, '');
  const number = digits.length === 10 ? `52${digits}` : digits;
  if (number.length < 8 || number.length > 15) return null;
  const names = properties.map(p => p.name).filter(Boolean).join(', ');
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hola ${advisor || ''}, revisé mi portafolio${names ? ` y me interesan: ${names}` : ''}. ¿Podemos revisar disponibilidad, precio actualizado y próximos pasos?`)}`;
}
