/** Demo messages are local examples; they never claim to write to a real account. */
export function demoCopilotReply(text, context) {
  const q = String(text || '').trim().toLowerCase();
  if (context && /resum|cliente|pipeline|seguimiento|kpi/.test(q) && !/crear|registr|mueve|anota/.test(q)) {
    const leads = context.leads || [];
    return `Demostración · ${leads.length} clientes ficticios en tu CRM.\n${leads.map(lead => `• ${lead.n}: ${lead.st}`).join('\n')}\nPuedes abrir sus expedientes y cambiar la etapa; los cambios solo existen en esta demo.`;
  }
  if (context && /tarea|agenda|pendiente/.test(q) && !/crear|registr|mueve|anota/.test(q)) {
    const tasks = (context.tasks || []).filter(task => !task.done);
    return tasks.length ? `Agenda ficticia · ${tasks.length} pendientes:\n${tasks.map(task => `• ${task.text}`).join('\n')}` : 'Agenda ficticia · No hay tareas pendientes. Puedes crear una en Mi Espacio.';
  }
  if (/agenda|recordatorio|tarea|crear|registr|mueve|anota/.test(q)) return 'Esta es una demostración. No se crean clientes, citas ni recordatorios reales. En tu cuenta, el Copilot usa los datos y permisos de tu empresa.';
  if (/kpi|pipeline|clientes/.test(q)) return 'Estás viendo datos de ejemplo del CRM. Para consultar tu cartera y métricas reales, inicia sesión con tu cuenta de Stratos.';
  return 'Puedes explorar la guía «Qué puede hacer» y preparar ejemplos. La demo no consulta ni modifica información de producción.';
}
