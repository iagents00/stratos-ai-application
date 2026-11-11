import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';
test('audio uploads keep their MIME type, require a session, and return recoverable failures',async()=>{
 const server=await createServer({appType:'custom',logLevel:'error',server:{middlewareMode:true}}),original=globalThis.fetch;
 try{
  const {supabase}=await server.ssrLoadModule('/src/lib/supabase.js');
  const {transcribirEnServidor}=await server.ssrLoadModule('/src/lib/transcribir.js');
  let token='voice-session',calls=0;
  supabase.auth.getSession=async()=>({data:{session:token?{access_token:token}:null}});
  const blob=new Blob(['test-audio'],{type:'audio/mp4'});
  globalThis.fetch=async(url,options)=>{calls++;assert.match(url,/functions\/v1\/transcribir-voz$/);assert.equal(options.headers.authorization,'Bearer voice-session');assert.ok(options.signal);assert.equal(options.body.get('audio').name,'dictado.mp4');return Response.json({ok:true,texto:'Registrar a una cliente'});};
  assert.equal((await transcribirEnServidor(blob)).texto,'Registrar a una cliente');
  token=null;assert.match((await transcribirEnServidor(blob)).error,/sesión/);assert.equal(calls,1);
  token='voice-session';globalThis.fetch=async()=>Response.json({error:'sin_saldo'},{status:402});
  assert.match((await transcribirEnServidor(blob)).error,/Conservé tu audio/);
  globalThis.fetch=async()=>{throw Error('Network lost');};
  assert.match((await transcribirEnServidor(blob)).error,/Conservé tu audio/);
  assert.equal(blob.size,10);
 }finally{globalThis.fetch=original;await server.close();}
});
