import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { isCommonEntryLocation } from '../src/lib/common-entry.js';

test('shared login keeps a stable entry while client-specific paths, domains and public routes remain separate', () => {
  for (const url of [
    'https://getstratosai.com/login',
    'https://app.stratoscapitalgroup.com/login/?client=nsg',
    'https://app.tgenius.com/login',
    'http://localhost:5173/login',
    'https://getstratosai.com/',
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
    'https://getstratosai.com/p',
    'https://getstratosai.com/privacy-policy',
    'http://localhost:5173/',
  ]) assert.equal(isCommonEntryLocation(new URL(url)), false, url);
});

test('shared entry applies the authenticated company in memory, never a requested company or a profile reassignment', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { getClientConfig, resolveClientFromLocation, resolveClientTransitionForUser, resolveRedirectForUser } = await vite.ssrLoadModule('/src/clients/index.js');
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
