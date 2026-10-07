/** Synthetic CRM examples. No customer, advisor or contact data belongs here. */
export function createDemoLeads() {
  const names = ['Alex', 'Sam', 'Robin', 'Charlie', 'Dani', 'Ari', 'Noa', 'Taylor'];
  const stages = ['Seguimiento', 'Zoom Agendado', 'Contáctame Ya', 'Apartó', 'Largo Plazo', 'Visita Agendada', 'Cierre', 'Postventa'];
  return names.map((name, index) => ({
    id: index + 1,
    fechaIngreso: '',
    asesor: `Asesor ${index % 3 + 1} Ejemplo`,
    n: `${name} Ejemplo`,
    tag: 'Cliente ficticio · Demo',
    phone: '',
    email: '',
    st: stages[index],
    budget: `$${100 + index * 25}K USD (ejemplo)`,
    presupuesto: 100000 + index * 25000,
    p: `Proyecto ${index % 2 ? 'Horizonte' : 'Aurora'} (ficticio)`,
    campana: 'Campaña de demostración',
    sc: 50 + index * 5,
    hot: index % 3 === 0,
    isNew: index === 2,
    bio: 'Perfil inventado para explorar el CRM. No representa a una persona real.',
    risk: 'Evaluación simulada: confirmar el interés en el proyecto de ejemplo.',
    friction: 'Escenario ficticio: comparar las opciones de demostración.',
    nextAction: 'Preparar una propuesta de ejemplo',
    nextActionDate: '',
    lastActivity: 'Actividad de demostración',
    daysInactive: index,
    notas: 'Datos ficticios. Las notas de este ejemplo no son información de clientes.',
  }));
}
