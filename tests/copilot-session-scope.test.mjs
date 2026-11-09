import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
test('history discards stale account responses and sends push registration with the signed-in JWT',async()=>{
 const server=await createServer({appType:'custom',logLevel:'error',server:{middlewareMode:true}});
 const savedFetch=globalThis.fetch;
 try{
  const {supabase}=await server.ssrLoadModule('/src/lib/supabase.js');
  let user='a', reads=0;
  supabase.auth.getSession=async()=>({data:{session:{user:{id:user},access_token:'verified-session-token'}}});
  supabase.from=()=>({select(){return this},eq(){return this},abortSignal(){return this},single:async()=>({data:{telegram_chat_id:-1,organization_id:'org-a'}}),or(){return this},order(){return this},limit:async()=>({data:[]})});
  supabase.rpc=async()=>{reads++;user='b';return {data:[{id:1,content:'Private tenant A content',role:'ai'}]};};
  const {getCopilotActivity}=await server.ssrLoadModule('/src/lib/telegram.js');
  assert.deepEqual((await getCopilotActivity(50,{id:'a',organizationId:'org-a'})).messages,[]);
  assert.equal(reads,1);
  const mismatch=await getCopilotActivity(50,{id:'a',organizationId:'org-a'});
  assert.deepEqual(mismatch.messages,[]);assert.equal(reads,1);
  const push=await server.ssrLoadModule('/src/lib/push.js');
  // The public key remains an apikey; it is never the actor's Authorization.
  push.initPushContext('https://example.invalid','public-anon');
  let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer verified-session-token');return new Response('{}');};
  const subscription={toJSON:()=>({endpoint:'device',keys:{p256dh:'key',auth:'auth'}})};
  assert.equal(await push.saveSubscriptionToBackend('a',subscription),false);
  assert.equal(calls,0);
  assert.equal(await push.saveSubscriptionToBackend('b',subscription),true);
  assert.equal(calls,1);
 }finally{globalThis.fetch=savedFetch;await server.close();}
});

