import test from 'node:test';
import assert from 'node:assert/strict';
import { companySummary, isManagedCompany, validateCompany, validateCompanyUser } from '../src/app/features/Admin/company-onboarding.js';
const org = { id: 'new', name: 'Nueva', seats: 2, active: true, meta_config: { onboarding: { createdFrom: 'whatsapp_admin' } } };
const form = { organization_id: org.id, name: 'Ana', email: 'ana@example.com', role: 'admin' };
test('new-company workflow keeps custom tenants and partner containers outside managed companies', () => {
  assert.equal(isManagedCompany(org), true);
  assert.equal(isManagedCompany({ id:'duke', meta_config:{} }), false);
  assert.equal(isManagedCompany({ ...org, meta_config:{ ...org.meta_config, platform:{kind:'partner'} } }), false);
});
test('team counts and administrator readiness never include another organization or inactive users', () => {
  const summary=companySummary(org,[{id:'other',organization_id:'nsg',role:'admin',active:true},{id:'old',organization_id:org.id,role:'admin',active:false}]);
  assert.deepEqual(summary,{team:[],used:0,available:2,hasAdmin:false});
  assert.match(validateCompanyUser({...form,role:'asesor'},org,[]),/primero al administrador/);
});
test('user submission rejects stale company, invalid role, custom tenant, inactive company and full licenses', () => {
  assert.equal(validateCompanyUser(form,org,[]),'');
  assert.match(validateCompanyUser({...form,organization_id:'duke'},org,[]),/cambió/);
  assert.match(validateCompanyUser({...form,role:'super_admin'},org,[]),/rol válido/);
  assert.match(validateCompanyUser(form,{...org,meta_config:{}},[]),/activa creada/);
  assert.match(validateCompanyUser(form,{...org,active:false},[]),/activa creada/);
  assert.match(validateCompanyUser(form,{...org,seats:1},[{organization_id:org.id,active:true,role:'admin'}]),/licencias/);
});
test('company and email validation preserve whole positive seat counts', () => {
  for(const seats of [0,-1,1.5,1001,'',NaN,Infinity]) assert.ok(validateCompany({name:'Empresa',seats}));
  assert.equal(validateCompany({name:'Empresa',seats:'5'}),'');
  assert.ok(validateCompany({name:' ',seats:1}));
  assert.ok(validateCompanyUser({...form,email:'invalid'},org,[]));
});
