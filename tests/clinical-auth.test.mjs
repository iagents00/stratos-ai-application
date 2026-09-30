import test from 'node:test';import assert from 'node:assert/strict';import {authorizeClinic} from '../server/clinical-auth.mjs';
const config={stratosOrganizationId:'clinic',stratosUserId:'admin',authUrl:'https://example.test',authAnonKey:'public'};
const req={headers:{authorization:'Bearer test-token'}};
function factory({userId='admin',profileOrg='clinic',userActive=true,orgActive=true,error=null}={}){return()=>({auth:{getUser:async()=>({data:{user:{id:userId}},error})},from:table=>({select:()=>({eq:()=>({single:async()=>({data:table==='profiles'?{id:userId,organization_id:profileOrg,active:userActive}:{id:'clinic',active:orgActive}})})})})});}
test('clinic tenant requires a verified session rather than the old shared cookie',async()=>{await assert.rejects(authorizeClinic({headers:{cookie:'old-cookie'}},config,factory()),e=>e.status===401);await assert.rejects(authorizeClinic(req,config,factory({error:true})),e=>e.status===401);});
test('clinic access rejects other users, cross-tenant profiles and inactive accounts',async()=>{for(const setting of [{userId:'other'},{profileOrg:'other'},{userActive:false},{orgActive:false}])await assert.rejects(authorizeClinic(req,config,factory(setting)),e=>e.status===403);});
test('only the active registered administrator can access the fixed tenant',async()=>{assert.equal(await authorizeClinic(req,config,factory()),'admin');});
