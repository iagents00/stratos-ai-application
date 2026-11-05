import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const APP_ID = '6804826565';
const editable = new Set(['PREPARE_FOR_SUBMISSION','REJECTED','METADATA_REJECTED','DEVELOPER_REJECTED']);
const inReview = new Set(['WAITING_FOR_REVIEW','IN_REVIEW','PENDING_APPLE_RELEASE','PENDING_DEVELOPER_RELEASE','READY_FOR_DISTRIBUTION','READY_FOR_SALE','PROCESSING_FOR_DISTRIBUTION','PROCESSING_FOR_APP_STORE']);
const notes = locale => locale.startsWith('es')
  ? 'Copilot y los módulos de tu empresa disponibles también en el menú móvil. Personaliza las etapas de tu pipeline como administrador; el asistente usa las etapas de tu empresa. Mejoras al editar y guardar etapas.'
  : 'Copilot and your company modules are available in the mobile menu. Company administrators can customize pipeline stages, and the assistant uses each company’s stages. Improved stage editing and saving.';
const relationship = (type,id) => ({data:{type,id}});

export async function releaseIOS({ mode='inspect', version, buildNumber, request }) {
  if (!['inspect','prepare','submit'].includes(mode) || !/^\d+\.\d+\.\d+$/.test(version || '')
      || !/^\d+$/.test(buildNumber || '')) throw new Error('Choose inspect/prepare/submit, a semantic version and an exact build number.');
  const versions=(await request('GET', '/v1/apps/'+APP_ID+'/appStoreVersions?filter[platform]=IOS&limit=50')).data;
  const buildsResponse=await request('GET','/v1/builds?filter[app]='+APP_ID+'&filter[version]='+buildNumber+'&include=preReleaseVersion&limit=50');
  const build=buildsResponse.data.find(b=>b.attributes.version===buildNumber
    && buildsResponse.included?.some(p=>p.type==='preReleaseVersions' && p.id===b.relationships.preReleaseVersion.data.id && p.attributes.version===version && p.attributes.platform==='IOS'));
  let target=versions.find(v=>v.attributes.versionString===version);
  const state=v=>v.attributes.appVersionState || v.attributes.appStoreState;
  const summary={appId:APP_ID,version,build:buildNumber,mode,buildState:build?.attributes.processingState || 'NOT_FOUND',versions:versions.map(v=>({version:v.attributes.versionString,state:state(v)}))};
  if(mode==='inspect') return summary;
  if(!build || build.attributes.processingState!=='VALID' || build.attributes.expired) throw new Error('The exact iOS build is not processed and valid.');
  if(target && inReview.has(state(target))) {
    const linked=await request('GET','/v1/appStoreVersions/'+target.id+'/relationships/build');
    if(linked.data?.id!==build.id) throw new Error('This version is already in review or released with another build. It was left unchanged.');
    return {...summary,state:state(target),alreadySubmitted:true};
  }
  if(target && !editable.has(state(target))) throw new Error('App Store version is not editable: '+state(target));
  if(!target) target=(await request('POST','/v1/appStoreVersions',{data:{type:'appStoreVersions',attributes:{platform:'IOS',versionString:version,releaseType:'AFTER_APPROVAL'},relationships:{app:relationship('apps',APP_ID)}}})).data;
  await request('PATCH','/v1/appStoreVersions/'+target.id,{data:{type:'appStoreVersions',id:target.id,attributes:{releaseType:'AFTER_APPROVAL'}}});
  if(build.attributes.usesNonExemptEncryption==null) {
    const plist=readFileSync('mobile/ios/App/App/Info.plist','utf8');
    if(!/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\s*\/>/.test(plist)) throw new Error('Export compliance must be reviewed.');
    await request('PATCH','/v1/builds/'+build.id,{data:{type:'builds',id:build.id,attributes:{usesNonExemptEncryption:false}}});
  } else if(build.attributes.usesNonExemptEncryption!==false) throw new Error('Unexpected export compliance declaration.');
  await request('PATCH','/v1/appStoreVersions/'+target.id+'/relationships/build',relationship('builds',build.id));
  const locales=(await request('GET','/v1/appStoreVersions/'+target.id+'/appStoreVersionLocalizations?limit=50')).data;
  if(!locales.length) throw new Error('The new version has no inherited localization. Complete the listing before submitting.');
  let screenshotSets=0;
  for(const locale of locales) {
    if(!locale.attributes.description || !locale.attributes.supportUrl) throw new Error('Incomplete inherited listing for '+locale.attributes.locale);
    const sets=(await request('GET','/v1/appStoreVersionLocalizations/'+locale.id+'/appScreenshotSets?include=appScreenshots&limit=50')).data;
    screenshotSets+=sets.filter(s=>s.relationships.appScreenshots?.data?.length).length;
    await request('PATCH','/v1/appStoreVersionLocalizations/'+locale.id,{data:{type:'appStoreVersionLocalizations',id:locale.id,attributes:{whatsNew:notes(locale.attributes.locale)}}});
  }
  if(!screenshotSets) throw new Error('No inherited screenshots are associated with this version.');
  const detail=(await request('GET','/v1/appStoreVersions/'+target.id+'/appStoreReviewDetail')).data;
  if(!detail || (detail.attributes.demoAccountRequired && (!detail.attributes.demoAccountName || !detail.attributes.demoAccountPassword))) throw new Error('App Review access is incomplete.');
  const linked=(await request('GET','/v1/appStoreVersions/'+target.id+'/relationships/build')).data;
  if(linked?.id!==build.id) throw new Error('Build association readback failed.');
  const current=(await request('GET','/v1/appStoreVersions/'+target.id)).data;
  if(current.attributes.releaseType!=='AFTER_APPROVAL') throw new Error('Automatic release readback failed.');
  const prepared={...summary,versionId:target.id,state:state(current),releaseType:current.attributes.releaseType,locales:locales.map(l=>l.attributes.locale),screenshotSets,reviewAccessPresent:true};
  if(mode==='prepare') return prepared;
  let submission;
  const submissions=(await request('GET','/v1/reviewSubmissions?filter[app]='+APP_ID+'&limit=50')).data;
  for(const candidate of submissions.filter(s=>s.attributes.state==='READY_FOR_REVIEW')) {
    const items=(await request('GET','/v1/reviewSubmissions/'+candidate.id+'/items?limit=50')).data;
    if(items.some(i=>i.relationships.appStoreVersion?.data?.id===target.id)) {submission=candidate;break;}
    if(!items.length && (!candidate.attributes.platform || candidate.attributes.platform==='IOS')) {submission=candidate;break;}
  }
  if(!submission) submission=(await request('POST','/v1/reviewSubmissions',{data:{type:'reviewSubmissions',attributes:{platform:'IOS'},relationships:{app:relationship('apps',APP_ID)}}})).data;
  const items=(await request('GET','/v1/reviewSubmissions/'+submission.id+'/items?limit=50')).data;
  if(items.some(i=>i.relationships.appStoreVersion?.data?.id && i.relationships.appStoreVersion.data.id!==target.id)) throw new Error('The draft contains another app version. It was not submitted.');
  if(!items.some(i=>i.relationships.appStoreVersion?.data?.id===target.id)) await request('POST','/v1/reviewSubmissionItems',{data:{type:'reviewSubmissionItems',relationships:{reviewSubmission:relationship('reviewSubmissions',submission.id),appStoreVersion:relationship('appStoreVersions',target.id)}}});
  await request('PATCH','/v1/reviewSubmissions/'+submission.id,{data:{type:'reviewSubmissions',id:submission.id,attributes:{submitted:true}}});
  const result=(await request('GET','/v1/reviewSubmissions/'+submission.id)).data;
  return {...prepared,submissionId:result.id,submissionState:result.attributes.state};
}

export function appleRequest(env=process.env) {
  for(const key of ['APPSTORE_KEY_ID','APPSTORE_ISSUER_ID','APPSTORE_PRIVATE_KEY']) if(!env[key]) throw new Error('Missing existing App Store credential: '+key);
  const privateKey=createPrivateKey(env.APPSTORE_PRIVATE_KEY.replaceAll('\\n','\n'));
  return async(method,path,body)=>{
    if(!path.startsWith('/v1/')) throw new Error('Unexpected API path');
    const now=Math.floor(Date.now()/1000);
    const header=Buffer.from(JSON.stringify({alg:'ES256',kid:env.APPSTORE_KEY_ID,typ:'JWT'})).toString('base64url');
    const payload=Buffer.from(JSON.stringify({iss:env.APPSTORE_ISSUER_ID,iat:now-5,exp:now+600,aud:'appstoreconnect-v1'})).toString('base64url');
    const data=header+'.'+payload;
    const token=data+'.'+sign('sha256',Buffer.from(data),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
    const res=await fetch('https://api.appstoreconnect.apple.com'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
    const result=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(method+' '+path.split('?')[0]+' '+res.status+': '+result.errors?.map(e=>e.code+' '+e.title+' '+e.detail).join('; '));
    return result;
  };
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  releaseIOS({mode:process.env.RELEASE_MODE || 'inspect',version:process.env.RELEASE_VERSION,buildNumber:process.env.RELEASE_BUILD,request:appleRequest()})
    .then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
