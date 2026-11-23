import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {routes,classifyDelivery,failure,isRegistrationAcceptance} from '../supabase/functions/copilot-deliver/delivery.mjs';

test('background acceptance returns before the engine; final result uses the same receipt once',async()=>{
 const source=readFileSync('supabase/functions/copilot-deliver/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
 const code=stripTypeScriptTypes(source);
 let handler,task,resolveEngine,engineCalls=0,finishes=[],waitingChecks=0;
 const engine=new Promise(r=>{resolveEngine=r;});
 const context={routes,classifyDelivery,failure,isRegistrationAcceptance,Response,AbortSignal,console,setTimeout,clearTimeout,
  Deno:{env:{get:k=>({SB_URL:'https://database.invalid',SB_ANON_KEY:'public',SB_SERVICE_ROLE_KEY:'service'}[k])},serve:h=>{handler=h;}},
  EdgeRuntime:{waitUntil:p=>{task=p;}},
  fetch:async(url,options)=>{
   const args=JSON.parse(options.body);
   if(url.endsWith('/copilot_ingress_actor'))return Response.json({profile_id:'own-user',organization_id:'own-company',chat_id:-1});
   if(url.endsWith('/copilot_delivery_begin'))return Response.json({run:true,id:args.p_id});
   if(url.endsWith('/copilot_delivery_waiting')){waitingChecks++;return Response.json(waitingChecks===1);}
   if(url.endsWith('/fn_copilot_delivery_finish')){finishes.push(args);return Response.json(true);}
   engineCalls++;return engine;
  }};
 runInNewContext(code,context);
 const response=await handler({method:'POST',headers:new Headers({Authorization:'Bearer own-user'}),json:async()=>({request_id:'30000000-0000-4000-8000-000000000001',route:'crm',chat_id:-1,text:'Regístrala en contactado',background:true})});
 assert.equal(response.status,202);assert.equal((await response.json()).pending,true);assert.equal(engineCalls,0);assert.equal(finishes.length,0);assert.ok(task);
 await new Promise(r=>setTimeout(r,1100));assert.equal(waitingChecks,2);assert.equal(engineCalls,1);
 resolveEngine(Response.json({ok:true,reply:{text:'Actualicé a Jessica en RS Contactado'}}));await task;
 assert.equal(finishes.length,1);assert.equal(finishes[0].p_id,'30000000-0000-4000-8000-000000000001');assert.equal(finishes[0].p_org,'own-company');assert.equal(finishes[0].p_status,'completed');
});

test('a plain yes to a registration is confirmed before any model can restage it',async()=>{
 const source=readFileSync('supabase/functions/copilot-deliver/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
 let handler,models=0,finishes=0;
 runInNewContext(stripTypeScriptTypes(source),{routes,classifyDelivery,failure,isRegistrationAcceptance,Response,AbortSignal,console,setTimeout,clearTimeout,
  Deno:{env:{get:k=>({SB_URL:'https://db.invalid',SB_ANON_KEY:'public',SB_SERVICE_ROLE_KEY:'service'}[k])},serve:h=>{handler=h;}},
  fetch:async(url,options)=>{
   if(url.endsWith('/copilot_ingress_actor'))return Response.json({profile_id:'own',organization_id:'company',chat_id:-1});
   if(url.endsWith('/copilot_delivery_begin'))return Response.json({run:true,id:JSON.parse(options.body).p_id});
   if(url.endsWith('/copilot_delivery_waiting'))return Response.json(false);
   if(url.endsWith('/copilot_confirm_registration'))return Response.json({ok:true,data:{lead_id:'one-contact'},reply:{text:'Registré el cliente'}});
   if(url.endsWith('/fn_copilot_delivery_finish')){finishes++;return Response.json(true);}
   models++;throw Error('Confirmation must not call the model');
  }});
 const r=await handler({method:'POST',headers:new Headers({Authorization:'Bearer own'}),json:async()=>({request_id:'30000000-0000-4000-8000-000000000002',route:'crm',chat_id:-1,text:'si',background:true})});
 assert.equal((await r.json()).reply.text,'Registré el cliente');assert.equal(models,0);assert.equal(finishes,1);
 for(const t of ['sí, registrar','SI.','Confirmo'])assert.equal(isRegistrationAcceptance(t),true);
 for(const t of ['sí, pero cambia la etapa','si tuviera presupuesto','no','crea otro cliente'])assert.equal(isRegistrationAcceptance(t),false);
});
