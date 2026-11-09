import test from 'node:test';
import assert from 'node:assert/strict';
import {patchConversationNodes,conversationMarker} from './copilot-conversation-context.mjs';
test('classifier receives the same actual conversation and company as the interpreter',()=>{
 const nodes=[{name:'AI Agent',parameters:{options:{systemMessage:'classify'},text:'old'}},{name:'Intérprete',parameters:{options:{systemMessage:'route'}}},{name:'Parse Intérprete',parameters:{jsCode:"let ruta=p.ruta; const texto = advisorClientText || raw;return [{json:{ruta,texto}}];"}},{name:'Parse Pick',parameters:{jsCode:'return [{ json: { tool_name, args } }];'}}];
 const patched=patchConversationNodes(nodes);assert.equal(nodes[0].parameters.text,'old');assert.match(patched[0].parameters.text,/Contexto Reciente/);
 assert.match(patched[0].parameters.options.systemMessage,/update_client/);assert.match(patched[1].parameters.options.systemMessage,/recordatorio/);
 assert.deepEqual(patchConversationNodes(patched),patched);
 const parser=new Function('p','raw','advisorClientText',patched[2].parameters.jsCode);
 assert.equal(parser({ruta:'correccion'},'El segundo apellido es Golán','')[0].json.ruta,'crm');
 assert.equal(parser({ruta:'correccion',nuevo_dia:'viernes'},'mejor el viernes','')[0].json.ruta,'correccion');
 assert.equal(parser({ruta:'correccion'},'ya te paso los detalles','')[0].json.ruta,'crm');
 assert.equal(parser({ruta:'actividades'},'Para el cliente queda pendiente confirmar una visita. Entonces recuérdame en dos horas consultar a la propietaria.','')[0].json.ruta,'crm');
 for (const raw of ['Sí, pero quiero que queden los dos CRM tanto en el bienes raíces como en el médico','Samara no está en el equipo Samara, la estoy considerando como una cliente','Y dónde quedó Samara dentro de el Pipeline de M contactado']) {
   assert.equal(parser({ruta:'actividades'},raw,'')[0].json.ruta,'crm',raw);
 }
 assert.equal(parser({ruta:'correccion',nueva_hora:'mañana'},'De Samara, el presupuesto es 19,000 pesos. Está buscando renta en Selva Nova y cambiar el contrato.','')[0].json.ruta,'crm');
 assert.ok(patched[0].parameters.options.systemMessage.includes(conversationMarker));
 const pick=new Function('tool_name','args','inputText',patched[3].parameters.jsCode);
 const raw='Relato completo con arquitecto y agua; recuérdame en dos horas consultar a la propietaria.';
 const action=pick('multi',{actions:[{tool_name:'add_expediente_note',args:{nota:'Resumen corto'}},{tool_name:'create_personal_reminder',args:{text:'Consultar',when:'en dos horas'}}]},raw)[0].json.args.actions;
 assert.equal(action[0].args._dictation_source,raw);assert.equal(action[1].args._dictation_source,undefined);
 const details=pick('multi',{actions:[{tool_name:'update_client',args:{nota:'Busca renta'}},{tool_name:'create_personal_reminder',args:{text:'Buscar renta',when:'sin plazo explícito'}}]},'El presupuesto es 19,000 pesos y busca renta en Selva Nova.')[0].json.args.actions;
 assert.equal(details.length,1);assert.equal(details[0].tool_name,'update_client');
 for (const request of ['Además quiero que me recuerdes en dos horas llamar a la propietaria.','Busca renta y me avisas mañana a las nueve.','Anota lo de Samara y programa un recordatorio para mañana.']) {
   const requested=pick('multi',{actions:[{tool_name:'update_client',args:{nota:'Busca renta'}},{tool_name:'create_personal_reminder',args:{text:'Consultar',when:'mañana'}}]},request)[0].json.args.actions;
   assert.equal(requested.length,2,request);
 }
});
