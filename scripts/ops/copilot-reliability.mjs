export const monitoredWorkflows=['8ZasBukTkSx26m2A','vM5Yu1HRmUDPOCg7','lplLwsnJapOXtFcs','5YYDRgEQRMpj7NlE','ZoOugv5dN3bVeXof','rYCZkrrReAxmhWNl'];
export function opsErrorWorkflow(serviceKey){
 return{name:'Stratos Copilot · errores sin contenido privado',nodes:[
  {id:'ops-error-in',name:'Workflow error',type:'n8n-nodes-base.errorTrigger',typeVersion:1,position:[0,0],parameters:{}},
  {id:'ops-error-classify',name:'Classify safely',type:'n8n-nodes-base.code',typeVersion:2,position:[220,0],parameters:{jsCode:`const raw=JSON.stringify($input.first().json||{}).toLowerCase();
const code=/insufficient_quota|credit_balance|billing_hard_limit/.test(raw)?'provider_quota':/rate.?limit|429/.test(raw)?'provider_rate_limit':/api.?key|unauthorized|401/.test(raw)?'provider_auth':'workflow_error';
return [{json:{code}}];`}},
  {id:'ops-error-report',name:'Queue support incident',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[440,0],parameters:{method:'POST',url:'https://glulgyhkrqpykxmujodb.supabase.co/rest/v1/rpc/fn_copilot_ops_report',sendHeaders:true,headerParameters:{parameters:[{name:'apikey',value:serviceKey},{name:'Authorization',value:'Bearer '+serviceKey}]},sendBody:true,specifyBody:'json',jsonBody:"={{ {p_org:'4a17b181-35d2-41b3-b639-6e0bd4c38acc',p_component:'n8n',p_code:$json.code} }}",options:{timeout:10000}}},
 ],connections:{'Workflow error':{main:[[{node:'Classify safely',type:'main',index:0}]]},'Classify safely':{main:[[{node:'Queue support incident',type:'main',index:0}]]}},settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveExecutionProgress:false}};
}
export function patchCopilotReliability(workflow,errorWorkflow){
 const w=structuredClone(workflow);w.settings={...w.settings,errorWorkflow};
 if(w.id!=='8ZasBukTkSx26m2A')return w;
 if(w.nodes.some(n=>n.name==='Copilot Delivery Failure'))return w;
 const risky=['Contexto Reciente','Intérprete','AI Agent','Agente Actividades','Parse Pick','Parse Actividades','Parse Intérprete','Dispatch verbatim','Handle Callback','Whisper Transcribe','Zoom consistency sync','Normalize Reply'];
 for(const name of risky){const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('Missing '+name);n.onError='continueErrorOutput';const c=w.connections[name]||{main:[[]]};if(!c.main||c.main.length>1)throw Error('Review existing error route: '+name);c.main[1]=[{node:'Copilot Delivery Failure',type:'main',index:0}];w.connections[name]=c;}
 w.nodes.push({id:'copilot-failure-result',name:'Copilot Delivery Failure',type:'n8n-nodes-base.code',typeVersion:2,position:[1800,1000],parameters:{jsCode:`const raw=JSON.stringify($input.first().json||{}).toLowerCase();
const code=/insufficient_quota|credit_balance|billing_hard_limit/.test(raw)?'provider_quota':/rate.?limit|429/.test(raw)?'provider_rate_limit':/api.?key|unauthorized|401/.test(raw)?'provider_auth':'engine_error';
return [{json:{ok:false,error:code,reply:{text:'No pude confirmar tu solicitud. La conversación conserva lo que enviaste; revisa el CRM antes de repetirla. El equipo recibirá un aviso para revisarlo.',inline_keyboard:[]}}}];`}});
 w.nodes.push({id:'copilot-failure-report',name:'Copilot Report Failure',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[2000,1000],onError:'continueRegularOutput',parameters:{method:'POST',url:"={{ $('Global Config').first().json.SUPABASE_URL + '/rest/v1/rpc/fn_copilot_ops_report' }}",sendHeaders:true,headerParameters:{parameters:[{name:'apikey',value:"={{ $('Global Config').first().json.SUPABASE_SERVICE_ROLE_KEY }}"},{name:'Authorization',value:"={{ 'Bearer ' + $('Global Config').first().json.SUPABASE_SERVICE_ROLE_KEY }}"}]},sendBody:true,specifyBody:'json',jsonBody:"={{ {p_org:$('Copilot Session Guard').first().json.organization_id,p_component:'copilot',p_code:$('Copilot Delivery Failure').first().json.error} }}",options:{timeout:5000}}});
 w.nodes.push({id:'copilot-failure-response',name:'Copilot Failure Response',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[2200,1000],parameters:{respondWith:'json',responseBody:"={{ $('Copilot Delivery Failure').first().json }}",options:{responseCode:200}}});
 w.connections['Copilot Delivery Failure']={main:[[{node:'Copilot Report Failure',type:'main',index:0}]]};w.connections['Copilot Report Failure']={main:[[{node:'Copilot Failure Response',type:'main',index:0}]]};
 return w;
}

// Gmail is used without a model. The deterministic Message-ID permits checking
// an uncertain mail delivery before attempting the same incident again.
export function opsMailWorkflow(secret,gmailCredential){
 return {name:'Stratos Copilot · correo de incidencias',nodes:[
  {id:'ops-mail-in',name:'Ops Mail',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],parameters:{httpMethod:'POST',path:'stratos-copilot-ops-mail',responseMode:'responseNode',options:{}}},
  {id:'ops-mail-gate',name:'Validate incident',type:'n8n-nodes-base.code',typeVersion:2,position:[220,0],parameters:{jsCode:`const source=$input.first().json;
if(source.headers?.['x-copilot-ops-secret']!==${JSON.stringify(secret)})throw Error('Unauthorized');
const b=source.body||{};
if(!/^[a-f0-9-]{36}$/i.test(b.id)||typeof b.text!=='string'||b.text.length>2500)throw Error('Invalid incident');
const id='copilot-incident-'+b.id+'@stratoscapitalgroup.com';
const mime='To: angelgarzonsarzosa@gmail.com\\r\\nSubject: Stratos Copilot - incidencia '+b.id.slice(0,8)+'\\r\\nMessage-ID: <'+id+'>\\r\\nMIME-Version: 1.0\\r\\nContent-Type: text/plain; charset=UTF-8\\r\\n\\r\\n'+b.text;
return [{json:{messageId:id,raw:Buffer.from(mime).toString('base64url')}}];`}},
  {id:'ops-mail-check',name:'Check existing mail',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[440,0],credentials:{gmailOAuth2:gmailCredential},parameters:{url:'https://gmail.googleapis.com/gmail/v1/users/me/messages',authentication:'predefinedCredentialType',nodeCredentialType:'gmailOAuth2',sendQuery:true,queryParameters:{parameters:[{name:'q',value:"={{ 'in:sent rfc822msgid:'+$json.messageId }}"},{name:'maxResults',value:'1'}]},options:{timeout:15000}}},
  {id:'ops-mail-exists',name:'Mail exists',type:'n8n-nodes-base.if',typeVersion:2.2,position:[660,0],parameters:{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:'exists',leftValue:'={{ ($json.messages || []).length > 0 }}',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}}},
  {id:'ops-mail-send',name:'Send incident mail',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[880,120],credentials:{gmailOAuth2:gmailCredential},parameters:{method:'POST',url:'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',authentication:'predefinedCredentialType',nodeCredentialType:'gmailOAuth2',sendBody:true,specifyBody:'json',jsonBody:"={{ {raw:$('Validate incident').first().json.raw} }}",options:{timeout:15000}}},
  {id:'ops-mail-response',name:'Mail receipt',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[1100,0],parameters:{respondWith:'json',responseBody:'={{ {ok:true,id:$json.id || $json.messages?.[0]?.id} }}'}},
 ],connections:{'Ops Mail':{main:[[{node:'Validate incident',type:'main',index:0}]]},'Validate incident':{main:[[{node:'Check existing mail',type:'main',index:0}]]},'Check existing mail':{main:[[{node:'Mail exists',type:'main',index:0}]]},'Mail exists':{main:[[{node:'Mail receipt',type:'main',index:0}],[{node:'Send incident mail',type:'main',index:0}]]},'Send incident mail':{main:[[{node:'Mail receipt',type:'main',index:0}]]}},settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveExecutionProgress:false}};
}
