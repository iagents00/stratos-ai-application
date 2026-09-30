import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { dayRange,passwordMatches,signSession,verifySession,cookieValue,SESSION_COOKIE } from '../server/dental-security.mjs';
import { selectedPair, executeQuery } from '../server/dental-huli.mjs';
import handler from '../api/dental-huli.js';
const config={apiKey:'hidden-provider-key',organizationId:'123',userId:'456',passwordSalt:'test-salt',passwordHash:scryptSync('private-clinic-access','test-salt',64).toString('hex'),sessionSecret:'test-signing-secret-not-used-in-deploy'};
test('clinic authentication checks password and expires tamper-proof scoped sessions',()=>{
  assert.equal(passwordMatches('private-clinic-access',config),true);assert.equal(passwordMatches('wrong',config),false);
  const session=signSession(config,100000);
  assert.equal(verifySession(session,config,100100),true);
  assert.equal(verifySession(session+'x',config,100100),false);
  assert.equal(verifySession(session,{...config,organizationId:'999'},100100),false);
  assert.equal(verifySession(session,config,100000+4*3600000),false);
  assert.equal(cookieValue(`other=1; ${SESSION_COOKIE}=${session}`),session);
});
test('calendar day uses provider timezone and daylight-saving boundaries',()=>{
  assert.deepEqual(dayRange('2026-09-27','America/Mexico_City'),{from:'2026-09-27T06:00:00.000Z',to:'2026-09-28T06:00:00.000Z'});
  const fall=dayRange('2026-11-01','America/Los_Angeles');assert.equal(Date.parse(fall.to)-Date.parse(fall.from),25*3600000);
  const spring=dayRange('2026-03-29','Europe/London');assert.equal(Date.parse(spring.to)-Date.parse(spring.from),23*3600000);
  assert.throws(()=>dayRange('2026-02-30','America/Mexico_City'));
});
const metadata={doctors:[{id:'10',timeZone:'America/Mexico_City',clinics:[{id:'20',name:'Sede'}]}]};
test('doctor/sede selection must belong to the server-discovered scope',()=>{
  assert.throws(()=>selectedPair(metadata,{doctorId:'999',clinicId:'20'}));assert.throws(()=>selectedPair(metadata,{doctorId:'10',clinicId:'999'}));
});
test('patient results minimize personal data and accept no caller-supplied organization',async()=>{
  const calls=[];const client={get:async path=>{calls.push(path);return{patientFiles:[{id:'1',personalData:{firstName:'Test',lastName:'Patient',birthdate:'1990-01-01',patientIds:[{idNumber:'hidden-id'}]},contact:{email:'hidden-email'}}],total:1}}};
  const result=await executeQuery(client,metadata,{action:'patients',query:' Test ',organizationId:'other'});
  assert.deepEqual(result.patients,[{id:'1',name:'Test Patient'}]);assert.equal(calls.length,1);assert.ok(!calls[0].includes('other'));
});
test('availability rejects scope mismatch and unknown actions cannot create appointments',async()=>{
  const client={get:async()=>({idDoctor:'10',idClinic:'99',slotDates:[]})};
  await assert.rejects(executeQuery(client,metadata,{action:'availability',doctorId:'10',clinicId:'20',date:'2026-09-27'}));
  await assert.rejects(executeQuery(client,metadata,{action:'create',doctorId:'10',clinicId:'20',date:'2026-09-27'}));
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(v){this.body=v;return this;}};}
test('HTTP gateway denies unauthenticated access and cross-origin login',async()=>{
  const saved=process.env.DENTAL_HULI_CONFIG;process.env.DENTAL_HULI_CONFIG=JSON.stringify(config);
  try{
    let res=response();await handler({method:'GET',headers:{host:'clinic.test'}},res);assert.equal(res.code,401);assert.ok(!JSON.stringify(res.body).includes(config.apiKey));
    res=response();await handler({method:'POST',headers:{host:'clinic.test',origin:'https://other.test'},body:{action:'login',password:'private-clinic-access'}},res);assert.equal(res.code,403);
    res=response();await handler({method:'POST',headers:{host:'clinic.test',origin:'https://clinic.test'},body:{action:'login',password:'private-clinic-access'}},res);assert.equal(res.code,200);assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.deepEqual(res.body,{authenticated:true});
  }finally{if(saved===undefined)delete process.env.DENTAL_HULI_CONFIG;else process.env.DENTAL_HULI_CONFIG=saved;}
});
test('Huli empty agenda payload is accepted but malformed nonempty payload is rejected',async()=>{
 const body={action:'appointments',doctorId:'10',clinicId:'20',date:'2026-09-27'};
 const result=await executeQuery({get:async()=>({})},metadata,body);assert.deepEqual(result.appointments,[]);
 await assert.rejects(executeQuery({get:async()=>({unexpected:true})},metadata,body));
});
