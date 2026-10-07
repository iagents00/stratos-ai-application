/** fixtures.js — Datos inventados y respuestas locales de la demo aislada. */
export const stages = ['Nuevo', 'En seguimiento', 'Reunión', 'Cerrado'];
export function initialClients() {
  return [
    { id: 'guest-1', name: 'Alex Ejemplo', interest: 'Proyecto Aurora (ficticio)', stage: 'Nuevo', note: 'Solicitó información del proyecto de ejemplo.' },
    { id: 'guest-2', name: 'Sam Ejemplo', interest: 'Proyecto Horizonte (ficticio)', stage: 'En seguimiento', note: 'Preparar una propuesta de demostración.' },
    { id: 'guest-3', name: 'Robin Ejemplo', interest: 'Proyecto Aurora (ficticio)', stage: 'Reunión', note: 'Reunión de ejemplo por confirmar.' },
  ];
}
export function initialTasks() {
  return [
    { id: 'task-1', title: 'Preparar propuesta de ejemplo', done: false },
    { id: 'task-2', title: 'Revisar seguimiento de Sam Ejemplo', done: false },
  ];
}
export function sampleReply(question, clients, tasks) {
  const normalized = question.toLowerCase();
  if (/tarea|agenda|pendiente/.test(normalized)) {
    const pending = tasks.filter(task => !task.done);
    return pending.length ? `Tareas de esta demo: ${pending.map(task => task.title).join('; ')}.` : 'Completaste todas las tareas de ejemplo.';
  }
  if (/seguimiento|cliente|resumen/.test(normalized)) {
    return `En esta demo hay ${clients.length} clientes ficticios. ${clients.filter(client => client.stage === 'En seguimiento').length} están en seguimiento. Puedes abrir Clientes para cambiar su etapa o guardar una nota de ejemplo.`;
  }
  return 'Esta es una respuesta demostrativa, sin conexión a IA ni a datos de empresas. Prueba “Resume mis clientes” o “¿Qué tareas tengo pendientes?”.';
}
