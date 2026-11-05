import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLoginIdentity } from '../src/lib/login-identity.js';
test('Stratos usernames resolve consistently while full company emails retain their domain',()=>{
 assert.equal(normalizeLoginIdentity(' Advisor.Demo '),'advisor.demo@stratoscapitalgroup.com');
 assert.equal(normalizeLoginIdentity('ADMIN2026'),'admin2026@stratoscapitalgroup.com');
 assert.equal(normalizeLoginIdentity(' Employee@Own-Company.com '),'employee@own-company.com');
 assert.equal(normalizeLoginIdentity(''), '');
 assert.equal(normalizeLoginIdentity('invalid name'),'invalid name');
});
