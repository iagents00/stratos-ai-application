import { useEffect, useState } from 'react';
import { CalendarDays, Users, RefreshCw, ExternalLink, Search, ShieldCheck, Clock3 } from 'lucide-react';
import { useHuli,queryHuli } from './HuliContext';
import './huli-workspace.css';
const HULI_CALENDAR='https://app.hulipractice.com/es#/calendar';
function dateToday(zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone||'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export default function HuliWorkspace({view}) {
  const metadata=useHuli();
  const [doctorId,setDoctorId]=useState(metadata.doctors[0]?.id||'');
  const doctor=metadata.doctors.find(d=>d.id===doctorId);
  const [clinicId,setClinicId]=useState(doctor?.clinics[0]?.id||'');
  const [date,setDate]=useState(()=>dateToday(doctor?.timeZone));
  const [query,setQuery]=useState(''),[offset,setOffset]=useState(0),[version,setVersion]=useState(0),[tab,setTab]=useState(view==='copilot'?'availability':'appointments');
  const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const isPatients=view==='patients';
  useEffect(()=>{
    if(view==='profile')return;
    if(!isPatients && (!doctorId||!clinicId))return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setLoading(true);setError('');setData(null);
      queryHuli(isPatients?{action:'patients',query,offset}:{action:tab,doctorId,clinicId,date},controller.signal).then(d=>{if(!controller.signal.aborted)setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },isPatients?300:0);
    return()=>{clearTimeout(timer);controller.abort();};
  },[view,isPatients,query,offset,tab,doctorId,clinicId,date,version]);
  const time=value=>new Intl.DateTimeFormat('es-MX',{timeZone:doctor?.timeZone,hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  return <div className="huli-workspace">
    <div className="huli-title"><div><p className="huli-kicker">STRATOS AI · HULI</p><h1>{view==='profile'?'Perfil de la clínica':isPatients?'Pacientes':view==='copilot'?'Copilot · Consulta de horarios':'Agenda de la clínica'}</h1><p>{metadata.organization.name}</p></div><span className="huli-connected"><ShieldCheck size={16}/>Conexión real · Sólo consulta</span></div>
    {!metadata.dentalConfigured&&<div className="huli-setup" role="status"><strong>Piloto dental conectado a tu cuenta Huli.</strong><p>Huli registra {metadata.doctors.map(d=>`${d.name} · ${d.specialties.join(', ')}`).join('; ')||'ningún profesional autorizado'}. El piloto usa ese profesional y su sede sin cambiar los datos de Huli.</p></div>}
    {view==='profile'?<section className="huli-panel"><h2>Profesionales y sedes autorizados</h2>{metadata.doctors.map(d=><article className="huli-row" key={d.id}><div><strong>{d.name}</strong><p>{d.specialties.join(', ')}</p><p>{d.clinics.map(c=>c.name).join(', ')}</p><small>Zona horaria: {d.timeZone||'Sin configurar'}</small></div></article>)}<p>Esta sesión consulta la organización {metadata.organization.name}. La API no expone su clave ni comparte la información con los clientes de Stratos.</p><a className="huli-primary" href={HULI_CALENDAR} target="_blank" rel="noreferrer">Abrir Huli para completar la configuración <ExternalLink size={14}/></a></section>:<>
    <div className="huli-tools">{isPatients?<label className="huli-search"><Search size={17}/><input aria-label="Buscar paciente en Huli" placeholder="Buscar por nombre…" value={query} maxLength={120} onChange={e=>{setQuery(e.target.value);setOffset(0);}}/></label>:<>
      <label>Profesional<select value={doctorId} onChange={e=>{const d=metadata.doctors.find(d=>d.id===e.target.value);setDoctorId(e.target.value);setClinicId(d?.clinics[0]?.id||'');}}>{metadata.doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>Sede<select value={clinicId} onChange={e=>setClinicId(e.target.value)}>{doctor?.clinics.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Fecha<input aria-label="Fecha de consulta" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    </>}
    <button className="huli-secondary" disabled={loading} onClick={()=>setVersion(v=>v+1)}><RefreshCw size={15}/>Actualizar</button></div>
    {!isPatients&&<div className="huli-tabs"><button aria-pressed={tab==='appointments'} onClick={()=>setTab('appointments')}><CalendarDays size={16}/>Citas del día</button><button aria-pressed={tab==='availability'} onClick={()=>setTab('availability')}><Clock3 size={16}/>Horarios disponibles</button><span>Hora de la sede · {doctor?.timeZone||'Sin configurar'}</span></div>}
    {error?<div className="huli-panel huli-failure" role="alert"><strong>No pudimos actualizar esta consulta.</strong><p>{error}</p><button className="huli-secondary" onClick={()=>setVersion(v=>v+1)}>Reintentar</button></div>:loading||!data?<section className="huli-panel" aria-busy="true"><p>{!isPatients&&(!doctorId||!clinicId)?'Agrega un profesional y una sede en Huli para consultar la agenda.':'Consultando Huli…'}</p></section>:isPatients?<section className="huli-panel"><div className="huli-panel-title"><h2><Users size={18}/>Pacientes de Huli</h2><span>{data.total} registros</span></div>{data.patients.length?data.patients.map(p=><article className="huli-row" key={p.id}><span className="huli-avatar">{p.name.slice(0,1)}</span><div><strong>{p.name}</strong><p>Registro de paciente en Huli</p></div></article>):<div className="huli-empty"><h2>{query?'No encontramos ese nombre':'No hay pacientes registrados'}</h2><p>{query?'Prueba con el nombre o apellido.':'Los pacientes aparecerán aquí al registrarlos en tu cuenta Huli.'}</p></div>}<div className="huli-pagination"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Anterior</button><span>{data.total?`${offset+1}–${offset+data.patients.length} de ${data.total}`:'0 registros'}</span><button disabled={offset+data.patients.length>=data.total} onClick={()=>setOffset(offset+20)}>Siguiente</button></div></section>:<section className="huli-panel"><div className="huli-panel-title"><h2>{tab==='appointments'?'Citas registradas':'Disponibilidad real'}</h2><a className="huli-secondary" href={HULI_CALENDAR} target="_blank" rel="noreferrer">Agendar en Huli<ExternalLink size={14}/></a></div>{tab==='availability'?data.slots.length?<div className="huli-slot-grid">{data.slots.map((slot,i)=><div key={`${slot.dateTime}-${i}`}><Clock3 size={15}/><strong>{time(slot.dateTime)}</strong><span>Disponible</span></div>)}</div>:<div className="huli-empty"><h2>No hay horarios disponibles</h2><p>Prueba otra fecha o revisa el calendario de disponibilidad en Huli.</p></div>:data.appointments.length?data.appointments.map(a=><article className="huli-row" key={a.id}><time>{a.time?.slice(0,5)}</time><div><strong>{a.patientName || "Cita registrada en Huli"}</strong><p>{{BOOKED:'Agendada',RESCHEDULED:'Reprogramada',COMPLETED:'Finalizada',CANCELLED:'Cancelada',NOSHOW:'No asistió'}[a.status]||a.status}</p></div></article>):<div className="huli-empty"><h2>No hay citas para esta fecha</h2><p>Consulta horarios disponibles o abre Huli para agendar una cita.</p></div>}{data.limited&&<p>Se muestran las primeras 100 citas. Consulta la agenda completa en Huli.</p>}</section>}
    </>}
    <p className="huli-footnote">Información real de tu cuenta Huli. La creación, modificación y cancelación de citas se realizan en Huli.</p>
  </div>;
}
