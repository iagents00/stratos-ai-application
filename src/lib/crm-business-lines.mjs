/** Business lines are organization data; a shared CRM never assumes RS/medicine. */
export function businessLinesForPipeline(lines, stages) {
  if (!Array.isArray(lines)) return [];
  const known = new Set(stages);
  return lines.filter(line => line && typeof line.id === 'string' && typeof line.label === 'string'
    && Array.isArray(line.stages) && known.has(line.entryStage) && line.stages.includes(line.entryStage))
    .map(line => ({ ...line, stages: line.stages.filter(stage => known.has(stage)) }));
}
export function businessLineForStage(stage, lines) {
  const matches = lines.filter(line => line.stages.includes(stage));
  return matches.length === 1 ? matches[0] : null;
}
export function reconcileSavedLead(current, saved, expected) {
  if (!current || current.id !== saved?.id || current.id !== expected?.id
      || (current.seguimientos || 0) !== (expected.seguimientos || 0)
      || current.st !== expected.st || current.sc !== expected.sc || !Number.isFinite(saved.score)) return current;
  return { ...current, sc: saved.score, score_calc: saved.score_calc, hot_auto: saved.hot_auto };
}
