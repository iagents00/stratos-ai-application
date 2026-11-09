// No service credential is needed: PostgREST verifies the user's JWT and the RPC
// compares its auth.uid() with the active, server-owned chat/organization.
export function patchCopilotSessionGuard(workflow, anonKey) {
 const result=structuredClone(workflow);
 const webhook=result.nodes.filter(n=>n.type==='n8n-nodes-base.webhook');
 if(webhook.length!==1||webhook[0].parameters.responseMode!=='responseNode') throw Error('Expected one response-node webhook');
 if(result.nodes.some(n=>n.name==='Copilot Session Guard')) return result;
 const entry=webhook[0];
 const original=result.connections[entry.name];
 if(!original?.main?.[0]?.length||original.main.length!==1) throw Error('Unexpected ingress connections');
 if(JSON.parse(Buffer.from(anonKey.split('.')[1],'base64url')).role!=='anon') throw Error('Only a public anon key is allowed');
 result.nodes.push({id:'copilot-session-guard',name:'Copilot Session Guard',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[entry.position[0]+180,entry.position[1]],onError:'continueRegularOutput',parameters:{
  method:'POST',url:'https://glulgyhkrqpykxmujodb.supabase.co/rest/v1/rpc/copilot_ingress_actor',sendHeaders:true,
  headerParameters:{parameters:[{name:'apikey',value:anonKey},{name:'Authorization',value:"={{ $json.headers?.authorization || 'Bearer invalid' }}"}]},
  sendBody:true,specifyBody:'json',jsonBody:'={{ {p_chat_id: $json.body?.chat_id ?? null} }}',options:{timeout:10000}
 }});
 result.nodes.push({id:'copilot-session-authorized',name:'Copilot Session Authorized',type:'n8n-nodes-base.if',typeVersion:2.2,position:[entry.position[0]+360,entry.position[1]],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'verified-session',leftValue:'={{ $json.authorized === true }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}});
 result.nodes.push({id:'copilot-session-input',name:'Copilot Session Input',type:'n8n-nodes-base.code',typeVersion:2,position:[entry.position[0]+540,entry.position[1]],parameters:{jsCode:`const source = $('${entry.name.replaceAll("'","\\'")}').first();
const json = structuredClone(source.json);
delete json.headers;
return [{json,binary:source.binary}];`}});
 result.nodes.push({id:'copilot-session-denied',name:'Copilot Session Denied',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[entry.position[0]+540,entry.position[1]+180],parameters:{respondWith:'json',responseBody:'={{ {ok:false,error:"session_required",reply:"Tu sesión no corresponde a este Copilot. Actualiza la aplicación e inicia sesión."} }}',options:{responseCode:401}}});
 result.connections[entry.name]={main:[[{node:'Copilot Session Guard',type:'main',index:0}]]};
 result.connections['Copilot Session Guard']={main:[[{node:'Copilot Session Authorized',type:'main',index:0}]]};
 result.connections['Copilot Session Authorized']={main:[[{node:'Copilot Session Input',type:'main',index:0}],[{node:'Copilot Session Denied',type:'main',index:0}]]};
 result.connections['Copilot Session Input']=original;
 result.settings={...result.settings,saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveExecutionProgress:false};
 return result;
}
