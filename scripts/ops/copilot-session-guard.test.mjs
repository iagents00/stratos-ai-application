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
 assert.equal(result.nodes.find(n=>n.name==='Copilot Session Denied').parameters.options.responseCode,401);
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
