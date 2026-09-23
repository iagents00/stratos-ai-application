import test from 'node:test';
import assert from 'node:assert/strict';
import { patchBulkInterpreter, patchBulkPick } from './copilot-bulk-raw-guard.mjs';

const interpreterFixture = `
const esAgendaPersonal = /^(?:\\/?agenda|mi agenda|mis pendientes|que tengo (?:hoy|manana|pendiente|pendientes))$/.test(agendaQuery);
if (esConfirmacion || esAgendaPersonal) ruta = 'crm';
const texto = (esConfirmacion || esAgendaPersonal) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);
`;
const pickFixture = `
if (typeof args.input_text !== 'string' || !args.input_text) args.input_text = inputText;
return [{ json: { tool_name, args } }];
`;

test('interpreter guard is scoped and idempotent', () => {
  const once = patchBulkInterpreter(interpreterFixture);
  assert.match(once, /esAltaMasivaConDatos/);
  assert.equal(patchBulkInterpreter(once), once);
});

test('picker discards stale model leads and structures the exact current raw message', () => {
  const once = patchBulkPick(pickFixture);
  assert.match(once, /tool_name = 'bulk_register'/);
  assert.match(once, /currentLeads = _parseCurrentBulkLeads\(inputText\)/);
  assert.equal(patchBulkPick(once), once);
});

test('guard requires at least two name-phone rows', () => {
  const code = patchBulkPick(pickFixture)
    .replace("return [{ json: { tool_name, args } }];", "return [{ json: { tool_name, args, detected: _looksLikeBulkLeadInput(inputText) } }];");
  const run = new Function('$input', '$', 'let tool_name="menu", args={}, inputText=$input; ' + code);
  const bulk = run('Nombre: Fabiola Uno | Teléfono: +1 202 555 0150\nNombre: Gabriel Dos | Teléfono: +1 202 555 0151');
  assert.equal(bulk[0].json.detected, true);
  assert.equal(bulk[0].json.tool_name, 'bulk_register');
  assert.deepEqual(bulk[0].json.args, {
    leads: [
      { name: 'Fabiola Uno', phone: '12025550150' },
      { name: 'Gabriel Dos', phone: '12025550151' },
    ],
    input_text: 'Nombre: Fabiola Uno | Teléfono: +1 202 555 0150\nNombre: Gabriel Dos | Teléfono: +1 202 555 0151',
  });
  const single = run('Nombre: Único | Teléfono: +57 300 123 4567');
  assert.equal(single[0].json.detected, false);
});

test('guard ignores numeric QA tags and supports phone-first Emmanuel exports', () => {
  const code = patchBulkPick(pickFixture)
    .replace("return [{ json: { tool_name, args } }];", "return [{ json: { tool_name, args } }];");
  const run = new Function('$input', '$', 'let tool_name="menu", args={}, inputText=$input; ' + code);
  const tagged = run('Nombre: [QA-20260923-BULK] P01 Alba Prueba | Teléfono: +1 202-555-0160\nNombre: [QA-20260923-BULK] P02 Beto Prueba | Teléfono: +1 202-555-0161');
  assert.equal(tagged[0].json.args.leads.length, 2);
  assert.deepEqual(tagged[0].json.args.leads.map(x => x.phone), ['12025550160', '12025550161']);
  const phoneFirst = run('300 555 0101 Ana Ruiz BAY VIEW GRAND\n300 555 0102 Bruno Díaz BAY VIEW GRAND\nESTOS LEADS ASIGNAMELOS A CONTACTAME YA');
  assert.deepEqual(phoneFirst[0].json.args.leads, [
    { name: 'Ana Ruiz', phone: '3005550101', campaign: 'BAY VIEW GRAND' },
    { name: 'Bruno Díaz', phone: '3005550102', campaign: 'BAY VIEW GRAND' },
  ]);
});

test('phone-first arrows do not contaminate names and campaign is preserved', () => {
  const code = patchBulkPick(pickFixture);
  const run = new Function('$input', '$', 'let tool_name="menu", args={}, inputText=$input; ' + code);
  const result = run('+1 202-555-0301 → [QA-20260923-BULK] S01 Flora Prueba → BAY VIEW GRAND\n+1 202-555-0302 → [QA-20260923-BULK] S02 Gael Prueba → BAY VIEW GRAND', () => ({}));
  assert.deepEqual(result[0].json.args.leads, [
    { name: 'S01 Flora Prueba', phone: '12025550301', campaign: 'BAY VIEW GRAND' },
    { name: 'S02 Gael Prueba', phone: '12025550302', campaign: 'BAY VIEW GRAND' },
  ]);
});

test('assign-to-self uses only current authenticated writer from context', () => {
  const code = patchBulkPick(pickFixture);
  const currentInput = '300 555 0201 Ana Ruiz BAY VIEW GRAND\n300 555 0202 Bruno Díaz BAY VIEW GRAND\nESTOS LEADS ASIGNAMELOS A CONTACTAME YA';
  const run = new Function('$input', '$', 'let tool_name="menu", args={}, inputText=$input; ' + code);
  const result = run(currentInput, name => {
    assert.equal(name, 'Contexto Reciente');
    return { item: { json: { quien_escribe: 'Emmanuel Ortiz' } } };
  });
  assert.equal(result[0].json.args.target_asesor, 'Emmanuel Ortiz');
  assert.equal(result[0].json.args.asesor_name, 'Emmanuel Ortiz');
  assert.equal(result[0].json.args.leads.length, 2);
});

test('single-line tab export parses every tuple and sends the live dispatcher key', () => {
  const code = patchBulkPick(pickFixture);
  const run = new Function('$input', '$', 'let tool_name="menu", args={}, inputText=$input; ' + code);
  const input = '12025550401\tTino Prueba BAY VIEW GRAND\t12025550402\tGeo Prueba BAY VIEW GRAND\t12025550403\tJorge Ramos BAY VIEW GRAND\tESTOS LEADS ASIGNAMELOS A CONTACTAME YA';
  const result = run(input, () => ({ item: { json: { quien_escribe: 'QA Admin' } } }));
  assert.deepEqual(result[0].json.args.leads, [
    { name: 'Tino Prueba', phone: '12025550401', campaign: 'BAY VIEW GRAND' },
    { name: 'Geo Prueba', phone: '12025550402', campaign: 'BAY VIEW GRAND' },
    { name: 'Jorge Ramos', phone: '12025550403', campaign: 'BAY VIEW GRAND' },
  ]);
  assert.equal(result[0].json.args.asesor_name, 'QA Admin');
});

test('explicit list stage move uses the dedicated bulk-stage RPC path', () => {
  const code = patchBulkPick(pickFixture);
  const run = new Function('$input', '$', 'let tool_name="menu", args={}, inputText=$input; ' + code);
  const input = 'Mueve estos clientes a Seguimiento:\nAna Uno, 12025550501\nBruno Dos, 12025550502';
  const result = run(input, () => ({}));
  assert.equal(result[0].json.tool_name, 'bulk_change_stage');
  assert.deepEqual(result[0].json.args.clients, ['12025550501', '12025550502']);
  assert.equal(result[0].json.args.stage, 'Seguimiento');
});

test('assign-to-self and first stage remains owner-and-stage bulk register', () => {
  const code = patchBulkPick(pickFixture);
  const run = new Function('$input', '$', 'let tool_name="menu", args={}, inputText=$input; ' + code);
  const input = '12025550601\tAna Uno BAY VIEW GRAND\t12025550602\tBruno Dos BAY VIEW GRAND\tESTOS LEADS ASIGNAMELOS A CONTACTAME YA';
  const result = run(input, () => ({ item: { json: { quien_escribe: 'QA Admin' } } }));
  assert.equal(result[0].json.tool_name, 'bulk_register');
  assert.equal(result[0].json.args.asesor_name, 'QA Admin');
});
