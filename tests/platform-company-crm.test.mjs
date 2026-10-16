import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  COMPANY_LEAD_FIELDS, companyLeadChanged, companyLeadDraft, companyLeadPayload,
  confirmCompanyLeadResponse, confirmCompanyListResponse, validateCompanyLead,
} from '../src/app/features/Admin/platform-company-crm.mjs';

const pipeline = [{ name: 'Nuevo', color: '#00D1FF' }, { name: 'Contactado', color: '#6DD4A8' }];
const advisors = [{ id: 'advisor-a', name: 'Asesor A', role: 'asesor' }];
const original = {
  id: 'lead-a', organization_id: 'company-a', name: 'Cliente A', phone: '+52 686 123 4567',
  email: 'cliente@example.com', stage: 'Nuevo', asesor_id: 'advisor-a', presupuesto: 120000,
  next_action_at: '2026-10-17T20:35:42.123456Z', updated_at: '2026-10-16T18:22:41.123456Z',
};

test('CRM edits send only changed allowed fields and preserve exact timestamps until the date changes', () => {
  const draft = companyLeadDraft(original);
  assert.equal(companyLeadChanged(draft, original), false);
  assert.deepEqual(companyLeadPayload(draft, original), {});
  draft.name = 'Cliente editado';
  draft.role = 'super_admin';
  draft.organization_id = 'company-b';
  const patch = companyLeadPayload(draft, original);
  assert.deepEqual(patch, { name: 'Cliente editado' });
  assert.equal(original.updated_at, '2026-10-16T18:22:41.123456Z');
  assert.equal(patch.next_action_at, undefined);
  assert.ok(Object.keys(patch).every(field => COMPANY_LEAD_FIELDS.includes(field)));
  draft.next_action_at = '2026-10-20T10:25';
  assert.equal(companyLeadPayload(draft, original).next_action_at, new Date('2026-10-20T10:25').toISOString());
  draft.next_action_at = '';
  assert.equal(companyLeadPayload(draft, original).next_action_at, null);
});

test('CRM creation requires a current company advisor and stage; budgets and contact values are validated', () => {
  const draft = companyLeadDraft(original);
  assert.equal(validateCompanyLead(draft, pipeline, advisors, { creating: true }), '');
  assert.match(validateCompanyLead({ ...draft, asesor_id: 'advisor-other-company' }, pipeline, advisors, { creating: true }), /asesor activo/);
  assert.match(validateCompanyLead({ ...draft, stage: 'Etapa ajena' }, pipeline, advisors, { creating: true }), /etapa del proceso/);
  for (const value of ['-1', '3.5', 'Infinity', 'not-a-number', '9007199254740993', '']) {
    assert.match(validateCompanyLead({ ...draft, presupuesto: value }, pipeline, advisors), /número entero/);
  }
  assert.match(validateCompanyLead({ ...draft, email: 'invalid' }, pipeline, advisors), /correo electrónico válido/);
  assert.match(validateCompanyLead({ ...draft, phone: '123' }, pipeline, advisors), /7 y 15/);
  assert.match(validateCompanyLead({ ...draft, name: 'A' }, pipeline, advisors), /al menos 2/);
});

test('editing unrelated fields preserves historical stage and inactive assignment but cannot assign another company advisor', () => {
  const historic = { ...original, stage: 'Etapa retirada', asesor_id: 'inactive-advisor' };
  const draft = companyLeadDraft(historic);
  draft.notas = 'Nota nueva';
  assert.equal(validateCompanyLead(draft, pipeline, advisors, { original: historic }), '');
  assert.match(validateCompanyLead({ ...draft, asesor_id: 'other-company' }, pipeline, advisors, { original: historic }), /asesor activo/);
  assert.match(validateCompanyLead({ ...draft, stage: 'Etapa inventada' }, pipeline, advisors, { original: historic }), /etapa del proceso/);
});

test('server confirmation rejects wrong-company rows, wrong client ids and incomplete save responses', () => {
  assert.equal(confirmCompanyLeadResponse({ lead: original }, 'company-a', 'lead-a'), original);
  for (const lead of [{ ...original, organization_id: 'company-b' }, { ...original, id: 'another-lead' }, { ...original, updated_at: null }, null]) {
    assert.throws(() => confirmCompanyLeadResponse({ lead }, 'company-a', 'lead-a'), /No se pudo confirmar/);
  }
  const response = { organization: { id: 'company-a' }, leads: [original], total: 1 };
  assert.equal(confirmCompanyListResponse(response, 'company-a'), response);
  assert.throws(() => confirmCompanyListResponse(response, 'company-b'), /verificar la cartera/);
  assert.throws(() => confirmCompanyListResponse({ ...response, leads: [{ ...original, organization_id: 'company-b' }] }, 'company-a'), /verificar la cartera/);
});

test('company CRM shows an explicit authorized-company selector and never falls back to an unauthorized initial company', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false } });
  try {
    const { default: PlatformCompanyCRM } = await vite.ssrLoadModule('/src/app/features/Admin/PlatformCompanyCRM.jsx');
    const { P } = await vite.ssrLoadModule('/src/design-system/tokens.js');
    const organizations = [{ id: 'company-a', name: 'Empresa A' }, { id: 'company-b', name: 'Empresa B' }];
    const render = props => renderToStaticMarkup(createElement(PlatformCompanyCRM, { T: P, actorId: 'operator', organizations, ...props }));
    const neutral = render({ initialOrganizationId: 'unauthorized' });
    assert.match(neutral, /Selecciona una empresa/);
    assert.match(neutral, /Empresa A/);
    assert.match(neutral, /Empresa B/);
    assert.doesNotMatch(neutral, /unauthorized|Cargando clientes/);
    const selected = render({ initialOrganizationId: 'company-b' });
    assert.match(selected, /value="company-b" selected/);
    assert.match(selected, /Cargando clientes/);
    assert.doesNotMatch(render({ actorId: '' }), /Cargando clientes/);
  } finally { await vite.close(); }
});
