import { HuliClient, HuliError } from '../supabase/functions/_shared/huli.mjs';
import { dayRange } from './dental-security.mjs';
export async function discoverConnection(client, config) {
  const data = await client.get('/organization?expand=AUTHORIZATION');
  const org = data.organizations?.find(o=>String(o.idOrganization)===config.organizationId && o.status==='ACTIVE');
  if (!org) throw new HuliError('La organización Huli no está disponible.',403);
  const users=[...new Set((org.authorization||[]).filter(a=>a.status==='ACTIVE' && String(a.idGrantee)===config.userId && String(a.idOrganization)===config.organizationId).map(a=>String(a.idGrantor)))];
  const doctors=[];
  for (const userId of users.slice(0,20)) {
    const doctor=await client.get(`/doctor/user/${userId}`);
    if (String(doctor.idUser)!==userId || doctor.status!=='ACTIVE') continue;
    doctors.push({id:String(doctor.id),name:doctor.user?.displayName || [doctor.user?.firstName,doctor.user?.lastName].filter(Boolean).join(' '),timeZone:doctor.user?.timeZone?.name || null,specialties:(doctor.specialty||[]).filter(s=>s.status==='ACTIVE').map(s=>s.name),clinics:(doctor.doctorClinic||[]).filter(c=>c.status==='ACTIVE' && c.clinic?.status==='ACTIVE').map(c=>({id:String(c.idClinic),name:c.clinic.name,type:c.clinic.type}))});
  }
  return {organization:{id:config.organizationId,name:org.name},doctors,mode:'read-only',dentalConfigured:doctors.some(d=>d.specialties.some(s=>/odont|dental|ortodon|endodon|periodon/i.test(s)))};
}
export function selectedPair(metadata, body) {
  const doctor=metadata.doctors.find(d=>d.id===body.doctorId);
  const clinic=doctor?.clinics.find(c=>c.id===body.clinicId);
  if (!doctor || !clinic) throw new HuliError('Selecciona un profesional y una sede de esta cuenta.',403);
  if (!doctor.timeZone) throw new HuliError('Huli no tiene la zona horaria del profesional. Complétala en Huli.',409);
  return {doctor,clinic};
}
export async function executeQuery(client, metadata, body) {
  if (body.action==='patients') {
    const query=typeof body.query==='string'?body.query.trim():'';
    const offset=Number(body.offset||0);
    if(query.length>120 || !Number.isInteger(offset) || offset<0 || offset>100000) throw new HuliError('Búsqueda inválida.',400);
    const data=await client.get(`/patient-file?${new URLSearchParams({query,limit:'20',offset:String(offset)})}`);
    if (!Array.isArray(data.patientFiles)) throw new HuliError('Huli devolvió una lista de pacientes inválida.');
    return {patients:data.patientFiles.map(p=>({id:String(p.id),name:[p.personalData?.firstName,p.personalData?.lastName].filter(Boolean).join(' ') || p.personalData?.knownAs || 'Sin nombre registrado'})),total:Number(data.total||0),offset};
  }
  const {doctor,clinic}=selectedPair(metadata,body);
  let range;try{range=dayRange(body.date,doctor.timeZone);}catch{throw new HuliError('Selecciona una fecha válida.',400);}
  if(body.action==='availability') {
    const data=await client.get(`/availability/doctor/${doctor.id}/clinic/${clinic.id}?${new URLSearchParams(range)}`);
    if(String(data.idDoctor)!==doctor.id || String(data.idClinic)!==clinic.id || !Array.isArray(data.slotDates))throw new HuliError('La disponibilidad no corresponde a la selección.');
    const dateInZone=instant=>new Intl.DateTimeFormat('en-CA',{timeZone:doctor.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
    return {slots:data.slotDates.flatMap(d=>d.slots||[]).filter(s=>Number.isFinite(Date.parse(s.dateTime)) && dateInZone(s.dateTime)===body.date).map(s=>({dateTime:s.dateTime})).slice(0,80),timeZone:doctor.timeZone};
  }
  if(body.action==='appointments') {
    const list=[];let limited=false;
    for(let offset=0;offset<100;offset+=20){
      const data=await client.get(`/appointment/doctor/${doctor.id}?${new URLSearchParams({...range,idClinic:clinic.id,limit:'20',offset:String(offset)})}`);
      const page=Array.isArray(data)?data:data?.appointments;
      if(data===null || (data && typeof data==='object' && !Array.isArray(data) && Object.keys(data).length===0))break;
      if(!Array.isArray(page))throw new HuliError('Huli devolvió una agenda inválida.');
      if(page.some(a=>String(a.idDoctor)!==doctor.id || String(a.idClinic)!==clinic.id))throw new HuliError('La agenda contiene citas fuera de la sede seleccionada.');
      list.push(...page);
      if(page.length<20)break;
      if(offset===80)limited=true;
    }
    const patientNames=new Map();
    const patientIds=[...new Set(list.map(a=>a.idPatientFile).filter(Boolean).map(String))].slice(0,20);
    for(let offset=0;offset<patientIds.length;offset+=5)await Promise.all(patientIds.slice(offset,offset+5).map(async id=>{
      try{const patient=await client.get(`/patient-file/${id}`);if(String(patient.id)===id)patientNames.set(id,[patient.personalData?.firstName,patient.personalData?.lastName].filter(Boolean).join(' '));}catch{/* A missing patient does not hide its calendar entry. */}
    }));
    return {appointments:list.map(a=>({id:String(a.idEvent),patientName:patientNames.get(String(a.idPatientFile)) || 'Paciente sin nombre disponible',date:a.startDate,time:a.timeFrom,status:a.statusAppointment})),timeZone:doctor.timeZone,limited};
  }
  throw new HuliError('Consulta no disponible.',400);
}
export const createHuliClient=config=>new HuliClient(config);
