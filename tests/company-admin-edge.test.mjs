import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const source=stripTypeScriptTypes(readFileSync('supabase/functions/whatsapp-admin/index.ts','utf8').replace(/^import .*;\n/gm,''));

function harness({operator=true,disabled=false}={}) {
 const rows={
  platform_admins:operator?[{user_id:'operator',active:true,scope_organization_id:'partner',company_limit:10,support_only:true}]:[],
  organizations:[{id:'partner',name:'Partner',active:true},{id:'own',name:'Own',active:true,seats:3,parent_organization_id:'partner',meta_config:{onboarding:{createdFrom:'whatsapp_admin'}}},{id:'duke',name:'Duke',active:true,seats:50},{id:'nsg',name:'NSG',active:true,seats:50},{id:'other',name:'Other',parent_organization_id:'other-partner',active:true}],
  profiles:[{id:'operator',organization_id:'partner',active:!disabled},{id:'own-user',name:'Owner',organization_id:'own',role:'admin',active:true},{id:'duke-user',organization_id:'duke',active:true}],
  whatsapp_numero_asesor:[],whatsapp_onboarding_runs:[],
 };
 const creates=[];
 const from=table=>{
  let list=[...(rows[table]||[])];let count=false;let one=false;let update=null;let start=0,end=Infinity;
  const query={select(_fields,options){count=options?.count==='exact';return this;},eq(key,value){list=list.filter(row=>row[key]===value);return this;},in(key,values){list=list.filter(row=>values.includes(row[key]));return this;},or(expression){const clauses=expression.split(",").map(part=>part.split(".eq."));list=list.filter(row=>clauses.some(([key,value])=>row[key]===value));return this;},order(){return this;},range(a,b){start=a;end=b;return this;},limit(n){end=n-1;return this;},maybeSingle(){one=true;return this;},single(){one=true;return this;},update(value){update=value;return this;},then(resolve){if(update)list.forEach(row=>Object.assign(row,update));return Promise.resolve({data:one?list[0]||null:list.slice(start,end+1),error:null,count:count?list.length:null}).then(resolve);}};
  return query;
 };
 const admin={from,auth:{admin:{createUser:async value=>{creates.push(value);const id='created';rows.profiles.push({id,organization_id:value.app_metadata.stratos_organization_id,active:true});return {data:{user:{id}},error:null};},updateUserById:async()=>({})}}};
 let handler;
 const context=vm.createContext({Request,Response,URL,console,crypto:webcrypto,fetch:()=>{throw new Error('Unexpected external request');},setTimeout,clearTimeout,
  createClient:(_url,key)=>key==='service'?admin:{auth:{getUser:async()=>({data:{user:{id:'operator'}},error:null})}},
  saveTemporaryCredential:async()=>{},decryptCredentialRows:async()=>[],XLSX:{},
  Deno:{env:{get:key=>({SB_URL:'https://stratos.example',SB_SERVICE_ROLE_KEY:'service',SB_ANON_KEY:'anon'}[key])},serve:fn=>{handler=fn;}},
 });
 vm.runInContext(source,context);
 const call=async payload=>{const response=await handler(new Request('https://stratos.example/functions/v1/whatsapp-admin',{method:'POST',headers:{authorization:'Bearer qa'},body:JSON.stringify(payload)}));return {status:response.status,body:await response.json()};};
 return {call,creates,rows};
}

test('Edge rejects nonoperators and deactivated operators before reading company data',async()=>{
 for(const options of [{operator:false},{disabled:true}]){
  const h=harness(options);const result=await h.call({action:'bootstrap'});assert.equal(result.status,403);assert.equal(h.creates.length,0);
 }
});
test('partner bootstrap and forged create_user requests cannot access Duke, NSG or another partner',async()=>{
 const h=harness();const result=await h.call({action:'bootstrap'});
 assert.equal(result.status,200);assert.deepEqual(result.body.organizations.map(row=>row.id),['own']);
 assert.deepEqual(result.body.profiles.map(row=>row.id),['own-user']);
 for(const organization_id of ['duke','nsg','other']){
  const denied=await h.call({action:'create_user',organization_id,name:'Test',email:'test@example.com',role:'admin'});
  assert.equal(denied.status,403);
 }
 assert.equal(h.creates.length,0);
});
test('authorized creation passes trusted organization metadata and cannot grant platform access',async()=>{
 const h=harness();
 const blocked=await h.call({action:'create_user',organization_id:'own',name:'Test',email:'test@example.com',role:'admin',platform_admin:true});assert.equal(blocked.status,403);
 const allowed=await h.call({action:'create_user',organization_id:'own',name:'Test',email:'test@example.com',role:'admin'});
 assert.equal(allowed.status,200);
 assert.equal(h.creates.length,1);assert.equal(h.creates[0].app_metadata.stratos_organization_id,'own');assert.equal(h.creates[0].app_metadata.stratos_role,'admin');
});

test('bootstrap counts the complete team beyond the PostgREST page limit',async()=>{
 const h=harness();
 for(let i=0;i<1200;i++)h.rows.profiles.push({id:`own-${i}`,organization_id:'own',role:'asesor',active:true});
 const result=await h.call({action:'bootstrap'});
 assert.equal(result.status,200);assert.equal(result.body.profiles.length,1201);
 assert.ok(result.body.profiles.every(person=>person.organization_id==='own'));
});
