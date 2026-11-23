export const routes={crm:'copilot-transcribe',marketing:'copilot-marketing',tenant:'copilot-tenant',nsg:'copilot-nsg-c4d81e2f',dental:'copilot-dental-9f2c7a41'};
export function classifyDelivery(status,body){
 const reply=typeof body?.reply==='string'?body.reply:body?.reply?.text;
 if(status>=200&&status<300&&typeof reply==='string'&&reply.trim()&&body.ok!==false)return{status:'completed',response:body,code:null};
 const code=['provider_quota','provider_auth','provider_rate_limit','engine_error','client_update_required'].includes(body?.error)?body.error:status===401||status===403?'session_rejected':status===429?'provider_rate_limit':status>=500?'engine_error':'empty_response';
 return failure(code);
}
export function failure(code){
 return {status:'uncertain',code,response:{ok:false,error:code,reply:{text:'No pude confirmar la respuesta del asistente. Tu solicitud quedó identificada; revisa la conversación antes de repetirla. Ya avisamos al equipo de soporte.',inline_keyboard:[]}}};
}
export function isRegistrationAcceptance(text){
 const clean=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 return /^(si|si registrar|si confirmar|confirmo|confirmar|adelante|de acuerdo|dale|ok|registralo|hazlo|correcto)$/.test(clean);
}
