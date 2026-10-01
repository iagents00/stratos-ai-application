import { advisorDisplayGroup } from "./zoom-metrics.js";
import { timestampInRange } from "./date-range.js";

export function productivityRows(actions, range) {
  const groups = new Map();
  for (const action of actions) {
    if (action.deleted_at || !timestampInRange(action.due_at || action.created_at, range)) continue;
    const asesor = advisorDisplayGroup(action.asesor_name);
    if (!groups.has(asesor)) groups.set(asesor, { asesor, items: [] });
    const state = action.done === true ? "done" : ["in_progress", "not_done"].includes(action.status) ? action.status : "pending";
    groups.get(asesor).items.push({ ...action, text: action.text || "(sin descripción)", state, nota: action.nota || "" });
  }
  return [...groups.values()].map(group => {
    const done = group.items.filter(i => i.state === "done").length;
    const inProg = group.items.filter(i => i.state === "in_progress").length;
    const notDone = group.items.filter(i => i.state === "not_done").length;
    return { ...group, done, inProg, notDone, pend: group.items.length - done, total: group.items.length };
  }).sort((a, b) => b.total - a.total || a.asesor.localeCompare(b.asesor, "es"));
}
