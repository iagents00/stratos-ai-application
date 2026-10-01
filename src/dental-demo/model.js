export const INITIAL_APPOINTMENTS = [
  { id: 'demo-1', time: '09:00', patient: 'Paciente Demo A', treatment: 'Valoración dental', doctor: 'Dra. Ana · Demo', status: 'Confirmada' },
  { id: 'demo-2', time: '10:00', patient: 'Paciente Demo B', treatment: 'Limpieza dental', doctor: 'Dr. Luis · Demo', status: 'Por confirmar' },
  { id: 'demo-3', time: '12:00', patient: 'Paciente Demo C', treatment: 'Revisión de ortodoncia', doctor: 'Dra. Ana · Demo', status: 'Confirmada' },
];
export const DEMO_HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '16:00'];
export const availableHours = appointments => DEMO_HOURS.filter(time => !appointments.some(a => a.time === time));
export function demoReply(text, appointments) {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/huli|conexion/.test(normalized)) return { reply: 'Esta es una simulación dental. Las consultas de esta demo no se envían a Huli. El conector real se validó por separado y requiere permisos de la clínica para activarse.' };
  if (/disponib|horario|hueco/.test(normalized)) return { reply: `Horarios ficticios disponibles: ${availableHours(appointments).join(', ') || 'ninguno'}. Selecciona uno para preparar una cita demo.`, slots: availableHours(appointments) };
  if (/agenda|citas|resumen/.test(normalized)) return { reply: `Agenda simulada: ${appointments.length} citas, ${appointments.filter(a => a.status === 'Confirmada').length} confirmadas y ${appointments.filter(a => a.status === 'Por confirmar').length} por confirmar. Todos los pacientes son ficticios.` };
  if (/recordat|whatsapp/.test(normalized)) return { reply: 'Ejemplo de recordatorio: «Hola, te recordamos tu cita dental. Confirma tu asistencia con la recepción». Es un borrador de demostración; no se envía ningún mensaje.' };
  return { reply: 'Puedo mostrar la agenda demo, consultar horarios ficticios o preparar un ejemplo de recordatorio. Prueba «¿Qué horarios hay disponibles?».' };
}
