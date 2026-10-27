export const searchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function findCreateProperties(properties, query, selectedIds, selectedOnly = false, budget = {}) {
  const words = searchText(query).split(/\s+/).filter(Boolean);
  const min = Math.max(0, Number(budget.min) || 0);
  const max = budget.max === '' || budget.max == null ? Infinity : Math.max(0, Number(budget.max) || 0);
  const withinBudget = property => {
    const from = Number(property.priceFrom) || 0;
    const to = Number(property.priceTo) || from;
    return max >= min && (to <= 0 || (from <= max && to >= min));
  };
  return properties.filter(property => withinBudget(property) && (!selectedOnly || selectedIds.includes(property.id)) && words.every(word => searchText([property.name, property.location, property.zone, property.type, property.bedrooms, property.ticket].filter(Boolean).join(' ')).includes(word)));
}
export function orderedCreateProperties(properties, ids) {
  const byId = new Map(properties.map(property => [property.id, property]));
  return [...new Set(ids)].map(id => byId.get(id)).filter(Boolean);
}
