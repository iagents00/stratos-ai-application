import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Copy, Eye, EyeOff, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { createWhatsAppOrganization, createWhatsAppTenantUser } from '../../../lib/whatsapp-admin';
import { MANAGED_TENANT_FEATURES, managedTenantFeatures } from '../../../clients/tenant/managed-features';
import { getClientConfigByOrgId } from '../../../clients';
import { companyReadiness, companySummary, ROOT_COMPANY_ROLES, visibleCompanies, validateCompany, validateCompanyUser } from './company-onboarding';

const initialCompany = () => ({ name: '', seats: 5, features: managedTenantFeatures() });
const initialUser = organizationId => ({ organization_id: organizationId, name: '', email: '', role: 'admin' });
const roleName = { admin: 'Administrador', super_admin: 'Superadministrador de empresa', director: 'Director', asesor: 'Asesor', ceo: 'Dirección general', marketing: 'Marketing', colaborador: 'Colaborador' };
const companyLabel = company => {
  const alias = getClientConfigByOrgId(company.id)?.legalName;
  return alias && alias !== company.name ? `${company.name} · ${alias}` : company.name;
};

export default function CompanyOnboarding({ data, refresh, onIntegrations, onUsers, onSetup, onOpenCRM }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState('');
  const [createdCompany, setCreatedCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState(initialCompany);
  const [userForm, setUserForm] = useState(() => initialUser(''));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requestId = useRef(null);
  const headingRef = useRef(null);
  const accessRef = useRef(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const organizations = data?.organizations || [];
  const profiles = data?.profiles || [];
  const company = organizations.find(item => item.id === selectedId) || (createdCompany?.id === selectedId ? createdCompany : null);
  const summary = company ? companySummary(company, profiles) : null;
  const readiness = company ? companyReadiness(company, profiles) : null;
  const root = data?.access?.root === true;
  const companies = visibleCompanies(organizations, root);
  const filtered = companies.filter(item => `${companyLabel(item)} ${item.slug}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const quotaAvailable = root || (data?.access?.scopeReady === true && Number(data?.access?.companiesUsed) < Number(data?.access?.companyLimit));
  const loginUrl = `${window.location.origin}/login`;

  useEffect(() => { if (view !== "list") headingRef.current?.focus(); }, [view, selectedId]);
  useEffect(() => { if (credentials) accessRef.current?.focus(); }, [credentials]);

  const clearFeedback = () => { setError(''); setNotice(''); setCopied(false); };
  const selectCompany = item => {
    clearFeedback(); setSelectedId(item.id); setUserForm(initialUser(item.id));
    setCredentials(null); setVisiblePassword(false); setView('detail');
  };
  const run = async action => {
    if (lock.current) return;
    lock.current = true; setBusy(true); clearFeedback();
    try { await action(); }
    catch (err) { setError(err.message || 'No se pudo completar la acción. Tus datos siguen aquí.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const createCompany = event => {
    event.preventDefault();
    const invalid = validateCompany(companyForm);
    if (invalid) { setError(invalid); return; }
    run(async () => {
      requestId.current ||= crypto.randomUUID();
      const result = await createWhatsAppOrganization({ request_id: requestId.current, ...companyForm, name: companyForm.name.trim(), seats: Number(companyForm.seats), features: root ? companyForm.features : undefined });
      requestId.current = null;
      setCreatedCompany(result.organization); selectCompany(result.organization); setCompanyForm(initialCompany());
      setNotice('Empresa creada. Ahora agrega a su administrador para que pueda iniciar sesión.');
      const refreshed = await refresh();
      if (!refreshed) setNotice('Empresa creada. No pudimos actualizar la lista; pulsa Actualizar antes de crear su administrador.');
    });
  };
  const createUser = event => {
    event.preventDefault();
    const invalid = validateCompanyUser(userForm, company, profiles, { root });
    if (invalid) { setError(invalid); return; }
    const destination = { id: company.id, name: company.name };
    run(async () => {
      const result = await createWhatsAppTenantUser({ ...userForm, name: userForm.name.trim(), email: userForm.email.trim().toLowerCase() });
      setCredentials({ company: destination.name, email: result.user.email, password: result.temp_password });
      setVisiblePassword(false); setUserForm(initialUser(destination.id));
      setNotice(result.credential_saved === false ? 'Usuario creado. Guarda este acceso ahora: no se pudo conservar en Accesos temporales.' : 'Usuario creado. Su acceso queda disponible en Accesos temporales hasta que cambie la contraseña.');
      await refresh();
    });
  };
  const copyAccess = async () => {
    try {
      await navigator.clipboard.writeText(`Acceso a ${credentials.company}\n${loginUrl}\nCorreo: ${credentials.email}\nContraseña temporal: ${credentials.password}`);
      setCopied(true);
    } catch { setError('El navegador no permitió copiar. Puedes seleccionar el correo y mostrar la contraseña para guardarlos.'); }
  };

  return <section className="company-page" aria-labelledby="company-title" aria-busy={busy}>
    <header className="company-heading">
      <div>{view !== 'list' && <button className="company-back" disabled={busy} onClick={() => { setView('list'); clearFeedback(); setCredentials(null); }}><ArrowLeft size={16} /> Todas las empresas</button>}
        <h1 id="company-title" ref={headingRef} tabIndex={-1}>{view === 'create' ? 'Nueva empresa' : view === 'detail' ? company ? companyLabel(company) : 'Empresa' : 'Empresas'}</h1>
        <p>{view === 'create' ? 'Prepara un espacio propio para tu próximo cliente.' : view === 'detail' ? 'Administra el equipo y prepara su acceso a Stratos.' : 'Cada cliente tiene su equipo, sus datos y su espacio en Stratos.'}</p>
      </div>
      {view === 'list' && <button className="company-primary" disabled={!quotaAvailable || busy || !data} onClick={() => { clearFeedback(); setView('create'); }}><Plus size={18} /> Nueva empresa</button>}
    </header>
    {error && <div className="company-message company-error" role="alert">{error}</div>}
    {notice && <div className="company-message" role="status"><Check size={18} />{notice}</div>}
    {!root && <p className="company-quota">{data?.access?.companiesUsed ?? '—'} de {data?.access?.companyLimit ?? '—'} empresas utilizadas en tu plan.{!quotaAvailable && ' Solicita a Stratos una ampliación para crear otra empresa.'}</p>}

    {view === 'list' && <>
      <div className="company-toolbar"><label className="company-search"><Search size={17} /><span className="company-sr-only">Buscar empresa</span><input type="search" placeholder="Buscar empresa…" value={query} onChange={event => setQuery(event.target.value)} /></label><span>{companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}</span></div>
      <div className="company-list">
        {filtered.length ? filtered.map(item => {
          const info = companySummary(item, profiles);
          const status = companyReadiness(item, profiles);
          return <button className="company-row" key={item.id} onClick={() => selectCompany(item)}>
            <span className="company-avatar"><Building2 size={21} /></span>
            <span className="company-row-name"><strong>{companyLabel(item)}</strong><small>{item.slug}{item.meta_config?.platform?.kind === 'partner' ? ' · Partner' : ''}</small></span>
            <span className="company-row-status">{status.label}</span>
            <span className="company-seats">{info.used} / {item.seats} usuarios</span><ArrowRight size={17} />
          </button>;
        }) : <div className="company-empty"><Building2 size={28} /><h2>{query ? 'No encontramos esa empresa' : 'Tu próximo cliente empieza aquí'}</h2><p>{query ? 'Prueba con otro nombre.' : 'Crea la empresa y su administrador. Después podrás incorporar al resto del equipo.'}</p>{!query && <button className="company-primary" disabled={!quotaAvailable || !data} onClick={() => setView('create')}><Plus size={17} /> Crear primera empresa</button>}</div>}
      </div>
      {root && <p className="company-footnote">Incluye todas las empresas, los espacios registrados y los partners. Abre una empresa para administrar su equipo y sus datos generales.</p>}
    </>}

    {view === 'create' && <div className="company-workspace">
      <form className="company-form" onSubmit={createCompany}>
        <fieldset disabled={busy || !quotaAvailable}><legend>Datos de la empresa</legend>
          <label htmlFor="company-name">Nombre de la empresa</label><input id="company-name" autoFocus required minLength={2} maxLength={120} autoComplete="organization" placeholder="Ej. Inmobiliaria Horizonte" value={companyForm.name} onChange={event => setCompanyForm(form => ({ ...form, name: event.target.value }))} />
          <label htmlFor="company-seats">Licencias de usuarios</label><input id="company-seats" type="number" required min="1" max="1000" step="1" aria-describedby="company-seats-help" value={companyForm.seats} onChange={event => setCompanyForm(form => ({ ...form, seats: event.target.value }))} /><p id="company-seats-help" className="company-help">Incluye al administrador. Puedes ampliar el cupo más adelante.</p>
          {root && <fieldset className="company-modules"><legend>Módulos iniciales</legend><p className="company-help">CRM incluido en todas las empresas.</p>{MANAGED_TENANT_FEATURES.map(item => <label className="company-check" key={item.key}><input type="checkbox" checked={companyForm.features[item.key]} onChange={event => setCompanyForm(form => ({ ...form, features: { ...form.features, [item.key]: event.target.checked } }))} /><span>{item.label}</span></label>)}</fieldset>}
          <button className="company-primary" type="submit">{busy ? 'Creando empresa…' : 'Crear empresa y continuar'}<ArrowRight size={17} /></button>
        </fieldset>
      </form>
      <aside className="company-guide"><ShieldCheck size={23} /><h2>Un espacio para cada empresa</h2><p>Su equipo entra con sus propias cuentas. Los clientes y las conversaciones se mantienen dentro de su organización.</p><ol><li><strong>Empresa</strong><span>Nombre, licencias y módulos.</span></li><li><strong>Administrador</strong><span>La primera persona con acceso.</span></li><li><strong>Acceso listo</strong><span>Guarda sus credenciales y el enlace.</span></li></ol><p>WhatsApp se puede configurar después. No es necesario para empezar a usar el CRM.</p></aside>
    </div>}

    {view === 'detail' && company && <>
      {onOpenCRM && <div className="company-actions" style={{ marginBottom: 24 }}><button className="company-primary" disabled={!company.active || busy} onClick={() => onOpenCRM(company.id)}>Abrir CRM de {company.name}<ArrowRight size={17} /></button></div>}
      <div className="company-context"><span><Users size={17} />{summary.used} de {company.seats} licencias en uso</span><span><ShieldCheck size={17} />{company.active ? 'Empresa activa' : 'Empresa inactiva'}</span></div>
      <section className="company-readiness" aria-labelledby="company-readiness-title"><h2 id="company-readiness-title">{readiness.label}</h2><p>{readiness.detail}</p><p>Acceso de empresas: <a href={loginUrl} target="_blank" rel="noreferrer">{loginUrl}</a></p><p className="company-help">Cada persona entra con su propia cuenta. WhatsApp se verifica por separado y no es necesario para empezar a usar el CRM.</p></section>
      {credentials && <section className="company-access" aria-labelledby="company-access-title"><div><Check size={22} /><h2 id="company-access-title" ref={accessRef} tabIndex={-1}>Acceso creado para {credentials.company}</h2></div><p>Comparte estos datos con la persona autorizada de esta empresa.</p><dl><div><dt>Enlace de acceso</dt><dd><a href={loginUrl} target="_blank" rel="noreferrer">{loginUrl}</a></dd></div><div><dt>Correo</dt><dd>{credentials.email}</dd></div><div><dt>Contraseña temporal</dt><dd><code>{visiblePassword ? credentials.password : '••••••••••••'}</code><button type="button" className="company-icon" aria-label={visiblePassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVisiblePassword(value => !value)}>{visiblePassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></dd></div></dl><div className="company-actions"><button className="company-primary" onClick={copyAccess}><Copy size={17} />{copied ? 'Acceso copiado' : 'Copiar acceso completo'}</button><button className="company-secondary" onClick={() => { setCredentials(null); setVisiblePassword(false); }}>Ya guardé el acceso</button></div></section>}
      <div className="company-workspace">
        <form className="company-form" onSubmit={createUser}>
          <fieldset disabled={busy || !company.active || !summary.available || !!credentials}><legend>{summary.hasAdmin ? 'Agregar persona al equipo' : 'Crear administrador'}</legend><p className="company-destination">Este usuario pertenecerá a <strong>{company.name}</strong>.</p>
            <label htmlFor="company-user-name">Nombre completo</label><input id="company-user-name" required maxLength={120} autoComplete="name" value={userForm.name} onChange={event => setUserForm(form => ({ ...form, name: event.target.value }))} />
            <label htmlFor="company-user-email">Correo de acceso</label><input id="company-user-email" type="email" required maxLength={254} autoComplete="email" placeholder="nombre@empresa.com" value={userForm.email} onChange={event => setUserForm(form => ({ ...form, email: event.target.value }))} />
            <label htmlFor="company-user-role">Rol</label><select id="company-user-role" value={userForm.role} disabled={!summary.hasAdmin} onChange={event => setUserForm(form => ({ ...form, role: event.target.value }))}>{(root ? ROOT_COMPANY_ROLES : ['admin', 'director', 'asesor']).map(role => <option key={role} value={role}>{roleName[role]}</option>)}</select><p className="company-help">{userForm.role === 'marketing' ? 'Trabaja en el espacio de Marketing de esta empresa.' : userForm.role === 'super_admin' ? 'Administra su empresa. El acceso global a Stratos requiere una autorización de plataforma independiente.' : userForm.role === 'admin' ? 'Administra al equipo y la configuración de su empresa.' : userForm.role === 'director' ? 'Supervisa la operación comercial de su empresa.' : 'Su acceso se limita a los módulos y permisos de su empresa.'}</p>
            <button className="company-primary" type="submit"><Plus size={17} />{busy ? 'Creando usuario…' : summary.hasAdmin ? 'Crear usuario' : 'Crear administrador'}</button>
          </fieldset>
          {!summary.available && <p className="company-help" role="status">Sin licencias disponibles. Amplía el cupo desde Módulos y licencias.</p>}
          {credentials && <p className="company-help">Guarda el acceso anterior para agregar a otra persona.</p>}
        </form>
        <aside className="company-guide"><h2>Equipo de {companyLabel(company)}</h2>{summary.team.length ? <ul className="company-team">{summary.team.map(person => <li key={person.id}><strong>{person.name}</strong><span>{roleName[person.role] || person.role}</span></li>)}</ul> : <p>Aún no hay usuarios activos. Crea al administrador para completar el alta.</p>}
          {root && <div className="company-actions"><button className="company-secondary" disabled={busy} onClick={() => onUsers?.(company.id)}><Users size={16} />Gestionar todos los usuarios</button><button className="company-secondary" disabled={busy} onClick={() => onSetup?.(company.id)}><Building2 size={16} />Editar empresa y licencias</button></div>}
          <div className="company-next"><h2>Después del alta</h2><p>El equipo podrá entrar por el acceso de empresas. WhatsApp requiere vincular y verificar el número de este cliente.</p><button className="company-secondary" disabled={busy} onClick={() => onIntegrations(company.id)}>Configurar WhatsApp<ArrowRight size={16} /></button></div></aside>
      </div>
    </>}
  </section>;
}
