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
  supabase.auth.getSession=async()=>({data:{session:{access_token:'session-test-token',user:{id:'audit-test-user'}}}});
  supabase.from=()=>({select(){return this},eq(){return this},abortSignal(){return this},single:async()=>({data:{telegram_chat_id:123,role:'asesor',organization_id:cfg.tenant.organizationId}})});
  supabase.rpc=async()=>({data:null,error:null});
  const {sendCopilotMessage}=await server.ssrLoadModule('/src/lib/telegram.js');
  const modelFetch = handler => async (url, options) => {
    if(String(url).includes('/functions/v1/copilot-deliver')) return handler(url,options);
    if(String(url).includes('/profiles?')) return new Response(JSON.stringify({telegram_chat_id:123,role:'asesor',organization_id:cfg.tenant.organizationId}),{headers:{'Content-Type':'application/json'}});
    return new Response('null',{headers:{'Content-Type':'application/json'}});
  };
  let attempts=0;
  globalThis.fetch=modelFetch(async()=>{attempts++;throw new TypeError('response lost');});
  const uncertain=await sendCopilotMessage('Mensaje de prueba aislada');
  assert.equal(attempts,1);assert.match(uncertain.reply,/confirmar/);
  attempts=0;globalThis.fetch=modelFetch(async()=>{attempts++;return new Response('unavailable',{status:503});});
  const serverError=await sendCopilotMessage('Mensaje de prueba aislada');
  assert.equal(attempts,1);assert.match(serverError.reply,/confirmar/);
  globalThis.fetch=modelFetch(async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer session-test-token');return new Response(JSON.stringify({reply:'Respuesta verificada del asistente.'}));});
  const ok=await sendCopilotMessage('Mensaje de prueba aislada');
  assert.equal(ok.reply,'Respuesta verificada del asistente.');assert.equal(ok.error,null);
 }finally{globalThis.fetch=originalFetch;await server.close();}
});
