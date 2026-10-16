import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const provisioningSource=stripTypeScriptTypes(readFileSync('supabase/functions/_shared/provision-user.ts','utf8').replace('export async function','async function'));
const crmSource=stripTypeScriptTypes(readFileSync('supabase/functions/whatsapp-admin/platform-crm.ts','utf8').replace(/^export /gm,''));
const source=stripTypeScriptTypes(readFileSync('supabase/functions/whatsapp-admin/index.ts','utf8').replace(/^import .*;\n/gm,''));

function harness({operator=true,disabled=false,root=false,rpcError=null,directory=null}={}) {
 const rows={
  platform_admins:operator?[{user_id:'operator',active:true,scope_organization_id:root?null:'partner',company_limit:10,support_only:true}]:[],
  organizations:[{id:'partner',name:'Partner',active:true},{id:'own',name:'Own',active:true,seats:3,parent_organization_id:'partner',meta_config:{onboarding:{createdFrom:'whatsapp_admin'}}},{id:'duke',name:'Duke',active:true,seats:50},{id:'nsg',name:'NSG',active:true,seats:50},{id:'other',name:'Other',parent_organization_id:'other-partner',active:true}],
  profiles:[{id:'operator',organization_id:'partner',active:!disabled},{id:'own-user',name:'Owner',organization_id:'own',role:'admin',active:true},{id:'duke-user',organization_id:'duke',active:true}],
  whatsapp_numero_asesor:[],whatsapp_onboarding_runs:[],
 };
 const creates=[],rpcs=[],authPages=[];
 const authUsers=rows.profiles.map(profile=>({id:profile.id,email:`${profile.id}@example.com`,email_confirmed_at:'2026-10-15T00:00:00Z',last_sign_in_at:'2026-10-16T00:00:00Z',user_metadata:{name:profile.name,secret:'never-export'},app_metadata:{secret:'never-export'},encrypted_password:'never-export'}));
 const from=table=>{
  let list=[...(rows[table]||[])];let count=false;let one=false;let update=null;let start=0,end=Infinity;
  const query={insert(value){(rows[table]??=[]).push(value);return this;},delete(){return this;},select(_fields,options){count=options?.count==='exact';return this;},eq(key,value){list=list.filter(row=>row[key]===value);return this;},not(key,_operator,value){list=list.filter(row=>row[key]!==value);return this;},in(key,values){list=list.filter(row=>values.includes(row[key]));return this;},or(expression){const clauses=expression.split(",").map(part=>part.split(".eq."));list=list.filter(row=>clauses.some(([key,value])=>row[key]===value));return this;},order(){return this;},range(a,b){start=a;end=b;return this;},limit(n){end=n-1;return this;},maybeSingle(){one=true;return this;},single(){one=true;return this;},update(value){update=value;return this;},then(resolve){if(update)list.forEach(row=>Object.assign(row,update));return Promise.resolve({data:one?list[0]||null:list.slice(start,end+1),error:null,count:count?list.length:null}).then(resolve);}};
  return query;
 };
 const admin={from,rpc:async(name,args)=>{rpcs.push({name,args});return {data:name==='fn_platform_list_users'?(directory||{ok:true,users:[],organizations:rows.organizations}):{ok:true,audit_saved:true,user:{id:args.p_user_id},organization:{id:args.p_organization_id}},error:rpcError};},auth:{admin:{listUsers:async({page})=>{authPages.push(page);return {data:null,error:{message:'Database error finding users'}};},createUser:async value=>{creates.push(value);const id='created';rows.profiles.push({id,organization_id:value.app_metadata.stratos_organization_id,active:true});return {data:{user:{id}},error:null};},updateUserById:async()=>({})}}};
 let handler;
 const context=vm.createContext({Request,Response,URL,console,crypto:webcrypto,fetch:()=>{throw new Error('Unexpected external request');},setTimeout,clearTimeout,
  createClient:(_url,key)=>key==='service'?admin:{auth:{getUser:async()=>({data:{user:{id:'operator'}},error:null})}},
  saveTemporaryCredential:async()=>{},decryptCredentialRows:async()=>[],XLSX:{},
  Deno:{env:{get:key=>({SB_URL:'https://stratos.example',SB_SERVICE_ROLE_KEY:'service',SB_ANON_KEY:'anon'}[key])},serve:fn=>{handler=fn;}},
 });
 vm.runInContext(provisioningSource,context);
 vm.runInContext(crmSource,context);
 vm.runInContext(source,context);
 const call=async payload=>{const response=await handler(new Request('https://stratos.example/functions/v1/whatsapp-admin',{method:'POST',headers:{authorization:'Bearer qa'},body:JSON.stringify(payload)}));return {status:response.status,body:await response.json()};};
 return {call,creates,rows,rpcs,authUsers,authPages};
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

test('managed company with an existing team still requires its own active administrator',async()=>{
 const h=harness();
 h.rows.profiles.find(person=>person.id==='own-user').active=false;
 h.rows.profiles.push({id:'advisor',organization_id:'own',role:'asesor',active:true});
 h.rows.profiles.push({id:'other-admin',organization_id:'duke',role:'admin',active:true});
 for(const role of ['director','asesor']){
  const blocked=await h.call({action:'create_user',organization_id:'own',name:'Test',email:'test@example.com',role});
  assert.equal(blocked.status,400);
  assert.match(blocked.body.error,/primero al administrador/);
 }
 assert.equal(h.creates.length,0);
 const allowed=await h.call({action:'create_user',organization_id:'own',name:'Admin',email:'admin@example.com',role:'admin'});
 assert.equal(allowed.status,200);
});

test('managed company can add advisors after its active administrator exists',async()=>{
 const h=harness();
 const result=await h.call({action:'create_user',organization_id:'own',name:'Advisor',email:'advisor@example.com',role:'asesor'});
 assert.equal(result.status,200);
 assert.equal(h.creates[0].app_metadata.stratos_role,'asesor');
});

test('root directory delegates to the authenticated service-only SQL projection without calling broken Auth listUsers',async()=>{
 const safeDirectory={ok:true,users:[{id:'operator',name:'Root',protected_from_access_changes:true,email_confirmed:true},{id:'legacy',name:'Legacy Marketing',email:'legacy@example.com',email_confirmed:false,last_sign_in:null,role:'marketing'}],organizations:[{id:'duke'},{id:'partner'}]};
 const h=harness({root:true,directory:safeDirectory});
 h.rows.organizations.find(row=>row.id==='partner').meta_config={platform:{kind:'partner'}};
 h.rows.profiles.push({id:'mkt',name:'Marketing',organization_id:'duke',role:'marketing',active:true});
 const bootstrap=await h.call({action:'bootstrap'});
 assert.equal(bootstrap.status,200);
 assert.deepEqual(bootstrap.body.organizations.map(row=>row.id),['partner','own','duke','nsg','other']);
 assert.ok(bootstrap.body.profiles.some(row=>row.id==='mkt'));
 const directory=await h.call({action:'list_platform_users',p_actor_id:'forged'});
 assert.equal(directory.status,200);
 assert.deepEqual(directory.body,safeDirectory);
 assert.deepEqual(h.authPages,[]);
 assert.equal(h.rpcs.length,1);
 assert.equal(h.rpcs[0].name,'fn_platform_list_users');
 assert.deepEqual(JSON.parse(JSON.stringify(h.rpcs[0].args)),{p_actor_id:'operator'});
 assert.equal(directory.body.users.find(row=>row.id==='operator').protected_from_access_changes,true);
 assert.equal(directory.body.users.find(row=>row.id==='operator').email_confirmed,true);
 assert.equal(JSON.stringify(directory.body).includes('never-export'),false);
});

test('partners cannot read or mutate global accounts or companies',async()=>{
 const h=harness();
 for(const action of ['list_platform_users','update_platform_user','update_platform_company']) {
  const result=await h.call({action,user_id:'duke-user',organization_id:'duke',active:false});
  assert.equal(result.status,403);
 }
 const privileged=await h.call({action:'create_user',organization_id:'partner',name:'Forged',email:'forged@example.com',role:'super_admin'});
 assert.equal(privileged.status,403);
 assert.equal(h.rpcs.length,0);
 assert.equal(h.authPages.length,0);
});

test('root mutations bind the authenticated actor, validate payloads and map SQL conflicts',async()=>{
 const payload={action:'update_platform_user',user_id:'00000000-0000-0000-0000-000000000010',organization_id:'00000000-0000-0000-0000-000000000001',expected_updated_at:'2026-10-15T00:00:00Z',name:'Marketer',role:'marketing',active:true,is_marketing_admin:false,crm_only:false,area:'Marketing',confirm_move:true,p_actor_id:'forged'};
 const h=harness({root:true});
 const success=await h.call(payload);
 assert.equal(success.status,200);
 assert.equal(success.body.audit_saved,true);
 assert.equal(h.rpcs[0].name,'fn_platform_update_user');
 assert.equal(h.rpcs[0].args.p_actor_id,'operator');
 assert.equal(h.rpcs[0].args.p_confirm_move,true);
 assert.equal((await h.call({...payload,active:'false'})).status,400);
 assert.equal((await h.call({...payload,role:'contabilidad'})).status,400);
 assert.equal(h.rpcs.length,1);
 const conflict=harness({root:true,rpcError:{code:'40001',message:'El usuario cambió.'}});
 const rejected=await conflict.call(payload);
 assert.equal(rejected.status,409);
 assert.equal(rejected.body.code,'40001');
 const company=await h.call({action:'update_platform_company',organization_id:payload.organization_id,expected_updated_at:payload.expected_updated_at,name:'Duke',seats:100,active:true});
 assert.equal(company.status,200);
 assert.equal(h.rpcs[1].name,'fn_platform_update_company');
 assert.equal(h.rpcs[1].args.p_actor_id,'operator');
});

test('root can provision Marketing into historical and managed companies without granting platform access',async()=>{
 for(const organization_id of ['duke','own']) {
  const h=harness({root:true});
  const result=await h.call({action:'create_user',organization_id,name:'Marketing',email:'mkt@example.com',role:'marketing'});
  assert.equal(result.status,200);
  assert.equal(h.creates[0].app_metadata.stratos_role,'marketing');
  assert.equal(h.creates[0].app_metadata.stratos_organization_id,organization_id);
  assert.equal(h.rows.platform_admins.length,1);
 }
});

test('CRM actions bind the verified operator and expose explicit RPCs with bounded pagination',async()=>{
 const h=harness({root:true});
 const organization_id='00000000-0000-0000-0000-000000000001';
 const lead_id='00000000-0000-0000-0000-000000000099';
 const listed=await h.call({action:'list_company_leads',organization_id,page:2,page_size:25,search:'Maria',p_actor_id:'forged'});
 assert.equal(listed.status,200);assert.equal(h.rpcs[0].name,'fn_platform_crm_read');
 assert.equal(h.rpcs[0].args.p_actor_id,'operator');assert.equal(h.rpcs[0].args.p_organization_id,organization_id);
 assert.equal(h.rpcs[0].args.p_page,2);assert.equal(h.rpcs[0].args.p_page_size,25);assert.equal(h.rpcs[0].args.p_search,'Maria');
 assert.equal(h.rpcs[0].args.p_lead_id,null);
 for(const page_size of [0,101,1.5]) assert.equal((await h.call({action:'list_company_leads',organization_id,page_size})).status,400);
 assert.equal((await h.call({action:'get_company_lead',organization_id})).status,400);
 assert.equal((await h.call({action:'get_company_lead',organization_id,lead_id})).status,200);
 assert.equal(h.rpcs[1].args.p_lead_id,lead_id);
 assert.equal((await h.call({action:'update_company_lead',organization_id,lead_id,patch:{name:'Maria'}})).status,400);
 const expected_updated_at='2026-10-16T00:00:00.123456+00:00';
 assert.equal((await h.call({action:'update_company_lead',organization_id,lead_id,expected_updated_at,patch:{name:'Maria'}})).status,200);
 assert.equal(h.rpcs[2].name,'fn_platform_crm_mutate');assert.equal(h.rpcs[2].args.p_create,false);
 assert.equal(h.rpcs[2].args.p_expected_updated_at,expected_updated_at,'retain timestamp precision');
 assert.equal((await h.call({action:'create_company_lead',organization_id,lead_id,lead:{name:'Maria'}})).status,200);
 assert.equal(h.rpcs[3].args.p_create,true);assert.equal(h.rpcs[3].args.p_lead_id,lead_id);
});

test('CRM maps scope rejection, stale saves and undeployed gateway without falling back to tenant reads',async()=>{
 const organization_id='00000000-0000-0000-0000-000000000001';
 for(const [code,status] of [['42501',403],['P0002',404],['40001',409],['23505',409],['22023',400],['PGRST202',503]]) {
  const h=harness({root:true,rpcError:{code,message:'SQL rejected'}});
  const response=await h.call({action:'list_company_leads',organization_id});
  assert.equal(response.status,status);assert.equal(response.body.code,code);
  assert.equal(h.rpcs.length,1);
 }
 const h=harness({operator:false});
 assert.equal((await h.call({action:'list_company_leads',organization_id})).status,403);
 assert.equal(h.rpcs.length,0);
});
