export default {
  id: 'clinica-dental-demo', name: 'Clínica Dental · Demo', legalName: 'Clínica Dental · Demo', tagline: 'Perfil dental independiente de Stratos AI',
  demoOnly: true,
  brand: { logoText: 'Stratos AI', appWordmark: 'Stratos AI · Dental', intelligenceCenterLabel: 'Clínica Dental · Demo' },
  tenant: { clientId: 'clinica-dental-demo', organizationId: null },
  navLabels: { c: 'Pacientes', mi_espacio: 'Agenda dental', perfil: 'Perfil dental' },
  features: { crm: true, dash: false, erp: false, team: false, iacrm: false, landingPages: false, finanzas: false, rrhh: false, trash: false, comandoDirectivo: false, caja: false, whatsappModule: false, whatsappChat: false, copilotModule: true },
  crm: {
    aiAgentsPanel: false, defaultProjects: ['Valoración dental', 'Limpieza dental', 'Ortodoncia', 'Rehabilitación dental'], advisorMetricsTab: false,
    labels: { entity: 'paciente', entityCap: 'Paciente', entityPlural: 'pacientes', newEntity: 'Nuevo paciente', priorityList: 'Pacientes en prioridad', emptyList: 'Sin pacientes', entityNamePlaceholder: 'Nombre del paciente', entityProfile: 'Perfil del paciente', deleteEntity: 'Eliminar paciente demo', viewDetail: 'Ver seguimiento del paciente', openProfile: 'Abrir perfil del paciente', pageTitle: 'CRM', pageTitleAccent: 'Clínica Dental · Demo', pageTitleMobile: 'Pacientes', discoveryTab: 'Seguimiento', discoveryTabShort: 'Seguim.' },
    pipeline: [{name:'Nuevo paciente',color:'#94a3b8'},{name:'Contactado',color:'#38bdf8'},{name:'Valoración pendiente',color:'#fbbf24'},{name:'Cita agendada',color:'#6ee7c2'},{name:'En tratamiento',color:'#a78bfa'},{name:'Seguimiento dental',color:'#2dd4bf'},{name:'Tratamiento terminado',color:'#34d399'}],
    kpis: [{label:'PACIENTES DEMO',value:{type:'total'},sub:{text:'Datos ficticios del perfil dental'},icon:'Users',color:'blue'},{label:'VALORACIONES PENDIENTES',value:{type:'count',stage:'Valoración pendiente'},sub:{text:'Seguimiento de recepción'},icon:'Target',color:'cyan'},{label:'CITAS AGENDADAS',value:{type:'count',stage:'Cita agendada'},sub:{text:'Citas de demostración'},icon:'CalendarDays',color:'accent'},{label:'EN TRATAMIENTO',value:{type:'count',stage:'En tratamiento'},sub:{text:'Casos ficticios'},icon:'FileText',color:'violet'}],
  },
};
