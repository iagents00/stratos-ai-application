export const BOARD_STATES = [
  { id: 'por_hacer', label: 'Por hacer' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'bloqueada', label: 'Bloqueadas' },
  { id: 'hecha', label: 'Hechas' },
];
export const WIP_LIMIT = 3;
export function readDescription(value = '') {
  const notes = [], checklist = []; let blocker = '';
  for (const line of String(value || '').split('\n')) {
    const item = line.match(/^\s*- \[([ xX])\] (.+)$/);
    if (item) checklist.push({ text: item[2], done: item[1].toLowerCase() === 'x' });
    else if (line.startsWith('Bloqueo: ')) blocker = line.slice(9);
    else notes.push(line);
  }
  return { notes: notes.join('\n').trim(), checklist, blocker };
}
export function writeDescription({ notes = '', checklist = [], blocker = '' }) {
  return [notes.trim(), blocker.trim() ? `Bloqueo: ${blocker.trim()}` : '',
    checklist.filter(x => x.text.trim()).map(x => `- [${x.done ? 'x' : ' '}] ${x.text.trim()}`).join('\n')].filter(Boolean).join('\n\n');
}
export function blockingReason(task, tasks) {
  if (task.estado === 'hecha') return '';
  const manual = readDescription(task.descripcion).blocker;
  if (manual) return manual;
  if (!task.depends_on) return '';
  const dependency = tasks.find(x => x.id === task.depends_on);
  return !dependency ? 'Dependencia no disponible: revisa la tarea.'
    : dependency.estado !== 'hecha' ? `Espera: ${dependency.titulo}` : '';
}
export function taskColumn(task, tasks) { return blockingReason(task, tasks) ? 'bloqueada' : task.estado; }
export function createsCycle(taskId, dependencyId, tasks) {
  const seen = new Set([taskId]); let next = dependencyId;
  while (next) { if (seen.has(next)) return true; seen.add(next); next = tasks.find(t => t.id === next)?.depends_on; }
  return false;
}
export function taskProgress(task) {
  if (task.estado === 'hecha') return 100;
  const list = readDescription(task.descripcion).checklist;
  return list.length ? Math.round(list.filter(x => x.done).length / list.length * 100) : (task.estado === 'en_curso' ? 25 : task.estado === 'en_revision' ? 90 : 0);
}
export function projectProgress(projectId, tasks) {
  const own = tasks.filter(t => t.project_id === projectId);
  return { done: own.filter(t => t.estado === 'hecha').length, total: own.length };
}
export function isFocus(task) { return ['alta', 'urgente'].includes(task.prioridad) && task.estado !== 'hecha'; }
export function validateTask(task, tasks, previous = null) {
  if (!task.titulo?.trim()) return 'Escribe el nombre de la tarea.';
  if (createsCycle(task.id, task.depends_on, tasks)) return 'Esa dependencia forma un ciclo. Elige otra tarea.';
  if ((task.estado === 'hecha' || (['en_curso','en_revision'].includes(task.estado) && task.estado !== previous?.estado)) && blockingReason({ ...task, estado: 'por_hacer' }, tasks)) return 'Resuelve el bloqueo o la dependencia antes de avanzar.';
  if (task.estado === 'hecha' && readDescription(task.descripcion).checklist.some(x => !x.done)) return 'Completa el checklist antes de marcar la tarea como hecha.';
  return '';
}
export function safeLink(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export function localDateTime(value) {
  if (!value) return '';
  const d = new Date(value); if (Number.isNaN(d.valueOf())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
