import { useEffect, useRef, useState } from "react";
import { CalendarRange, Mic, Plus, Square, Trash2 } from "lucide-react";
import { addCalendarDays, applyProjectWeek, bySchedule, dayInZone, dayLabel, draftProjectWeek, scheduleLabel } from "./workspace";
import { useWeekDictation } from "./useWeekDictation";

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City";
const zones = [["America/Tijuana","Tijuana"],["America/Cancun","Cancún"],["America/Mexico_City","Ciudad de México"]];
const read = (key) => {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
};
const blank = (project, assignee) => ({
  key: crypto.randomUUID(), title:"", outcome:"", assignee_id:assignee, who:"",
  project_id:project, due_on:"", time:"", requires_time:false, criteria:"", reviewer_id:assignee,
});
const projectRow = (row) => ({
  project_id: row.project_id, assignee_id: row.assignee_id, reviewer_id:row.reviewer_id,
  title:row.title.trim(), outcome:row.outcome.trim(), due_on:row.due_on, time:row.time,
  criteria:row.criteria.split("\n").map((line) => line.trim()).filter(Boolean),
});
function ready(row, projects, people) {
  const data = projectRow(row);
  return data.title && data.outcome && data.due_on && (!row.requires_time || data.time) && data.criteria.length > 0 && data.criteria.length <= 12
    && data.criteria.every((line) => line.length <= 240) && projects.some((item) => item.id === data.project_id)
    && people.some((item) => item.id === data.assignee_id) && people.some((item) => item.id === data.reviewer_id);
}

export default function ProjectWeekPlanner({ user, data, onSaved, onOpen, initialText }) {
  const storageKey = `stratos.week-draft:${user.organizationId}:${user.id}`;
  const [state,setState] = useState(() => {
    const stored = read(storageKey) || {
      message:"", zone:deviceZone(), project:data.projects.length===1 ? data.projects[0].id : "",
      draft:[], notes:[], attempt:null,
    };
    if (initialText?.trim() && !stored.attempt && !stored.message.includes(initialText.trim())) {
      stored.message = [stored.message,initialText.trim()].filter(Boolean).join("\n").slice(0,12000);
    }
    return stored;
  });
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [confirmation,setConfirmation] = useState("");
  const [person,setPerson] = useState("");
  const lock = useRef(false);
  const { message, zone, project, draft, notes, attempt } = state;
  const update = (patch) => setState((previous) => ({ ...previous,...patch }));
  const voice = useWeekDictation((value) => setState((previous) => ({
    ...previous, message:[previous.message.trim(),value.trim()].filter(Boolean).join("\n").slice(0,12000),
  })));
  const micBusy = voice.phase !== "idle";
  const today = dayInZone(zone);
  const last = addCalendarDays(today,6);
  const due = data.deliveries.filter((item) => item.due_on>=today && item.due_on<=last &&
    (!person || item.assignee_id === person)).sort(bySchedule);
  const nameOf = (id) => data.people.find((entry) => entry.id === id)?.name || "Integrante";
  const titleOf = (id) => data.projects.find((entry) => entry.id === id)?.title || "Proyecto";

  useEffect(() => {
    try { sessionStorage.setItem(storageKey,JSON.stringify(state)); } catch { /* Keep the in-memory draft. */ }
  }, [storageKey,state]);

  async function prepare(event) {
    event.preventDefault();
    if (lock.current || attempt || !message.trim() || micBusy) return;
    lock.current = true; setBusy(true); setError(""); setConfirmation("");
    try {
      const result = await draftProjectWeek(user.organizationId,message.trim(),zone,project);
      if (!Array.isArray(result?.activities) || !result.activities.length) {
        setError(result?.error || result?.notes?.join(" ") || "No encontré actividades. Indica quién hará qué y cuándo.");
        return;
      }
      update({
        notes:result.notes || [],
        draft:result.activities.map((row) => ({
          ...row, key:crypto.randomUUID(), criteria:row.criteria.join("\n"), reviewer_id:user.id,
        })),
      });
    } catch {
      setError("No pude preparar el borrador. Tu mensaje sigue disponible.");
    } finally { lock.current = false; setBusy(false); }
  }

  async function confirm() {
    if (lock.current || micBusy || (!attempt && (!draft.length || !draft.every((row) => ready(row,data.projects,data.people))))) return;
    const request = attempt || { id:crypto.randomUUID(), zone, plan:draft.map(projectRow) };
    lock.current = true; setBusy(true); setError(""); setConfirmation("");
    update({ attempt:request });
    try {
      const { data:receipt,error:failure } = await applyProjectWeek(user.organizationId,request.id,request.zone,request.plan);
      if (failure || !Array.isArray(receipt?.created) || !Array.isArray(receipt?.reused)) {
        if (failure?.code && /^([0-9A-Z]{5})$/.test(failure.code)) {
          update({ attempt:null });
          setError(failure.message || "Revisa el plan antes de guardarlo.");
        } else {
          setError("No pudimos confirmar el resultado. Pulsa «Comprobar guardado» para recuperar el recibo sin duplicar actividades.");
        }
        return;
      }
      update({ draft:[], notes:[], attempt:null, message:"" });
      setConfirmation(`Plan confirmado. ${receipt.created.length} nuevas actividades${receipt.reused.length ? ` · ${receipt.reused.length} ya registradas` : ""}.`);
      await onSaved();
    } catch {
      setError("La respuesta no se confirmó. Pulsa «Comprobar guardado» para continuar con la misma solicitud.");
    } finally { lock.current = false; setBusy(false); }
  }

  const edit = (key, patch) => setState((previous) => ({
    ...previous,draft:previous.draft.map((row) => row.key===key ? { ...row,...patch } : row),
  }));
  const incomplete = draft.filter((row) => !ready(row,data.projects,data.people)).length;
  const changedZone = zone !== deviceZone() && !zones.some(([id])=>id===zone);
  return <div className="pw-week">
    <section className="pw-panel">
      <h1>Planear la semana</h1>
      {!data.projects.length && <p className="pw-alert">Puedes preparar el borrador. Crea un proyecto para guardar las actividades.</p>}
      <p className="pw-sub">Dile a Copilot qué hará cada persona y cuándo. Revisa el borrador antes de guardarlo.</p>
      <form className="pw-week-form" onSubmit={prepare}>
        <fieldset disabled={busy || micBusy || Boolean(attempt)}>
          <div className="pw-form-grid">
            <label>Proyecto base<select value={project} onChange={(event) => update({project:event.target.value})}>
              <option value="">Elegir por actividad</option>
              {data.projects.map(({id,title}) => <option key={id} value={id}>{title}</option>)}
            </select></label>
            <label>Zona horaria del plan<select value={zone} onChange={(event) => {
              if (!draft.length || window.confirm("Cambiar la zona aplicará las horas del borrador en la nueva zona. ¿Continuar?")) update({zone:event.target.value});
            }}>
              <option value={deviceZone()}>Mi dispositivo · {deviceZone()}</option>
              {zones.filter(([id]) => id!==deviceZone()).map(([id,label]) => <option key={id} value={id}>{label}</option>)}
              {changedZone && <option value={zone}>{zone}</option>}
            </select></label>
          </div>
          <label>Tu mensaje para Copilot<textarea rows={5} maxLength={12000} value={message}
            placeholder="Mañana a las 9 Ana revisa la propuesta. El miércoles a las 11 Luis confirma el acceso. Yo reviso las entregas el viernes a las 4 de la tarde."
            onChange={(event) => update({message:event.target.value})} /></label>
        </fieldset>
        <div className="pw-actions">
          <button type="button" className="pw-btn" disabled={busy || Boolean(attempt) || (micBusy && voice.phase!=="recording")}
            onClick={voice.phase==="recording" ? voice.stop : voice.start}>
            {voice.phase==="recording" ? <Square size={17} /> : <Mic size={18} />}
            {voice.phase==="recording" ? "Terminar dictado" : voice.phase==="opening" ? "Abriendo micrófono…" : voice.phase==="transcribing" ? "Transcribiendo…" : "Dictar mensaje"}
          </button>
          {voice.hasAudio && !micBusy && <button type="button" className="pw-btn" disabled={busy || Boolean(attempt)} onClick={voice.retry}>Reintentar transcripción</button>}
          <button type="submit" className="pw-btn pw-primary" disabled={busy || micBusy || Boolean(attempt) || !message.trim()}>
            {busy && !attempt ? "Preparando…" : "Preparar plan"}
          </button>
        </div>
      </form>
      {voice.error && <p className="pw-alert" role="alert">{voice.error}</p>}
      {error && <p className="pw-alert" role="alert">{error}</p>}
      {confirmation && <p className="pw-status" role="status">{confirmation}</p>}
    </section>
    <section className="pw-panel">
      <h2>Borrador {draft.length > 0 ? `· ${draft.length}` : ""}</h2>
      {notes.length > 0 && <ul className="pw-week-notes">{notes.map((note,index) => <li key={index}>{note}</li>)}</ul>}
      {!draft.length && <p className="pw-sub">Aquí aparecerán las actividades sugeridas por Copilot.</p>}
      {draft.map((row,index) => <fieldset key={row.key} className="pw-week-activity" disabled={busy || micBusy || Boolean(attempt)}>
        <legend>{index+1}. {row.title || "Actividad nueva"}</legend>
        <div className="pw-form-grid">
          <label>Actividad<input maxLength={160} value={row.title} onChange={(event)=>edit(row.key,{title:event.target.value})} /></label>
          <label>Persona<select value={row.assignee_id} onChange={(event)=>edit(row.key,{assignee_id:event.target.value})}>
            <option value="">{row.who ? `Elegir · ${row.who}` : "Elegir persona"}</option>
            {data.people.map(({id,name}) => <option key={id} value={id}>{id===user.id ? `${name} (yo)` : name}</option>)}
          </select></label>
          <label>Proyecto<select value={row.project_id} onChange={(event)=>edit(row.key,{project_id:event.target.value})}>
            <option value="">Elegir proyecto</option>
            {data.projects.map(({id,title}) => <option key={id} value={id}>{title}</option>)}
          </select></label>
          <label>Revisa<select value={row.reviewer_id} onChange={(event)=>edit(row.key,{reviewer_id:event.target.value})}>
            {data.people.map(({id,name}) => <option key={id} value={id}>{id===user.id ? `${name} (yo)` : name}</option>)}
          </select></label>
          <label>Día<input type="date" value={row.due_on} onChange={(event)=>edit(row.key,{due_on:event.target.value})} /></label>
          <label>{row.requires_time ? "Hora por confirmar" : "Hora opcional"}<input type="time" value={row.time} onChange={(event)=>edit(row.key,{time:event.target.value})} /></label>
          <label>Resultado esperado<textarea rows={2} maxLength={2000} value={row.outcome} onChange={(event)=>edit(row.key,{outcome:event.target.value})} /></label>
          <label>Criterios de aceptación<textarea rows={2} maxLength={2900} placeholder="Uno por línea" value={row.criteria} onChange={(event)=>edit(row.key,{criteria:event.target.value})} /></label>
        </div>
        <button type="button" className="pw-btn pw-quiet" onClick={() => update({draft:draft.filter((entry)=>entry.key!==row.key)})}><Trash2 size={17} /> Quitar actividad</button>
      </fieldset>)}
      <div className="pw-actions">
        <button type="button" className="pw-btn" disabled={busy || micBusy || Boolean(attempt) || draft.length>=50}
          onClick={() => update({draft:[...draft,blank(project,user.id)]})}><Plus size={17} /> Agregar actividad</button>
        {(draft.length>0 || attempt) && <button type="button" className="pw-btn pw-primary" disabled={busy || micBusy || (!attempt && incomplete>0)} onClick={confirm}>
          {busy && attempt ? "Guardando…" : attempt ? "Comprobar guardado" : `Guardar ${draft.length} ${draft.length===1 ? "actividad" : "actividades"}`}
        </button>}
      </div>
      {incomplete>0 && <p className="pw-sub">Completa los datos de {incomplete} {incomplete===1 ? "actividad" : "actividades"} antes de guardar.</p>}
    </section>
    <section className="pw-panel">
      <div className="pw-week-list-head"><h2>Próximos 7 días</h2>
        <label>Persona<select value={person} onChange={(event)=>setPerson(event.target.value)}>
          <option value="">Todo el equipo</option>
          {data.people.map(({id,name}) => <option key={id} value={id}>{name}</option>)}
        </select></label>
      </div>
      {due.length ? due.map((item) => <button className="pw-row" type="button" key={item.id} onClick={()=>onOpen(item.id)}>
        <span className="pw-tile" aria-hidden="true"><CalendarRange size={21} /></span>
        <span className="pw-row-copy"><strong>{item.title}</strong><small>{nameOf(item.assignee_id)} · {titleOf(item.project_id)}</small></span>
        <span className="pw-sub">{item.scheduled_at ? scheduleLabel(item) : dayLabel(item.due_on,zone)}</span>
      </button>) : <p className="pw-sub">Sin actividades programadas para estos días.</p>}
    </section>
  </div>;
}
