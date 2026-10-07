import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { initialClients, initialTasks, sampleReply } from '../src/guest/fixtures.js';

test('guest workspaces do not share mutable data', () => {
  const clients = initialClients();
  const tasks = initialTasks();
  clients[0].name = 'Changed locally';
  tasks[0].done = true;
  assert.equal(initialClients()[0].name, 'Alex Ejemplo');
  assert.equal(initialTasks()[0].done, false);
});

test('sample replies use only the supplied guest data', () => {
  assert.match(sampleReply('mis clientes', [], []), /0 clientes ficticios/);
  assert.match(sampleReply('tareas pendientes', [], [{ title: 'Local example', done: false }]), /Local example/);
  assert.match(sampleReply('tareas pendientes', [], [{ title: 'Local example', done: true }]), /Completaste/);
  assert.match(sampleReply('otra pregunta', [], []), /sin conexión a IA ni a datos de empresas/);
});

test('guest source is restricted to React, design tokens and its own modules', () => {
  for (const file of readdirSync('src/guest')) {
    const source = readFileSync(`src/guest/${file}`, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.ok(['react', 'react-dom/client', '../design-system/tokens', './fixtures.js', './GuestWorkspace.jsx'].includes(match[1]), `Unexpected guest dependency: ${match[1]}`);
    }
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|supabase|Capacitor)\b/, file);
  }
  const html = readFileSync('guest.html', 'utf8');
  for (const directive of ['default', 'connect', 'frame', 'worker', 'media', 'object']) {
    assert.ok(html.includes(`${directive}-src 'none'`));
  }
  assert.ok(html.includes("form-action 'none'"));
});

test('built guest entry has no authenticated application chunks', { skip: !existsSync('dist-app/guest.html') }, () => {
  const html = readFileSync('dist-app/guest.html', 'utf8');
  const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.js)"/g)].map(match => resolve('dist-app', `.${match[1]}`));
  const seen = new Set();
  function visit(path) {
    if (seen.has(path)) return;
    seen.add(path);
    assert.doesNotMatch(path, /(?:supabase|AuthContext|App-|useClient|ClientContext|native-|Copilot-)/);
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /(?:supabase\.co|organization_id|localStorage|sessionStorage|indexedDB|registerPlugin|createClient\()/);
    for (const match of source.matchAll(/(?:from|import)\s*[(']?\s*["'](\.\/[^"']+\.js)["']/g)) visit(resolve(dirname(path), match[1]));
  }
  scripts.forEach(visit);
  assert.ok(seen.size >= 4, 'Guest dependency graph was not traversed');
});
