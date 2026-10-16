import test from 'node:test';
import assert from 'node:assert/strict';
import { companyReadiness, companySummary, isManagedCompany, visibleCompanies, validateCompany, validateCompanyUser } from '../src/app/features/Admin/company-onboarding.js';
const org = { id: 'new', name: 'Nueva', seats: 2, active: true, meta_config: { onboarding: { createdFrom: 'whatsapp_admin' } } };
const form = { organization_id: org.id, name: 'Ana', email: 'ana@example.com', role: 'admin' };
test('new-company workflow keeps custom tenants and partner containers outside managed companies', () => {
  assert.equal(isManagedCompany(org), true);
  assert.equal(isManagedCompany({ id:'duke', meta_config:{} }), false);
  assert.equal(isManagedCompany({ ...org, meta_config:{ ...org.meta_config, platform:{kind:'partner'} } }), false);
});
test('global company administration includes historical tenants and partners without widening partner scope', () => {
  const duke={...org,id:'duke',meta_config:{}};
  const partner={...org,id:'partner',meta_config:{platform:{kind:'partner'}}};
  assert.deepEqual(visibleCompanies([org,duke,partner],true),[org,duke,partner]);
  assert.deepEqual(visibleCompanies([org,duke,partner],false),[org]);
  assert.equal(validateCompanyUser({...form,organization_id:'duke'},duke,[],{root:true}),'');
  const admin={organization_id:'duke',active:true,role:'admin'};
  assert.equal(validateCompanyUser({...form,organization_id:'duke',role:'marketing'},duke,[admin],{root:true}),'');
  assert.match(validateCompanyUser({...form,organization_id:'duke',role:'marketing'},duke,[admin]),/activa creada/);
  assert.match(validateCompanyUser({...form,role:'marketing'},org,[{...admin,organization_id:org.id}]),/rol válido/);
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
  assert.match(validateCompanyUser({...form,email:`${'a'.repeat(250)}@example.com`},org,[]),/254/);
});

test('company readiness requires its own active administrator and valid licenses, without requiring WhatsApp or spare seats', () => {
  const admin = { id:'admin', organization_id:org.id, role:'admin', active:true };
  assert.equal(companyReadiness(org, [{...admin, organization_id:'duke'}]).ready, false);
  assert.equal(companyReadiness(org, [{...admin, active:false}]).ready, false);
  assert.equal(companyReadiness({...org, active:false}, [admin]).ready, false);
  assert.equal(companyReadiness({...org, seats:0}, [admin]).ready, false);
  assert.equal(companyReadiness({...org, seats:1}, [admin, {...admin, id:'second'}]).ready, false);
  assert.equal(companyReadiness({...org, seats:1}, [admin]).ready, true);
  assert.equal(companyReadiness(org, [admin]).label, 'Acceso preparado');
});
