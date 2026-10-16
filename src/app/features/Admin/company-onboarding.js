export const isManagedCompany = company => company?.meta_config?.onboarding?.createdFrom === 'whatsapp_admin'
  && company?.meta_config?.platform?.kind !== 'partner';

export function companySummary(company, profiles = []) {
  const team = profiles.filter(person => person.organization_id === company.id && person.active === true);
  return {
    team,
    used: team.length,
    available: Math.max(0, Number(company.seats || 0) - team.length),
    hasAdmin: team.some(person => ['admin', 'super_admin'].includes(person.role)),
  };
}

export function companyReadiness(company, profiles = []) {
  if (company?.active !== true) return { ready: false, label: 'Empresa inactiva', detail: 'Solicita a Stratos la activación de esta empresa antes de compartir su acceso.' };
  const summary = companySummary(company, profiles);
  if (!Number.isInteger(Number(company.seats)) || Number(company.seats) < 1 || summary.used > Number(company.seats)) {
    return { ready: false, label: 'Revisar licencias', detail: 'El cupo debe cubrir a todos los usuarios activos. Revisa Módulos y licencias.' };
  }
  if (!summary.hasAdmin) return { ready: false, label: 'Falta administrador', detail: 'Crea un administrador activo para completar el alta de esta empresa.' };
  return { ready: true, label: 'Acceso preparado', detail: 'La empresa está activa y tiene administrador. Su equipo puede entrar con las cuentas de esta organización.' };
}

export function validateCompany({ name, seats }) {
  if (name.trim().length < 2 || name.trim().length > 120) return 'Escribe un nombre de empresa de 2 a 120 caracteres.';
  if (!Number.isInteger(Number(seats)) || Number(seats) < 1 || Number(seats) > 1000) return 'Elige entre 1 y 1000 licencias, sin decimales.';
  return '';
}

export function validateCompanyUser(form, company, profiles) {
  if (!company || company.active !== true || !isManagedCompany(company)) return 'Selecciona una empresa activa creada desde esta consola.';
  if (form.organization_id !== company.id) return 'La empresa seleccionada cambió. Revisa los datos antes de continuar.';
  if (!form.name.trim() || form.name.trim().length > 120) return 'Escribe el nombre de la persona (máximo 120 caracteres).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Escribe un correo válido.';
  if (form.email.trim().length > 254) return 'El correo no puede superar 254 caracteres.';
  if (!['admin', 'director', 'asesor'].includes(form.role)) return 'Selecciona un rol válido.';
  const summary = companySummary(company, profiles);
  if (!summary.hasAdmin && form.role !== 'admin') return 'Crea primero al administrador de la empresa.';
  if (!summary.available) return 'Esta empresa ya utiliza todas sus licencias. Amplía el cupo antes de agregar usuarios.';
  return '';
}
