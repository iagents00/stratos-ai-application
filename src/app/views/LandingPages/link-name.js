// Match the database normalization; the server appends a random identifier.
export function normalizeLinkName(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/g, '');
}

export function suggestedLinkName(client, agency) {
  const company = normalizeLinkName(agency);
  const person = normalizeLinkName(client);
  if (!person) return company;
  // Reserve room for the agency even when the client's name is long.
  const brand = company.slice(0, 20).replace(/-+$/g, '');
  return [person.slice(0, brand ? 31 - brand.length : 32).replace(/-+$/g, ''), brand].filter(Boolean).join('-');
}
