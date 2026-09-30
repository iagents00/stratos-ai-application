import test from 'node:test';
import assert from 'node:assert/strict';
import { currencyCode, isCurrentMonth, summarizeMovements, fetchAllRows, csvCell } from '../src/lib/financial-data.js';
import ogLanding from '../api/og-landing.js';
import pushRefresh from '../api/push/refresh.js';
const now = new Date(2026, 8, 12, 12);
const rows = [
 {amount:100, tipo:'ingreso', currency:'USD', spent_at:new Date(2026,8,2).toISOString()},
 {amount:35, tipo:'egreso', currency:'USD', spent_at:new Date(2026,8,3).toISOString()},
 {amount:5000, tipo:'ingreso', currency:'MXN', spent_at:new Date(2026,8,3).toISOString()},
 {amount:999, tipo:'ingreso', currency:'USD', spent_at:new Date(2026,9,1).toISOString()},
 {amount:99, tipo:'ingreso', currency:'USD', spent_at:'invalid'},
];
test('monthly totals isolate currency, next month and invalid dates',()=>{
 assert.deepEqual(summarizeMovements(rows,'USD',now), {ing:100,egr:35,bal:65,count:2});
 assert.equal(summarizeMovements(rows,'MXN',now).bal,5000);
 assert.equal(currencyCode(null),'SIN MONEDA');
 assert.equal(currencyCode(' usdt '),'USDT');
 assert.equal(isCurrentMonth(new Date(2025,8,12),now),false);
});
test('financial history fetches beyond 1000 and surfaces later page failure',async()=>{
 const data=Array.from({length:1251},(_,id)=>({id})); const ranges=[];
 const result=await fetchAllRows(()=>({range:async(a,b)=>{ranges.push([a,b]);return {data:data.slice(a,b+1)};}}));
 assert.equal(result.data.length,1251);assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
 await assert.rejects(fetchAllRows(()=>({range:async(a)=>a?{error:new Error('unavailable')}:{data:data.slice(0,500)}})),/unavailable/);
});
test('CSV cells prevent formula execution and preserve quotes and line breaks',()=>{
 assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
 assert.equal(csvCell(' +SUM(A1:A2)'),"' +SUM(A1:A2)");
 assert.equal(csvCell('a,b\nc'),'"a,b\nc"');assert.equal(csvCell('USD'),'USD');
});
function response(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};}
test('portfolio handler rejects host injection and verifies upstream HTTP status',async()=>{
 const original=globalThis.fetch;const urls=[];
 try{
  globalThis.fetch=async(url)=>{urls.push(url);return new Response('<html><head><title>Old</title></head></html>');};
  const res=response();await ogLanding({method:'GET',headers:{host:'127.0.0.1:8000'}},res);
  assert.equal(urls[0],'https://app.stratoscapitalgroup.com/index.html');assert.equal(res.statusCode,200);
  assert.match(res.body,/Portafolio Personalizado/);assert.doesNotMatch(res.body,/127\.0/);
  globalThis.fetch=async()=>new Response('fail',{status:503});
  const err=response();await ogLanding({method:'GET',headers:{}},err);assert.equal(err.statusCode,302);assert.equal(err.headers.Location,'/index.html');
 }finally{globalThis.fetch=original;}
});
test('push refresh rejects missing previous ownership before making any request',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;throw new Error('unexpected');};
 const res=response();await pushRefresh({method:'POST',body:{newSubscription:{endpoint:'https://push.example/new',keys:{p256dh:'a',auth:'b'}}}},res);
 assert.equal(res.statusCode,400);assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
test('paid AI endpoints require a user identity, not the public anon JWT',async()=>{
 const {requireUser}=await import('../supabase/functions/_shared/require-user.ts');
 const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;let calls=0;
 try{
  globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://project.supabase.co':'public-key'}};
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({role:'anon'}));};
  assert.equal(await requireUser(new Request('https://example.test')),false);assert.equal(calls,0);
  assert.equal(await requireUser(new Request('https://example.test',{headers:{authorization:'Bearer public-jwt'}})),false);
  globalThis.fetch=async()=>new Response(JSON.stringify({id:'user-id',role:'authenticated'}));
  assert.equal(await requireUser(new Request('https://example.test',{headers:{authorization:'Bearer user-jwt'}})),true);
  globalThis.fetch=async()=>new Response('{}',{status:401});
  assert.equal(await requireUser(new Request('https://example.test',{headers:{authorization:'Bearer expired-jwt'}})),false);
 }finally{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno;}
});
