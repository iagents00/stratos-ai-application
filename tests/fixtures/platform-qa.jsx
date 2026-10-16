// Local synthetic QA only. Install the network barrier before importing any
// application module; no fixture request may reach a production backend.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) {
  throw new Error('Esta prueba sintética solo se abre en el servidor local de desarrollo.');
}

const params = new URLSearchParams(location.search);
const root = params.get('role') !== 'partner';
const actor = '33333333-3333-4333-8333-333333333333';
const company = (id, name) => ({ id, name, slug: name.toLowerCase().replaceAll(' ', '-'), seats: 5, active: true, meta_config: { onboarding: { createdFrom: 'whatsapp_admin' } } });
const organizations = [company('11111111-1111-4111-8111-111111111111', 'Horizonte QA'), company('22222222-2222-4222-8222-222222222222', 'Estudio Norte QA')];
const visible = root ? organizations : organizations.slice(0, 1);
const profiles = organizations.map((org, index) => ({ id: `44444444-4444-4444-8444-44444444444${index}`, name: `Asesor ${org.name}`, role: 'admin', active: true, organization_id: org.id }));
const pipeline = [{ name: 'Prospecto', color: '#94A3B8' }, { name: 'Contactado', color: '#38BDF8' }, { name: 'Ganado', color: '#34D399' }];
const leads = organizations.map((org, index) => ({ id: `55555555-5555-4555-8555-55555555555${index}`, organization_id: org.id, name: index ? 'Bruno Estudio QA' : 'Ana Horizonte QA', phone: `+52664123456${index}`, email: `cliente${index}@example.test`, stage: 'Prospecto', asesor_id: profiles[index].id, asesor_name: profiles[index].name, project: 'Proyecto sintético', budget: '1500000', presupuesto: 1500000, notas: 'Datos locales de prueba.', next_action: 'Llamar para confirmar interés', next_action_at: null, created_at: '2026-10-15T15:00:00.000Z', updated_at: '2026-10-16T15:00:00.000Z', action_history: [] }));
const initialData = { organizations: visible, profiles: profiles.filter(person => visible.some(org => org.id === person.organization_id)), channels: [], runs: [], events: [], partners: [], provider: {}, access: { root, supportOnly: true, companyLimit: 5, companiesUsed: visible.length, scopeReady: true } };
const nativeFetch = window.fetch.bind(window);
let simulatedSaveFailure = false;
window.__STRATOS_PLATFORM_QA_REQUESTS__ = [];
window.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
  if (url.origin === location.origin) return nativeFetch(input, options);
  if (url.hostname.endsWith('.supabase.co') && url.pathname.endsWith('/functions/v1/whatsapp-admin')) {
    const request = JSON.parse(options?.body || '{}');
    window.__STRATOS_PLATFORM_QA_REQUESTS__.push(request);
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (request.action === 'bootstrap') return reply({ ok: true, ...initialData });
    const org = visible.find(item => item.id === request.organization_id);
    if (!org) return reply({ ok: false, error: 'Empresa fuera del alcance sintético.' }, 403);
    const context = { organization: org, pipeline, advisors: profiles.filter(person => person.organization_id === org.id) };
    const selected = leads.find(item => item.id === request.lead_id && item.organization_id === org.id);
    if (request.action === 'list_company_leads') {
      await new Promise(resolve => setTimeout(resolve, Number(params.get('delay')) || 60));
      const filtered = leads.filter(item => item.organization_id === org.id && (!request.stage || item.stage === request.stage) && (!request.asesor_id || item.asesor_id === request.asesor_id) && (!request.search || `${item.name} ${item.phone} ${item.email}`.toLowerCase().includes(request.search.toLowerCase())));
      return reply({ ok: true, ...context, leads: filtered, total: filtered.length, page: 0, page_size: 50, has_more: false });
    }
    if (request.action === 'get_company_lead') return selected ? reply({ ok: true, ...context, lead: selected, notes: [] }) : reply({ ok: false, error: 'Cliente sintético no encontrado.' }, 404);
    if (request.action === 'create_company_lead') {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (selected) return reply({ ok: true, lead: selected, audit_saved: true, replayed: true });
      const lead = { ...request.lead, id: request.lead_id, organization_id: org.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), action_history: [] };
      leads.push(lead);
      if (params.get('save') === 'uncertain' && !simulatedSaveFailure) { simulatedSaveFailure = true; throw new TypeError('Respuesta sintética perdida después de guardar.'); }
      return reply({ ok: true, lead, audit_saved: true, replayed: false });
    }
    if (request.action === 'update_company_lead' && selected) {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (params.get('save') === 'conflict' && !simulatedSaveFailure) {
        simulatedSaveFailure = true;
        return reply({ ok: false, code: '40001', error: 'La ficha sintética cambió en otra sesión.' }, 409);
      }
      Object.assign(selected, request.patch, { updated_at: new Date().toISOString() });
      return reply({ ok: true, lead: selected, audit_saved: true, replayed: false });
    }
    return reply({ ok: false, error: 'Esta acción no forma parte de la prueba sintética.' }, 403);
  }
  return new Response(JSON.stringify({ message: 'Red externa bloqueada durante QA local.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
};

const [{ default: PlatformAdminConsole }, { AuthContext }, { ClientProvider }, { getClientConfig }, { P, LP }, { supabase }] = await Promise.all([
  import('../../src/app/features/Admin/PlatformAdminConsole'), import('../../src/contexts/AuthContext'),
  import('../../src/contexts/ClientContext'), import('../../src/clients'), import('../../src/design-system/tokens'), import('../../src/lib/supabase'),
]);
supabase.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-qa-token', user: { id: actor } } } });

export function QA() {
  const [theme, setTheme] = useState(params.get('theme') || 'dark');
  const [ownCRM, setOwnCRM] = useState(false);
  const user = { id: actor, name: 'Operador de prueba', email: 'operador@example.test', role: 'admin', organizationId: organizations[0].id, isDemo: true };
  return <AuthContext.Provider value={{ user, logout: () => setOwnCRM(true) }}><ClientProvider config={getClientConfig('tenant')}>
    {ownCRM ? <main aria-label="CRM propio de prueba" style={{ minHeight: '100vh', padding: 32, background: P.bg, color: P.txt, fontFamily: 'sans-serif' }}><h1>Mi CRM · QA local</h1><p>La salida de la consola conserva la cuenta y su empresa.</p><button onClick={() => setOwnCRM(false)}>Volver a empresas</button></main>
      : <PlatformAdminConsole initialData={initialData} T={theme === 'light' ? LP : P} theme={theme} onThemeChange={setTheme} onOpenOwnCRM={() => setOwnCRM(true)} />}
  </ClientProvider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<QA />);
