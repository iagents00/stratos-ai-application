/** Demo messages are local examples; they never claim to write to a real account. */
export function demoCopilotReply(text) {
  const q = String(text || '').trim().toLowerCase();
  if (/agenda|recordatorio|tarea|crear|registr|mueve|anota/.test(q)) return 'Esta es una demostración. No se crean clientes, citas ni recordatorios reales. En tu cuenta, el Copilot usa los datos y permisos de tu empresa.';
  if (/kpi|pipeline|clientes/.test(q)) return 'Estás viendo datos de ejemplo del CRM. Para consultar tu cartera y métricas reales, inicia sesión con tu cuenta de Stratos.';
  return 'Puedes explorar la guía «Qué puede hacer» y preparar ejemplos. La demo no consulta ni modifica información de producción.';
}
