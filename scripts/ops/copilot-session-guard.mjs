// No service credential is needed: PostgREST verifies the user's JWT and the RPC
// compares its auth.uid() with the active, server-owned chat/organization.
export function patchCopilotSessionGuard(workflow, anonKey) {
 const result=structuredClone(workflow);
 const webhook=result.nodes.filter(n=>n.type==='n8n-nodes-base.webhook');
 if(webhook.length!==1||webhook[0].parameters.responseMode!=='responseNode') throw Error('Expected one response-node webhook');
 const exclusiveOrg={
  'copilot-nsg-c4d81e2f':'4a17b181-35d2-41b3-b639-6e0bd4c38acc',
  'copilot-dental-9f2c7a41':'6c5cf32a-3db4-477d-bbed-26d90231bc9a',
 }[webhook[0].parameters.path];
 const authorizedExpression=exclusiveOrg
  ? `={{ $json.authorized === true && $json.organization_id === ${JSON.stringify(exclusiveOrg)} }}`
  : '={{ $json.authorized === true }}';
 const inputCode = `const source = $('${webhook[0].name.replaceAll("'","\\'")}').first();
const json = {...source.json};
delete json.headers;
const item = {json};
if (source.binary) item.binary = source.binary;
return [item];`;
 // Older installed apps did not attach a session to the webhook. They also
 // discard non-2xx response bodies, hiding the instructions needed to recover.
 // Return a readable rejection to those clients without entering the CRM path.
 const sourceHeaders = `$('${webhook[0].name.replaceAll("'","\\'")}').first().json.headers`;
 const hasSession = `Boolean(${sourceHeaders}?.authorization)`;
 const deniedParameters = {
  respondWith:'json',
  responseBody:`={{ ${hasSession} ? {ok:false,error:"session_required",reply:"Tu sesión no corresponde a este Copilot. Actualiza la aplicación e inicia sesión."} : {ok:false,error:"client_update_required",reply:{text:"Tu versión de Stratos AI necesita actualizarse para usar el Copilot. Actualiza la app o abre la versión web actualizada y vuelve a enviar tu solicitud. Este intento no registró ningún cambio.",inline_keyboard:[[{text:"Actualizar en iPhone",url:"https://apps.apple.com/app/id6804826565"}],[{text:"Abrir Stratos actualizado",url:"https://app.getstratosai.com"}]]}} }}`,
  options:{responseCode:`={{ ${hasSession} ? 401 : 200 }}`},
 };
 if(result.nodes.some(n=>n.name==='Copilot Session Guard')) {
  const input=result.nodes.find(n=>n.name==='Copilot Session Input');
  if(!input) throw Error('Incomplete session guard');
  input.parameters.jsCode=inputCode;
  const condition=result.nodes.find(n=>n.name==='Copilot Session Authorized')?.parameters?.conditions?.conditions;
  if(condition?.length!==1||condition[0].id!=='verified-session') throw Error('Session condition changed');
  condition[0].leftValue=authorizedExpression;
  const denied=result.nodes.find(n=>n.name==='Copilot Session Denied');
  if(!denied) throw Error('Incomplete session rejection');
  denied.parameters=deniedParameters;
  return result;
 }
 const entry=webhook[0];
 const original=result.connections[entry.name];
 if(!original?.main?.[0]?.length||original.main.length!==1) throw Error('Unexpected ingress connections');
 if(JSON.parse(Buffer.from(anonKey.split('.')[1],'base64url')).role!=='anon') throw Error('Only a public anon key is allowed');
 result.nodes.push({id:'copilot-session-guard',name:'Copilot Session Guard',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[entry.position[0]+180,entry.position[1]],onError:'continueRegularOutput',parameters:{
  method:'POST',url:'https://glulgyhkrqpykxmujodb.supabase.co/rest/v1/rpc/copilot_ingress_actor',sendHeaders:true,
  headerParameters:{parameters:[{name:'apikey',value:anonKey},{name:'Authorization',value:"={{ $json.headers?.authorization || 'Bearer invalid' }}"}]},
  sendBody:true,specifyBody:'json',jsonBody:'={{ {p_chat_id: $json.body?.chat_id ?? null} }}',options:{timeout:10000}
 }});
 result.nodes.push({id:'copilot-session-authorized',name:'Copilot Session Authorized',type:'n8n-nodes-base.if',typeVersion:2.2,position:[entry.position[0]+360,entry.position[1]],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'verified-session',leftValue:authorizedExpression,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}});
 result.nodes.push({id:'copilot-session-input',name:'Copilot Session Input',type:'n8n-nodes-base.code',typeVersion:2,position:[entry.position[0]+540,entry.position[1]],parameters:{jsCode:inputCode}});
 result.nodes.push({id:'copilot-session-denied',name:'Copilot Session Denied',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[entry.position[0]+540,entry.position[1]+180],parameters:deniedParameters});
 result.connections[entry.name]={main:[[{node:'Copilot Session Guard',type:'main',index:0}]]};
 result.connections['Copilot Session Guard']={main:[[{node:'Copilot Session Authorized',type:'main',index:0}]]};
 result.connections['Copilot Session Authorized']={main:[[{node:'Copilot Session Input',type:'main',index:0}],[{node:'Copilot Session Denied',type:'main',index:0}]]};
 result.connections['Copilot Session Input']=original;
 result.settings={...result.settings,saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveExecutionProgress:false};
 return result;
}
