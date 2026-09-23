/** Preserve personal agenda reads before the interpreter can rewrite them as another person's tasks. */
export const marker = '// PERSONAL_AGENDA_READ_GUARD_20260923';
export const guard = `${marker}
const agendaQuery = raw.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
  .replace(/[¿?¡!.,]/g, '').trim().replace(/\\s+/g, ' ');
const esAgendaPersonal = /^(?:\\/?agenda|mi agenda|mis pendientes|que tengo (?:hoy|manana|pendiente|pendientes))$/.test(agendaQuery);
if (esConfirmacion || esAgendaPersonal) ruta = 'crm';
const texto = (esConfirmacion || esAgendaPersonal) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);`;

const oldRoute = "if (esConfirmacion) ruta = 'crm';\nconst texto = esConfirmacion ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);";
export function patchAgendaRoute(code) {
  if (code.includes(marker)) return code;
  if (code.split(oldRoute).length !== 2) throw new Error('Interpreter changed; inspect instead of overwriting.');
  const next = code.replace(oldRoute, guard);
  new Function('$input', '$', next); // Syntax check only; no workflow execution.
  return next;
}
