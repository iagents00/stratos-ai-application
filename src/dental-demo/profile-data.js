export function isDentalProfile(location = globalThis.location) {
  return /^\/(?:clinica-dental-demo|demo-dental)(?:\/|$)/.test(location?.pathname || '') || ['clinica-dental-demo'].includes(new URLSearchParams(location?.search || '').get('client'));
}
export const DENTAL_DEMO_USER = { id: 'demo-dental-local', name: 'Admin Dental · Demo', role: 'admin', email: 'dental-demo@example.invalid', organizationId: 'demo-dental-only', organizationName: 'Clínica Dental · Demo', isDemo: true };
const stages = ['Valoración pendiente','Cita agendada','En tratamiento','Nuevo paciente','Contactado','Seguimiento dental','Tratamiento terminado'];
export const DENTAL_DEMO_LEADS = Array.from({length:14},(_,i)=>({
  id:`dental-demo-${i+1}`, n:`Paciente Demo ${String(i+1).padStart(2,'0')}`, asesor:'Recepción Dental · Demo', st:stages[i%stages.length], p:['Valoración dental','Limpieza dental','Ortodoncia'][i%3], tag:'Paciente ficticio', phone:'',email:'',presupuesto:0,budget:'',sc:70-i*2,hot:i<3,isNew:i<4,daysInactive:i%5,seguimientos:0,
  nextAction:['Confirmar disponibilidad para valoración','Confirmar asistencia a cita demo','Coordinar próxima visita dental'][i%3],nextActionDate:'Hoy',fechaIngreso:'26 Sep, 9:00am',created_at:new Date().toISOString(),notas:'Registro ficticio de demostración. No contiene expediente clínico.',bio:'Paciente ficticio para mostrar el seguimiento de recepción.',risk:'Datos de prueba',friction:'Bajo',tasks:[],action_history:[],
}));
