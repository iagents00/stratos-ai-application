import test from 'node:test';
import assert from 'node:assert/strict';
import {patchConversationNodes,conversationMarker} from './copilot-conversation-context.mjs';
test('classifier receives the same actual conversation and company as the interpreter',()=>{
 const nodes=[{name:'AI Agent',parameters:{options:{systemMessage:'classify'},text:'old'}},{name:'Intérprete',parameters:{options:{systemMessage:'route'}}},{name:'Parse Intérprete',parameters:{jsCode:"let ruta=p.ruta; const texto = advisorClientText || raw;return [{json:{ruta,texto}}];"}}];
 const patched=patchConversationNodes(nodes);assert.equal(nodes[0].parameters.text,'old');assert.match(patched[0].parameters.text,/Contexto Reciente/);
 assert.match(patched[0].parameters.options.systemMessage,/update_client/);assert.match(patched[1].parameters.options.systemMessage,/recordatorio/);
 assert.deepEqual(patchConversationNodes(patched),patched);
 const parser=new Function('p','raw','advisorClientText',patched[2].parameters.jsCode);
 assert.equal(parser({ruta:'correccion'},'El segundo apellido es Golán','')[0].json.ruta,'crm');
 assert.equal(parser({ruta:'correccion',nuevo_dia:'viernes'},'mejor el viernes','')[0].json.ruta,'correccion');
 assert.equal(parser({ruta:'correccion'},'ya te paso los detalles','')[0].json.ruta,'crm');
 assert.equal(parser({ruta:'actividades'},'Para el cliente queda pendiente confirmar una visita. Entonces recuérdame en dos horas consultar a la propietaria.','')[0].json.ruta,'crm');
 assert.ok(patched[0].parameters.options.systemMessage.includes(conversationMarker));
});
