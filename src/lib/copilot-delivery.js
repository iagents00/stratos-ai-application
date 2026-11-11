import {SUPABASE_REST_URL,SUPABASE_ANON_KEY} from './supabase';
const paths={'copilot-transcribe':'crm','copilot-marketing':'marketing','copilot-tenant':'tenant','copilot-nsg-c4d81e2f':'nsg','copilot-dental-9f2c7a41':'dental'};
export function reportCopilotProblem(client,component,code){
 try{Promise.resolve(client.rpc('copilot_report_problem',{p_component:component,p_code:code})).catch(()=>{});}catch{/* Reporting must not block the user. */}
}
export async function deliverCopilot({client,session,webhookUrl,chatId,text,callback,requestId=crypto.randomUUID()}){
 const route=paths[new URL(webhookUrl).pathname.split('/').pop()];
 if(!route)return {error:'delivery_route_unavailable'};
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),95000);
 try{
  const r=await fetch(SUPABASE_REST_URL+'/functions/v1/copilot-deliver',{method:'POST',signal:ctrl.signal,
   headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
   body:JSON.stringify({request_id:requestId,route,chat_id:chatId,text,callback_data:callback||undefined})});
  if(r.status===401||r.status===403)return{error:'sesion_expirada'};
  const data=await r.json();
  if(data?.reply&&(typeof data.reply==='string'||data.reply.text))return{data};
  reportCopilotProblem(client,'copilot','empty_response');
 }catch(e){reportCopilotProblem(client,'copilot',e.name==='AbortError'?'delivery_timeout':'delivery_network');}
 finally{clearTimeout(timer);}
 // Ask for the result of this exact request. Never resend an uncertain write.
 try{
  const {data}=await client.rpc('copilot_delivery_status',{p_id:requestId});
  if(data?.response)return{data:{...data.response,persisted:true,request_id:requestId}};
 }catch{/* The same receipt remains available on the next refresh. */}
 return {data:{pending:true,request_id:requestId,reply:{text:'No pude confirmar todavía la respuesta. Conservé tu mensaje en la conversación; revisa su estado antes de enviarlo otra vez.',inline_keyboard:[]}}};
}
