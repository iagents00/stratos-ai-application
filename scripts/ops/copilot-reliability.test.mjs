import test from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';
import {patchCopilotReliability,opsMailWorkflow} from './copilot-reliability.mjs';
test('model, parsing and write errors end in an explicit response without retrying writes',()=>{
 const names=['Contexto Reciente','Intérprete','AI Agent','Agente Actividades','Parse Pick','Parse Actividades','Parse Intérprete','Dispatch verbatim','Handle Callback','Whisper Transcribe','Zoom consistency sync','Normalize Reply'];
 const w={id:'8ZasBukTkSx26m2A',settings:{},nodes:names.map(name=>({name,parameters:{}})),connections:Object.fromEntries(names.map(name=>[name,{main:[[{node:'Next',type:'main',index:0}]]}]))};
 const r=patchCopilotReliability(w,'error-handler');
 for(const name of names){assert.equal(r.connections[name].main[1][0].node,'Copilot Delivery Failure');assert.equal(r.nodes.find(n=>n.name===name).retryOnFail,undefined);}
 assert.equal(r.connections['Copilot Report Failure'].main[0][0].node,'Copilot Failure Response');assert.equal(r.settings.errorWorkflow,'error-handler');
 assert.deepEqual(patchCopilotReliability(r,'error-handler'),r);
});
test('support email is fixed to the authorized address, authenticated and idempotently searchable',()=>{
 const w=opsMailWorkflow('private-test-secret',{id:'mail-credential',name:'Operational account'});
 const code=w.nodes.find(n=>n.name==='Validate incident').parameters.jsCode;
 const input={headers:{'x-copilot-ops-secret':'private-test-secret'},body:{id:'10000000-0000-4000-8000-000000000001',text:'Safe incident category'}};
 const run=()=>runInNewContext(`(function(){${code}})()`,{$input:{first:()=>({json:input})},Buffer});
 const result=run()[0].json;const message=Buffer.from(result.raw,'base64url').toString();
 assert.match(message,/To: angelgarzonsarzosa@gmail.com\r\n/);assert.match(message,/Message-ID: <copilot-incident-/);assert.ok(!message.includes('private-test-secret'));
 input.headers={};assert.throws(run,/Unauthorized/);
 assert.equal(w.settings.saveDataErrorExecution,'none');
});
