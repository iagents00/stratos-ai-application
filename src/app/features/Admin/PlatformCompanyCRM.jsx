import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, Plus, RefreshCw, Save, Search, Users, X } from "lucide-react";
import { P, font } from "../../../design-system/tokens";
import { loadCompanyCRM, loadCompanyCRMLead, createCompanyCRMLead, updateCompanyCRMLead } from "../../../lib/whatsapp-admin";
import {
  companyLeadChanged, companyLeadDraft, companyLeadPayload, confirmCompanyLeadResponse,
  confirmCompanyListResponse, validateCompanyLead,
} from "./platform-company-crm.mjs";
import "./PlatformCompanyCRM.css";

const PAGE_SIZE = 50;
const dateLabel = value => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Fecha no disponible";
};
const moneyLabel = lead => lead.budget || (Number(lead.presupuesto) > 0 ? new Intl.NumberFormat("es", { maximumFractionDigits: 0 }).format(lead.presupuesto) : "Sin presupuesto");

function Notice({ error = false, children }) {
  const Icon = error ? AlertCircle : Check;
  return <div className={`company-crm-notice${error ? " is-error" : ""}`} role={error ? "alert" : "status"}><Icon size={18} aria-hidden="true" /><div>{children}</div></div>;
}

export default function PlatformCompanyCRM({ T = P, organizations = [], initialOrganizationId = "", actorId = "", onDraftState }) {
  // A different authenticated actor gets a new tree, with no portfolio or
  // editable draft retained from the prior session.
  return <CompanySelector key={actorId} T={T} organizations={organizations} initialOrganizationId={initialOrganizationId} actorId={actorId} onDraftState={onDraftState} />;
}

function CompanySelector({ T, organizations, initialOrganizationId, actorId, onDraftState: reportDraftState }) {
  const id = useId();
  const [organizationId, setOrganizationId] = useState(() => organizations.some(org => org.id === initialOrganizationId) ? initialOrganizationId : "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCompany, setPendingCompany] = useState(null);
  const organization = organizations.find(org => org.id === organizationId);
  const onDraftState = useCallback((changed, busy) => { setDirty(changed); setSaving(busy); }, []);
  useEffect(() => { reportDraftState?.(dirty, saving); }, [dirty, saving, reportDraftState]);
  useEffect(() => () => { reportDraftState?.(false, false); }, [reportDraftState]);
  const selectCompany = value => {
    if (value === organizationId || saving) return;
    if (dirty) { setPendingCompany(value); return; }
    setOrganizationId(value); setPendingCompany(null); setDirty(false);
  };
  const style = {
    fontFamily: font, "--crm-bg": T.bg, "--crm-surface": T.surface || T.bg2,
    "--crm-hover": T.glassH, "--crm-text": T.txt, "--crm-muted": T.txt2,
    "--crm-border": T.borderH || T.border, "--crm-accent": T.accentDark || T.accent,
    "--crm-on-accent": T.onAccent, "--crm-accent-soft": T.accentS,
    "--crm-error": T.rose, "--crm-success": T.success,
  };
  return <section className="company-crm" style={style} aria-labelledby={`${id}-title`}>
    <div className="company-crm-heading"><div><h1 id={`${id}-title`}>CRM de empresas</h1><p>Consulta y gestiona los clientes de la empresa que selecciones.</p></div></div>
    <div className="company-crm-company"><label htmlFor={`${id}-company`}>Empresa</label><select id={`${id}-company`} value={organization?.id || ""} onChange={event => selectCompany(event.target.value)} disabled={saving}>
      <option value="">Selecciona una empresa</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name || "Empresa sin nombre"}{org.active === false ? " · Inactiva" : ""}</option>)}
    </select></div>
    {pendingCompany !== null && <Notice error><strong>Tienes un cliente con cambios sin guardar.</strong><p>Guarda el borrador en esta empresa o descártalo para cambiar de cartera.</p><div className="company-crm-actions"><button type="button" className="crm-secondary" onClick={() => setPendingCompany(null)}>Continuar editando</button><button type="button" className="crm-secondary" onClick={() => { setOrganizationId(pendingCompany); setPendingCompany(null); setDirty(false); }}>Descartar y cambiar empresa</button></div></Notice>}
    {organization && actorId ? <CompanyWorkspace key={`${actorId}:${organization.id}`} organization={organization} onDraftState={onDraftState} />
      : <div className="company-crm-empty"><Users size={28} aria-hidden="true" /><h2>{organizations.length ? "Elige la empresa que vas a atender" : "No hay empresas disponibles"}</h2><p>{organizations.length ? "Su cartera, asesores y etapas se cargarán aquí." : "Actualiza la administración para comprobar las empresas a las que tienes acceso."}</p></div>}
  </section>;
}

function CompanyWorkspace({ organization, onDraftState }) {
  const id = useId();
  const organizationId = organization.id;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [metadata, setMetadata] = useState({ pipeline: [], advisors: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [lastLeadId, setLastLeadId] = useState("");
  const [pendingSelection, setPendingSelection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState("");
  const alive = useRef(true);
  const savingRef = useRef(false);
  const detailVersion = useRef(0);
  const pendingSubmission = useRef(null);
  const editorHeading = useRef(null);
  const dirty = Boolean(editor && (editor.isNew || companyLeadChanged(editor.draft, editor.original)));
  const { pipeline, advisors } = metadata;
  const advisorNames = useMemo(() => new Map(advisors.map(advisor => [advisor.id, advisor.name])), [advisors]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; detailVersion.current += 1; pendingSubmission.current = null; }; }, []);
  useEffect(() => { onDraftState(dirty || uncertain, saving); }, [dirty, uncertain, saving, onDraftState]);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(""); setResult(null);
    loadCompanyCRM({ organization_id: organizationId, page, page_size: PAGE_SIZE, search: query, ...(stage ? { stage } : {}), ...(advisorId ? { asesor_id: advisorId } : {}) })
      .then(value => {
        if (!active) return;
        const confirmed = confirmCompanyListResponse(value, organizationId);
        if (page > 0 && page * PAGE_SIZE >= Number(confirmed.total)) {
          setPage(Math.max(0, Math.ceil(Number(confirmed.total) / PAGE_SIZE) - 1));
          return;
        }
        setResult(confirmed); setMetadata({ pipeline: confirmed.pipeline || [], advisors: confirmed.advisors || [] });
      })
      .catch(error => { if (active) setLoadError(error.message || "No se pudo cargar la cartera. Intenta de nuevo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, page, query, stage, advisorId, refresh]);
  const editorId = editor?.id;
  useEffect(() => {
    if (!editorId || editorLoading) return;
    editorHeading.current?.focus();
  }, [editorId, editorLoading]);
  useEffect(() => {
    if (!dirty && !uncertain) return;
    const protect = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, uncertain]);

  const resetEditorState = () => {
    setSaveError(""); setConflict(false); setUncertain(false); setSuccess(""); setDetailError("");
    setPendingSelection(null); pendingSubmission.current = null;
  };
  const selectLead = async (leadId, { preserveDraft = false } = {}) => {
    const version = ++detailVersion.current;
    if (!preserveDraft) resetEditorState();
    setEditorLoading(true); setDetailError(""); setLastLeadId(leadId);
    if (!preserveDraft) setEditor(null);
    try {
      const value = await loadCompanyCRMLead({ organization_id: organizationId, lead_id: leadId });
      if (!alive.current || version !== detailVersion.current) return;
      const lead = confirmCompanyLeadResponse(value, organizationId, leadId);
      setMetadata({ pipeline: value.pipeline || [], advisors: value.advisors || [] });
      setEditor({ id: lead.id, isNew: false, original: lead, draft: companyLeadDraft(lead), notes: value.notes || [] });
      setSaveError(""); setConflict(false); setUncertain(false); pendingSubmission.current = null;
    } catch (error) {
      if (alive.current && version === detailVersion.current) setDetailError(error.message || "No se pudo cargar el cliente. Intenta abrirlo de nuevo.");
    } finally { if (alive.current && version === detailVersion.current) setEditorLoading(false); }
  };
  const applySelection = action => {
    setPendingSelection(null);
    if (action.type === "lead") { void selectLead(action.id); return; }
    if (action.type === "reload") { void selectLead(editor.id, { preserveDraft: true }); return; }
    detailVersion.current += 1; resetEditorState(); setEditorLoading(false);
    if (action.type === "close") { setEditor(null); setLastLeadId(""); return; }
    if (!advisors.length || !pipeline.length) { setDetailError("Para crear un cliente, esta empresa necesita un asesor activo y un proceso configurado."); return; }
    if (!globalThis.crypto?.randomUUID) { setDetailError("No se pudo preparar el nuevo cliente. Actualiza el navegador e intenta de nuevo."); return; }
    setEditor({ id: crypto.randomUUID(), isNew: true, original: null, draft: companyLeadDraft({}, pipeline[0].name), notes: [] });
    setLastLeadId("");
  };
  const requestSelection = action => {
    if (savingRef.current) return;
    if (action.type === "lead" && action.id === editor?.id) return;
    if (dirty || uncertain) { setPendingSelection(action); return; }
    applySelection(action);
  };
  const patchDraft = (field, value) => {
    setEditor(current => current ? { ...current, draft: { ...current.draft, [field]: value } } : current);
    setSaveError(""); setSuccess("");
  };
  const save = async event => {
    event.preventDefault();
    if (!editor || savingRef.current || editorLoading) return;
    let submission = pendingSubmission.current;
    if (!uncertain || !submission) {
      const error = validateCompanyLead(editor.draft, pipeline, advisors, { creating: editor.isNew, original: editor.original });
      if (error) { setSaveError(error); return; }
      const fields = companyLeadPayload(editor.draft, editor.original);
      if (!editor.isNew && !Object.keys(fields).length) return;
      submission = { creating: editor.isNew, organization_id: organizationId, lead_id: editor.id,
        ...(editor.isNew ? { lead: fields } : { expected_updated_at: editor.original.updated_at, patch: fields }) };
      pendingSubmission.current = submission;
    }
    const version = detailVersion.current;
    savingRef.current = true;
    onDraftState(dirty || uncertain, true);
    setSaving(true); setSaveError(""); setSuccess("");
    try {
      const { creating, ...payload } = submission;
      const value = await (creating ? createCompanyCRMLead(payload) : updateCompanyCRMLead(payload));
      if (!alive.current || version !== detailVersion.current) return;
      const lead = confirmCompanyLeadResponse(value, organizationId, submission.lead_id);
      setEditor(current => ({ ...current, id: lead.id, isNew: false, original: lead, draft: companyLeadDraft(lead) }));
      setUncertain(false); setConflict(false); pendingSubmission.current = null;
      setSuccess(`${lead.name || "Cliente"}: ${creating ? "cliente creado" : "cambios guardados"}.${value.audit_saved === false ? " No se pudo confirmar el registro del cambio." : ""}`);
      setRefresh(count => count + 1);
    } catch (error) {
      if (!alive.current || version !== detailVersion.current) return;
      const rejected = error.status >= 400 && error.status < 500;
      setConflict(error.status === 409); setUncertain(!rejected);
      if (rejected) pendingSubmission.current = null;
      setSaveError(error.status === 409 ? "Este cliente cambió desde que abriste su ficha. Tu borrador se conserva. Recarga la ficha para revisar la versión actual."
        : rejected ? `${error.message || "No se pudieron guardar los cambios."} Tu borrador se conserva.`
          : "No se pudo confirmar el guardado. Tu envío se conserva: reintenta la misma operación o recarga la ficha para comprobar el resultado.");
    } finally {
      savingRef.current = false;
      if (alive.current && version === detailVersion.current) setSaving(false);
    }
  };

  const draft = editor?.draft;
  const editorStageMissing = draft?.stage && !pipeline.some(item => item.name === draft.stage);
  const editorAdvisorMissing = draft?.asesor_id && !advisors.some(item => item.id === draft.asesor_id);
  const visibleLeads = result?.leads || [];
  const setFilter = (setter, value) => { setter(value); setPage(0); };
  const field = (key, label, options = {}) => <div className={options.wide ? "crm-field crm-field-wide" : "crm-field"}><label htmlFor={`${id}-${key}`}>{label}{options.required ? " *" : ""}</label><input id={`${id}-${key}`} type={options.type || "text"} value={draft?.[key] || ""} onChange={event => patchDraft(key, event.target.value)} maxLength={options.maxLength} required={options.required} min={options.min} step={options.step} autoComplete={options.autoComplete || "off"} /></div>;

  return <>
    <div className="company-crm-toolbar"><div><h2>{organization.name}</h2><p>{loading ? "Cargando cartera…" : result ? `${result.total.toLocaleString("es")} ${result.total === 1 ? "cliente" : "clientes"}${query || stage || advisorId ? " en esta búsqueda" : result.total === 1 ? " registrado" : " registrados"}` : "Cartera de clientes"}</p></div><div className="company-crm-actions"><button type="button" className="crm-secondary" onClick={() => setRefresh(value => value + 1)} disabled={loading || saving}><RefreshCw size={16} aria-hidden="true" />Actualizar</button><button type="button" className="crm-primary" onClick={() => requestSelection({ type: "new" })} disabled={loading || saving || !advisors.length || !pipeline.length}><Plus size={17} aria-hidden="true" />Nuevo cliente</button></div></div>
    {success && <Notice>{success}</Notice>}
    {loadError && <Notice error>{loadError}<div className="company-crm-actions"><button type="button" className="crm-secondary" onClick={() => setRefresh(value => value + 1)}>Reintentar carga</button></div></Notice>}
    {!loading && result && !advisors.length && <Notice error>Esta empresa no tiene asesores activos. Agrega un asesor antes de crear clientes.</Notice>}
    {detailError && <Notice error>{detailError}{lastLeadId && <div className="company-crm-actions"><button type="button" className="crm-secondary" disabled={saving || editorLoading} onClick={() => selectLead(lastLeadId, { preserveDraft: Boolean(editor) })}>Reintentar carga del cliente</button></div>}</Notice>}
    {pendingSelection && <Notice error><strong>{pendingSelection.type === "reload" ? "Recargar sustituirá tu borrador por la ficha guardada." : "Tienes cambios sin guardar en este cliente."}</strong><p>{uncertain ? "La última operación podría haberse guardado. Comprueba la ficha antes de realizar otra edición." : "Puedes continuar editando o descartar el borrador."}</p><div className="company-crm-actions"><button type="button" className="crm-secondary" onClick={() => setPendingSelection(null)}>Continuar editando</button><button type="button" className="crm-secondary" onClick={() => applySelection(pendingSelection)}>{pendingSelection.type === "reload" ? "Descartar y recargar ficha" : "Descartar borrador y continuar"}</button></div></Notice>}
    {editorLoading && !editor && <div className="company-crm-loading" role="status">Cargando ficha del cliente…</div>}
    {editor && <form className="company-crm-editor" onSubmit={save} aria-labelledby={`${id}-editor-title`}>
      <div className="company-crm-editor-heading"><div><button type="button" className="crm-back" onClick={() => requestSelection({ type: "close" })} disabled={saving}><ArrowLeft size={16} aria-hidden="true" />Volver a la cartera</button><h2 id={`${id}-editor-title`} ref={editorHeading} tabIndex={-1}>{editor.isNew ? "Nuevo cliente" : editor.original.name || "Ficha del cliente"}</h2><p>{organization.name}{!editor.isNew && ` · Actualizado ${dateLabel(editor.original.updated_at)}`}</p></div><button type="button" className="crm-icon" aria-label="Cerrar ficha del cliente" onClick={() => requestSelection({ type: "close" })} disabled={saving}><X size={18} aria-hidden="true" /></button></div>
      <fieldset disabled={saving || uncertain || editorLoading} className="company-crm-fields"><legend className="crm-sr-only">Datos del cliente</legend>
        {field("name", "Nombre", { required: true, maxLength: 200, autoComplete: "name" })}
        {field("phone", "Teléfono", { type: "tel", maxLength: 80, autoComplete: "tel" })}
        {field("email", "Correo electrónico", { type: "email", maxLength: 254, autoComplete: "email" })}
        <div className="crm-field"><label htmlFor={`${id}-stage`}>Etapa *</label><select id={`${id}-stage`} value={draft.stage} onChange={event => patchDraft("stage", event.target.value)} required><option value="">Selecciona una etapa</option>{editorStageMissing && <option value={draft.stage}>{draft.stage} · Etapa anterior</option>}{pipeline.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></div>
        <div className="crm-field"><label htmlFor={`${id}-advisor`}>Asesor{editor.isNew ? " *" : ""}</label><select id={`${id}-advisor`} value={draft.asesor_id} onChange={event => patchDraft("asesor_id", event.target.value)} required={editor.isNew}><option value="">Sin asignar</option>{editorAdvisorMissing && <option value={draft.asesor_id}>{editor.original?.asesor_name || "Asesor anterior"} · Inactivo</option>}{advisors.map(advisor => <option key={advisor.id} value={advisor.id}>{advisor.name || "Asesor sin nombre"}</option>)}</select></div>
        {field("project", "Proyecto o interés", { maxLength: 200 })}
        {field("budget", "Rango de inversión", { maxLength: 100 })}
        {field("presupuesto", "Presupuesto estimado", { type: "number", min: "0", step: "1" })}
        {field("campaign", "Campaña", { maxLength: 200 })}
        {field("source", "Origen", { maxLength: 80 })}
        {field("next_action", "Próxima acción", { maxLength: 1000 })}
        {field("next_action_at", "Fecha y hora de la próxima acción", { type: "datetime-local" })}
        <div className="crm-field crm-field-wide"><label htmlFor={`${id}-notes`}>Notas del cliente</label><textarea id={`${id}-notes`} value={draft.notas} onChange={event => patchDraft("notas", event.target.value)} maxLength={20000} rows={4} /></div>
      </fieldset>
      <p className="company-crm-help">Las fechas se muestran en tu zona horaria: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Los cambios se confirman al guardar.</p>
      {saveError && <Notice error>{saveError}</Notice>}
      <div className="company-crm-save"><span>{saving ? "Guardando…" : editorLoading ? "Recargando ficha…" : uncertain ? "Guardado pendiente de confirmar" : dirty ? "Cambios sin guardar" : "Ficha guardada"}</span><div className="company-crm-actions">{(!editor.isNew || uncertain) && <button type="button" className="crm-secondary" disabled={saving || editorLoading} onClick={() => requestSelection({ type: "reload" })}><RefreshCw size={16} aria-hidden="true" />{conflict || uncertain ? "Revisar ficha actual" : "Recargar ficha"}</button>}<button type="submit" className="crm-primary" disabled={saving || editorLoading || (!dirty && !uncertain)}><Save size={16} aria-hidden="true" />{saving ? "Guardando…" : uncertain ? "Reintentar el mismo envío" : editor.isNew ? "Crear cliente" : "Guardar cambios"}</button></div></div>
      {editor.notes.length > 0 && <section className="company-crm-history" aria-labelledby={`${id}-history-title`}><h3 id={`${id}-history-title`}>Actividad registrada</h3><ol>{editor.notes.map((note, index) => <li key={note.id || index}><div><strong>{note.titulo || note.tipo || "Actividad"}</strong><time dateTime={note.created_at || undefined}>{dateLabel(note.created_at)}</time></div>{note.descripcion && <p>{note.descripcion}</p>}{note.asesor_id && <span>{advisorNames.get(note.asesor_id) || "Asesor anterior"}</span>}</li>)}</ol></section>}
    </form>}

    <div className="company-crm-filters"><div className="crm-search-field"><label htmlFor={`${id}-search`}>Buscar cliente</label><div className="company-crm-search"><Search size={17} aria-hidden="true" /><input id={`${id}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, teléfono o correo" /></div></div><div className="crm-field"><label htmlFor={`${id}-stage-filter`}>Etapa</label><select id={`${id}-stage-filter`} value={stage} onChange={event => setFilter(setStage, event.target.value)}><option value="">Todas las etapas</option>{pipeline.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></div><div className="crm-field"><label htmlFor={`${id}-advisor-filter`}>Asesor</label><select id={`${id}-advisor-filter`} value={advisorId} onChange={event => setFilter(setAdvisorId, event.target.value)}><option value="">Todos los asesores</option>{advisors.map(advisor => <option key={advisor.id} value={advisor.id}>{advisor.name || "Asesor sin nombre"}</option>)}</select></div></div>
    <div className="company-crm-list" aria-busy={loading}>
      <div className="company-crm-columns" aria-hidden="true"><span>Cliente</span><span>Etapa</span><span>Asesor</span><span>Próxima acción</span><span /></div>
      {loading ? <div className="company-crm-loading" role="status">Cargando clientes…</div> : !loadError && visibleLeads.length === 0 ? <div className="company-crm-empty"><h3>{query || stage || advisorId ? "No hay clientes con estos filtros" : "Esta cartera todavía está vacía"}</h3><p>{query || stage || advisorId ? "Prueba otro nombre, etapa o asesor." : "Crea el primer cliente para comenzar su seguimiento."}</p>{(query || stage || advisorId) && <button type="button" className="crm-secondary" onClick={() => { setSearch(""); setQuery(""); setStage(""); setAdvisorId(""); setPage(0); }}>Limpiar filtros</button>}</div>
        : <ul>{visibleLeads.map(lead => <li key={lead.id}><button type="button" className="company-crm-row" aria-pressed={editor?.id === lead.id} disabled={saving || editorLoading} onClick={() => requestSelection({ type: "lead", id: lead.id })}><span className="company-crm-person"><strong>{lead.name || "Sin nombre"}</strong><span>{lead.phone || lead.email || "Sin datos de contacto"}</span><small>{lead.project || moneyLabel(lead)}</small></span><span className="company-crm-stage"><span className="crm-sr-only">Etapa: </span>{lead.stage || "Sin etapa"}</span><span className="company-crm-advisor"><span className="crm-sr-only">Asesor: </span>{advisorNames.get(lead.asesor_id) || lead.asesor_name || "Sin asignar"}</span><span className="company-crm-next"><span>{lead.next_action || "Sin próxima acción"}</span>{lead.next_action_at && <small>{dateLabel(lead.next_action_at)}</small>}</span><ChevronRight size={17} aria-hidden="true" /></button></li>)}</ul>}
    </div>
    {result && result.total > 0 && <nav className="company-crm-pagination" aria-label="Páginas de clientes"><span>{page * PAGE_SIZE + 1}–{page * PAGE_SIZE + visibleLeads.length} de {result.total.toLocaleString("es")}</span><div className="company-crm-actions"><button type="button" className="crm-secondary" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={loading || page === 0}><ChevronLeft size={16} aria-hidden="true" />Anterior</button><button type="button" className="crm-secondary" onClick={() => setPage(value => value + 1)} disabled={loading || !result.has_more}>Siguiente<ChevronRight size={16} aria-hidden="true" /></button></div></nav>}
  </>;
}
