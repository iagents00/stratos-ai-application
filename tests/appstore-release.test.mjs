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
  if(path==='/v1/builds/'+buildId)return {data:{attributes:{version:buildNumber}}};
  if(path.endsWith('/appStoreVersionLocalizations?limit=50'))return {data:[{id:'localeES',attributes:{locale:'es-MX',description:'Existing listing',supportUrl:'https://stratoscapitalgroup.com'}}]};
  if(path.startsWith('/v1/appStoreVersionLocalizations/localeES/appScreenshotSets'))return {data:[{id:'screens',relationships:{appScreenshots:{data:[{id:'shot'}]}}}]};
  if(path.endsWith('/appStoreReviewDetail'))return {data:{attributes:{demoAccountRequired:true,demoAccountName:'synthetic-review',demoAccountPassword:'must-not-log'}}};
  if(path==='/v1/appStoreVersions/version492')return {data:target};
  if(path.startsWith('/v1/reviewSubmissions?'))return {data:[]};
  if(path==='/v1/reviewSubmissions'&&method==='POST')return {data:{id:'submission'}};
  if(path.startsWith('/v1/reviewSubmissions/submission/items?'))return {data:[]};
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

function replacementMock({processing='VALID',oldBuild='142',extraItem=false,oldState='WAITING_FOR_REVIEW',sparse=false,canceledState='COMPLETE',itemState='REMOVED'}={}) {
 const m=mock({version:'4.9.4',buildNumber:'143',processing});
 let state=oldState, renamed=false;
 const previous=()=>({id:'version492',type:'appStoreVersions',attributes:{versionString:renamed?'4.9.4':'4.9.3',platform:'IOS',appVersionState:state,releaseType:'AFTER_APPROVAL'}});
 const request=async(method,path,body)=>{
  if(path.startsWith('/v1/apps/'+APP_ID+'/appStoreVersions')) {m.calls.push({method,path,body});return {data:[previous()]};}
  if(path==='/v1/builds/oldBuild'){m.calls.push({method,path,body});return {data:{id:'oldBuild',attributes:{version:oldBuild}}};}
  if(path.endsWith('/relationships/build') && !renamed){m.calls.push({method,path,body});return {data:{id:'oldBuild'}};}
  if(path.startsWith('/v1/reviewSubmissions?') && !renamed){m.calls.push({method,path,body});return {data:[{id:'oldSubmission',attributes:{state:oldState==='DEVELOPER_REJECTED'?canceledState:oldState}}]};}
  if(path.startsWith('/v1/reviewSubmissions/oldSubmission/items?')){m.calls.push({method,path,body});return {data:[...(sparse?[{id:'sparse-item'}]:[{attributes:{state:itemState},relationships:{appStoreVersion:{data:{id:'version492'}}}}]),...(extraItem?[{relationships:{appStoreVersion:{data:{id:'other-version'}}}}]:[])]};}
  if(method==='PATCH' && body?.data?.attributes?.canceled){m.calls.push({method,path,body});state='DEVELOPER_REJECTED';return {};}
  if(method==='PATCH' && body?.data?.attributes?.versionString){m.calls.push({method,path,body});renamed=true;return {};}
  if(path==='/v1/appStoreVersions/version492' && method==='GET'){m.calls.push({method,path,body});return {data:previous()};}
  return m.request(method,path,body);
 };
 return {...m,request};
}
const replacement={version:'4.9.4',buildNumber:'143',previousVersion:'4.9.3',previousBuild:'142',mode:'replace-review'};
test('explicit review replacement validates both builds and cancels only the exact single-version submission',async()=>{
 const m=replacementMock();const result=await releaseIOS({...replacement,request:m.request});
 assert.deepEqual(result.replacedReview,{version:'4.9.3',build:'142',submissionId:'oldSubmission'});
 assert.equal(result.submissionState,'WAITING_FOR_REVIEW');
 assert.ok(m.calls.some(c=>c.path.includes('include=appStoreVersion')&&c.path.includes('fields[reviewSubmissionItems]=state,appStoreVersion')));
 const cancel=m.calls.filter(c=>c.body?.data?.attributes?.canceled);assert.equal(cancel.length,1);assert.equal(cancel[0].path,'/v1/reviewSubmissions/oldSubmission');
 assert.equal(m.calls.find(c=>c.method==='PATCH'&&c.path.endsWith('/relationships/build')).body.data.id,'build143');
 assert.match(m.calls.find(c=>c.body?.data?.attributes?.whatsNew).body.data.attributes.whatsNew,/fondo blanco/);
});
test('review replacement refuses an invalid new build, changed previous build or mixed submission before writing',async()=>{
 for(const input of [{processing:'PROCESSING'},{oldBuild:'unexpected'},{extraItem:true},{sparse:true}]) {
  const m=replacementMock(input);await assert.rejects(releaseIOS({...replacement,request:m.request}));assert.ok(m.calls.every(c=>c.method==='GET'));
 }
 const m=replacementMock();await assert.rejects(releaseIOS({...replacement,previousVersion:undefined,request:m.request}),/exact earlier/);assert.ok(m.calls.every(c=>c.method==='GET'));
});


test('a timed-out cancellation resumes only the same rejected build and completed review with its single item removed',async()=>{
 const m=replacementMock({oldState:'DEVELOPER_REJECTED'});const result=await releaseIOS({...replacement,request:m.request});
 assert.equal(result.submissionState,'WAITING_FOR_REVIEW');assert.equal(result.replacedReview.submissionId,'oldSubmission');
 assert.ok(!m.calls.some(c=>c.body?.data?.attributes?.canceled));
 for(const input of [{oldBuild:'unexpected'},{extraItem:true},{sparse:true},{canceledState:'CANCELING'},{canceledState:'WAITING_FOR_REVIEW'},{itemState:'APPROVED'},{itemState:null}]) {
  const bad=replacementMock({oldState:'DEVELOPER_REJECTED',...input});
  await assert.rejects(releaseIOS({...replacement,request:bad.request}));assert.ok(bad.calls.every(c=>c.method==='GET'));
 }
});
test('inspect reads back the public submission build and automatic release without writing',async()=>{
 const m=mock({version:'4.9.5',buildNumber:'148',state:'WAITING_FOR_REVIEW'});
 const result=await releaseIOS({version:'4.9.5',buildNumber:'148',mode:'inspect',request:m.request});
 assert.equal(result.target.build,'148');assert.equal(result.target.releaseType,'AFTER_APPROVAL');assert.ok(m.calls.every(c=>c.method==='GET'));
});

test('business-aware public release selects the exact 4.9.6 build and updated release notes',async()=>{
 const m=mock({version:'4.9.6',buildNumber:'149'});
 const result=await releaseIOS({version:'4.9.6',buildNumber:'149',mode:'submit',request:m.request});
 assert.equal(result.submissionState,'WAITING_FOR_REVIEW');assert.equal(result.releaseType,'AFTER_APPROVAL');
 assert.match(m.calls.find(c=>c.body?.data?.attributes?.whatsNew).body.data.attributes.whatsNew,/negocio.*seguimientos/i);
});

test('navigation and reading fix uses exact 4.9.7 build and public release notes',async()=>{
 const m=mock({version:'4.9.7',buildNumber:'150'});
 const result=await releaseIOS({version:'4.9.7',buildNumber:'150',mode:'submit',request:m.request});
 assert.equal(result.submissionState,'WAITING_FOR_REVIEW');assert.equal(result.releaseType,'AFTER_APPROVAL');
 assert.match(m.calls.find(c=>c.body?.data?.attributes?.whatsNew).body.data.attributes.whatsNew,/posición.*reabrir/i);
});

test('buyer-document release selects the exact mobile build and public CRM notes',async()=>{
 const m=mock({version:'4.9.8',buildNumber:'152'});
 const result=await releaseIOS({version:'4.9.8',buildNumber:'152',mode:'submit',request:m.request});
 assert.equal(result.submissionState,'WAITING_FOR_REVIEW');assert.equal(result.releaseType,'AFTER_APPROVAL');
 assert.equal(m.calls.find(c=>c.method==='PATCH'&&c.path.endsWith('/relationships/build')).body.data.id,'build152');
 const whatsNew=m.calls.find(c=>c.body?.data?.attributes?.whatsNew).body.data.attributes.whatsNew;
 assert.match(whatsNew,/identificaciones.*cartas oferta.*teléfonos.*correos.*Cierres Caídos/);
});
