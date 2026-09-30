import { useEffect, useRef, useState } from 'react';
import { ArrowUp, CalendarDays, RotateCcw, Sparkles, Check, Clock3 } from 'lucide-react';
import { INITIAL_APPOINTMENTS, availableHours, demoReply } from './model';
import './dental-demo.css';

export default function DentalDemo({ embedded = false, view = 'all' }) {
  const [appointments, setAppointments] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('stratos.dental-demo.appointments') || 'null');
      if (Array.isArray(saved) && saved.every(a => a && typeof a.time === 'string' && typeof a.patient === 'string')) return saved;
    } catch { /* Fresh demo if browser storage is unavailable. */ }
    return INITIAL_APPOINTMENTS.map(a => ({ ...a }));
  });
  useEffect(() => {
    try { sessionStorage.setItem('stratos.dental-demo.appointments', JSON.stringify(appointments)); } catch { /* Optional demo persistence. */ }
  }, [appointments]);
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Bienvenido a la clínica dental demo. Consulta disponibilidad y prepara una cita ficticia para ver el flujo completo.' }]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState('');
  const conversation = useRef(null);
  useEffect(() => {
    if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [messages]);
  function send(text) {
    if (!text.trim()) return;
    const result = demoReply(text.trim(), appointments);
    setMessages(prev => [...prev, { role: 'user', text: text.trim() }, { role: 'assistant', text: result.reply, slots: result.slots }]);
    setInput('');
  }
  function book() {
    if (!pending || !availableHours(appointments).includes(pending)) { setNotice('El horario ya está ocupado. Selecciona otro.'); return; }
    const appointment = { id: `demo-${Date.now()}`, time: pending, patient: 'Paciente Demo Nuevo', treatment: 'Valoración dental', doctor: 'Dra. Ana · Demo', status: 'Por confirmar' };
    setAppointments(prev => [...prev, appointment].sort((a, b) => a.time.localeCompare(b.time)));
    setMessages(prev => [...prev, { role: 'assistant', text: `Cita ficticia creada a las ${pending} para Paciente Demo Nuevo. Ya aparece en la agenda. No se reservó ningún horario en Huli.` }]);
    setNotice(`Cita demo creada a las ${pending}.`); setPending(null);
  }
  function reset() {
    setAppointments(INITIAL_APPOINTMENTS.map(a => ({ ...a }))); setPending(null); setInput('');
    setMessages([{ role: 'assistant', text: 'Demo reiniciada. Puedes consultar horarios y crear otra cita ficticia.' }]); setNotice('Se restableció la agenda ficticia.');
  }
  return <div className={`dental-demo ${embedded ? 'dental-embedded' : ''} dental-view-${view}`}>
    <header className="dental-header"><a className="dental-brand" href="/">STRATOS <span>AI</span></a><span className="dental-demo-label">Demo dental · Datos ficticios</span><button className="dental-reset" onClick={reset}><RotateCcw size={15} /> Reiniciar</button></header>
    <main className="dental-main">
      <div className="dental-heading"><div><p className="dental-eyebrow">RECEPCIÓN / CLÍNICA DENTAL DEMO</p><h1>Tu agenda, con un asistente.</h1><p>Prueba el flujo de recepción: encuentra un horario y prepara una cita.</p></div><div className="dental-mode"><span /> Entorno de demostración</div></div>
      <div className="dental-workspace">
        <section className="dental-agenda" aria-labelledby="dental-agenda-title"><div className="dental-panel-head"><div><CalendarDays size={20} /><h2 id="dental-agenda-title">Agenda dental</h2></div><span>Jornada de ejemplo</span></div>
          <div className="dental-summary"><div><strong>{appointments.length}</strong><span>Citas demo</span></div><div><strong>{availableHours(appointments).length}</strong><span>Horarios libres</span></div><div><strong>{appointments.filter(a => a.status === 'Por confirmar').length}</strong><span>Por confirmar</span></div></div>
          <div className="dental-appointments">{appointments.map(a => <article key={a.id} className="dental-appointment"><time>{a.time}</time><div className="dental-patient"><h3>{a.patient}</h3><p>{a.treatment}</p><span>{a.doctor}</span></div><button className={`dental-status ${a.status === 'Confirmada' ? 'confirmed' : ''}`} disabled={a.status === 'Confirmada'} aria-label={`${a.status === 'Confirmada' ? 'Confirmada' : 'Confirmar cita de'} ${a.patient}`} onClick={() => { setAppointments(prev => prev.map(item => item.id === a.id ? { ...item, status: 'Confirmada' } : item)); setNotice('Cita confirmada en la simulación.'); }}>{a.status === 'Confirmada' ? <Check size={13} /> : <Clock3 size={13} />}{a.status}</button></article>)}</div>
          <div className="dental-agenda-foot"><p>Todos los nombres, tratamientos y horarios son ficticios.</p><p role="status">{notice || 'Los cambios sólo duran mientras esta página esté abierta.'}</p></div>
        </section>
        <section className="dental-copilot" aria-labelledby="dental-copilot-title"><div className="dental-panel-head"><div><Sparkles size={20} /><h2 id="dental-copilot-title">Copilot dental</h2></div><span>Simulación</span></div>
          <div className="dental-suggestions">{['Ver agenda', 'Consultar horarios', 'Ejemplo de recordatorio'].map(text => <button key={text} onClick={() => send(text)}>{text}</button>)}</div>
          <div ref={conversation} className="dental-messages" role="log" aria-live="polite" aria-label="Conversación de demostración">{messages.map((m, i) => <div key={i} className={`dental-message ${m.role}`}><span>{m.role === 'user' ? 'Tú' : 'Stratos Copilot · Demo'}</span><p>{m.text}</p>{m.slots && <div className="dental-slots">{m.slots.filter(time => availableHours(appointments).includes(time)).map(time => <button key={time} onClick={() => { setPending(time); setNotice(''); }}>Preparar {time}</button>)}</div>}</div>)}</div>
          {pending && <div className="dental-review"><strong>Revisar cita ficticia · {pending}</strong><p>Paciente Demo Nuevo · Valoración dental<br />Dra. Ana · Jornada de ejemplo</p><div><button onClick={book}>Crear cita demo</button><button onClick={() => setPending(null)}>Cancelar</button></div></div>}
          <form className="dental-composer" onSubmit={e => { e.preventDefault(); send(input); }}><label className="dental-sr-only" htmlFor="dental-input">Instrucción para Copilot demo</label><input id="dental-input" value={input} onChange={e => setInput(e.target.value)} maxLength={300} placeholder="Pregunta por horarios disponibles…" /><button type="submit" disabled={!input.trim()} aria-label="Enviar mensaje"><ArrowUp size={19} /></button></form>
        </section>
      </div>
      <footer className="dental-disclosure"><strong>Huli · Conector preparado, demo simulada</strong><p>Esta página no consulta pacientes reales ni modifica Huli. La activación real requiere vincular la clínica, sus sedes, médicos y usuarios autorizados.</p></footer>
    </main>
  </div>;
}
