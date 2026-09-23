import test from 'node:test';
import assert from 'node:assert/strict';
import { patchAdvisorMemory } from './copilot-advisor-memory-guard.mjs';

const fixture = 'return [{ json: { tool_name, args } }];';

test('resolves advisor pronoun from the most recent user turn and live team', () => {
  const code = patchAdvisorMemory(fixture);
  const run = new Function('$input', '$', 'let tool_name="list_clients", args={}, inputText=$input; ' + code);
  const result = run('¿Y cuántos clientes tiene ella?', name => {
    assert.equal(name, 'Contexto Reciente');
    return { item: { json: {
      equipo: [{ nombre: 'Juana Vendedora QA' }, { nombre: 'QA Admin' }],
      ultimos_mensajes: [
        { rol: 'user', texto: '¿Qué clientes tiene Juana Vendedora QA?' },
        { rol: 'ai', texto: 'Tiene diez.' },
        { rol: 'user', texto: '¿Y cuántos clientes tiene ella?' },
      ],
    } } };
  });
  assert.equal(result[0].json.args.advisor_name, 'Juana Vendedora QA');
  assert.equal(result[0].json.args.input_text, 'clientes de Juana Vendedora QA');
});

test('does not rewrite an explicit advisor request', () => {
  const code = patchAdvisorMemory(fixture);
  const run = new Function('$input', '$', 'let tool_name="list_clients", args={advisor_name:"QA Admin"}, inputText=$input; ' + code);
  const result = run('¿Cuántos clientes tiene ella?', () => { throw new Error('context should not be read'); });
  assert.equal(result[0].json.args.advisor_name, 'QA Admin');
});

test('extracts an explicitly named teammate even when the model omits advisor_name', () => {
  const code = patchAdvisorMemory(fixture);
  const run = new Function('$input', '$', 'let tool_name="list_clients", args={input_text:$input}, inputText=$input; ' + code);
  const result = run('clientes de QA Asesor Uno', () => ({ item: { json: {
    equipo: [{ nombre: 'QA Asesor Uno' }, { nombre: 'QA Admin' }],
    ultimos_mensajes: [],
  } } }));
  assert.equal(result[0].json.args.advisor_name, 'QA Asesor Uno');
  assert.equal(result[0].json.args.input_text, 'clientes de QA Asesor Uno');
});
