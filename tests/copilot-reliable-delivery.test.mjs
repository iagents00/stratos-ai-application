import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {classifyDelivery} from '../supabase/functions/copilot-deliver/delivery.mjs';
test('empty HTTP success, quota and engine failures cannot become a successful action',()=>{
 for(const [status,body,code] of [[200,{},'empty_response'],[200,{ok:false,error:'provider_quota',reply:{text:'failed'}},'provider_quota'],[503,{},'engine_error'],[429,{},'provider_rate_limit']]){
  const r=classifyDelivery(status,body);assert.equal(r.status,'uncertain');assert.equal(r.code,code);assert.ok(r.response.reply.text);
 }
 assert.equal(classifyDelivery(200,{ok:true,reply:{text:'Real server receipt'}}).status,'completed');
});
test('a lost reply is recovered by receipt id without repeating the write',async()=>{
 const server=await createServer({appType:'custom',logLevel:'error',server:{middlewareMode:true}}),original=globalThis.fetch;
 try{
  const {deliverCopilot}=await server.ssrLoadModule('/src/lib/copilot-delivery.js');let attempts=0,lookups=0;
  const client={rpc:async(name,args)=>{if(name==='copilot_delivery_status'){lookups++;assert.equal(args.p_id,'request-test');return{data:{response:{ok:true,reply:{text:'Registered once'}}}};}return{data:true};}};
  globalThis.fetch=async(url,options)=>{attempts++;assert.match(url,/\/functions\/v1\/copilot-deliver$/);assert.equal(options.headers.Authorization,'Bearer fixed-user-token');throw Error('HTTP response lost');};
  const r=await deliverCopilot({client,session:{access_token:'fixed-user-token'},webhookUrl:'https://example.invalid/webhook/copilot-transcribe',chatId:-123,text:'Register client',requestId:'request-test'});
  assert.equal(attempts,1);assert.equal(lookups,1);assert.equal(r.data.reply.text,'Registered once');assert.equal(r.data.persisted,true);
 }finally{globalThis.fetch=original;await server.close();}
});
