import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { updateMarketingRecord } from '../src/lib/marketing-records.mjs';

function database(rows, failure = null) {
  const calls = [];
  let table, fields;
  const filters = new Map();
  const query = {
    update(value) { fields = value; calls.push(['update', value]); return this; },
    eq(key, value) { filters.set(key, value); calls.push(['eq', key, value]); return this; },
    select(value) { calls.push(['select', value]); return this; },
    async single() {
      if (failure) return { data: null, error: failure };
      const matching = rows.filter(row => Object.entries(Object.fromEntries(filters)).every(([k, v]) => row[k] === v));
      if (matching.length !== 1) return { data: null, error: null };
      Object.assign(matching[0], fields);
      return { data: { id: matching[0].id }, error: null };
    },
  };
  return { calls, from(name) { table = name; calls.push(['from', table]); return query; } };
}

test('marketing saves only the requested organization and confirms the saved record', async () => {
  const rows = [{ id: 'task', organization_id: 'duke', estado: 'por_hacer' }];
  const db = database(rows);
  const result = await updateMarketingRecord(db, 'mkt_tasks', 'task', 'duke', { estado: 'hecha' });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, { id: 'task' });
  assert.equal(rows[0].estado, 'hecha');

  const denied = await updateMarketingRecord(db, 'mkt_tasks', 'task', 'another-tenant', { estado: 'en_curso' });
  assert.ok(denied.error);
  assert.equal(rows[0].estado, 'hecha');
});

test('a missing or RLS-hidden marketing record cannot be reported as saved', async () => {
  const empty = await updateMarketingRecord(database([]), 'mkt_pipeline_items', 'missing', 'duke', { nombre: 'Edición' });
  assert.ok(empty.error);
  const failure = { code: '42501', message: 'Denied' };
  const rejected = await updateMarketingRecord(database([], failure), 'mkt_daily_reports', 'report', 'duke', { texto: 'Mi reporte' });
  assert.equal(rejected.error, failure);
});

test('marketing edits require organization identity and cannot target other business tables', async () => {
  const db = database([]);
  for (const [table, id, org] of [['mkt_tasks', 'task', null], ['mkt_tasks', null, 'duke'], ['profiles', 'user', 'duke']]) {
    assert.ok((await updateMarketingRecord(db, table, id, org, { role: 'admin' })).error);
  }
  assert.equal(db.calls.length, 0);
});

test('marketing leader and team have their own working space with tenant isolation', async () => {
  const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  try {
    const { canAccessModule, STRATOS_ORG_ID } = await server.ssrLoadModule('/src/app/constants/navigation.js');
    const { getClientConfig } = await server.ssrLoadModule('/src/clients/index.js');
    const cfg = getClientConfig('duke');
    const leader = { role: 'super_admin', isMarketingAdmin: true, organizationId: STRATOS_ORG_ID };
    const member = { role: 'marketing', organizationId: STRATOS_ORG_ID };
    for (const user of [leader, member]) {
      for (const module of ['plan', 'mkt_reporte', 'mkt_marcas', 'mkt_pipe', 'mkt_sol', 'midrive', 'copilot', 'e', 'perfil']) {
        assert.equal(canAccessModule(module, user, cfg), true, `${user.role}/${module}`);
      }
      for (const module of ['c', 'd', 'fa', 'admin', 'wa']) {
        assert.equal(canAccessModule(module, user, cfg), false, `${user.role}/${module}`);
      }
    }
    assert.equal(canAccessModule('mkt_equipo', leader, cfg), true);
    assert.equal(canAccessModule('mkt_equipo', member, cfg), false);
    const outside = { ...member, organizationId: 'other-org' };
    for (const module of ['mkt_reporte', 'mkt_pipe', 'mkt_marcas', 'midrive', 'e']) {
      assert.equal(canAccessModule(module, outside, getClientConfig('tenant')), false, module);
    }
  } finally {
    await server.close();
  }
});

test('live marketing agenda stays empty without fake work and resolves ownership by id', async () => {
  const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  try {
    const { default: MetaPanel, DEFAULT_META_PLAN, DEFAULT_META_PROTOCOL } = await server.ssrLoadModule('/src/app/features/MetaPanel/index.jsx');
    const { P } = await server.ssrLoadModule('/src/design-system/tokens.js');
    const user = { id: 'yaz', name: 'Yazmin Ledesma', role: 'marketing', organizationId: 'duke' };
    const props = {
      open: true, metaTab: 'acciones', marketingMode: true, user, T: P,
      metaActions: [], metaNewText: '', metaDocs: [], leadsData: [],
      metaPlan: DEFAULT_META_PLAN, metaProtocol: DEFAULT_META_PROTOCOL,
    };
    const render = (overrides = {}) => renderToStaticMarkup(createElement(MetaPanel, { ...props, ...overrides }));
    const empty = render();
    assert.match(empty, /Todo al día/);
    assert.doesNotMatch(empty, /DEMO ·|Revisar campañas activas/);
    const populated = render({ metaActions: [
      { id: 'own', asesor_id: user.id, asesor: 'Nombre anterior', text: 'Mi entrega real', done: false },
      { id: 'other', asesor_id: 'another-person', asesor: user.name, text: 'Entrega ajena', done: false },
    ] });
    assert.match(populated, /Mi entrega real/);
    assert.doesNotMatch(populated, /Entrega ajena/);
    assert.match(render({ user: { ...user, isDemo: true } }), /Revisar campañas activas/);
  } finally {
    await server.close();
  }
});
