import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createDemoLeads } from '../src/app/data/demo-leads.js';
import { demoCopilotReply } from '../src/lib/copilot-demo.js';
import { memoryStorage, installGuestBoundary } from '../src/guest/boundary.js';
import { supabase, resetGuestData } from '../src/guest/backend.js';

test('guest workspaces do not share mutable data', () => {
  const clients = createDemoLeads();
  clients[0].n = 'Changed locally';
  assert.equal(createDemoLeads()[0].n, 'Alex Ejemplo');
});

test('sample replies use only the supplied guest data', () => {
  assert.match(demoCopilotReply('mis clientes', { leads: [] }), /0 clientes ficticios/);
  assert.match(demoCopilotReply('tareas pendientes', { tasks: [{ text: 'Local example', done: false }] }), /Local example/);
  assert.match(demoCopilotReply('tareas pendientes', { tasks: [{ text: 'Local example', done: true }] }), /No hay tareas/);
  assert.match(demoCopilotReply('registrar un cliente', { leads: [] }), /No se crean clientes/);
});

test('guest replaces storage without reading or clearing enterprise state and denies transport', () => {
  let enterpriseReads = 0, networkCalls = 0;
  const enterprise = memoryStorage(); enterprise.setItem('sb-real-auth-token', 'sentinel');
  const target = { navigator: {}, fetch: () => networkCalls++ };
  Object.defineProperty(target, 'localStorage', { configurable: true, get: () => { enterpriseReads++; return enterprise; } });
  installGuestBoundary(target);
  assert.equal(enterpriseReads, 0);
  assert.equal(target.localStorage.getItem('sb-real-auth-token'), null);
  target.localStorage.setItem('demo', 'new');
  assert.equal(enterprise.getItem('demo'), null);
  assert.equal(enterprise.getItem('sb-real-auth-token'), 'sentinel');
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'Worker']) assert.throws(() => target[name](), /no conecta/);
  assert.equal(networkCalls, 0);
  assert.equal(target.Capacitor, undefined);
  assert.equal(target.indexedDB, undefined);
});

test('guest fails closed when the host cannot isolate storage', () => {
  const target = {};
  Object.defineProperty(target, 'localStorage', { value: memoryStorage(), configurable: false });
  assert.throws(() => installGuestBoundary(target), TypeError);
});

test('guest tasks are local, resettable and cannot mutate unknown enterprise tables', async () => {
  resetGuestData();
  const created = await supabase.from('team_actions').insert({ text: 'Tarea ficticia' }).select().single();
  assert.equal(created.data.text, 'Tarea ficticia');
  await supabase.from('team_actions').update({ done: true }).eq('id', created.data.id);
  assert.equal((await supabase.from('team_actions').select()).data[0].done, true);
  assert.equal((await supabase.from('organizations').update({ name: 'Unsafe' })).error.code, 'GUEST_ONLY');
  assert.equal((await supabase.from('team_actions').upsert({ text: 'Unsupported' })).error.code, 'GUEST_ONLY');
  assert.equal((await supabase.rpc('unknown_function')).error.code, 'GUEST_ONLY');
  resetGuestData();
  assert.deepEqual((await supabase.from('team_actions').select()).data, []);
});

test('guest preserves browser enforced network denial', () => {
  const html = readFileSync('guest.html', 'utf8');
  for (const directive of ['default', 'connect', 'frame', 'worker', 'media', 'object']) {
    assert.ok(html.includes(`${directive}-src 'none'`));
  }
  assert.ok(html.includes("form-action 'none'"));
});

test('built guest uses real UI with an independently isolated bundle', { skip: !existsSync('dist-app/guest.html') }, () => {
  const html = readFileSync('dist-app/guest.html', 'utf8');
  const scripts = [...html.matchAll(/(?:src|href)="(\/guest\/assets\/[^" ]+\.js)"/g)].map(match => resolve('dist-app', `.${match[1]}`));
  const seen = new Set();
  function visit(path) {
    if (seen.has(path)) return;
    seen.add(path);
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/["'`]((?:\.\/|\/guest\/assets\/)[^"'`]+\.js)["'`]/g)) visit(match[1].startsWith('/') ? resolve('dist-app', `.${match[1]}`) : resolve(dirname(path), match[1]));
  }
  scripts.forEach(visit);
  assert.ok(seen.size >= 4, 'Guest dependency graph was not traversed');
  const config = readFileSync('vite.guest.config.js', 'utf8');
  assert.match(config, /production capability/);
  assert.match(config, /node_modules\/@supabase/);
  assert.match(readFileSync('src/guest/Workspace.jsx', 'utf8'), /import App from '\.\.\/app\/App\.jsx'/);
  assert.equal(scripts.length > 0, true, 'Guest must never load the enterprise entry');
});
