import test from 'node:test';
import assert from 'node:assert/strict';
import { patchWriteArgsGuard } from './copilot-write-args-guard.mjs';

const fixture = `// Anti-override del backend:
return [{ json: { tool_name, args } }];`;

function run(inputText, toolName, initialArgs) {
  const code = patchWriteArgsGuard(fixture);
  return new Function('$input', '$', `let inputText=$input.inputText, tool_name=$input.toolName, args=$input.args; ${code}`)(
    { inputText, toolName, args: structuredClone(initialArgs) },
    () => { throw new Error('unexpected node lookup'); },
  )[0].json.args;
}

test('preserves a trailing visit location that the anti-override rewrite would drop', () => {
  const args = run(
    'Agenda una visita con QA-20260923-WRITES Detalle el 26/09/2026 a las 11:00 am en Oficina QA-20260923-WRITES.',
    'agendar_visita',
    { client_name: 'QA-20260923-WRITES Detalle', when: 'el 26/09/2026 a las 11:00 am' },
  );
  assert.equal(args.lugar, 'Oficina QA-20260923-WRITES');
});

test('passes the exact current phone for an expediente note and ignores QA tag digits', () => {
  const args = run(
    'Agrega al expediente del cliente con telefono 12025550202 la nota QA-20260923-WRITES nota E2E validada.',
    'add_expediente_note',
    { client_name: 'QA-20260923-WRITES Detalle', nota: 'QA note' },
  );
  assert.equal(args.phone, '12025550202');
});

test('does not overwrite explicit structured arguments', () => {
  assert.equal(run('Visita en Otro Lugar', 'agendar_visita', { lugar: 'Portofino' }).lugar, 'Portofino');
  assert.equal(run('Nota 12025550202', 'add_expediente_note', { phone: '5551234567' }).phone, '5551234567');
});

test('patch is idempotent and fails closed on topology drift', () => {
  const once = patchWriteArgsGuard(fixture);
  assert.equal(patchWriteArgsGuard(once), once);
  assert.throws(() => patchWriteArgsGuard('return [];'), /anchor changed/);
});
