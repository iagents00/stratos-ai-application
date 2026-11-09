import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
test('switching accounts during a send cannot log or display the previous account response',async()=>{
 const server=await createServer({appType:'custom',logLevel:'error',server:{middlewareMode:true}});
 const original=globalThis.fetch;
 try {
  const {supabase}=await server.ssrLoadModule('/src/lib/supabase.js');
  const {getClientConfig}=await server.ssrLoadModule('/src/clients/index.js');
  const cfg=getClientConfig('nsg');
  let id='account-a',token='jwt-a';
  supabase.auth.getSession=async()=>({data:{session:{user:{id},access_token:token}}});
  const writes=[];
  globalThis.fetch=async(url,options)=>{
   const auth=new Headers(options.headers).get('Authorization');
   assert.equal(auth,'Bearer jwt-a');
   if(String(url).includes('/profiles?')) return Response.json({telegram_chat_id:-123,organization_id:cfg.tenant.organizationId,role:'asesor'});
   if(String(url).includes('/rpc/copilot_log_msg')) {writes.push(JSON.parse(options.body));return Response.json(null);}
   if(String(url).includes('/rpc/')) return Response.json(null);
   assert.match(String(url),/\/webhook\//);
   id='account-b';token='jwt-b';
   return Response.json({reply:'Private account A response'});
  };
  const {sendCopilotMessage}=await server.ssrLoadModule('/src/lib/telegram.js');
  const result=await sendCopilotMessage('Consulta privada',{actorId:'account-a',organizationId:cfg.tenant.organizationId});
  assert.equal(result.reply,null);assert.equal(result.error,'sesion_expirada');
  assert.deepEqual(writes,[{p_role:'user',p_content:'Consulta privada'}]);
  let contacted=false;
  globalThis.fetch=async()=>{contacted=true;throw Error('No request from a stale view');};
  assert.equal((await sendCopilotMessage('Vista anterior',{actorId:'account-a'})).error,'sesion_expirada');
  assert.equal(contacted,false);
 } finally {globalThis.fetch=original;await server.close();}
});
