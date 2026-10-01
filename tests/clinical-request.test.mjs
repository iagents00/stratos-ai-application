import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicalTrace, parseClinicalBody, readClinicalBody } from '../server/clinical-request.mjs';

test('platform lazy JSON parser failures are returned as client errors', () => {
  const req = { get body() { throw new Error('upstream parser details must not escape'); } };
  assert.throws(() => readClinicalBody(req), error => error.status === 400 && !error.message.includes('upstream'));
});

test('clinical request rejects malformed or non-object JSON with client errors', () => {
  for (const body of ['{broken', 'null', '[]', '"text"', '1', []])
    assert.throws(() => parseClinicalBody(body), error => error.status === 400);
  assert.deepEqual(parseClinicalBody('{"action":"patients"}'), { action: 'patients' });
});
test('clinical body limit measures UTF-8 bytes including multibyte data', () => {
  assert.throws(() => parseClinicalBody({ query: 'é'.repeat(2100) }), error => error.status === 413);
  assert.deepEqual(parseClinicalBody({ query: 'é'.repeat(100) }), { query: 'é'.repeat(100) });
});
test('trace records verified actor and outcome without request data or injected action', () => {
  const events = [], trace = createClinicalTrace('POST', event => events.push(event));
  trace.setActor('clinic', 'verified-user');
  trace.setAction('patient name, password, token');
  trace.complete(403); trace.complete(200);
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.actorId, 'verified-user'); assert.equal(event.organizationId, 'clinic');
  assert.equal(event.action, 'unsupported'); assert.equal(event.status, 403);
  assert.match(event.requestId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(Object.keys(event).sort(), ['event','schemaVersion','requestId','occurredAt','method','action','status','outcome','durationMs','organizationId','actorId'].sort());
  assert.ok(!JSON.stringify(event).includes('patient name'));
});
test('denials have no invented actor and logger failures expose no contents', () => {
  let event; const trace = createClinicalTrace('GET', value => { event = value; }); trace.complete(401);
  assert.equal('actorId' in event, false); assert.equal('organizationId' in event, false);
  assert.doesNotThrow(() => createClinicalTrace('GET', () => { throw Error('sink failed'); }).complete(401));
});
