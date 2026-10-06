import { useEffect, useRef, useState } from 'react';
import { Plus, Search, RefreshCw, ArrowUpRight, X, Flag, GripVertical, LockKeyhole, ListChecks, CalendarDays } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBoard } from '../features/ISpace/useBoard';
import { BOARD_STATES, WIP_LIMIT, readDescription, writeDescription, blockingReason, taskColumn, taskProgress, projectProgress, isFocus, validateTask, safeLink, localDateTime } from '../features/ISpace/board-model.mjs';
import './ISpaceBoard.css';

const QUARTER_MARK = 'Prioridad trimestral: Sí';
const dateLabel = value => value ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(value)) : 'Sin fecha';
export default function ISpaceBoard({ T, onOpenCopilot }) {
  const { user } = useAuth();
  const board = useBoard(user?.organizationId, user?.id);
  const { projects, tasks, people, brands, loading, saving, error, notice, load, save, setError } = board;
  const [view, setView] = useState('kanban'), [projectId, setProjectId] = useState('all');
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null), [draft, setDraft] = useState({});
  const [dragged, setDragged] = useState(null);
  const [expandedColumns, setExpandedColumns] = useState({});
  const [blockedJump, setBlockedJump] = useState(0);
  useEffect(() => {
    if (!blockedJump || view !== 'kanban') return;
    const frame = requestAnimationFrame(() => document.getElementById('is-column-bloqueada')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [blockedJump, view]);
  const busy = useRef(false), formRef = useRef(null);
  const light = parseInt(String(T?.bg || '#000').replace('#','').slice(0,2),16) > 128;
  const active = tasks.filter(t => t.estado !== 'hecha');
  const inProgress = tasks.filter(t => taskColumn(t, tasks) === 'en_curso');
  const focus = tasks.filter(isFocus);
  const blocked = tasks.filter(t => blockingReason(t, tasks));
  const overdue = active.filter(t => t.due_at && new Date(t.due_at) < new Date());
  const projectName = id => projects.find(p => p.id === id)?.nombre || 'Sin proyecto';
  const personName = id => people.find(p => p.id === id)?.name || 'Por asignar';
  const visible = tasks.filter(t => (projectId === 'all' || (projectId === 'none' ? !t.project_id : t.project_id === projectId))
    && (!query || `${t.titulo} ${t.descripcion || ''} ${projectName(t.project_id)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    && (filter === 'all' || (filter === 'focus' && isFocus(t)) || (filter === 'unassigned' && !t.assignee_id && t.estado !== 'hecha') || (filter === 'overdue' && overdue.includes(t))))
    .sort((a,b) => Number(isFocus(b)) - Number(isFocus(a)) || String(a.due_at || 'z').localeCompare(String(b.due_at || 'z')) || a.created_at.localeCompare(b.created_at));
  const openTask = (task = null, preset = {}) => {
    setError(''); setEditor({ type: 'task', item: task });
    setDraft(task ? { ...task, ...readDescription(task.descripcion), due: localDateTime(task.due_at) }
      : { titulo: '', project_id: projectId !== 'all' && projectId !== 'none' ? projectId : '', estado: 'por_hacer', prioridad: 'media', assignee_id: user.id, depends_on: '', due: '', drive_url: '', notes: '', blocker: '', checklist: [], ...preset });
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); formRef.current?.querySelector('input')?.focus(); });
  };
  const openProject = (project = null) => {
    setError(''); setEditor({ type: 'project', item: project });
    setDraft(project ? { ...project, quarter: (project.descripcion || '').includes(QUARTER_MARK), description: (project.descripcion || '').replace(QUARTER_MARK, '').trim() }
      : { nombre: '', description: '', due_date: '', estado: 'activo', quarter: false, drive_url: '' });
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); formRef.current?.querySelector('input')?.focus(); });
  };
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const persistTask = async (task, patch) => {
    if (busy.current || saving) return;
    const next = { ...task, ...patch };
    const validation = validateTask(next, tasks, task);
    if (validation) { setError(validation); return; }
    busy.current = true;
    await save('mkt_tasks', { ...patch, avance_pct: taskProgress(next) }, task);
    busy.current = false;
  };
  const submit = async event => {
    event.preventDefault(); if (saving) return;
    if (editor.type === 'project') {
      if (!draft.nombre?.trim()) { setError('Escribe el nombre del proyecto.'); return; }
      if (draft.drive_url && !safeLink(draft.drive_url)) { setError('El enlace debe comenzar por https:// o http://.'); return; }
      const ok = await save('mkt_projects', { nombre: draft.nombre.trim(), descripcion: [draft.quarter ? QUARTER_MARK : '', draft.description?.trim()].filter(Boolean).join('\n\n'), due_date: draft.due_date || null, estado: draft.estado, drive_url: draft.drive_url || null, brand_id: editor.item?.brand_id || brands[0]?.id || null }, editor.item);
      if (ok) setEditor(null); return;
    }
    const description = writeDescription(draft);
    const next = { ...draft, descripcion: description, id: editor.item?.id, depends_on: draft.depends_on || null };
    const validation = validateTask(next, tasks, editor.item);
    if (validation) { setError(validation); return; }
    if (draft.drive_url && !safeLink(draft.drive_url)) { setError('El enlace debe comenzar por https:// o http://.'); return; }
    const project = projects.find(p => p.id === draft.project_id);
    const ok = await save('mkt_tasks', { titulo: draft.titulo.trim(), descripcion: description, project_id: project?.id || null, brand_id: project?.brand_id || brands[0]?.id || null, estado: draft.estado, prioridad: draft.prioridad, assignee_id: draft.assignee_id || null, depends_on: draft.depends_on || null, due_at: draft.due ? new Date(draft.due).toISOString() : null, drive_url: draft.drive_url || null, avance_pct: taskProgress(next), ...(editor.item ? {} : { origen: 'web' }) }, editor.item);
    if (ok) setEditor(null);
  };
  const taskCard = task => {
    const parsed = readDescription(task.descripcion), reason = blockingReason(task, tasks);
    const checked = parsed.checklist.filter(x => x.done).length;
    return <article key={task.id} className="is-task" draggable={!saving && !editor} onDragStart={e => { e.dataTransfer.setData('text/plain', task.id); setDragged(task.id); }} onDragEnd={() => setDragged(null)}>
      <div className="is-task-top"><span>{projectName(task.project_id)}</span><GripVertical size={14} aria-hidden="true" /></div>
      <button className="is-task-title" onClick={() => openTask(task)}>{task.titulo}</button>
      {reason && <p className="is-blocker"><LockKeyhole size={13} />{reason}</p>}
      <div className="is-task-meta"><span>{personName(task.assignee_id)}</span><span className={overdue.includes(task) ? 'is-late' : ''}>{dateLabel(task.due_at)}</span></div>
      <div className="is-task-bottom">
        <span>{parsed.checklist.length > 0 && <><ListChecks size={14} />{checked}/{parsed.checklist.length}</>}</span>
        <button aria-label={`${isFocus(task) ? 'Quitar del' : 'Añadir al'} foco: ${task.titulo}`} aria-pressed={isFocus(task)} disabled={saving || task.estado === 'hecha'} onClick={() => persistTask(task, { prioridad: isFocus(task) ? 'media' : 'alta' })}><Flag size={14} fill={isFocus(task) ? 'currentColor' : 'none'} />{isFocus(task) ? 'Foco' : 'Priorizar'}</button>
      </div>
      <label className="is-sr" htmlFor={`state-${task.id}`}>Estado de {task.titulo}</label>
      <select id={`state-${task.id}`} value={task.estado} disabled={saving} onChange={e => persistTask(task, { estado: e.target.value })}>
        {BOARD_STATES.filter(s => s.id !== 'bloqueada').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </article>;
  };
  const createReview = () => {
    const date = new Date().toLocaleDateString('es-MX');
    openTask(null, { titulo: `Revisión semanal · ${date}`, assignee_id: user.id, notes: 'Cierre semanal: registrar resultados, resolver bloqueos y elegir el siguiente foco. Escribir decisiones y aprendizajes aquí.', checklist: ['Revisar el resultado y la métrica de cada prioridad trimestral', 'Cerrar tareas terminadas con su evidencia', 'Decidir cómo desbloquear lo que está detenido', 'Asignar responsables y fechas a los siguientes compromisos', 'Elegir hasta tres tareas de foco y revisar capacidad'].map(text => ({ text, done: false })) });
  };
  return <section className="is-board" data-theme={light ? 'light' : 'dark'}>
    <header className="is-heading"><div><h1>Todo en su lugar.</h1><p>Tus proyectos, una siguiente acción a la vez.</p></div><div className="is-heading-actions"><button onClick={load} disabled={loading || saving} aria-label="Actualizar tablero"><RefreshCw size={17} /></button>{onOpenCopilot && <button onClick={onOpenCopilot}>Copilot <ArrowUpRight size={16} /></button>}<button className="is-primary" onClick={() => openTask()}><Plus size={16} /> Nueva tarea</button></div></header>
    <div className="is-pulse"><span><strong>{active.length}</strong> pendientes</span><span><strong>{inProgress.length}/{WIP_LIMIT}</strong> en curso · límite sugerido</span><button onClick={() => {setView('kanban');setFilter('all');setProjectId('all');setQuery('');setBlockedJump(n => n + 1);}}><strong>{blocked.length}</strong> bloqueadas</button><button onClick={() => {setView('kanban');setFilter('unassigned');}}><strong>{active.filter(t => !t.assignee_id).length}</strong> por asignar</button><span className="is-private"><LockKeyhole size={13} /> I Space · privado</span></div>
    {inProgress.length > WIP_LIMIT && <p className="is-warning">Tienes {inProgress.length} tareas en curso. Termina o desbloquea una antes de empezar otra.</p>}
    <nav className="is-tabs" aria-label="Vistas de proyectos">{[['kanban','Kanban'],['projects','Proyectos'],['review','Revisión semanal']].map(([id,label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>
    {error && <div role="alert" className="is-alert">{error}</div>}{notice && <p role="status" className="is-status">{notice}</p>}
    {editor && <form ref={formRef} className="is-editor" onSubmit={submit} aria-label={editor.type === 'task' ? 'Editar tarea' : 'Editar proyecto'}>
      <div className="is-section-title"><h2>{editor.item ? 'Editar' : 'Nuevo'} {editor.type === 'task' ? 'pendiente' : 'proyecto'}</h2><button type="button" aria-label="Cerrar editor" disabled={saving} onClick={() => setEditor(null)}><X size={18} /></button></div>
      <fieldset disabled={saving}>
        {editor.type === 'project' ? <>
          <label>Nombre del proyecto<input required maxLength={180} value={draft.nombre} onChange={e => set('nombre',e.target.value)} /></label>
          <label>Resultado, métrica y contexto<textarea rows={5} value={draft.description} onChange={e => set('description',e.target.value)} placeholder="Qué debe quedar listo, cómo lo medirás y qué falta confirmar." /></label>
          <div className="is-form-grid"><label>Fecha objetivo<input type="date" value={draft.due_date || ''} onChange={e => set('due_date',e.target.value)} /></label><label>Estado del proyecto<select value={draft.estado} onChange={e => set('estado',e.target.value)}><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="terminado">Terminado</option></select></label></div>
          <label className="is-checkline"><input type="checkbox" checked={draft.quarter} onChange={e => set('quarter',e.target.checked)} /> Prioridad trimestral</label>
        </> : <>
          <label>Qué hay que hacer<input required maxLength={240} value={draft.titulo} onChange={e => set('titulo',e.target.value)} /></label>
          <div className="is-form-grid"><label>Proyecto<select value={draft.project_id || ''} onChange={e => set('project_id',e.target.value)}><option value="">Sin proyecto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><label>Responsable<select value={draft.assignee_id || ''} onChange={e => set('assignee_id',e.target.value)}><option value="">Por asignar / delegar</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Fecha y hora<input type="datetime-local" value={draft.due} onChange={e => set('due',e.target.value)} /></label><label>Estado<select value={draft.estado} onChange={e => set('estado',e.target.value)}>{BOARD_STATES.filter(s => s.id !== 'bloqueada').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div>
          <p className="is-help">Fechas en {Intl.DateTimeFormat().resolvedOptions().timeZone}. “Por asignar” no invita ni concede acceso a nadie.</p>
          <label>Resultado esperado y notas<textarea rows={3} value={draft.notes} onChange={e => set('notes',e.target.value)} /></label>
          <div className="is-form-grid"><label>Depende de<select value={draft.depends_on || ''} onChange={e => set('depends_on',e.target.value)}><option value="">Sin dependencia</option>{tasks.filter(t => t.id !== editor.item?.id).map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}</select></label><label>Qué la bloquea<input value={draft.blocker} onChange={e => set('blocker',e.target.value)} placeholder="Vacío si puede avanzar" /></label></div>
          <label className="is-checkline"><input type="checkbox" checked={['alta','urgente'].includes(draft.prioridad)} onChange={e => set('prioridad',e.target.checked ? 'alta' : 'media')} /> Foco semanal</label>
          <div className="is-checklist"><h3>Checklist de entrega</h3>{draft.checklist.map((item,i) => <div className="is-check-item" key={i}><input aria-label={`Completar paso ${i+1}: ${item.text}`} type="checkbox" checked={item.done} onChange={e => set('checklist',draft.checklist.map((x,j) => j===i ? {...x,done:e.target.checked}:x))} /><input aria-label={`Paso ${i+1}`} value={item.text} onChange={e => set('checklist',draft.checklist.map((x,j) => j===i ? {...x,text:e.target.value}:x))} /><button type="button" aria-label={`Quitar paso ${i+1}`} onClick={() => set('checklist',draft.checklist.filter((_,j)=>j!==i))}><X size={15} /></button></div>)}<button type="button" onClick={() => set('checklist',[...draft.checklist,{text:'',done:false}])}><Plus size={14} /> Añadir paso</button></div>
        </>}
        <label>Enlace a documentos o evidencia<input type="url" value={draft.drive_url || ''} onChange={e => set('drive_url',e.target.value)} placeholder="https://…" /></label>
        <div className="is-form-actions"><button type="button" onClick={() => setEditor(null)}>Cancelar</button><button className="is-primary" type="submit">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </fieldset>
    </form>}
    {loading && <p role="status" className="is-loading">Actualizando tu tablero…</p>}
    {view === 'kanban' && <>
      <div className="is-toolbar"><label className="is-search"><Search size={16} /><input aria-label="Buscar tareas" placeholder="Buscar una tarea…" value={query} onChange={e=>setQuery(e.target.value)} /></label><label><span className="is-sr">Filtrar por proyecto</span><select aria-label="Filtrar por proyecto" value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="all">Todos los proyectos</option><option value="none">Sin proyecto</option>{projects.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label><label><span className="is-sr">Filtrar tareas</span><select aria-label="Filtrar tareas" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas las tareas</option><option value="focus">Foco semanal</option><option value="unassigned">Por asignar / delegar</option><option value="overdue">Vencidas</option></select></label><span className="is-help">{visible.length} {visible.length === 1 ? 'tarea' : 'tareas'}</span></div>
      <div className="is-kanban" aria-label="Tablero Kanban">{BOARD_STATES.map(state => {
        const column = visible.filter(t=>taskColumn(t,tasks)===state.id);
        return <section id={`is-column-${state.id}`} key={state.id} className={`is-column ${dragged && state.id !== 'bloqueada' ? 'is-drop-ready' : ''}`} onDragOver={e=>{if(state.id!=='bloqueada')e.preventDefault();}} onDrop={e=>{e.preventDefault();const t=tasks.find(t=>t.id===e.dataTransfer.getData('text/plain'));setDragged(null);if(t && state.id!=='bloqueada')persistTask(t,{estado:state.id});}}>
          <h2><span className={`is-state-dot is-state-${state.id}`} />{state.label}<span>{column.length}</span></h2>
          {column.length ? column.slice(0, expandedColumns[state.id] ? undefined : 5).map(taskCard) : <p className="is-column-empty">{state.id==='hecha'?'Aquí verás lo que termines.':state.id==='bloqueada'?'Sin bloqueos en esta vista.':'Sin tareas en esta columna.'}</p>}
          {column.length > 5 && <button className="is-add" onClick={() => setExpandedColumns(v => ({...v,[state.id]:!v[state.id]}))}>{expandedColumns[state.id] ? 'Mostrar menos' : `Ver ${column.length - 5} más`}</button>}
          {state.id==='por_hacer' && <button className="is-add" onClick={()=>openTask()}><Plus size={15}/> Añadir tarea</button>}
        </section>;
      })}</div><p className="is-help">Arrastra una tarjeta o cambia su estado con el selector. Abre el título para editar su checklist, responsable y dependencias.</p>
    </>}
    {view === 'projects' && <section><div className="is-section-title"><div><h2>Frentes de trabajo</h2><p className="is-help">Un resultado claro por proyecto. Marca entre tres y cinco prioridades trimestrales.</p></div><button onClick={()=>openProject()}><Plus size={16}/> Nuevo proyecto</button></div>
      <div className="is-project-list">{projects.map(p=>{const progress=projectProgress(p.id,tasks), own=tasks.filter(t=>t.project_id===p.id&&t.estado!=='hecha');return <article className="is-project" key={p.id}><div><div className="is-project-name"><h3>{p.nombre}</h3>{p.descripcion?.includes(QUARTER_MARK)&&<span className="is-quarter"><Flag size={12}/> Trimestre</span>}<span className="is-help">{p.estado==='activo'?'Activo':p.estado==='pausado'?'Pausado':'Terminado'}</span></div><p className="is-project-description">{(p.descripcion||'Añade el resultado esperado de este proyecto.').replace(QUARTER_MARK,'').trim()}</p><div className="is-project-foot"><span>{progress.done}/{progress.total} tareas hechas</span><span>{own.filter(t=>blockingReason(t,tasks)).length} bloqueos</span><span>{p.due_date?`Objetivo: ${dateLabel(`${p.due_date}T12:00:00`)}`:'Fecha objetivo por definir'}</span></div><progress max={Math.max(progress.total,1)} value={progress.done} aria-label={`Avance de ${p.nombre}`} /></div><div className="is-project-actions"><button onClick={()=>{setProjectId(p.id);setFilter('all');setQuery('');setView('kanban');}}>Ver tareas <ArrowUpRight size={15}/></button><button onClick={()=>openProject(p)}>Editar proyecto</button>{safeLink(p.drive_url)&&<a href={safeLink(p.drive_url)} target="_blank" rel="noreferrer">Documentos <ArrowUpRight size={14}/></a>}</div></article>;})}{!loading&&!projects.length&&<p>Aún no hay proyectos. Crea el primero para agrupar sus tareas.</p>}</div>
    </section>}
    {view === 'review' && <section className="is-review"><div className="is-section-title"><div><h2>Menos frentes abiertos. Más entregas.</h2><p className="is-help">Revisa tus prioridades, decide qué sigue y deja un responsable por compromiso.</p></div><button onClick={createReview}><CalendarDays size={16}/> Preparar revisión</button></div><div className="is-review-grid"><div><h3>Foco semanal <span>{focus.length}</span></h3><p className="is-help">Seleccionado con la bandera. Mantén hasta tres compromisos como punto de partida.</p>{focus.map(taskCard)}{!focus.length&&<p>Usa “Priorizar” en las tarjetas para elegir tu siguiente foco.</p>}</div><div className="is-review-notes"><h3>Decisiones pendientes</h3><button onClick={()=>{setFilter('overdue');setProjectId('all');setView('kanban');}}>{overdue.length} tareas vencidas <ArrowUpRight size={15}/></button><button onClick={()=>{setFilter('unassigned');setProjectId('all');setView('kanban');}}>{active.filter(t=>!t.assignee_id).length} tareas por asignar <ArrowUpRight size={15}/></button><p>{active.filter(t=>!t.due_at).length} tareas sin fecha acordada</p><h3>Prioridades del trimestre</h3>{projects.filter(p=>p.descripcion?.includes(QUARTER_MARK)).map(p=><button key={p.id} onClick={()=>openProject(p)}><Flag size={14}/>{p.nombre}</button>)}<h3>Ritmo de trabajo</h3><p><strong>Cada día:</strong> revisa el foco, avanza una entrega y registra lo que te bloquea.</p><p><strong>Cada semana:</strong> contrasta resultados con la métrica del proyecto, acuerda responsables y elige el siguiente foco.</p><p><strong>Cada trimestre:</strong> revisa resultados, capacidad y las tres a cinco prioridades.</p><p className="is-help">Adaptación práctica de Kanban y Scaling Up. Fechas y metas se acuerdan; no se suponen.</p><a href="https://scalingup.com/topics/execution" target="_blank" rel="noreferrer">Referencia: Scaling Up <ArrowUpRight size={13}/></a></div></div></section>}
  </section>;
}
