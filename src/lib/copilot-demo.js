/** Demo messages are local examples; they never claim to write to a real account. */
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const noWrites = 'Esta es una demostración. No se crean clientes, citas ni recordatorios reales. Tampoco se reasignan clientes ni se modifican datos reales. En tu cuenta, el Copilot usa los datos y permisos de tu empresa.';

export function demoCopilotReply(text, context) {
  const q = normalize(text);
  // Mutations must never fall through to a read reply merely because they
  // also mention a client, a dossier or follow-up.
  if (/\b(?:crear|crea(?:me|le)?|registr\w*|mueve\w*|mover|anota\w*|(?:re)?asigna\w*|cambia\w*|actuali[cz]\w*|modifi(?:c|qu)\w*|anad\w*|agreg\w*|elimina\w*|borra\w*|programa\w*|agendar|agendame|recuerdame)\b|\bagenda\s+(?:un|una|el|la)\b/.test(q)) return noWrites;
  const leads = Array.isArray(context?.leads) ? context.leads : [];
  if (context && /\b(?:ficha|expediente)\b/.test(q)) {
    const requested = q.match(/\b(?:ficha|expediente)\s+(?:(?:de|del)\s+)?(?:cliente\s+)?(.+?)(?:\s+por favor)?$/)?.[1];
    const matches = leads.filter(lead => requested && normalize(lead.n) === requested);
    if (matches.length !== 1) return 'Demostración · No encuentro una ficha única con ese nombre en los datos ficticios. Indica el nombre completo de un cliente de esta demo.';
    const lead = matches[0];
    const budget = lead.budget || (Number.isFinite(lead.presupuesto) ? lead.presupuesto.toLocaleString('es-MX') : 'Sin presupuesto registrado');
    return `Demostración · Ficha con datos ficticios.\nNombre: ${lead.n}\nEtapa: ${lead.st || 'Sin etapa registrada'}\nPresupuesto: ${budget}\nPróxima acción: ${lead.nextAction || 'Sin próxima acción registrada'}`;
  }
  if (context && /\bseguimiento\b/.test(q) && /\ba quien\b|\bprioridades?\b/.test(q)) {
    const followUps = leads.filter(lead => String(lead.nextAction || '').trim()).slice(0, 3);
    return followUps.length
      ? `Demostración · Seguimientos para revisar (datos ficticios).\n${followUps.map(lead => `• ${lead.n}: ${lead.nextAction}`).join('\n')}\nRevisa la fecha de cada próxima acción en el CRM.`
      : 'Demostración · No hay clientes con próxima acción registrada en estos datos ficticios.';
  }
  if (context && /resum|cliente|pipeline|seguimiento|kpi/.test(q)) {
    return `Demostración · ${leads.length} clientes ficticios en tu CRM.\n${leads.map(lead => `• ${lead.n}: ${lead.st}`).join('\n')}\nPuedes abrir sus expedientes y cambiar la etapa; los cambios solo existen en esta demo.`;
  }
  if (context && /tarea|agenda|pendiente/.test(q)) {
    const tasks = (Array.isArray(context.tasks) ? context.tasks : []).filter(task => !task.done);
    return tasks.length ? `Agenda ficticia · ${tasks.length} pendientes:\n${tasks.map(task => `• ${task.text}`).join('\n')}` : 'Agenda ficticia · No hay tareas pendientes. Puedes crear una en Mi Espacio.';
  }
  if (/agenda|recordatorio|tarea/.test(q)) return noWrites;
  if (/kpi|pipeline|clientes/.test(q)) return 'Estás viendo datos de ejemplo del CRM. Para consultar tu cartera y métricas reales, inicia sesión con tu cuenta de Stratos.';
  return 'Puedes explorar la guía «Qué puede hacer» y preparar ejemplos. La demo no consulta ni modifica información de producción.';
}
