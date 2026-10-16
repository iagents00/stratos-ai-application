import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check, ChevronDown, Pencil, RefreshCw, Save, Search, ShieldCheck, Users, X } from "lucide-react";
import { loadPlatformUsers, updatePlatformUser } from "../../../lib/whatsapp-admin";
import {
  filterPlatformUsers, isMarketingUser, isProtectedPlatformUser, MARKETING_ADMIN_ROLES,
  PLATFORM_USER_ROLES, platformRoleLabel, platformUserChanged, platformUserDraft, validatePlatformUserDraft,
} from "./platform-users.mjs";

const dateLabel = value => {
  if (!value) return "Todavía no ha entrado";
  try { return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return "Fecha no disponible"; }
};

export default function PlatformUsersAdmin({ currentUserId, initialOrganizationId = "", marketingOnly = false, refreshKey = 0, onChanged }) {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [marketing, setMarketing] = useState(marketingOnly);
  const [visibleCount, setVisibleCount] = useState(50);
  const [original, setOriginal] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const result = await loadPlatformUsers();
      setUsers(result.users || []);
      setOrganizations(result.organizations || []);
      return result;
    } catch (error) {
      setLoadError(error.message || "No se pudieron cargar los usuarios. Pulsa Actualizar para intentar de nuevo.");
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const organizationNames = useMemo(() => new Map(organizations.map(org => [org.id, org.name])), [organizations]);
  const organizationName = id => organizationNames.get(id) || (id ? "Empresa no disponible" : "Sin empresa");
  const filtered = useMemo(() => filterPlatformUsers(users, organizations, { query, organizationId, role, status, marketing }), [users, organizations, query, organizationId, role, status, marketing]);
  const dirty = platformUserChanged(draft, original);
  const protectedUser = original && isProtectedPlatformUser(original, currentUserId);
  const incompleteAccount = original?.profile_missing === true || original?.identity_missing === true;
  const moving = original && draft && (original.organization_id || "") !== draft.organization_id;

  const select = id => {
    const selected = users.find(user => user.id === id) || null;
    setOriginal(selected);
    setDraft(selected ? platformUserDraft(selected) : null);
    setPendingSelection(null); setSaveError(""); setConflict(false);
  };
  const requestSelection = id => {
    if (id === original?.id) return;
    if (dirty) { setPendingSelection(id || "close"); return; }
    select(id);
  };
  const patch = values => {
    setDraft(current => ({ ...current, ...values }));
    setSaveError("");
  };
  const reloadSelected = async () => {
    const result = await load();
    if (!result) return;
    const latest = result.users?.find(user => user.id === original?.id);
    if (!latest) { setSaveError("Esta cuenta ya no está disponible. Selecciona otro usuario."); return; }
    setOriginal(latest); setDraft(platformUserDraft(latest));
    setConflict(false); setSaveError("");
  };
  const save = async event => {
    event.preventDefault();
    const validation = validatePlatformUserDraft(draft, original, organizations, currentUserId);
    if (validation) { setSaveError(validation); return; }
    if (!dirty) return;
    setSaving(true); setSaveError(""); setSuccess("");
    try {
      const result = await updatePlatformUser({
        user_id: original.id, expected_updated_at: original.updated_at,
        ...draft, name: draft.name.trim(), area: draft.area.trim(),
        organization_id: draft.organization_id || null, confirm_move: !!moving && draft.confirm_move === true,
      });
      const updated = { ...original, ...result.user };
      setUsers(current => current.map(user => user.id === updated.id ? { ...user, ...updated } : user));
      setOriginal(updated); setDraft(platformUserDraft(updated)); setConflict(false);
      setSuccess(`${updated.name}: cambios guardados.${moving ? " La cuenta ya pertenece a la empresa de destino; sus datos e historial permanecen en la empresa original." : ""}${result.audit_saved === false ? " No se pudo registrar la auditoría; revisa el servidor." : ""}`);
      await load();
      if (onChanged) await onChanged();
    } catch (error) {
      setSaveError(error.message || "No se pudieron guardar los cambios. Tu borrador se conserva.");
      setConflict(error.status === 409 && (!error.code || error.code === "40001"));
    } finally { setSaving(false); }
  };

  return <section className="company-page platform-users" aria-labelledby="platform-users-title">
    <div className="company-heading">
      <div><h1 id="platform-users-title">{marketingOnly ? "Usuarios de Marketing" : "Todos los usuarios"}</h1>
        <p>{marketingOnly ? "Equipo de Marketing y cuentas con permiso para administrarlo, en todas las empresas." : "Busca cualquier cuenta de Stratos. Administra su empresa, rol y estado, incluidos los usuarios inactivos."}</p></div>
      <button className="company-secondary" onClick={load} disabled={loading || saving}><RefreshCw size={16} aria-hidden="true" />{loading ? "Actualizando…" : "Actualizar usuarios"}</button>
    </div>

    {success && <div className="company-message" role="status"><Check size={18} aria-hidden="true" /><span>{success}</span></div>}
    {loadError && <div className="company-message company-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{loadError}</span></div>}

    <div className="platform-users-filters">
      <label className="platform-users-search" htmlFor="platform-user-search"><span className="company-sr-only">Buscar por nombre, correo o empresa</span><Search size={17} aria-hidden="true" /><input id="platform-user-search" type="search" placeholder="Nombre, correo o empresa" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div><label htmlFor="platform-user-company-filter">Empresa</label><select id="platform-user-company-filter" value={organizationId} onChange={event => setOrganizationId(event.target.value)}>
        <option value="">Todas las empresas</option><option value="unassigned">Sin empresa</option>
        {organizations.map(org => <option key={org.id} value={org.id}>{org.name}{org.meta_config?.platform?.kind === "partner" ? " · Partner" : ""}</option>)}
      </select></div>
      <div><label htmlFor="platform-user-role-filter">Rol</label><select id="platform-user-role-filter" value={role} onChange={event => setRole(event.target.value)}><option value="">Todos los roles</option>{PLATFORM_USER_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label htmlFor="platform-user-status-filter">Estado</label><select id="platform-user-status-filter" value={status} onChange={event => setStatus(event.target.value)}><option value="">Activos e inactivos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div>
      {!marketingOnly && <label className="company-check platform-users-marketing"><input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} />Solo Marketing</label>}
    </div>

    {pendingSelection !== null && <div className="company-message platform-users-unsaved" role="alert"><AlertCircle size={18} aria-hidden="true" /><div><strong>Tienes cambios sin guardar en {original?.name}.</strong><p>Continúa editando o descarta el borrador para cambiar de cuenta.</p><div className="company-actions"><button className="company-secondary" onClick={() => setPendingSelection(null)}>Continuar editando</button><button className="company-secondary" onClick={() => select(pendingSelection === "close" ? null : pendingSelection)}>Descartar borrador</button></div></div></div>}

    {original && draft && <form className="platform-user-editor" onSubmit={save} aria-labelledby="platform-user-edit-title">
      <div className="platform-user-editor-heading"><div><h2 id="platform-user-edit-title">Editar a {original.name || "este usuario"}</h2><p>{original.email || "Sin correo de acceso"}</p></div><button type="button" className="company-icon" aria-label="Cerrar editor de usuario" disabled={saving} onClick={() => requestSelection(null)}><X size={18} aria-hidden="true" /></button></div>
      <div className="platform-user-access-info"><span>{original.email_confirmed === true ? "Correo confirmado" : original.email ? "Correo pendiente de confirmar" : "Sin correo registrado"}</span><span>Último acceso: {dateLabel(original.last_sign_in)}</span>{original.platform_admin?.active && <span><ShieldCheck size={14} aria-hidden="true" />Operador de plataforma</span>}</div>
      {incompleteAccount && <p className="platform-user-protection"><AlertCircle size={16} aria-hidden="true" />{original.profile_missing ? "Esta identidad de acceso no tiene perfil en Stratos. Su información se muestra para revisión; hay que recuperar el perfil antes de editar permisos." : "Este perfil no tiene una identidad de acceso asociada. Hay que recuperar la cuenta antes de editar permisos."}</p>}
      {protectedUser && <p className="platform-user-protection"><ShieldCheck size={16} aria-hidden="true" />{original.id === currentUserId ? "Tu cuenta está protegida para conservar tu acceso. Puedes modificar el nombre y el área." : "El acceso de este operador de plataforma está protegido. Puedes modificar su nombre y área."}</p>}
      <fieldset disabled={saving || loading || incompleteAccount} className="platform-user-fields"><legend className="company-sr-only">Datos y acceso del usuario</legend>
        <div><label htmlFor="platform-user-name">Nombre</label><input id="platform-user-name" value={draft.name} maxLength={120} required onChange={event => patch({ name: event.target.value })} /></div>
        <div><label htmlFor="platform-user-area">Área</label><input id="platform-user-area" value={draft.area} maxLength={100} onChange={event => patch({ area: event.target.value })} placeholder="Por ejemplo: Ventas" /></div>
        <div><label htmlFor="platform-user-company">Empresa de la cuenta</label><select id="platform-user-company" value={draft.organization_id} disabled={protectedUser} onChange={event => patch({ organization_id: event.target.value, confirm_move: false })}>
          {!draft.organization_id && <option value="">Sin empresa</option>}
          {draft.organization_id && !organizationNames.has(draft.organization_id) && <option value={draft.organization_id}>Empresa no disponible</option>}
          {organizations.map(org => <option key={org.id} value={org.id}>{org.name}{org.active === false ? " · Inactiva" : ""}{org.meta_config?.platform?.kind === "partner" ? " · Partner" : ""}</option>)}
        </select></div>
        <div><label htmlFor="platform-user-role">Rol</label><select id="platform-user-role" value={draft.role} disabled={protectedUser} onChange={event => patch({ role: event.target.value })}>{!PLATFORM_USER_ROLES.some(([value]) => value === draft.role) && <option value={draft.role}>{platformRoleLabel(draft.role)}</option>}{PLATFORM_USER_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="company-help">El rol Superadministrador aplica a su empresa. El acceso global de plataforma se administra por separado.</p></div>
        <div className="platform-user-permissions"><label className="company-check"><input type="checkbox" checked={draft.active} disabled={protectedUser} onChange={event => patch({ active: event.target.checked })} />Cuenta activa</label><p className="company-help">Una cuenta inactiva conserva su información y deja de acceder.</p></div>
        <div className="platform-user-permissions"><label className="company-check"><input type="checkbox" checked={draft.crm_only} disabled={protectedUser} onChange={event => patch({ crm_only: event.target.checked })} />Acceso limitado al CRM</label><label className="company-check"><input type="checkbox" checked={draft.is_marketing_admin} disabled={protectedUser || (!draft.is_marketing_admin && (!MARKETING_ADMIN_ROLES.includes(draft.role) || draft.crm_only))} onChange={event => patch({ is_marketing_admin: event.target.checked })} />Administrar Marketing</label></div>
      </fieldset>
      {moving && <div className="platform-user-move"><h3>Mover esta cuenta de empresa</h3><p className="platform-user-move-path"><strong>{organizationName(original.organization_id)}</strong><ArrowRight size={16} aria-label="a" /><strong>{organizationName(draft.organization_id)}</strong></p><p>El usuario tendrá acceso a la empresa de destino según su rol. Los clientes, datos e historial de la empresa original permanecen allí; no se trasladan con la cuenta.</p><label className="company-check"><input type="checkbox" checked={draft.confirm_move} disabled={saving || loading} onChange={event => patch({ confirm_move: event.target.checked })} />Confirmo el traslado de esta cuenta a {organizationName(draft.organization_id)}.</label></div>}
      {saveError && <div className="company-message company-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><div>{saveError}{conflict && <><p>Otro administrador cambió esta cuenta. Tu borrador se conserva. Carga la versión actual antes de volver a editar.</p><button type="button" className="company-secondary" onClick={reloadSelected} disabled={loading || saving}>Descartar borrador y cargar versión actual</button></>}</div></div>}
      <div className="company-actions"><button type="submit" className="company-primary" disabled={saving || loading || !dirty || conflict || incompleteAccount}><Save size={16} aria-hidden="true" />{saving ? "Guardando cambios…" : "Guardar cambios"}</button><button type="button" className="company-secondary" disabled={saving} onClick={() => requestSelection(null)}>Cerrar editor</button>{dirty && <span className="company-help">Cambios sin guardar</span>}</div>
    </form>}

    <div className="platform-users-results" role="status" aria-live="polite">{loading && !users.length ? "Cargando usuarios…" : `${filtered.length} de ${users.length} usuarios${marketing ? " · Marketing" : ""}`}</div>
    {loading && !users.length ? <div className="platform-users-skeleton" aria-hidden="true">{[1, 2, 3, 4].map(row => <div key={row}><span /><span /><span /></div>)}</div>
      : !filtered.length ? <div className="company-empty"><Users size={28} aria-hidden="true" /><h2>{users.length ? "Ningún usuario coincide con los filtros" : "Todavía no hay usuarios disponibles"}</h2><p>{users.length ? "Prueba con otro nombre o correo, o amplía los filtros de empresa, rol y estado." : "Actualiza la lista para cargar las cuentas registradas en la plataforma."}</p>{users.length > 0 && <button className="company-secondary" onClick={() => { setQuery(""); setOrganizationId(""); setRole(""); setStatus(""); setMarketing(marketingOnly); }}>Restablecer filtros</button>}</div>
        : <><div className="platform-users-list-heading" aria-hidden="true"><span>Usuario</span><span>Empresa</span><span>Acceso</span><span /></div><ul className="platform-users-list">{filtered.slice(0, visibleCount).map(user => <li key={user.id}><button className="platform-user-row" onClick={() => requestSelection(user.id)} disabled={saving || loading} aria-label={`Editar a ${user.name || user.email || "usuario"}`} aria-pressed={original?.id === user.id}>
          <span className="platform-user-person"><strong>{user.name || "Sin nombre"}</strong><span>{user.email || "Sin correo registrado"}</span>{isProtectedPlatformUser(user, currentUserId) && <small><ShieldCheck size={13} aria-hidden="true" />{user.id === currentUserId ? "Tu cuenta" : "Cuenta protegida"}</small>}{(user.profile_missing || user.identity_missing) && <small><AlertCircle size={13} aria-hidden="true" />{user.profile_missing ? "Falta perfil" : "Falta acceso"}</small>}</span>
          <span className="platform-user-company-label">{organizationName(user.organization_id)}</span><span className="platform-user-role-label"><span>{platformRoleLabel(user.role)}</span><small><span className={`platform-user-status ${user.active === false ? "is-inactive" : ""}`}>{user.active === false ? "Inactivo" : "Activo"}</span>{isMarketingUser(user) && <span className="platform-user-marketing-label">Marketing</span>}</small></span><Pencil size={16} aria-hidden="true" />
        </button></li>)}</ul>{filtered.length > visibleCount && <button className="company-secondary platform-users-more" onClick={() => setVisibleCount(count => count + 50)}><ChevronDown size={16} aria-hidden="true" />Mostrar más usuarios ({filtered.length - visibleCount} restantes)</button>}</>}
  </section>;
}
