import test from 'node:test';
import assert from 'node:assert/strict';
import { HuliClient, parseHuliCommand, requireAllowedPair } from '../supabase/functions/_shared/huli.mjs';
const config = { apiKey: 'test-secret', organizationId: '123', allowedPairs: [{ doctorId: '10', clinicId: '20' }] };
const command = parseHuliCommand('huli disponibilidad 10 20 2026-10-01T08:00:00-07:00 2026-10-02T08:00:00-07:00');
test('routes only explicit Huli commands and validates dates/ranges', () => {
  assert.equal(parseHuliCommand('agenda una cita'), null);
  assert.equal(parseHuliCommand('huli estado').action, 'estado');
  assert.equal(command.action, 'disponibilidad');
  for (const value of ['huli disponibilidad 10 20 yesterday tomorrow', 'huli disponibilidad 10 20 2026-10-02T00:00:00Z 2026-10-01T00:00:00Z', 'huli disponibilidad 10 20 2026-10-01T00:00:00Z 2026-12-01T00:00:00Z', 'huli borrar todo']) assert.equal(parseHuliCommand(value).action, 'ayuda');
});
test('doctor and clinic must both belong to the provisioned pair', () => {
  assert.doesNotThrow(() => requireAllowedPair(config, command));
  assert.throws(() => requireAllowedPair(config, { ...command, clinicId: '21' }), /no están habilitados/);
  assert.throws(() => requireAllowedPair({ ...config, allowedPairs: [] }, command));
});
test('authenticates server-side and scopes every GET; returns only slot timestamps', async () => {
  const calls = [];
  const client = new HuliClient(config, async (url, options) => {
    calls.push({url,options});
    const data = url.endsWith('/authorization/token') ? { data: { jwt: 'test-jwt' } } : url.endsWith('/organization') ? { organizations: [{ idOrganization: '123', name: 'Clinic', status: 'ACTIVE' }] } : { idDoctor: '10', idClinic: '20', slotDates: [{ slots: [{ dateTime: '2026-10-01T10:00:00Z', privateField: 'omit' }] }] };
    return Response.json(data);
  });
  assert.deepEqual(await client.availability(command), ['2026-10-01T10:00:00Z']);
  assert.equal(JSON.parse(calls[0].options.body).api_key, 'test-secret');
  for (const call of calls.slice(1)) { assert.equal(call.options.headers.id_organization, '123'); assert.equal(call.options.headers.Authorization, 'Bearer test-jwt'); assert.equal(call.options.method, undefined); }
});
test('rejects wrong organizations and inactive organizations', async () => {
  for (const org of [{ idOrganization: '124', status: 'ACTIVE' }, { idOrganization: '123', status: 'DISABLED' }]) {
    const client = new HuliClient(config, async url => Response.json(url.endsWith('/authorization/token') ? { data: { jwt: 'jwt' } } : { organizations: [org] }));
    await assert.rejects(client.status(), /no está activa/);
  }
});
test('rejects cross-clinic availability responses', async () => {
  const client = new HuliClient(config, async url => Response.json(url.endsWith('/authorization/token') ? { data: { jwt: 'jwt' } } : url.endsWith('/organization') ? { organizations: [{ idOrganization: '123', status: 'ACTIVE' }] } : { idDoctor: '10', idClinic: '99', slotDates: [] }));
  await assert.rejects(client.availability(command), /fuera del alcance/);
});
test('provider errors never expose raw credentials or upstream payloads', async () => {
  const client = new HuliClient(config, async () => new Response('test-secret', { status: 401 }));
  await assert.rejects(client.status(), error => !error.message.includes('test-secret') && error.status === 503);
});
