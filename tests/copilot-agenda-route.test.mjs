import test from 'node:test';
import assert from 'node:assert/strict';
import { guard, patchAgendaRoute } from '../scripts/ops/copilot-agenda-guard.mjs';

const route = new Function('raw', 'p', 'esConfirmacion', `let ruta=p.ruta;\n${guard}\nreturn {ruta,texto};`);
test('personal agenda queries remain verbatim instead of becoming a query about another person', () => {
  for (const raw of ['que tengo hoy', '¿Qué tengo hoy?', 'qué tengo mañana', 'mis pendientes', 'mi agenda', '/agenda']) {
    assert.deepEqual(route(raw, { ruta:'equipo', texto:'qué tareas tiene QA Admin' }, false), { ruta:'crm', texto:raw });
  }
});
test('the read guard never hijacks scheduling, team queries or pending confirmations', () => {
  for (const raw of ['agenda un Zoom mañana', 'qué tareas tiene Luis', 'qué tengo hoy y asigna una tarea a Luis']) {
    const p = { ruta:'actividades', texto:'interpretación original' };
    assert.deepEqual(route(raw, p, false), { ruta:p.ruta, texto:p.texto });
  }
  assert.deepEqual(route('sí', {ruta:'correccion',texto:'changed'}, true), {ruta:'crm',texto:'sí'});
});
test('patch refuses an unexpected interpreter and is idempotent', () => {
  const code = `const raw='agenda', p={}, esConfirmacion=false; let ruta='equipo';
if (esConfirmacion) ruta = 'crm';
const texto = esConfirmacion ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);
return {ruta,texto};`;
  const patched = patchAgendaRoute(code);
  assert.equal(patchAgendaRoute(patched), patched);
  assert.throws(() => patchAgendaRoute('unexpected'), /Interpreter changed/);
});
