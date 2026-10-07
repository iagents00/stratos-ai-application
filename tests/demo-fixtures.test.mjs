import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDemoLeads } from '../src/app/data/demo-leads.js';

test('CRM demo supports the sales workflow without usable customer contacts', () => {
  const records = createDemoLeads();
  assert.equal(records.length, 8);
  assert.equal(new Set(records.map(record => record.id)).size, records.length);
  for (const record of records) {
    assert.equal(record.phone, '');
    assert.equal(record.email, '');
    assert.match(record.n, / Ejemplo$/);
    assert.match(record.asesor, / Ejemplo$/);
    assert.match(record.p, /\(ficticio\)$/);
    assert.match(record.bio, /No representa a una persona real/);
    assert.ok(Number.isFinite(record.presupuesto) && record.presupuesto > 0);
    assert.ok(Number.isFinite(record.sc) && record.sc >= 0 && record.sc <= 100);
  }
  assert.ok(records.some(record => record.st === 'Contáctame Ya'));
  assert.ok(records.some(record => record.st === 'Seguimiento'));
  assert.ok(records.some(record => record.st === 'Cierre'));
});

test('editing one demo session never changes subsequent demo examples', () => {
  const records = createDemoLeads();
  records[0].n = 'Locally edited';
  records[0].notas = 'Local note';
  records.splice(1, 1);
  const fresh = createDemoLeads();
  assert.equal(fresh.length, 8);
  assert.equal(fresh[0].n, 'Alex Ejemplo');
  assert.notEqual(fresh[0].notas, 'Local note');
});

test('legacy CRM fixture export contains no independent customer records', () => {
  const source = readFileSync('src/app/data/leads.js', 'utf8');
  assert.match(source, /export const leads = createDemoLeads\(\)/);
  assert.doesNotMatch(source, /\b(?:phone|email|bio|notas)\s*:/);
});
