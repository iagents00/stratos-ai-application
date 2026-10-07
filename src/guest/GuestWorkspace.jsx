import { useState } from 'react';
import { P } from '../design-system/tokens';
import { initialClients, initialTasks, sampleReply, stages } from './fixtures.js';

const tabs = ['Clientes', 'Mi Espacio', 'Copilot'];

export default function GuestWorkspace() {
  const [tab, setTab] = useState('Clientes');
  const [clients, setClients] = useState(initialClients);
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState('');
  const current = clients.find(client => client.id === selected);
  const updateClient = (patch) => setClients(items => items.map(client => client.id === selected ? { ...client, ...patch } : client));

  function resetDemo() {
    setClients(initialClients()); setTasks(initialTasks()); setMessages([]);
    setSelected(null); setSearch(''); setName(''); setTaskTitle(''); setQuestion('');
    setNotice('Demo reiniciada. Todos los datos son ficticios.');
  }
  function ask(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    setMessages(items => [...items.slice(-18), { role: 'Tú', text }, { role: 'Copilot de ejemplo', text: sampleReply(text, clients, tasks) }]);
    setQuestion('');
  }

  return (
    <main style={s.page}>
      <header style={s.header}>
        <div><strong style={{ fontSize: 21 }}>Stratos AI</strong><p style={s.small}>Invitado · Empresa ficticia</p></div>
        <a href="/index.html?app" style={s.link}>Salir de la demo</a>
      </header>
      <aside style={s.banner}>Datos ficticios. Los cambios duran solo mientras esta demo está abierta. No uses información personal ni de clientes reales.</aside>
      <nav aria-label="Secciones de la demo" style={s.tabs}>
        {tabs.map(item => <button key={item} type="button" aria-pressed={tab === item} onClick={() => { setTab(item); setNotice(''); }} style={{ ...s.tab, color: tab === item ? P.bg : P.txt, background: tab === item ? P.accent : P.surface }}>{item}</button>)}
      </nav>
      <div role="status" style={s.small}>{notice}</div>

      {tab === 'Clientes' && <section aria-labelledby="guest-clients-title">
        <h1 id="guest-clients-title" style={s.title}>Clientes de ejemplo</h1>
        <label style={s.label}>Buscar cliente<input value={search} onChange={event => setSearch(event.target.value)} style={s.input} maxLength={80} /></label>
        {clients.filter(client => client.name.toLowerCase().includes(search.toLowerCase())).map(client => (
          <button key={client.id} type="button" onClick={() => { setSelected(client.id); setNotice(''); }} style={{ ...s.card, textAlign: 'left', cursor: 'pointer' }}>
            <strong>{client.name}</strong><span style={s.badge}>{client.stage}</span>
            <p style={s.small}>{client.interest}</p>
          </button>
        ))}
        {!clients.some(client => client.name.toLowerCase().includes(search.toLowerCase())) && <p>No hay resultados en esta demo.</p>}
        {current && <section style={s.card} aria-label={`Ficha de ${current.name}`}>
          <h2 style={s.subtitle}>{current.name}</h2>
          <label style={s.label}>Etapa<select value={current.stage} onChange={event => updateClient({ stage: event.target.value })} style={s.input}>{stages.map(stage => <option key={stage}>{stage}</option>)}</select></label>
          <label style={s.label}>Nota de ejemplo<textarea value={current.note} onChange={event => updateClient({ note: event.target.value })} maxLength={500} rows={3} style={s.input} /></label>
          <button type="button" style={s.button} onClick={() => setNotice('Nota guardada solo en esta demo.')}>Guardar nota</button>
        </section>}
        <form style={s.card} onSubmit={event => {
          event.preventDefault(); if (!name.trim()) return;
          setClients(items => [...items, { id: `guest-${Date.now()}`, name: name.trim(), interest: 'Proyecto ficticio', stage: 'Nuevo', note: '' }]);
          setName(''); setSearch(''); setNotice('Cliente de ejemplo añadido solo a esta demo.');
        }}>
          <label style={s.label}>Nombre ficticio<input required value={name} onChange={event => setName(event.target.value)} maxLength={70} style={s.input} /></label>
          <button type="submit" style={s.button}>Añadir cliente de ejemplo</button>
        </form>
      </section>}

      {tab === 'Mi Espacio' && <section aria-labelledby="guest-space-title">
        <h1 id="guest-space-title" style={s.title}>Mi Espacio</h1>
        <h2 style={s.subtitle}>Tareas de ejemplo</h2>
        {tasks.map(task => <label key={task.id} style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="checkbox" checked={task.done} onChange={() => setTasks(items => items.map(item => item.id === task.id ? { ...item, done: !item.done } : item))} />
          <span style={{ textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</span>
        </label>)}
        <form style={s.card} onSubmit={event => {
          event.preventDefault(); if (!taskTitle.trim()) return;
          setTasks(items => [...items, { id: `task-${Date.now()}`, title: taskTitle.trim(), done: false }]);
          setTaskTitle(''); setNotice('Tarea añadida solo a esta demo.');
        }}>
          <label style={s.label}>Nueva tarea de ejemplo<input required value={taskTitle} onChange={event => setTaskTitle(event.target.value)} maxLength={120} style={s.input} /></label>
          <button type="submit" style={s.button}>Añadir tarea</button>
        </form>
        <h2 style={s.subtitle}>Agenda de ejemplo</h2>
        <article style={s.card}><strong>10:00 · Reunión con Robin Ejemplo</strong><p style={s.small}>Cita ficticia para conocer el recorrido de trabajo.</p></article>
        <h2 style={s.subtitle}>Documento de ejemplo</h2>
        <article style={s.card}><strong>Propuesta · Proyecto Aurora</strong><p style={s.small}>Documento ficticio: presentación del proyecto y próximos pasos de seguimiento. No contiene archivos ni enlaces de ninguna empresa.</p></article>
      </section>}

      {tab === 'Copilot' && <section aria-labelledby="guest-copilot-title">
        <h1 id="guest-copilot-title" style={s.title}>Copilot de ejemplo</h1>
        <p style={s.small}>Respuestas demostrativas sobre los datos de esta demo. El asistente conectado se usa al entrar con una cuenta de empresa.</p>
        <div aria-live="polite">{messages.map((message, index) => <article key={index} style={s.card}><strong style={{ color: P.accent }}>{message.role}</strong><p style={{ marginBottom: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</p></article>)}</div>
        <form style={s.card} onSubmit={ask}>
          <label style={s.label}>Pregunta de ejemplo<textarea required value={question} onChange={event => setQuestion(event.target.value)} placeholder="Resume mis clientes" maxLength={500} rows={3} style={s.input} /></label>
          <button type="submit" style={s.button}>Enviar pregunta de ejemplo</button>
        </form>
      </section>}

      <footer style={{ marginTop: 28 }}><button type="button" onClick={resetDemo} style={s.tab}>Reiniciar datos de ejemplo</button><p style={s.small}>Esta demo no accede a cuentas, empresas ni servicios reales.</p></footer>
    </main>
  );
}

const s = {
  page: { boxSizing: 'border-box', minHeight: '100dvh', maxWidth: 760, margin: '0 auto', padding: 'max(20px, env(safe-area-inset-top)) 18px max(24px, env(safe-area-inset-bottom))', background: P.bg, color: P.txt, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 15, lineHeight: 1.5 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  title: { fontSize: 24, margin: '22px 0 16px' },
  subtitle: { fontSize: 18, margin: '18px 0 12px' },
  small: { fontSize: 13, color: P.txt2, margin: '6px 0' },
  banner: { marginTop: 16, padding: 14, borderRadius: 12, border: `1px solid ${P.accentB}`, background: P.accentS, fontSize: 13 },
  tabs: { display: 'flex', gap: 8, margin: '20px 0 12px' },
  tab: { flex: 1, minHeight: 46, padding: '8px 10px', borderRadius: 12, border: `1px solid ${P.borderH}`, background: P.surface, color: P.txt, font: 'inherit', fontSize: 14, cursor: 'pointer' },
  card: { boxSizing: 'border-box', width: '100%', margin: '12px 0', padding: 16, border: `1px solid ${P.borderH}`, borderRadius: 14, background: P.surface, color: P.txt, font: 'inherit' },
  label: { display: 'grid', gap: 8, marginBottom: 14, fontSize: 14, color: P.txt2 },
  input: { boxSizing: 'border-box', width: '100%', minHeight: 46, padding: 12, border: `1px solid ${P.borderH}`, borderRadius: 10, background: P.bg3, color: P.txt, font: 'inherit', fontSize: 16 },
  button: { minHeight: 48, width: '100%', padding: 12, border: 0, borderRadius: 12, background: P.accent, color: P.bg, font: 'inherit', fontWeight: 650, cursor: 'pointer' },
  link: { color: P.accent, fontSize: 14, padding: '12px 0', textAlign: 'right' },
  badge: { display: 'block', color: P.accent, fontSize: 13, marginTop: 6 },
};
