import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/og-landing.js';
import { suggestedLinkName } from '../src/app/views/LandingPages/link-name.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}});
const shell='<html><head><title>Stratos</title><meta property="og:image" content="old"></head><body><script src="/assets/app.js"></script></body></html>';
test('automatic names start with client and retain company within the code limit',()=>{
 assert.equal(suggestedLinkName('Ana López','Adoquín Inmobiliaria'),'ana-lopez-adoquin-inmobiliaria');
 assert.equal(suggestedLinkName('','Real Estate 33'),'real-estate-33');
 const value=suggestedLinkName('Un cliente con nombre muy largo','Adoquín Inmobiliaria');
 assert(value.length<=32);assert(value.endsWith('adoquin-inmobiliaria'));
});
test('share metadata resolves only the code, escapes names, keeps app scripts and advertises the new cover',async()=>{
 const original=globalThis.fetch;const calls=[];
 try{
  globalThis.fetch=async(url,opts)=>{calls.push([url,opts]);return url.endsWith('/index.html')?new Response(shell):new Response(JSON.stringify(Buffer.from(JSON.stringify({c:'Ana <script>"',g:'Adoquín & Co',p:[{n:'Test'}]})).toString('base64url')));};
  const res=response();await handler({method:'GET',url:'/api/og-landing?code=ana-abc',query:{code:'ana-abc'},headers:{host:'stratoscapitalgroup.com'}},res);
  assert.equal(res.statusCode,200);assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1][1].body).p_code,'ana-abc');
  assert.match(res.body,/Portafolio para Ana &lt;script&gt;&quot; · Adoquín &amp; Co/);
  assert.match(res.body,/og-portafolio-stratos-v2.png/);
  assert.match(res.body,/<script src="\/assets\/app.js"><\/script>/);
  assert.doesNotMatch(res.body,/content="old"/);
  assert.match(res.body,/og:url" content="https:\/\/stratoscapitalgroup.com\/p\/ana-abc/);
  assert.equal(res.headers['X-Robots-Tag'],'noindex, nofollow');
 }finally{globalThis.fetch=original;}
});
test('legacy, missing and unavailable payloads retain a usable generic preview',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async url=>url.endsWith('/index.html')?new Response(shell):new Response('failure',{status:503});
  for(const url of ['/p','/p/unknown','/p/invalid!']){
   const res=response();await handler({method:'GET',url,headers:{host:'stratoscapitalgroup.com'}},res);
   assert.equal(res.statusCode,200);assert.match(res.body,/Portafolio Personalizado/);
  }
  const res=response();await handler({method:'HEAD',url:'/p',headers:{}},res);assert.equal(res.body,undefined);
 }finally{globalThis.fetch=original;}
});

import { portfolioCode, isPortfolioPath } from '../src/lib/portfolio-route.js';
test('public routing accepts generated and legacy codes before the login gate', () => {
 for(const code of ['ab', 'ana-lopez-adoquin-inmobiliaria-'+'a'.repeat(20), 'a'.repeat(53), 'a'.repeat(64)]) {
  assert.equal(isPortfolioPath('/p/'+code),true);
  assert.equal(portfolioCode('/p/'+code),code);
  assert.equal(isPortfolioPath('/p/'+code+'/'),true);
 }
 for(const path of ['/p','/p/']) assert.equal(isPortfolioPath(path),true);
 for(const path of ['/p/'+ 'a'.repeat(65),'/p/../tenant','/p/a/b','/tenant','/p/bad!']) assert.equal(isPortfolioPath(path),false);
});
