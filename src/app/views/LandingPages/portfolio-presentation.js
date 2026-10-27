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

export function portfolioWhatsApp(phone, advisor, properties, notes = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  const number = digits.length === 10 ? `52${digits}` : digits;
  if (number.length < 8 || number.length > 15) return null;
  const names = properties.map(p => p.name).filter(Boolean).join(', ');
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hola ${advisor || ''}, revisé mi portafolio${names ? ` y me interesan: ${names}` : ''}. ¿Podemos revisar disponibilidad, precio actualizado y próximos pasos?${notes.trim() ? `\n\nMis prioridades y dudas:\n${notes.trim()}` : ''}`)}`;
}

/** Questions are guidance, never claims about suitability or returns. */
export function portfolioQuestions(property) {
  return [
    { title: 'Tu presupuesto completo', text: 'Confirma el precio de la unidad, los gastos de adquisición y las condiciones de pago.' },
    { title: property.bedrooms || property.sizes?.length ? 'El espacio que necesitas' : 'La distribución ideal para ti', text: property.bedrooms || property.sizes?.length ? 'Revisa el plano de la unidad y cómo se adapta al uso que quieres darle.' : 'Solicita tipologías y superficies disponibles para comparar con tus necesidades.' },
    { title: property.delivery ? 'Tu horizonte de entrega' : 'El momento de compra', text: property.delivery ? 'Confirma la fecha de entrega y las condiciones para disponer de la propiedad.' : 'Pregunta por la etapa del proyecto, la fecha de entrega y la disponibilidad actual.' },
  ];
}

/** Keep catalog identity while lifting accent text for the dark dossier. */
export function portfolioAccent(value) {
  const raw = typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : '#7BA8E0';
  const hex = raw.length === 4 ? raw.slice(1).split('').map(x => x + x).join('') : raw.slice(1);
  const channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const light = channels.map(channel => Math.round(channel * .4 + 255 * .6));
  return { '--pd-property-color': `#${hex}`, '--pd-property-ink': `rgb(${light.join(', ')})` };
}
