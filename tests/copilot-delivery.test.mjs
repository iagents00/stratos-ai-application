import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('Copilot never retries an uncertain write and still accepts direct replies', async () => {
 const server=await createServer({appType:'custom',logLevel:'error',server:{middlewareMode:true}});
 const originalFetch=globalThis.fetch;
 try {
  const {supabase}=await server.ssrLoadModule('/src/lib/supabase.js');
  const {getClientConfig}=await server.ssrLoadModule('/src/clients/index.js');
  const cfg=getClientConfig('nsg');
  supabase.auth.getSession=async()=>({data:{session:{user:{id:'audit-test-user'}}}});
  supabase.from=()=>({select(){return this},eq(){return this},abortSignal(){return this},single:async()=>({data:{telegram_chat_id:123,role:'asesor',organization_id:cfg.tenant.organizationId}})});
  supabase.rpc=async()=>({data:null,error:null});
  const {sendCopilotMessage}=await server.ssrLoadModule('/src/lib/telegram.js');
  let attempts=0;
  globalThis.fetch=async()=>{attempts++;throw new TypeError('response lost');};
  const uncertain=await sendCopilotMessage('Mensaje de prueba aislada');
  assert.equal(attempts,1);assert.equal(uncertain.slow,true);
  attempts=0;globalThis.fetch=async()=>{attempts++;return new Response('unavailable',{status:503});};
  const serverError=await sendCopilotMessage('Mensaje de prueba aislada');
  assert.equal(attempts,1);assert.equal(serverError.slow,true);
  globalThis.fetch=async()=>new Response(JSON.stringify({reply:'Respuesta verificada del asistente.'}));
  const ok=await sendCopilotMessage('Mensaje de prueba aislada');
  assert.equal(ok.reply,'Respuesta verificada del asistente.');assert.equal(ok.error,null);
 }finally{globalThis.fetch=originalFetch;await server.close();}
});
