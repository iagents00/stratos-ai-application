import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readAllRows } from '../src/lib/read-all-rows.js';

for (const cap of [200, 500, 1000]) {
  test(`cartera de 2,347 clientes: orden íntegro con límite del servidor ${cap}`, async () => {
    const source = Array.from({ length: 2347 }, (_, id) => ({ id }));
    let active = 0, peak = 0;
    const progress = [];
    const result = await readAllRows(() => ({ range: async (from, to) => {
      peak = Math.max(peak, ++active);
      // Deliberately complete the requests out of order.
      await new Promise(resolve => setTimeout(resolve, from % 3));
      active--;
      return { data: source.slice(from, Math.min(to + 1, from + cap)), error: null };
    } }), 500, { concurrency: 3, onProgress: rows => progress.push(rows) });
    assert.equal(result.error, null);
    assert.deepEqual(result.data, source);
    assert.equal(peak, 3);
    assert.equal(progress[0].length, Math.min(cap, 500));
    assert.ok(progress.length > 1);
    for (const rows of progress) assert.deepEqual(rows, source.slice(0, rows.length));
  });
}

test('un error intermedio no convierte la cartera parcial en un total completo', async () => {
  const source = Array.from({ length: 2400 }, (_, id) => ({ id }));
  const progress = [];
  const result = await readAllRows(() => ({ range: async (from, to) =>
    from === 1000 ? { error: { message: 'Sin conexión' }, data: null }
      : { data: source.slice(from, to + 1), error: null },
  }), 500, { concurrency: 3, onProgress: rows => progress.push(rows) });
  assert.equal(result.data, null);
  assert.equal(result.error.message, 'Sin conexión');
  assert.deepEqual(progress.map(rows => rows.length), [500]);
});

test('una cartera vacía termina con una sola consulta', async () => {
  let calls = 0;
  const result = await readAllRows(() => ({ range: async () => {
    calls++;
    return { data: [], error: null };
  } }), 500, { concurrency: 3 });
  assert.deepEqual(result, { data: [], error: null });
  assert.equal(calls, 1);
});

test('la app recarga por acceso, cancela respuestas viejas y muestra errores de cartera', () => {
  const app = readFileSync(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  const crm = readFileSync(new URL('../src/app/views/CRM/index.jsx', import.meta.url), 'utf8');
  assert.match(app, /\[leadsScope, fetchLeads\]/);
  assert.doesNotMatch(app, /\[user, fetchLeads\]/);
  assert.match(app, /leadsScopeRef\.current === leadsScope/);
  assert.match(app, /abortSignal\(controller\.signal\)/);
  assert.match(app, /concurrency: 3, onProgress/);
  assert.match(app, /loadError=\{leadsLoadError\}/);
  assert.match(crm, /La lista puede estar incompleta/);
});
