import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {routes,classifyDelivery,failure} from './delivery.mjs';
const url=Deno.env.get('SB_URL')??Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SB_ANON_KEY')??Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SB_SERVICE_ROLE_KEY')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function rpc(name:string,args:unknown,token:string){
 const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:token==='Bearer '+service?service:anon,Authorization:token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('rpc_'+r.status);return r.json();
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 const token=req.headers.get('Authorization')||'';
 let body:any,actor:any;
 try{
  body=await req.json();
  if(!/^[a-f0-9-]{36}$/i.test(body.request_id)||!Object.hasOwn(routes,body.route)||typeof body.text!=='string'||body.text.length>20000)return reply({error:'invalid_request'},400);
  actor=await rpc('copilot_ingress_actor',{p_chat_id:body.chat_id},token);
  const only={nsg:'4a17b181-35d2-41b3-b639-6e0bd4c38acc',dental:'6c5cf32a-3db4-477d-bbed-26d90231bc9a'}[body.route];
  if(only&&actor.organization_id!==only)return reply({error:'session_required'},403);
 }catch{return reply({error:'session_required'},401);}
 let receipt:any;
 try{receipt=await rpc('copilot_delivery_begin',{p_id:body.request_id,p_text:body.text,p_callback:body.callback_data||'',p_route:body.route},token);}
 catch{return reply({error:'receipt_unavailable'},503);}
 if(!receipt.run)return reply(receipt.response?{...receipt.response,persisted:true,request_id:receipt.id}:{ok:false,pending:true,request_id:receipt.id,reply:{text:'Esta solicitud ya está en curso. Estoy esperando su respuesta; no necesitas enviarla otra vez.',inline_keyboard:[]}});
 let result;
 try{
  const response=await fetch('https://personal-n8n.suwsiw.easypanel.host/webhook/'+routes[body.route],{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:token},
   body:JSON.stringify({chat_id:actor.chat_id,text:body.text,callback_data:body.callback_data||undefined,original_type:body.callback_data?'callback':'text',request_id:receipt.id}),signal:AbortSignal.timeout(80000)});
  let data={};try{data=await response.json();}catch{/* Empty/HTML responses are delivery failures. */}
  result=classifyDelivery(response.status,data);
 }catch(e){result=failure(e.name==='TimeoutError'?'engine_timeout':'engine_network');}
 try{
  const saved=await rpc('fn_copilot_delivery_finish',{p_org:actor.organization_id,p_profile:actor.profile_id,p_id:receipt.id,p_status:result.status,p_response:result.response,p_code:result.code},'Bearer '+service);
  if(saved!==true)throw Error('receipt_state_changed');
 }catch(e){console.error('Copilot receipt finish failed',e.message);return reply({ok:false,pending:true,error:'receipt_unavailable',request_id:receipt.id,reply:{text:'La respuesta llegó, pero no pude confirmar su registro. Revisa la conversación antes de repetir la solicitud.',inline_keyboard:[]}},202);}
 return reply({...result.response,persisted:true,request_id:receipt.id});
});
