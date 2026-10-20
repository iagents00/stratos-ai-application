import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { clearCommonEntryViews, isCommonEntryLocation, readCommonEntryView, writeCommonEntryView } from '../src/lib/common-entry.js';

function tabStorage() {
  const values = new Map();
  return { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const viewOptions = storage => ({ location: new URL('https://getstratosai.com/login'), storage,
  canAccess: view => ['c', 'd', 'mkt_reporte', 'admin'].includes(view),
  isPersistable: view => !['admin', 'planes', 'miespacio'].includes(view) });

test('common views belong to each tab and legacy markers start in CRM without consulting shared preferences', () => {
  const crmTab = tabStorage();
  const otherTab = tabStorage();
  const globalPreferences = tabStorage();
  globalPreferences.setItem('stratos.crm.view.person', 'mkt_reporte');
  crmTab.setItem('stratos.common-entry.person', '1');
  assert.equal(readCommonEntryView('person', viewOptions(crmTab)), 'c');
  assert.equal(writeCommonEntryView('person', 'c', viewOptions(crmTab)), true);
  assert.equal(writeCommonEntryView('person', 'mkt_reporte', viewOptions(otherTab)), true);
  for (let refresh = 0; refresh < 3; refresh++) {
    globalPreferences.setItem('stratos.crm.view.person', 'mkt_reporte');
    assert.equal(readCommonEntryView('person', viewOptions(crmTab)), 'c');
    assert.equal(readCommonEntryView('person', viewOptions(otherTab)), 'mkt_reporte');
  }
  writeCommonEntryView('person', 'd', viewOptions(crmTab));
  assert.equal(readCommonEntryView('person', viewOptions(crmTab)), 'd');
  assert.equal(readCommonEntryView('another-person', viewOptions(crmTab)), 'c');
  const branded = { ...viewOptions(crmTab), location: new URL('https://getstratosai.com/nsg') };
  assert.equal(readCommonEntryView('person', branded), null);
  assert.equal(writeCommonEntryView('person', 'c', branded), false);
  assert.equal(crmTab.getItem('stratos.common-entry.person'), 'd');
  assert.equal(globalPreferences.getItem('stratos.crm.view.person'), 'mkt_reporte');
});

test('tab restoration reevaluates permissions and never replaces a real view with an ephemeral one', () => {
  const storage = tabStorage();
  const options = viewOptions(storage);
  writeCommonEntryView('person', 'd', options);
  for (const view of ['admin', 'planes', 'miespacio', 'unknown', '1']) assert.equal(writeCommonEntryView('person', view, options), false, view);
  assert.equal(readCommonEntryView('person', options), 'd');
  assert.equal(readCommonEntryView('person', { ...options, canAccess: view => view === 'c' }), 'c');
  assert.equal(readCommonEntryView('person', { ...options, canAccess: view => view === 'mkt_reporte' }), null);
  writeCommonEntryView('marketing', 'mkt_reporte', options);
  assert.equal(readCommonEntryView('marketing', { ...options, canAccess: view => view === 'mkt_reporte' }), 'mkt_reporte');
  assert.equal(readCommonEntryView(null, options), null);
});

test('explicit logout clears common tab views while preserving other session state; unavailable storage stays safe', () => {
  const storage = tabStorage();
  storage.setItem('stratos.common-entry.person', 'c');
  storage.setItem('stratos.common-entry.other', '1');
  storage.setItem('unrelated-session-state', 'preserved');
  clearCommonEntryViews(storage);
  assert.equal(storage.getItem('stratos.common-entry.person'), null);
  assert.equal(storage.getItem('stratos.common-entry.other'), null);
  assert.equal(storage.getItem('unrelated-session-state'), 'preserved');
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, get length() { throw new Error('blocked'); } };
  assert.equal(readCommonEntryView('person', viewOptions(unavailable)), 'c');
  assert.equal(writeCommonEntryView('person', 'd', viewOptions(unavailable)), false);
  assert.doesNotThrow(() => clearCommonEntryViews(unavailable));
});

test('shared login keeps a stable entry while client-specific paths, domains and public routes remain separate', () => {
  for (const url of [
    'https://getstratosai.com/login',
    'https://app.stratoscapitalgroup.com/login/?client=nsg',
    'https://app.tgenius.com/login',
    'http://localhost:5173/login',
    'https://app.getstratosai.com/',
    'https://app.stratoscapitalgroup.com/?app',
    'https://stratos-preview.vercel.app/',
    'http://localhost:5173/?app',
  ]) assert.equal(isCommonEntryLocation(new URL(url)), true, url);
  for (const url of [
    'https://getstratosai.com/nsg',
    'https://getstratosai.com/tenant',
    'https://getstratosai.com/?client=grupo28',
    'https://app.tgenius.com/',
    'https://nsg.getstratosai.com/',
    'https://www.getstratosai.com/',
    'https://getstratosai.com/',
    'https://getstratosai.com/p',
    'https://getstratosai.com/privacy-policy',
    'http://localhost:5173/',
  ]) assert.equal(isCommonEntryLocation(new URL(url)), false, url);
});

test('shared entry applies the authenticated company in memory, never a requested company or a profile reassignment', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { getClientConfig, resolveClientFromLocation, resolveClientTransitionForUser, resolveRedirectForUser } = await vite.ssrLoadModule('/src/clients/index.js');
    const { nav, canAccessModule } = await vite.ssrLoadModule('/src/app/constants/navigation.js');
    const storage = tabStorage();
    const stratosAdmin = { id: 'admin-stratos', role: 'admin', organizationId: getClientConfig('duke').tenant.organizationId };
    const options = { ...viewOptions(storage), canAccess: view => canAccessModule(view, stratosAdmin, getClientConfig('duke')),
      isPersistable: view => !['admin', 'planes', 'miespacio'].includes(view) && nav.some(item => item.id === view) };
    storage.setItem('stratos.common-entry.admin-stratos', 'removed-view');
    assert.equal(readCommonEntryView(stratosAdmin.id, options), 'c', 'an obsolete module must never restore an empty shell, even with administrator permissions');
    assert.equal(writeCommonEntryView(stratosAdmin.id, 'removed-view', options), false);
    const known = Object.freeze({ id: 'ordinary-user', role: 'asesor', organizationId: getClientConfig('nsg').tenant.organizationId });
    const entry = new URL('https://getstratosai.com/login?client=grupo28#crm');
    assert.equal(resolveClientFromLocation(entry).id, 'tenant');
    assert.deepEqual(resolveClientTransitionForUser(known, 'tenant', entry), { clientId: 'nsg', inMemory: true, redirectUrl: null });
    assert.equal(resolveRedirectForUser(known, 'tenant', entry), null);
    assert.equal(resolveClientTransitionForUser(known, 'nsg', entry), null);
    assert.equal(entry.href, 'https://getstratosai.com/login?client=grupo28#crm');
    assert.equal(known.organizationId, getClientConfig('nsg').tenant.organizationId);

    const newCompany = { ...known, organizationId: 'new-managed-company' };
    assert.deepEqual(resolveClientTransitionForUser(newCompany, 'nsg', entry), { clientId: 'tenant', inMemory: true, redirectUrl: null });
    assert.equal(resolveClientTransitionForUser(null, 'tenant', entry), null);
    assert.equal(resolveClientTransitionForUser({ ...known, _offline: true }, 'tenant', entry), null);
    assert.deepEqual(resolveClientTransitionForUser({ id: 'demo-user-local', isDemo: true }, 'tenant', entry), { clientId: 'duke', inMemory: true, redirectUrl: null });
    assert.equal(resolveClientTransitionForUser({ id: 'unverified', isDemo: true }, 'tenant', entry), null);

    const branded = new URL('https://getstratosai.com/grupo28?app#crm');
    assert.equal(resolveClientFromLocation(branded).id, 'grupo28');
    assert.deepEqual(resolveClientTransitionForUser(known, 'grupo28', branded), { clientId: 'nsg', inMemory: false, redirectUrl: 'https://getstratosai.com/nsg?app#crm' });
    assert.equal(resolveClientFromLocation(new URL('https://app.tgenius.com/')).id, 'tgenius');
    assert.deepEqual(resolveClientTransitionForUser(known, 'duke', new URL('capacitor://localhost/'), { native: true }), { clientId: 'nsg', inMemory: true, redirectUrl: null });
  } finally { await vite.close(); }
});
