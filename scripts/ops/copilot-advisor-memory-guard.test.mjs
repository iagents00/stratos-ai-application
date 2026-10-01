import test from 'node:test';
import assert from 'node:assert/strict';
import { patchAdvisorInterpreter, patchAdvisorMemory } from './copilot-advisor-memory-guard.mjs';

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

test('uses interpreter-rewritten input when the original user text is still a pronoun', () => {
  const code = patchAdvisorMemory(fixture);
  const run = new Function('$input', '$', 'let tool_name="list_clients", args={input_text:"clientes de QA Asesor Uno"}, inputText=$input; ' + code);
  const result = run('¿Y cuáles clientes tiene él?', () => ({ item: { json: {
    equipo: [{ nombre: 'QA Asesor Uno' }, { nombre: 'QA Admin' }],
    ultimos_mensajes: [],
  } } }));
  assert.equal(result[0].json.args.advisor_name, 'QA Asesor Uno');
  assert.equal(result[0].json.args.asesor_name, 'QA Asesor Uno');
});

test('interpreter keeps a client-count pronoun question out of the team-task route', () => {
  const fixtureInterpreter = `
let ruta = ['redistribuir','actividades','completar','correccion','recordatorio','equipo','crm'].includes(p.ruta) ? p.ruta : 'crm';
const texto = (esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);
return [{json:{ruta,texto}}];`;
  const code = patchAdvisorInterpreter(fixtureInterpreter);
  const run = new Function('$input', '$', `let p={ruta:'equipo'},raw=$input,esConfirmacion=false,esAgendaPersonal=false,esAltaMasivaConDatos=false; ${code}`);
  const result = run('¿Y cuántos clientes tiene ella?', () => ({ item: { json: {
    equipo: [{ nombre: 'Juana Vendedora QA' }],
    ultimos_mensajes: [{ rol: 'user', texto: 'clientes de Juana Vendedora QA' }],
  } } }));
  assert.equal(result[0].json.ruta, 'crm');
  assert.equal(result[0].json.texto, 'clientes de Juana Vendedora QA');
});
