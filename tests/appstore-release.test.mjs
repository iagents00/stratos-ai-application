import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseIOS,APP_ID} from '../scripts/ops/appstore-release.mjs';
function mock({processing='VALID',state='PREPARE_FOR_SUBMISSION',linked,version='4.9.2',buildNumber='140'}={}){
 const buildId='build'+buildNumber; linked ||= buildId;
 const calls=[];
 const target={id:'version492',type:'appStoreVersions',attributes:{versionString:version,platform:'IOS',appVersionState:state,releaseType:'AFTER_APPROVAL'}};
 const request=async(method,path,body)=>{calls.push({method,path,body});
  if(path.startsWith('/v1/apps/'+APP_ID+'/appStoreVersions'))return {data:[target]};
  if(path.startsWith('/v1/builds?'))return {data:[{id:buildId,attributes:{version:buildNumber,processingState:processing,usesNonExemptEncryption:false},relationships:{preReleaseVersion:{data:{id:'pre492'}}}}],included:[{id:'pre492',type:'preReleaseVersions',attributes:{version,platform:'IOS'}}]};
  if(path.endsWith('/relationships/build'))return {data:{id:linked,type:'builds'}};
  if(path.endsWith('/appStoreVersionLocalizations?limit=50'))return {data:[{id:'localeES',attributes:{locale:'es-MX',description:'Existing listing',supportUrl:'https://stratoscapitalgroup.com'}}]};
  if(path.startsWith('/v1/appStoreVersionLocalizations/localeES/appScreenshotSets'))return {data:[{id:'screens',relationships:{appScreenshots:{data:[{id:'shot'}]}}}]};
  if(path.endsWith('/appStoreReviewDetail'))return {data:{attributes:{demoAccountRequired:true,demoAccountName:'synthetic-review',demoAccountPassword:'must-not-log'}}};
  if(path==='/v1/appStoreVersions/version492')return {data:target};
  if(path.startsWith('/v1/reviewSubmissions?'))return {data:[]};
  if(path==='/v1/reviewSubmissions'&&method==='POST')return {data:{id:'submission'}};
  if(path==='/v1/reviewSubmissions/submission/items?limit=50')return {data:[]};
  if(path==='/v1/reviewSubmissions/submission'&&method==='GET')return {data:{id:'submission',attributes:{state:'WAITING_FOR_REVIEW'}}};
  if(['PATCH','POST'].includes(method))return {};
  throw new Error('Unexpected request '+method+' '+path);
 };
 return {request,calls};
}
const options={version:'4.9.2',buildNumber:'140'};
test('inspect is read-only and an exact processed build is required before any write',async()=>{
 for(const mode of ['inspect','submit']){const m=mock({processing:'PROCESSING'});if(mode==='inspect')await releaseIOS({...options,mode,request:m.request});else await assert.rejects(releaseIOS({...options,mode,request:m.request}),/not processed/);assert.ok(m.calls.every(c=>c.method==='GET'));}
 await assert.rejects(releaseIOS({...options,mode:'delete',request:mock().request}),/Choose/);
});
test('prepare and submit associate the exact build, retain listing, and automatically release after approval',async()=>{
 for(const mode of ['prepare','submit']){const m=mock();const result=await releaseIOS({...options,mode,request:m.request});assert.equal(result.releaseType,'AFTER_APPROVAL');assert.ok(!JSON.stringify(result).includes('must-not-log'));
 const link=m.calls.find(c=>c.method==='PATCH'&&c.path.endsWith('/relationships/build'));assert.equal(link.body.data.id,'build140');
 const submit=m.calls.filter(c=>c.method==='PATCH'&&c.body?.data?.attributes?.submitted);assert.equal(submit.length,mode==='submit'?1:0);
 if(mode==='submit')assert.equal(result.submissionState,'WAITING_FOR_REVIEW');
 }
});
test('a version already under review is never replaced by a different build',async()=>{
 const m=mock({state:'WAITING_FOR_REVIEW',linked:'other-build'});await assert.rejects(releaseIOS({...options,mode:'submit',request:m.request}),/another build/);assert.ok(m.calls.every(c=>c.method==='GET'));
});

test('the next public release carries the company appointment UI and three-hour reminder notes',async()=>{
 const m=mock({version:'4.9.3',buildNumber:'142'});
 const result=await releaseIOS({version:'4.9.3',buildNumber:'142',mode:'submit',request:m.request});
 assert.equal(result.version,'4.9.3');assert.equal(result.build,'142');assert.equal(result.submissionState,'WAITING_FOR_REVIEW');
 assert.equal(m.calls.find(c=>c.method==='PATCH'&&c.path.endsWith('/relationships/build')).body.data.id,'build142');
 assert.match(m.calls.find(c=>c.body?.data?.attributes?.whatsNew).body.data.attributes.whatsNew,/etapa de citas.*3 horas/);
});
