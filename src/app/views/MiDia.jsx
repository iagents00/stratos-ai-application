import { useState, useMemo, useEffect, useRef, useId } from 'react';
import { Phone, MessageCircle, CalendarClock, Plus, LayoutGrid, Check } from 'lucide-react';
import { P, LP } from '../../design-system/tokens';
import { listaDelDia, diaRails } from '../../lib/next-action-engine';
import { hrefDelCanal } from '../../lib/telefono';
import { agendaDeHoy, resolverAccion, fechaParaMover, zonaRails } from '../../lib/agenda';
import { prepararGestion, resumenAgenda } from '../../lib/rails-gestion';
import './MiDia.css';

const agendaDemo = new Map(); // Solo datos de ejemplo; se reinicia al recargar.
const RESULTADOS = { contactado: 'Contactado', sin_respuesta: 'Sin respuesta', reprogramado: 'Reprogramado' };
const estadoDe = resultado => ({ contactado: 'hecho', sin_respuesta: 'saltado', reprogramado: 'movido' })[resultado];

export function Gestion({ accion, resultado, onCancelar, onGuardar }) {
  // Conserva la versión que el asesor estaba revisando, aunque llegue un sondeo.
  const [base] = useState(accion);
  const [detalle, setDetalle] = useState('');
  const [siguiente, setSiguiente] = useState('');
  const [fecha, setFecha] = useState('');
  const [canal, setCanal] = useState(accion.canal);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const envio = useRef(null), bloqueo = useRef(false), campo = useRef(null);
  const id = useId();
  useEffect(() => { campo.current?.focus(); }, []);
  async function guardar(e) {
    e.preventDefault();
    if (bloqueo.current) return;
    if (!envio.current) {
      try { envio.current = prepararGestion({ id: crypto.randomUUID(), resultado, detalle, siguiente, fecha, canal }); }
      catch (e) { setError(e.message); return; }
    }
    bloqueo.current = true; setGuardando(true); setError('');
    try { await onGuardar(base, envio.current); }
    catch (e) { if (e.definitivo) envio.current = null; setError(e.message || 'No pudimos confirmar el guardado. Reintenta; la tarjeta sigue pendiente.'); }
    finally { bloqueo.current = false; setGuardando(false); }
  }
  const incierto = !!envio.current;
  return <form onSubmit={guardar} className="rails-gestion" aria-label={`Registrar gestión de ${accion.nombre}`}>
    <h4>{RESULTADOS[resultado]} · resultado y siguiente paso</h4>
    <fieldset disabled={guardando || incierto}>
      <label htmlFor={`${id}-detalle`}>{resultado === 'reprogramado' ? 'Motivo para reprogramar' : 'Qué ocurrió'}</label>
      <textarea ref={campo} id={`${id}-detalle`} value={detalle} onChange={e => setDetalle(e.target.value)} required minLength={3} maxLength={2000} rows={2} />
      <label htmlFor={`${id}-canal`}>Canal de la gestión</label>
      <select id={`${id}-canal`} value={canal} onChange={e => setCanal(e.target.value)}>
        <option value="llamada">Llamada</option><option value="whatsapp">WhatsApp</option><option value="zoom">Zoom</option><option value="otro">Otro</option>
      </select>
      <label htmlFor={`${id}-paso`}>Qué harás después</label>
      <input id={`${id}-paso`} value={siguiente} onChange={e => setSiguiente(e.target.value)} required minLength={3} maxLength={1000} placeholder="Por ejemplo: revisar la propuesta con el cliente" />
      <label htmlFor={`${id}-fecha`}>Fecha y hora · {zonaRails()}</label>
      <input type="datetime-local" id={`${id}-fecha`} value={fecha} onChange={e => setFecha(e.target.value)} required />
      <div className="rails-botones">
        {[1,3,7].map((dias,i) => <button type="button" key={dias} onClick={() => setFecha(fechaParaMover(dias).local.replace(' ','T'))}>{['Mañana a las 9','En 3 días','En una semana'][i]}</button>)}
      </div>
    </fieldset>
    {error && <p role="alert" className="rails-error">{error}{incierto && ' El reintento conserva los datos enviados para evitar duplicar la gestión.'}</p>}
    <div className="rails-botones">
      <button className="rails-primary" disabled={guardando} type="submit">{guardando ? 'Guardando…' : incierto ? 'Reintentar el mismo guardado' : 'Guardar resultado y siguiente paso'}</button>
      {!incierto && <button disabled={guardando} type="button" onClick={onCancelar}>Cancelar</button>}
      {incierto && <button disabled={guardando} type="button" onClick={onCancelar}>Cerrar y revisar la ficha</button>}
    </div>
  </form>;
}

function Tarjeta({ accion, indice, total, bloqueada, onGuardar, onVerCliente }) {
  const [resultado, setResultado] = useState(null);
  const registrar = useRef(null);
  const enlace = hrefDelCanal(accion.canal, accion.telefono); // Las instrucciones del coach nunca se envían al cliente.
  const Icono = accion.canal === 'whatsapp' ? MessageCircle : Phone;
  return <article className="rails-tarjeta" aria-label={accion.nombre}>
    <p className="rails-contexto">{indice} de {total} · {accion.canal === 'whatsapp' ? 'WhatsApp' : 'Llamada'} · {accion.eta}</p>
    <h3>{accion.nombre}</h3>
    <p>{accion.razon}</p>
    <p className="rails-pedir">{accion.pedir}</p>
    <p className="rails-contexto">{accion.contexto?.join(' · ')}</p>
    {resultado ? <Gestion accion={accion} resultado={resultado} onGuardar={onGuardar} onCancelar={() => { setResultado(null); requestAnimationFrame(() => registrar.current?.focus()); }} />
      : <div className="rails-botones">
        {enlace && <a href={enlace.href} {...(enlace.externo ? { target: '_blank', rel: 'noreferrer' } : {})}><Icono size={16} />{accion.canal === 'whatsapp' ? 'Abrir WhatsApp' : 'Llamar'}</a>}
        {!enlace && <span className="rails-contexto">Sin teléfono registrado</span>}
        <button ref={registrar} disabled={bloqueada} onClick={() => setResultado('contactado')}><Check size={16} />Registrar contacto</button>
        <button disabled={bloqueada} onClick={() => setResultado('sin_respuesta')}>No contestó</button>
        <button disabled={bloqueada} onClick={() => setResultado('reprogramado')}><CalendarClock size={16} />Reprogramar</button>
        {onVerCliente && <button onClick={() => onVerCliente(accion.leadId)}>Ver ficha</button>}
      </div>}
  </article>;
}

function Jornada({ sessionKey, actorId, leads, config, ahora, demo, offline, recienRegistrado, onNuevoCliente, onVerCRM, onVerCliente, onGuardada }) {
  const [agenda, setAgenda] = useState(() => ({ cargada: demo, cerradas: demo ? agendaDemo.get(sessionKey) || {} : {}, error: '' }));
  const [intento, setIntento] = useState(0);
  const [orden, setOrden] = useState([]);
  const [aviso, setAviso] = useState('');
  const encabezado = useRef(null);
  useEffect(() => {
    if (demo || offline) return;
    let vivo = true;
    agendaDeHoy().then(cerradas => { if (vivo) setAgenda({ cerradas, cargada: true, error: '' }); })
      .catch(e => { if (vivo) setAgenda(prev => ({ ...prev, error: e.message || 'No se pudo leer la agenda.' })); });
    return () => { vivo = false; };
  }, [demo, offline, intento]);
  const lista = useMemo(() => listaDelDia(leads, { config, ahora, cerradas: agenda.cerradas, orden }), [leads, config, ahora, agenda.cerradas, orden]);
  const ids = lista.visibles.map(a => a.leadId);
  if (ids.join('|') !== orden.join('|')) setOrden(ids);
  const [configAnterior, setConfigAnterior] = useState(config);
  if (configAnterior !== config) { setConfigAnterior(config); setOrden([]); }
  const [ultimoNuevo, setUltimoNuevo] = useState(recienRegistrado);
  if (ultimoNuevo !== recienRegistrado) { setUltimoNuevo(recienRegistrado); if (recienRegistrado) setOrden([recienRegistrado, ...orden.filter(id => id !== recienRegistrado)]); }
  const cuenta = resumenAgenda(agenda.cerradas, actorId);
  const bloqueada = offline || !agenda.cargada || !!agenda.error;
  async function guardar(accion, gestion) {
    if (bloqueada) throw new Error('Recarga la agenda antes de registrar una gestión.');
    const data = demo ? { lead: { id: accion.leadId, next_action: gestion.siguiente, next_action_at: gestion.fecha, next_action_date: gestion.fecha, updated_at: new Date().toISOString() } }
      : await resolverAccion(accion, gestion);
    onGuardada?.(data.lead);
    if (demo) agendaDemo.set(sessionKey, { ...agendaDemo.get(sessionKey), [accion.leadId]: { estado: estadoDe(gestion.resultado), asesor_id: actorId, completado_at: new Date().toISOString() } });
    setAgenda(prev => ({ ...prev, cerradas: { ...prev.cerradas, [accion.leadId]: { estado: estadoDe(gestion.resultado), asesor_id: actorId, completado_at: new Date().toISOString() } } }));
    setAviso(`${RESULTADOS[gestion.resultado]}: ${accion.nombre}. Siguiente paso: ${new Date(gestion.fecha).toLocaleString('es-MX')}.${demo ? ' Simulación local.' : ' Guardado.'}`);
    requestAnimationFrame(() => encabezado.current?.focus());
  }
  return <>
    <header>
      <h2 ref={encabezado} tabIndex={-1}>Mi día</h2>
      <p>{lista.total} {lista.total === 1 ? 'cliente pendiente' : 'clientes pendientes'} · {lista.visibles.length} en este bloque</p>
      <p className="rails-contexto">Hoy: {cuenta.hecho || 0} con contacto · {cuenta.saltado || 0} sin respuesta · {cuenta.movido || 0} con nueva fecha</p>
      <div className="rails-botones">
        <button className="rails-primary" onClick={onNuevoCliente}><Plus size={16} />Nuevo cliente</button>
        <button onClick={onVerCRM}><LayoutGrid size={16} />Ver el CRM completo</button>
      </div>
    </header>
    {demo && <p className="rails-aviso">Demo con datos de ejemplo. Las gestiones se simulan en esta sesión; al recargar se reinician.</p>}
    {offline && <p role="alert" className="rails-error">Sin conexión. Puedes revisar la lista; reconecta para confirmar las gestiones.</p>}
    {agenda.error && <div role="alert" className="rails-error"><p>No pudimos comprobar las gestiones de hoy. {agenda.error}</p><button onClick={() => setIntento(i => i+1)}>Reintentar lectura</button></div>}
    {!agenda.cargada && !agenda.error && !offline && <p role="status">Comprobando la agenda de hoy…</p>}
    <p role="status" className="rails-confirmacion">{aviso}</p>
    {lista.visibles.map((accion,i) => <Tarjeta key={accion.leadId} accion={accion} indice={i+1} total={lista.visibles.length} bloqueada={bloqueada} onGuardar={guardar} onVerCliente={onVerCliente} />)}
    {lista.total > lista.visibles.length && <p className="rails-aviso">{lista.total - lista.visibles.length === 1 ? "Queda 1 cliente" : `Quedan ${lista.total - lista.visibles.length} clientes`} después de este bloque. Al guardar una gestión, aparece el siguiente pendiente.</p>}
    {agenda.cargada && !lista.total && <p className="rails-aviso">No hay acciones pendientes en la cartera cargada para este momento. Los próximos pasos aparecerán cuando corresponda su fecha. Puedes revisar las citas y el resto de la cartera en el CRM.</p>}
  </>;
}

export default function MiDia({ T: t, theme = 'dark', scope = 'demo', ...props }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    const timer = setInterval(actualizar, 30000);
    window.addEventListener('focus', actualizar);
    return () => { clearInterval(timer); window.removeEventListener('focus', actualizar); };
  }, []);
  const T = t || (theme === 'light' ? LP : P);
  return <section className={`stratos-rails ${theme === 'light' ? 'rails-light' : ''}`} style={{ '--rails-text': T.txt, '--rails-secondary': theme === 'light' ? '#4b5563' : '#aebaca', '--rails-border': T.border, '--rails-surface': theme === 'light' ? '#fff' : '#141c28', '--rails-accent': theme === 'light' ? '#087252' : '#6ee7c2', '--rails-field': theme === 'light' ? '#fff' : '#0d1420' }}>
    <Jornada key={`${scope}:${diaRails(ahora)}`} sessionKey={`${scope}:${diaRails(ahora)}`} {...props} ahora={ahora} />
  </section>;
}
