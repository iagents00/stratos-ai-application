import test from 'node:test';
import assert from 'node:assert/strict';
import {patchCopilotSessionGuard} from './copilot-session-guard.mjs';
import {runInNewContext} from 'node:vm';
test('all webhook paths must pass verified session RPC before any original node',()=>{
 const key=`header.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.signature`;
 const source={nodes:[{name:'Ingress',type:'n8n-nodes-base.webhook',position:[0,0],parameters:{responseMode:'responseNode'}}],connections:{Ingress:{main:[[{node:'Original',type:'main',index:0}]]}},settings:{executionOrder:'v1'}};
 const result=patchCopilotSessionGuard(source,key);
 assert.equal(source.nodes.length,1);
 assert.equal(result.connections.Ingress.main[0][0].node,'Copilot Session Guard');
 assert.equal(result.connections['Copilot Session Authorized'].main[1][0].node,'Copilot Session Denied');
 assert.deepEqual(result.connections['Copilot Session Input'],source.connections.Ingress);
 const denied=result.nodes.find(n=>n.name==='Copilot Session Denied').parameters;
 // n8n closes an expression at the first adjacent braces, including nested
 // object literals that JavaScript itself would accept without whitespace.
 assert.equal((denied.responseBody.match(/}}/g)||[]).length,1);
 const evaluate=(expression,headers)=>runInNewContext(expression.slice(3,-2),{$:()=>({first:()=>({json:{headers}})})});
 assert.equal(evaluate(denied.options.responseCode,{authorization:'Bearer invalid'}),401);
 assert.equal(evaluate(denied.responseBody,{authorization:'Bearer invalid'}).error,'session_required');
 assert.equal(evaluate(denied.options.responseCode,{}),200);
 const legacy=evaluate(denied.responseBody,{});
 assert.equal(legacy.ok,false);
 assert.equal(legacy.error,'client_update_required');
 assert.match(legacy.reply.text,/actualizarse/);
 assert.match(legacy.reply.text,/no registró ningún cambio/);
 assert.equal(legacy.reply.inline_keyboard[0][0].url,'https://apps.apple.com/app/id6804826565');
 assert.equal(legacy.reply.inline_keyboard[1][0].url,'https://app.getstratosai.com');
 assert.equal(result.settings.saveDataErrorExecution,'none');
 assert.deepEqual(patchCopilotSessionGuard(result,key),result);
 const input=result.nodes.find(n=>n.name==='Copilot Session Input');
 const sourceItem={json:{body:{chat_id:-1,text:'mis clientes'},headers:{authorization:'private-session'}}};
 const context={$:()=>({first:()=>sourceItem})};
 // n8n's sandbox does not expose structuredClone; binary must be absent when
 // there is no attachment, instead of being an explicitly undefined property.
 const items=runInNewContext(`(function(){${input.parameters.jsCode}})()`,context);
 assert.equal(items[0].json.body.text,'mis clientes');
 assert.equal('headers' in items[0].json,false);
 assert.equal('binary' in items[0],false);
 assert.equal(sourceItem.json.headers.authorization,'private-session');
 sourceItem.binary={audio:{data:'file'}};
 const media=runInNewContext(`(function(){${input.parameters.jsCode}})()`,context);
 assert.equal(media[0].binary.audio.data,'file');
 assert.throws(()=>patchCopilotSessionGuard(source,`header.${Buffer.from('{"role":"service_role"}').toString('base64url')}.sig`),/public anon/);
});
test('dedicated company endpoints reject a valid session of another organization',()=>{
 const key=`header.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.signature`;
 for(const [path,organization] of [['copilot-nsg-c4d81e2f','4a17b181-35d2-41b3-b639-6e0bd4c38acc'],['copilot-dental-9f2c7a41','6c5cf32a-3db4-477d-bbed-26d90231bc9a']]) {
  const source={nodes:[{name:'Ingress',type:'n8n-nodes-base.webhook',position:[0,0],parameters:{path,responseMode:'responseNode'}}],connections:{Ingress:{main:[[{node:'Original',type:'main',index:0}]]}},settings:{}};
  const result=patchCopilotSessionGuard(source,key);
  const expression=result.nodes.find(n=>n.name==='Copilot Session Authorized').parameters.conditions.conditions[0].leftValue.slice(3,-2);
  assert.equal(runInNewContext(expression,{$json:{authorized:true,organization_id:'another-company'}}),false);
  assert.equal(runInNewContext(expression,{$json:{authorized:true,organization_id:organization}}),true);
  assert.equal(runInNewContext(expression,{$json:{authorized:false,organization_id:organization}}),false);
  assert.deepEqual(patchCopilotSessionGuard(result,key),result);
 }
});
