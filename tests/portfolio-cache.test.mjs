import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { createPortfolioCache } from '../src/lib/portfolio-cache.js';

const setup = (options = {}) => {
  const database = new IDBFactory();
  return createPortfolioCache({ database: () => database, ...options });
};
const rows = Array.from({ length: 2347 }, (_, i) => ({ id: `lead-${i}`, tasks: [{ title: 'Seguimiento' }], score: i % 100 }));

test('restores all 2,347 records and nested fields without a localStorage row cap', async () => {
  const cache = setup();
  assert.equal(await cache.scope('user:org:admin').write(rows), true);
  assert.deepEqual(await cache.scope('user:org:admin').read(), rows);
});

test('snapshots are separated by user, organization and role', async () => {
  const cache = setup();
  await cache.scope('a:org1:admin').write(rows);
  for (const key of ['b:org1:admin', 'a:org2:admin', 'a:org1:asesor']) {
    assert.equal(await cache.scope(key).read(), null);
  }
});

test('expired snapshots are ignored; an empty successful portfolio replaces old data', async () => {
  let clock = 1000;
  const cache = setup({ now: () => clock, ttl: 500 });
  const scope = cache.scope('a');
  await scope.write(rows);
  clock += 501;
  assert.equal(await scope.read(), null);
  await scope.write([]);
  assert.deepEqual(await scope.read(), []);
});

test('logout removes snapshots and rejects writes from old in-flight sessions', async () => {
  const cache = setup();
  const old = cache.scope('a');
  const pending = old.write(rows);
  const cleared = cache.clear();
  await Promise.all([pending, cleared, old.write(rows)]);
  assert.equal(await old.read(), null);
  const fresh = cache.scope('a');
  assert.equal(await fresh.read(), null);
  await fresh.write(rows);
  assert.deepEqual(await fresh.read(), rows);
});

test('unavailable or blocked browser storage falls back without throwing or waiting forever', async () => {
  const absent = createPortfolioCache({ database: () => undefined });
  assert.equal(await absent.scope('a').read(), null);
  assert.equal(await absent.scope('a').write(rows), null);
  const denied = createPortfolioCache({ database: () => { throw new Error('Private mode'); } });
  assert.equal(await denied.scope('a').read(), null);
  const blocked = createPortfolioCache({ database: () => ({ open: () => ({}) }), timeout: 10 });
  assert.equal(await blocked.scope('a').read(), null);
});

test('cache is an optional parallel read; incomplete portfolios cannot replace it', () => {
  const app = readFileSync(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../src/contexts/AuthContext.jsx', import.meta.url), 'utf8');
  assert.match(app, /void fullPortfolioCache\.read\(\)\.then/);
  assert.match(app, /current\(\) && !networkPainted/);
  assert.match(app, /completePortfolioScope\.current !== leadsScope \|\| leadsRefreshing \|\| leadsLoadError/);
  assert.match(auth, /void portfolioCache\.clear\(\);\s*await signOut\(\)/);
});
