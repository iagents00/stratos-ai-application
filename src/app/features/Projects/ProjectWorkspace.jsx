import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, ChevronRight, CircleHelp, Layers, Paperclip, Plus, X } from "lucide-react";
import { StratosAtomHex } from "../../components/Logo";
import { byPriority, changeProject, dayLabel, deliveryState, loadProjects, localDay, runProjectAgent, states, useProjects } from "./workspace";
import { projectTheme } from "./project-theme";
import "./projects.css";

const tabs = {
  direction: [["today", "Hoy"], ["projects", "Proyectos"], ["flow", "Flujo"]],
  operation: [["today", "Mi trabajo"], ["deliveries", "Entregas"]],
};
const eventNames = {
  created: "Entrega creada", delegate: "Delegación actualizada", start: "Trabajo iniciado",
  save: "Avance guardado", submit: "Enviada a revisión", approve: "Entrega aprobada",
  return: "Devuelta con cambios", block: "Bloqueo registrado", unblock: "Bloqueo resuelto",
  agent_started: "Agente en ejecución", agent_submitted: "Informe enviado a revisión",
  agent_failed: "Informe no confirmado",
};

function Badge({ item, review = false }) {
  const state = deliveryState(item);
  return <span className="pw-badge" data-state={state}>{review && state === "review" ? "Por revisar" : states[state]}</span>;
}

function Row({ title, detail, rank, Icon = Layers, badge, onClick }) {
  return <button type="button" className={`pw-row${rank ? " pw-ranked" : ""}${rank === 1 ? " pw-first" : ""}`} onClick={onClick}>
    <span className={rank ? "pw-rank" : "pw-tile"} aria-hidden="true">{rank || <Icon size={23} />}</span>
    <span className="pw-row-copy"><strong>{title}</strong><small>{detail}</small></span>
    {badge || <ChevronRight size={18} aria-hidden="true" />}
  </button>;
}

function Modal({ title, onClose, busy, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className="pw-dialog" aria-labelledby="pw-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="pw-dialog-heading"><h2 id="pw-dialog-title">{title}</h2>
      <button type="button" className="pw-icon" aria-label="Cerrar" onClick={onClose} disabled={busy}><X size={20} /></button>
    </div>
    {children}
  </dialog>;
}

function ProjectForm({ busy, onSave }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSave(Object.fromEntries(new FormData(event.currentTarget))); }}>
    <label>Nombre<input name="title" maxLength={160} required /></label>
    <label>Resultado esperado<textarea name="outcome" maxLength={2000} rows={3} required /></label>
    <label>Fecha objetivo<input type="date" name="target_date" /></label>
    <button className="pw-btn pw-primary" type="submit" disabled={busy}>Crear proyecto</button>
  </form>;
}

function DeliveryForm({ item, project, projectOptions, deliveries, people, userId, busy, onSave }) {
  const [executor, setExecutor] = useState(item?.executor || "person");
  const [projectId, setProjectId] = useState(project?.id || projectOptions?.[0]?.id || "");
  function submit(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    if (!item) {
      payload.criteria = payload.criteria.split("\n").map((value) => value.trim()).filter(Boolean);
      payload.project_id = projectId;
    }
    onSave(payload);
  }
  return <form onSubmit={submit}>
    {projectOptions && <label>Proyecto<select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
      {projectOptions.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
    </select></label>}
    {!item && <>
      <label>Nombre de la actividad<input name="title" maxLength={160} required /></label>
      <label>Resultado esperado<textarea name="outcome" maxLength={2000} rows={2} required /></label>
    </>}
    <label>Ejecutor<select name="executor" value={executor} onChange={(event) => setExecutor(event.target.value)}>
      <option value="person">Persona</option><option value="progress_report">Agente de informe de avance</option>
    </select></label>
    <div className="pw-form-grid">
      <label>{executor === "person" ? "Persona asignada" : "Responsable humano"}
        <select name="assignee_id" defaultValue={item?.assignee_id || userId} required>
          {people.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label>Revisa<select name="reviewer_id" defaultValue={item?.reviewer_id || userId} required>
        {people.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>Fecha de entrega<input type="date" name="due_on" defaultValue={item?.due_on ?? ""} /></label>
      <label>Prioridad<select name="priority" defaultValue={item?.priority || 2}>
        <option value="1">Alta</option><option value="2">Normal</option><option value="3">Baja</option>
      </select></label>
    </div>
    {!item && <>
      <label>Depende de<select name="depends_on" key={projectId} defaultValue="">
        <option value="">Sin dependencia</option>
        {deliveries.filter((entry) => entry.project_id === projectId).map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
      </select></label>
      <label>Criterios de aceptación<textarea name="criteria" placeholder="Un criterio por línea" maxLength={2900} rows={3} required /></label>
    </>}
    {executor === "progress_report" && <p className="pw-sub">El agente prepara un informe interno y lo envía al revisor cuando lo ejecutes.</p>}
    <button className="pw-btn pw-primary" type="submit" disabled={busy}>{item ? "Guardar delegación" : "Crear actividad"}</button>
  </form>;
}

function Evidence({ text }) {
  if (!text) return <p className="pw-sub">Sin evidencia todavía.</p>;
  const url = /^https:\/\/[^\s]+$/i.test(text) ? text : null;
  if (url) {
    let name = "Ver evidencia";
    try {
      const parsed = new URL(url);
      const file = decodeURIComponent(parsed.pathname.split("/").pop());
      if (/\.[a-z0-9]{2,5}$/i.test(file)) name = file;
    } catch { /* Retain the readable link label. */ }
    return <a className="pw-evidence" href={url} target="_blank" rel="noopener noreferrer">
      <Paperclip size={18} /><span>{name}</span><ArrowRight size={17} />
    </a>;
  }
  return <p className="pw-evidence">{text}</p>;
}

function WorkForm({ item, actor, onAction, onAgent, onHelp, busy, compact = false, reviewer }) {
  const [checked, setChecked] = useState(() => item.criteria.map((entry) => entry.done));
  const [evidence, setEvidence] = useState(item.evidence);
  const [editingEvidence, setEditingEvidence] = useState(false);
  const [decision, setDecision] = useState("");
  const [note, setNote] = useState("");
  const canWork = actor === item.assignee_id;
  const canReview = actor === item.reviewer_id && item.state === "review";
  const editable = canWork && item.state === "active" && item.executor === "person";
  const agentReview = canReview && item.executor === "progress_report";
  const canSubmit = checked.every(Boolean) && evidence.trim() && !item.waiting;
  const changed = evidence !== item.evidence || checked.some((value, index) => value !== item.criteria[index].done);
  const running = Boolean(item.running_until);
  const apply = (action, data = {}) => onAction(action, { id: item.id, version: item.version, ...data });
  const toggle = (index) => setChecked((previous) => previous.map((value, i) => i === index ? !value : value));

  return <div className={compact ? "pw-work pw-compact" : "pw-work"}>
    {item.waiting && <p className="pw-alert">Espera la aprobación de la entrega anterior.</p>}
    {item.note && <p className="pw-alert">{item.state === "blocked" ? "Bloqueo" : "Nota del revisor"} · {item.note}</p>}
    {running && <p role="status" className="pw-sub">Agente preparando el informe.</p>}
    <h3>Para entregar</h3>
    <ul className="pw-criteria">{item.criteria.map(({ text }, index) => <li key={index}>
      <label><input type="checkbox" checked={checked[index]} disabled={busy || !(editable || agentReview)}
        onChange={() => toggle(index)} /> <span>{text}</span></label>
    </li>)}</ul>
    {editable && (!item.evidence || editingEvidence) ? <label className="pw-evidence-edit"><Paperclip size={18} aria-hidden="true" /> Evidencia
      <textarea value={evidence} disabled={busy} rows={2} maxLength={8000} onChange={(event) => setEvidence(event.target.value)}
        placeholder="Pega el enlace o escribe el resultado" />
    </label> : <div className="pw-attachment"><Evidence text={evidence} />
      {editable && <button type="button" className="pw-btn pw-quiet" disabled={busy} onClick={() => setEditingEvidence(true)}>Editar evidencia</button>}
    </div>}
    {reviewer && <p className="pw-sub pw-owner">Revisa · {reviewer}</p>}
    <div className="pw-actions">
      {onHelp && <button type="button" className="pw-btn" onClick={() => onHelp(item)} disabled={busy || changed}>
        <CircleHelp size={19} /> Pedir ayuda
      </button>}
      {canWork && item.state === "ready" && item.executor === "person" && <button type="button" className="pw-btn pw-primary"
        disabled={busy || item.waiting} onClick={() => apply("start")}>Iniciar entrega <ArrowRight size={18} /></button>}
      {editable && <button type="button" className="pw-btn pw-primary" disabled={busy || !canSubmit}
        onClick={() => apply("submit", { checked, evidence })}>Enviar a revisión <ArrowRight size={18} /></button>}
      {onAgent && item.executor === "progress_report" && ["ready", "active"].includes(item.state) &&
        <button type="button" className="pw-btn pw-primary" disabled={busy || item.waiting || running}
          onClick={() => onAgent(item)}>Ejecutar agente <ArrowRight size={18} /></button>}
      {canReview && <button type="button" className="pw-btn pw-primary" disabled={busy || (agentReview && !checked.every(Boolean))}
        onClick={() => apply("approve", { checked })}>Aprobar entrega</button>}
    </div>
    {editable && changed && <button type="button" className="pw-btn pw-quiet" disabled={busy} onClick={() => apply("save",{ checked,evidence })}>Guardar avance</button>}
    {editable && !canSubmit && <p className="pw-sub">Completa los criterios y guarda evidencia para enviar.</p>}
    {canReview && <button type="button" className="pw-btn pw-quiet" disabled={busy} onClick={() => setDecision("return")}>Devolver con cambios</button>}
    {!compact && (canWork || onAgent) && ["active","ready","blocked"].includes(item.state) && <button type="button" className="pw-btn pw-quiet"
      disabled={busy || running || changed} onClick={() => setDecision(item.state === "blocked" ? "unblock" : "block")}>
      {item.state === "blocked" ? "Resolver bloqueo" : "Señalar bloqueo"}
    </button>}
    {decision && <form onSubmit={(event) => { event.preventDefault(); apply(decision, { note }); }}>
      <label>{decision === "return" ? "Qué debe corregirse" : decision === "block" ? "Causa y siguiente paso" : "Cómo se resolvió"}
        <textarea rows={2} maxLength={2000} required value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="pw-actions"><button type="button" className="pw-btn" onClick={() => setDecision("")}>Cancelar</button>
        <button type="submit" className="pw-btn pw-primary" disabled={busy || !note.trim()}>Confirmar</button></div>
    </form>}
  </div>;
}

function DeliveryHistory({ org, id, version, people }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    loadProjects(org, id, controller.signal).then((response) => {
      if (!controller.signal.aborted) setResult({ version, error: Boolean(response.error), events: response.data?.events || [] });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ version, error: true, events: [] });
    });
    return () => controller.abort();
  }, [org, id, version]);
  if (result?.version !== version) return <p className="pw-sub" role="status">Cargando historial…</p>;
  if (result.error) return <p className="pw-sub" role="alert">No se pudo cargar el historial.</p>;
  return <ol className="pw-history">{result.events.map((event) => <li key={event.id}>
    <strong>{eventNames[event.action] || event.action}</strong> · {people.get(event.actor_id) || "Integrante"}
    <span> · {new Date(event.created_at).toLocaleString("es-MX", { dateStyle:"short", timeStyle:"short" })}</span>
    {event.detail && <p>{event.detail}</p>}
  </li>)}</ol>;
}

export default function ProjectWorkspace({ user, isLight, requestedDelivery, onRequestHandled, onCopilot, onAgenda, onCloseDetail }) {
  const org = user.organizationId;
  const { data, loading, error, reload } = useProjects(org);
  const [selectedMode, setMode] = useState(null);
  const [tab, setTab] = useState("today");
  const [dialog, setDialog] = useState(() => onCloseDetail ? { type:"detail", id:requestedDelivery } : null);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const people = useMemo(() => new Map(data?.people.map((person) => [person.id, person.name])), [data]);
  const projects = useMemo(() => new Map(data?.projects.map((project) => [project.id, project])), [data]);
  const items = data?.deliveries || [];
  const mode = data?.manage ? selectedMode || "direction" : "operation";
  const assigned = items.filter((item) => item.assignee_id === user.id && ["ready", "active", "blocked"].includes(item.state));
  assigned.sort((a, b) => Number(a.waiting || a.state === "blocked") - Number(b.waiting || b.state === "blocked")
    || Number(b.state === "active") - Number(a.state === "active") || byPriority(a, b));
  const focus = assigned.find((item) => item.id === data?.focus) || assigned[0];
  const reviewing = items.filter((item) => item.state === "review" && (item.assignee_id === user.id || item.reviewer_id === user.id)).sort(byPriority);
  const detail = dialog?.id ? items.find((item) => item.id === dialog.id) : null;
  const currentProject = projects.get(dialog?.projectId);

  useEffect(() => {
    if (onCloseDetail || !requestedDelivery || !data) return;
    const exists = data.deliveries.some((item) => item.id === requestedDelivery);
    if (exists) setDialog({ type: "detail", id: requestedDelivery });
    else setProblem("La entrega no está disponible para tu cuenta.");
    onRequestHandled();
  }, [requestedDelivery, data, onRequestHandled, onCloseDetail]);

  const open = (value) => { setProblem(""); setNotice(""); setDialog(value); };
  const show = (id) => open({ type: "detail", id });
  const showProject = (id) => open({ type: "project", projectId: id });
  const add = (type, projectId) => open({ type, projectId, newId: crypto.randomUUID() });

  async function perform(action, payload, next) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setProblem(""); setNotice("");
    try {
      const { data: saved, error: failure } = await changeProject(org, action, payload);
      if (failure || !saved) {
        setProblem(failure?.code === "40001" ? "Otra sesión cambió esta entrega. Tu borrador sigue abierto. Copia tus cambios y actualiza antes de enviarlos."
          : failure?.code === "23514" || failure?.code === "23502" ? "Revisa los campos obligatorios y sus límites."
            : failure?.message || "No se pudo confirmar el cambio.");
        return;
      }
      if (next) setDialog(next(saved));
      setNotice(eventNames[action] || (action === "create_project" ? "Proyecto creado" : action === "focus" ? "Entrega actualizada" : "Cambios guardados"));
      await reload();
    } catch {
      setProblem("No se pudo confirmar el cambio. Tu borrador sigue abierto.");
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  async function run(item) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice("El agente está preparando un informe."); setProblem("");
    try {
      const result = await runProjectAgent(org, item);
      if (result?.status === "review") setNotice("Informe enviado a revisión.");
      else {
        setNotice("");
        setProblem(result?.error || "El agente no pudo confirmar el informe. Consulta el estado de la entrega.");
      }
      await reload();
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  const actionRank = (item) => {
    if (item.state === "review" && item.reviewer_id === user.id) return 0;
    if (deliveryState(item) === "blocked") return 1;
    if (item.state === "review") return 4;
    return item.state === "active" ? 2 : 3;
  };
  const attention = items.filter((item) => item.state !== "approved").sort((a,b) =>
    actionRank(a) - actionRank(b) || Number((b.due_on || "z") <= localDay()) - Number((a.due_on || "z") <= localDay()) || byPriority(a,b)).slice(0,3);
  const activeProjects = data?.projects.filter((project) => !items.some((item) => item.project_id === project.id)
    || items.some((item) => item.project_id === project.id && item.state !== "approved")) || [];
  const description = (item) => `${projects.get(item.project_id)?.title || "Proyecto"} · ${dayLabel(item.due_on)}`;
  const person = (id) => people.get(id) || "Integrante";
  const help = onCopilot ? (item) => onCopilot(item ? { id: item.id, title: item.title } : { id: null }) : undefined;
  const taskRow = (item, status = false) => <Row key={item.id} title={item.title} detail={description(item)} Icon={CalendarDays}
    badge={status ? <Badge item={item} /> : undefined} onClick={() => show(item.id)} />;
  const projectRow = (project) => <Row key={project.id} title={project.title} detail={project.outcome} onClick={() => showProject(project.id)} />;
  const messages = <>{problem && <p className="pw-alert" role="alert">{problem}</p>}{notice && <p className="pw-status" role="status">{notice}</p>}</>;

  return <section className={onCloseDetail ? "pw pw-detail-host" : "pw"} data-theme={isLight ? "light" : "dark"} style={projectTheme(isLight)} aria-label={onCloseDetail ? "Actividad de Agenda" : "Proyectos"}>
    {!onCloseDetail && <>
    <div className="pw-toolbar">
      <nav aria-label="Vistas de proyectos">{tabs[mode].map(([id, label]) => <button type="button" key={id}
        aria-current={tab === id ? "page" : undefined} disabled={busy} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="pw-controls">
        {data?.manage && <button type="button" className="pw-btn" disabled={busy} onClick={() => { setMode(mode === "direction" ? "operation" : "direction"); setTab("today"); }}>
          {mode === "direction" ? "Mi trabajo" : "Dirección"}</button>}
        {data?.manage && mode === "direction" && <button type="button" className="pw-btn pw-primary" disabled={busy} onClick={() => add("newProject")}><Plus size={18} /> Nuevo proyecto</button>}
        {data?.manage && mode === "direction" && data.projects.length > 0 && <button type="button" className="pw-btn"
          disabled={busy} onClick={() => add("newActivity")}><Plus size={18} /> Nueva actividad</button>}
        {onAgenda && <button type="button" className="pw-btn" disabled={busy} onClick={onAgenda}><CalendarDays size={17} /> Agenda</button>}
      </div>
    </div>
    {!dialog && messages}
    {loading && !data && <p className="pw-panel pw-sub" role="status">Cargando proyectos…</p>}
    {error && <p className="pw-alert" role="alert">{error} <button className="pw-btn" type="button" onClick={reload}>Reintentar</button></p>}
    {data && tab === "today" && mode === "direction" && <div className="pw-grid">
      <section className="pw-panel"><h1 className="pw-today"><span>Hoy</span> Tu siguiente paso</h1>
        {attention.length ? attention.map((item,i) => <Row key={item.id} rank={i+1} title={item.title}
          detail={`${projects.get(item.project_id)?.title} · ${item.state === "review" ? person(item.reviewer_id) : item.executor === "person" ? person(item.assignee_id) : "Agente de informe"}`}
          badge={<Badge item={item} review={item.reviewer_id === user.id} />} onClick={() => show(item.id)} />)
          : <p className="pw-sub">Sin decisiones pendientes. Los siguientes pasos aparecerán cuando asignes entregas.</p>}
      </section>
      <section className="pw-panel"><h2>Proyectos activos</h2>
        {activeProjects.slice(0,3).map(projectRow)}
        {!activeProjects.length && <p className="pw-sub">Crea un proyecto para definir su resultado y delegar la primera entrega.</p>}
        {activeProjects.length > 3 && <button className="pw-btn pw-quiet" type="button" onClick={() => setTab("projects")}>Ver todos los proyectos</button>}
      </section>
    </div>}
    {data && tab === "today" && mode === "operation" && <div className="pw-grid">
      <section className="pw-panel"><h1 className="pw-today"><span>Hoy</span> Tu entrega actual</h1>
        {focus ? <>
          <div className="pw-highlight"><div><h2>{focus.title}</h2><p className="pw-sub">{description(focus)}</p><p>{focus.outcome}</p></div><Badge item={focus} /></div>
          <WorkForm key={`${focus.id}:${focus.version}`} item={focus} actor={user.id} busy={busy} onAction={perform} onAgent={run} onHelp={help} reviewer={person(focus.reviewer_id)} compact />
          <button className="pw-btn pw-quiet" type="button" disabled={busy} onClick={() => show(focus.id)}>Ver detalle</button>
        </> : <p className="pw-sub">Aquí verás tu próxima entrega cuando tengas trabajo asignado.</p>}
      </section>
      <section className="pw-panel"><h2>Después</h2>
        {assigned.filter((item) => item.id !== focus?.id).slice(0,3).map((item) => taskRow(item))}
        {assigned.length <= 1 && <p className="pw-sub">Sin próximas entregas asignadas.</p>}
        <h3 className="pw-after">En revisión</h3>
        {reviewing.slice(0,3).map((item) => <Row key={item.id} title={item.title} detail={`Con ${person(item.reviewer_id)}`} onClick={() => show(item.id)} />)}
        {!reviewing.length && <p className="pw-sub">Sin entregas en revisión.</p>}
      </section>
    </div>}
    {data && tab === "projects" && mode === "direction" && <section className="pw-panel">
      <h1>Proyectos</h1>{data.projects.map(projectRow)}{!data.projects.length && <p className="pw-sub">Todavía no hay proyectos.</p>}
    </section>}
    {data && tab === "flow" && mode === "direction" && <section className="pw-panel">
      <h1>Flujo de entregas</h1><p className="pw-sub">Carga sugerida · hasta tres entregas en curso por responsable.</p>
      <div className="pw-columns">{Object.entries(states).map(([state,label]) => {
        const group = items.filter((item) => deliveryState(item) === state);
        return <section key={state}><h3>{label} · {group.length}</h3>{group.map((item) => taskRow(item))}
          {!group.length && <p className="pw-sub">Sin entregas.</p>}</section>;
      })}</div>
    </section>}
    {data && tab === "deliveries" && mode === "operation" && <section className="pw-panel"><h1>Entregas</h1>
      {items.filter((item) => item.assignee_id === user.id || item.reviewer_id === user.id).sort(byPriority).map((item) => taskRow(item,true))}
      {!items.some((item) => item.assignee_id === user.id || item.reviewer_id === user.id) && <p className="pw-sub">Todavía no tienes entregas asignadas.</p>}
    </section>}
    {help && data && <button className="pw-copilot" type="button" disabled={busy} onClick={() => help(mode === "operation" ? focus : null)}>
      <span className="pw-atom" style={{ animation: "pw-orbit 12s linear infinite" }}><StratosAtomHex size={34} color="var(--pw-blue)" edge="var(--pw-atom-edge)" /></span><strong>Copilot</strong>
      <span>{mode === "operation" && focus ? "Ayúdame con esta entrega" : "¿Qué quieres avanzar?"}</span><ArrowRight size={25} />
    </button>}
    </>}
    {dialog && <Modal key={`${dialog.type}:${dialog.id || dialog.projectId || ""}`} busy={busy} onClose={onCloseDetail || (() => open(null))}
      title={dialog.type === "newProject" ? "Nuevo proyecto" : ["newDelivery","newActivity"].includes(dialog.type) ? "Nueva actividad"
        : dialog.type === "delegate" ? "Delegar entrega" : detail?.title || currentProject?.title || "Proyecto"}>
      {messages}
      {onCloseDetail && loading && !data && <p className="pw-sub" role="status">Cargando actividad…</p>}
      {onCloseDetail && error && <p className="pw-alert" role="alert">{error} <button className="pw-btn" type="button" onClick={reload}>Reintentar</button></p>}
      {onCloseDetail && data && !detail && <p className="pw-sub">Esta actividad ya no está asignada a tu cuenta.</p>}
      {dialog.type === "newProject" && <ProjectForm busy={busy} onSave={(payload) => perform("create_project", { ...payload,id:dialog.newId },
        (saved) => ({ type:"project", projectId:saved.id }))} />}
      {dialog.type === "project" && currentProject && <>
        <p className="pw-sub">{currentProject.outcome} · {dayLabel(currentProject.target_date)}</p>
        {data.manage && <p className="pw-sub">{items.filter((item) => item.project_id === currentProject.id && item.state === "approved").length}
          {" de "}{items.filter((item) => item.project_id === currentProject.id).length} entregas aprobadas</p>}
        {data.manage && <button type="button" className="pw-btn pw-primary" disabled={busy} onClick={() => add("newDelivery",currentProject.id)}>
          <Plus size={18} /> Nueva actividad</button>}
        {items.filter((item) => item.project_id === currentProject.id).map((item) => taskRow(item,true))}
      </>}
      {["newDelivery","newActivity","delegate"].includes(dialog.type) && <DeliveryForm item={detail} project={currentProject}
        projectOptions={dialog.type === "newActivity" ? data.projects : undefined} deliveries={items} people={data.people} userId={user.id} busy={busy}
        onSave={(payload) => perform(detail ? "delegate" : "create_delivery", {
          ...payload, id:detail?.id || dialog.newId, version:detail?.version,
        }, (saved) => ({ type:"detail", id:saved.id }))} />}
      {dialog.type === "detail" && detail && <>
        <p className="pw-sub">{description(detail)}</p><Badge item={detail} /><p className="pw-result">{detail.outcome}</p>
        <p className="pw-sub">Ejecuta · {detail.executor === "person" ? person(detail.assignee_id) : `Agente de informe · Responsable: ${person(detail.assignee_id)}`}</p>
        <p className="pw-sub">Revisa · {person(detail.reviewer_id)}</p>
        {detail.depends_on && <p className="pw-sub">Depende de · {items.find((item) => item.id === detail.depends_on)?.title || "Otra entrega del proyecto"}</p>}
        <WorkForm key={`${detail.id}:${detail.version}`} item={detail} actor={user.id} busy={busy} onAction={perform}
          onAgent={data.manage || detail.assignee_id === user.id ? run : undefined} onHelp={help} />
        <div className="pw-actions">
          {data.manage && ["ready","active","blocked"].includes(detail.state) && <button type="button" className="pw-btn"
            disabled={busy || Boolean(detail.running_until)} onClick={() => open({ type:"delegate", id:detail.id })}>Delegar</button>}
          {!onCloseDetail && detail.assignee_id === user.id && ["ready","active","blocked"].includes(detail.state) && <button type="button" className="pw-btn" disabled={busy}
            onClick={() => perform("focus", { id:detail.id }, () => { setMode("operation"); setTab("today"); return null; })}>Usar como entrega actual</button>}
        </div>
        <details><summary>Historial</summary><DeliveryHistory org={org} id={detail.id} version={detail.version} people={people} /></details>
      </>}
    </Modal>}
  </section>;
}
