import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { changeOwnPassword } from '../src/lib/password-change.js';

const source = stripTypeScriptTypes(readFileSync('supabase/functions/password-recovery/index.ts','utf8').replace(/^import .*;\n/gm,''));
function edge(options = {}) {
  let handler; const calls = [], updates = [], mails = [];
  const context = vm.createContext({ Request, Response, TextEncoder, AbortSignal, crypto: webcrypto, console: { error() {} },
    createClient: () => ({
      rpc: async (name, args) => { calls.push({name,args}); return name === 'fn_recovery_prepare'
        ? {data:{sent: options.sent ?? true,recovery_email:'mail@example.com',name:'Test'},error:options.dbError}
        : {data:options.confirm ?? {ok:true,user_id:'user-a'}}; },
      auth:{admin:{updateUserById:async(id,body)=>{updates.push({id,body});return options.update ?? {data:{user:{id}}};}}},
      from:()=>({insert:async()=>({error:null})}),
    }),
    fetch: async (_url, args) => { mails.push(JSON.parse(args.body)); if(options.throwMail) throw new Error('timeout'); return new Response(JSON.stringify(options.mailBody ?? {ok:true}),{status:options.mailStatus ?? 200}); },
    Deno:{env:{get:key=>({SUPABASE_SERVICE_ROLE_KEY:options.serviceKey ?? 'service',RECOVERY_CODE_PEPPER:'stable-test-pepper',N8N_RECOVERY_SECRET:options.missingSecret?'':'secret'}[key])},serve:fn=>{handler=fn;}},
  });
  vm.runInContext(source, context);
  return {calls,updates,mails,call:async(body,method='POST')=>{const r=await handler(new Request('https://stratos.test',{method,body:method==='POST'?JSON.stringify(body):undefined}));return {status:r.status,body:await r.json()};}};
}
test('recovery edge validates input and requires confirmed provider delivery',async()=>{
  for(const opts of [{dbError:{message:'offline'}},{throwMail:true},{mailStatus:401},{mailBody:{ok:false}},{missingSecret:true}]) {
    const h=edge(opts), r=await h.call({action:'request',email:'a@example.com'});
    assert.equal(r.status,503); assert.equal(r.body.ok,false); assert.equal(h.updates.length,0);
  }
  const h=edge(); assert.equal((await h.call(null)).status,400);
  assert.equal((await h.call({},'GET')).status,405);
  assert.equal((await h.call({action:'request',email:'invalid'})).body.ok,false);
  assert.equal(h.calls.length,0);
  assert.equal((await h.call({action:'request',email:' A@Example.COM '})).body.ok,true);
  assert.equal(h.calls[0].args.p_email,'a@example.com');
  assert.match(h.mails[0].code,/^\d{6}$/); assert.equal(h.calls[0].args.p_code_hash,createHash('sha256').update(`${h.mails[0].code}:a@example.com:stable-test-pepper`).digest('hex'));
  const rotated=edge({serviceKey:'rotated-service'});await rotated.call({action:'request',email:'a@example.com'});assert.equal(rotated.calls[0].args.p_code_hash,createHash('sha256').update(`${rotated.mails[0].code}:a@example.com:stable-test-pepper`).digest('hex'));
  const absent=edge({sent:false}); const unknown=await absent.call({action:'request',email:'none@example.com'});
  assert.equal(unknown.body.ok,true); assert.equal(absent.mails.length,0); assert.equal('recovery_email' in unknown.body,false);
});
test('recovery edge changes only the verified identity and never reports unconfirmed success',async()=>{
  const payload={action:'verify',email:'a@example.com',code:'123456',password:'Test-Password-123'};
  for(const reason of ['expired','invalid','too_many','no_code']) {
    const h=edge({confirm:{ok:false,reason}});assert.equal((await h.call(payload)).body.ok,false);assert.equal(h.updates.length,0);
  }
  for(const update of [{error:{message:'weak'}},{data:{user:null}},{data:{user:{id:'other'}}}]) {
    assert.match((await edge({update}).call(payload)).body.error,/código nuevo/);
  }
  const h=edge(); assert.equal((await h.call({...payload,user_id:'victim'})).body.ok,true);assert.equal(h.updates[0].id,'user-a');
  for(const invalid of [{code:'1'},{password:'short'},{email:'bad'}]) assert.equal((await edge().call({...payload,...invalid})).body.ok,false);
});
test('password changes refresh expired sessions and handle server failures and timeouts',async()=>{
  const session={user:{id:'self'},expires_at:Date.now()/1000+3600};let refreshed=0,updated=0;
  const client={auth:{getSession:async()=>({data:{session}}),refreshSession:async()=>{refreshed++;return {data:{session:{...session,expires_at:Date.now()/1000+3600}}};},updateUser:async()=>{updated++;return {data:{user:{id:'self'}}};}}};
  assert.equal((await changeOwnPassword(client,'new-password')).ok,true);assert.equal(refreshed,0);
  session.expires_at=1;assert.equal((await changeOwnPassword(client,'new-password')).ok,true);assert.equal(refreshed,1);
  assert.equal((await changeOwnPassword(client,'short')).ok,false);assert.equal(updated,2);
  client.auth.updateUser=async()=>{throw new Error('network');};assert.equal((await changeOwnPassword(client,'new-password')).ok,false);
  client.auth.updateUser=async()=>({data:{user:{id:'other'}}});assert.equal((await changeOwnPassword(client,'new-password')).ok,false);
  client.auth.updateUser=()=>new Promise(()=>{});assert.equal((await changeOwnPassword(client,'new-password',{timeoutMs:5})).ok,false);
  client.auth.refreshSession=async()=>({data:{session:null}});assert.match((await changeOwnPassword(client,'new-password')).error,/expiró/);
});
test('recovery SQL enforces expiry, single use, attempts, rate limits, aliases and permissions',async()=>{
  const db=new PGlite();
  const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text);
      create table profiles(id uuid primary key,name text,recovery_email text,active boolean default true);
      grant usage on schema public to anon,authenticated,service_role;`);
    await db.exec(readFileSync('supabase/migrations/056_password_reset_codes.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/269_password_recovery_guards.sql','utf8'));
    for(let i=1;i<=4;i++){
      await db.query('insert into auth.users values($1,$2)',[uid(i),`user${i}@example.com`]);
      await db.query('insert into profiles values($1,$2,$3,$4)',[uid(i),`User ${i}`,i===4?null:i===1?'recovery@example.com':'shared@example.com',i!==3]);
    }
    const prep=async(email,hash='hash')=>(await db.query('select fn_recovery_prepare($1,$2,null,15) r',[email,hash])).rows[0].r;
    const confirm=async(email,hash='hash')=>(await db.query('select fn_recovery_confirm($1,$2) r',[email,hash])).rows[0].r;
    assert.equal((await prep('nobody@example.com')).sent,false);
    assert.equal((await prep('user4@example.com')).sent,false);
    assert.equal((await prep('shared@example.com')).sent,false,'shared alias must never pick an arbitrary tenant');
    assert.equal((await prep('user3@example.com')).sent,false,'disabled accounts cannot recover');
    assert.equal((await prep('user2@example.com')).sent,true,'exact login still resolves a shared mailbox');
    assert.equal((await confirm('user2@example.com')).user_id,uid(2));
    assert.equal((await prep(' USER1@EXAMPLE.COM ')).sent,true);
    assert.equal((await confirm('user1@example.com')).user_id,uid(1));
    assert.equal((await confirm('user1@example.com')).ok,false,'single-use');
    await prep('user1@example.com');
    await db.query('update password_reset_codes set expires_at=now()-interval \'1 second\' where user_id=$1',[uid(1)]);
    assert.equal((await confirm('user1@example.com')).reason,'expired');
    await prep('user1@example.com');
    for(let i=0;i<5;i++) assert.equal((await confirm('user1@example.com','wrong')).ok,false);
    assert.equal((await confirm('user1@example.com')).reason,'too_many');
    await prep('user1@example.com','old');await prep('user1@example.com','new');
    assert.equal((await prep('user1@example.com')).reason,'rate_limited');
    assert.equal((await confirm('user1@example.com','old')).ok,false);
    assert.equal((await confirm('user1@example.com','new')).ok,true);
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      await assert.rejects(prep('user1@example.com'),/permission denied/);
      await assert.rejects(confirm('user1@example.com'),/permission denied/);
      await assert.rejects(db.query('select * from password_reset_codes'),/permission denied/);
      await db.exec('reset role');
    }
  } finally {await db.close();}
});

test('client recovery handles transport errors, validates before sending and normalizes email',async()=>{
  const code=readFileSync('src/lib/recovery.js','utf8').replace(/^import .*;\n/gm,'').replace(/export async function/g,'async function');
  let reply={data:{ok:true,message:'generic'}},calls=[];
  const context=vm.createContext({AbortController,setTimeout,clearTimeout,logAuthEvent:()=>{},supabase:{functions:{invoke:async(name,args)=>{calls.push({name,args});return reply;}}}});
  vm.runInContext(code,context);
  assert.equal((await context.requestRecoveryCode('invalid')).ok,false);assert.equal(calls.length,0);
  assert.equal((await context.requestRecoveryCode(' A@Example.COM ')).ok,true);assert.equal(calls[0].args.body.email,'a@example.com');
  reply={error:{context:new Response(JSON.stringify({error:'No se pudo enviar el código.'}),{status:503})}};
  assert.equal((await context.requestRecoveryCode('a@example.com')).error,'No se pudo enviar el código.');
  reply={error:new Error('offline')};assert.equal((await context.requestRecoveryCode('a@example.com')).ok,false);
  const count=calls.length;assert.equal((await context.verifyRecoveryCode('a@example.com','123','new-password')).ok,false);assert.equal(calls.length,count);
});
