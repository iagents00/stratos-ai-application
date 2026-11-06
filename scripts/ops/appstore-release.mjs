import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const APP_ID = '6804826565';
const editable = new Set(['PREPARE_FOR_SUBMISSION','REJECTED','METADATA_REJECTED','DEVELOPER_REJECTED']);
const inReview = new Set(['WAITING_FOR_REVIEW','IN_REVIEW','PENDING_APPLE_RELEASE','PENDING_DEVELOPER_RELEASE','READY_FOR_DISTRIBUTION','READY_FOR_SALE','PROCESSING_FOR_DISTRIBUTION','PROCESSING_FOR_APP_STORE']);
const notes = (locale, version) => version === '4.9.10'
  ? (locale.startsWith('es')
    ? 'Las nuevas empresas incluyen Comando, Proyectos, Finanzas, Mi Drive y Create, con los mismos módulos autorizados en computadora y móvil. Mi Drive muestra las carpetas de la empresa guardadas en Space. Se conservan las mejoras de Copilot, recordatorios, expedientes y citas.'
    : 'New companies include Command, Projects, Finance, My Drive and Create, with the same authorized modules on desktop and mobile. My Drive displays company folders saved in Space. Includes the latest Copilot, reminder, client record and appointment improvements.')
  : version === '4.9.9'
  ? (locale.startsWith('es')
    ? 'Copilot da seguimiento a tus tareas, Zooms y recordatorios cada tres minutos hasta que respondas. Configura la insistencia desde Copilot o Perfil: al desactivarla, recibirás como máximo dos avisos adicionales. Confirma que lo harás o que no podrás sin marcar la actividad como terminada. Incluye los nuevos documentos y contactos del expediente.'
    : 'Copilot follows up on tasks, meetings and reminders every three minutes until you respond. Manage follow-up intensity in Copilot or Profile: turning it off limits each reminder to two additional follow-ups. Confirm that you will do it or cannot do it without marking the activity complete. Includes the new client documents and contact details.')
  : version === '4.9.8'
  ? (locale.startsWith('es')
    ? 'Guarda varias identificaciones con nombre de titular y adjunta cartas oferta por propiedad. Registra varios teléfonos y correos por comprador adicional y consulta el contacto principal debajo del nombre del cliente. Incluye la etapa Cierres Caídos para Duke, conservando las identificaciones anteriores y las mejoras de Copilot, documentos de Space y citas.'
    : 'Save multiple named identity documents and attach property offer letters. Add multiple phone numbers and email addresses for additional buyers, with the main contact shown below the client name. Includes the Failed Closings stage for Duke while preserving existing identification records and Copilot, Space documents and appointment improvements.')
  : version === '4.9.7'
  ? (locale.startsWith('es')
    ? 'Copilot conserva tu posición cuando lees mensajes anteriores, aunque se actualice la conversación o lleguen recordatorios. Vuelve al CRM y a tus módulos desde Copilot incluso después de cerrar y reabrir la app. Incluye las mejoras del login blanco, documentos de Space, negocios y citas múltiples con avisos de 3 horas.'
    : 'Copilot keeps your reading position in earlier messages while the conversation refreshes or reminders arrive. Return to CRM and your modules from Copilot even after closing and reopening the app. Includes white sign-in, Space documents, business pipelines and multiple appointment stages with three-hour reminders.')
  : version === '4.9.6'
  ? (locale.startsWith('es')
    ? 'Identifica el negocio de cada contacto y elige su recorrido al registrarlo. Copilot propone la etapa inicial del negocio configurado y pide aclaración si hay más de una opción. Los seguimientos suman puntos en pipelines personalizados. Conserva el login blanco, los documentos de Space y las citas múltiples con recordatorios de 3 horas.'
    : 'Identify each contact’s business and choose its pipeline when registering. Copilot proposes the configured business entry stage and asks for clarification when needed. Follow-ups add points in custom pipelines. Includes white sign-in, Space documents and multiple appointment stages with three-hour reminders.')
  : version === '4.9.5'
  ? (locale.startsWith('es')
    ? 'Login con fondo blanco e identidad Stratos AI. Renombra las etapas de tu pipeline y actualiza sus clientes. Selecciona una o varias etapas de citas para Copilot, con recordatorios de 3 horas y reagendas que conservan la etapa elegida. Pide a Copilot los documentos y enlaces guardados en Space. Mejoras de navegación y edición en móvil.'
    : 'White sign-in screen in Stratos AI colors. Rename pipeline stages and update their clients. Choose one or more appointment stages for Copilot, with three-hour reminders and rescheduling that preserves the selected stage. Ask Copilot for documents and links saved in Space. Improved mobile navigation and editing.')
  : version === '4.9.4'
  ? (locale.startsWith('es')
    ? 'Nuevo acceso con fondo blanco y los colores de Stratos AI. Inicia sesión con tu correo o usuario y recupera tu acceso desde la misma pantalla. Incluye Copilot y los módulos de tu empresa en móvil, con recordatorios de 3 horas adaptados a la etapa de citas de cada pipeline.'
    : 'A new white sign-in screen in Stratos AI colors. Sign in with your email or username and recover access from the same screen. Includes your company’s Copilot and mobile modules, with three-hour reminders following each pipeline’s appointment stage.')
  : version === '4.9.3'
  ? (locale.startsWith('es')
    ? 'Copilot se sincroniza con la etapa de citas de cada empresa. Selecciona esa etapa desde el pipeline, registra fecha y hora y conserva los recordatorios de 3 horas. Mejoras al reprogramar citas y mantener su fecha sincronizada.'
    : 'Copilot follows each company’s appointment stage. Choose it in the pipeline, set the date and time, and keep the default three-hour reminders. Improved appointment rescheduling and date synchronization.')
  : locale.startsWith('es')
  ? 'Copilot y los módulos de tu empresa disponibles también en el menú móvil. Personaliza las etapas de tu pipeline como administrador; el asistente usa las etapas de tu empresa. Mejoras al editar y guardar etapas.'
  : 'Copilot and your company modules are available in the mobile menu. Company administrators can customize pipeline stages, and the assistant uses each company’s stages. Improved stage editing and saving.';
const relationship = (type,id) => ({data:{type,id}});
const reviewItemsPath = id => '/v1/reviewSubmissions/'+id+'/items?include=appStoreVersion&fields[reviewSubmissionItems]=state,appStoreVersion&fields[appStoreVersions]=versionString&limit=50';
const itemVersionId = item => item.relationships?.appStoreVersion?.data?.id;

export async function releaseIOS({ mode='inspect', version, buildNumber, previousVersion, previousBuild, request }) {
  if (!['inspect','prepare','submit','replace-review'].includes(mode) || !/^\d+\.\d+\.\d+$/.test(version || '')
      || !/^\d+$/.test(buildNumber || '')) throw new Error('Choose inspect/prepare/submit/replace-review, a semantic version and an exact build number.');
  const versions=(await request('GET', '/v1/apps/'+APP_ID+'/appStoreVersions?filter[platform]=IOS&limit=50')).data;
  const buildsResponse=await request('GET','/v1/builds?filter[app]='+APP_ID+'&filter[version]='+buildNumber+'&include=preReleaseVersion&limit=50');
  const build=buildsResponse.data.find(b=>b.attributes.version===buildNumber
    && buildsResponse.included?.some(p=>p.type==='preReleaseVersions' && p.id===b.relationships.preReleaseVersion.data.id && p.attributes.version===version && p.attributes.platform==='IOS'));
  let target=versions.find(v=>v.attributes.versionString===version);
  const state=v=>v.attributes.appVersionState || v.attributes.appStoreState;
  const summary={appId:APP_ID,version,build:buildNumber,mode,buildState:build?.attributes.processingState || 'NOT_FOUND',versions:versions.map(v=>({version:v.attributes.versionString,state:state(v)}))};
  if(mode==='inspect') {
    const reviews=(await request('GET','/v1/reviewSubmissions?filter[app]='+APP_ID+'&limit=50')).data;
    summary.reviewSubmissions=[];
    for(const s of reviews.slice(0,5)) {
      const items=(await request('GET',reviewItemsPath(s.id))).data;
      summary.reviewSubmissions.push({id:s.id,state:s.attributes.state,items:items.map(i=>({versionId:itemVersionId(i),state:i.attributes?.state}))});
    }
    if(target) {
      const linked=(await request('GET','/v1/appStoreVersions/'+target.id+'/relationships/build')).data;
      summary.target={versionId:target.id,state:state(target),releaseType:target.attributes.releaseType,buildId:linked?.id};
      if(linked?.id) summary.target.build=(await request('GET','/v1/builds/'+linked.id)).data.attributes.version;
    }
    return summary;
  }
  if(!build || build.attributes.processingState!=='VALID' || build.attributes.expired) throw new Error('The exact iOS build is not processed and valid.');
  // Explicit replacement is used only after the new signed build has passed QA.
  // The normal submit mode always leaves an existing review unchanged.
  let replacedReview;
  if(mode==='replace-review') {
    if(!/^\d+\.\d+\.\d+$/.test(previousVersion || '') || !/^\d+$/.test(previousBuild || '')
      || version.localeCompare(previousVersion, undefined, {numeric:true})<=0) throw new Error('An exact earlier version and build are required to replace a review.');
    const previous=versions.find(v=>v.attributes.versionString===previousVersion);
    if(previous && ['WAITING_FOR_REVIEW','IN_REVIEW','DEVELOPER_REJECTED'].includes(state(previous))) {
      if(target) throw new Error('The new version already exists; the previous review was left unchanged.');
      const oldLinked=(await request('GET','/v1/appStoreVersions/'+previous.id+'/relationships/build')).data;
      const oldBuild=oldLinked?.id && (await request('GET','/v1/builds/'+oldLinked.id)).data;
      if(oldBuild?.attributes.version!==previousBuild) throw new Error('The previous review build changed; it was left unchanged.');
      const submissions=(await request('GET','/v1/reviewSubmissions?filter[app]='+APP_ID+'&limit=50')).data;
      let oldSubmission;
      for(const candidate of submissions.filter(s=>state(previous)==='DEVELOPER_REJECTED'
          ? s.attributes.state==='COMPLETE' : ['WAITING_FOR_REVIEW','IN_REVIEW'].includes(s.attributes.state))) {
        const items=(await request('GET',reviewItemsPath(candidate.id))).data;
        if(items.some(i=>itemVersionId(i)===previous.id)) {
          if(items.length!==1) throw new Error('The prior submission contains other content; it was left unchanged.');
          if(state(previous)==='DEVELOPER_REJECTED' && items[0].attributes?.state!=='REMOVED')
            throw new Error('The previous version was not removed from its completed review.');
          oldSubmission=candidate;break;
        }
      }
      if(!oldSubmission) throw new Error('The exact prior review submission was not found.');
      // Apple can finish cancellation after a previous invocation timed out.
      // Resume only the same rejected version/build with a completed review and its single item removed.
      if(state(previous)!=='DEVELOPER_REJECTED')
        await request('PATCH','/v1/reviewSubmissions/'+oldSubmission.id,{data:{type:'reviewSubmissions',id:oldSubmission.id,attributes:{canceled:true}}});
      let current;
      for(let attempt=0;attempt<10;attempt++) {
        current=(await request('GET','/v1/appStoreVersions/'+previous.id)).data;
        if(editable.has(state(current))) break;
        await new Promise(resolve=>setTimeout(resolve,3000));
      }
      if(!editable.has(state(current))) throw new Error('Prior review cancellation is processing; inspect before retrying.');
      await request('PATCH','/v1/appStoreVersions/'+previous.id,{data:{type:'appStoreVersions',id:previous.id,attributes:{versionString:version}}});
      target=(await request('GET','/v1/appStoreVersions/'+previous.id)).data;
      if(target.attributes.versionString!==version) throw new Error('Replacement version readback failed.');
      replacedReview={version:previousVersion,build:previousBuild,submissionId:oldSubmission.id};
    } else if(previous && editable.has(state(previous)) && !target) {
      throw new Error('The previous version is editable. Inspect its state before renaming it.');
    } else if(!previous && !target) {
      throw new Error('The exact previous version was not found.');
    }
  }
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
    await request('PATCH','/v1/appStoreVersionLocalizations/'+locale.id,{data:{type:'appStoreVersionLocalizations',id:locale.id,attributes:{whatsNew:notes(locale.attributes.locale, version)}}});
  }
  if(!screenshotSets) throw new Error('No inherited screenshots are associated with this version.');
  const detail=(await request('GET','/v1/appStoreVersions/'+target.id+'/appStoreReviewDetail')).data;
  if(!detail || (detail.attributes.demoAccountRequired && (!detail.attributes.demoAccountName || !detail.attributes.demoAccountPassword))) throw new Error('App Review access is incomplete.');
  const linked=(await request('GET','/v1/appStoreVersions/'+target.id+'/relationships/build')).data;
  if(linked?.id!==build.id) throw new Error('Build association readback failed.');
  const current=(await request('GET','/v1/appStoreVersions/'+target.id)).data;
  if(current.attributes.releaseType!=='AFTER_APPROVAL') throw new Error('Automatic release readback failed.');
  const prepared={...summary,...(replacedReview?{replacedReview}:{}),versionId:target.id,state:state(current),releaseType:current.attributes.releaseType,locales:locales.map(l=>l.attributes.locale),screenshotSets,reviewAccessPresent:true};
  if(mode==='prepare') return prepared;
  let submission;
  const submissions=(await request('GET','/v1/reviewSubmissions?filter[app]='+APP_ID+'&limit=50')).data;
  for(const candidate of submissions.filter(s=>s.attributes.state==='READY_FOR_REVIEW')) {
    const items=(await request('GET','/v1/reviewSubmissions/'+candidate.id+'/items?limit=50')).data;
    if(items.some(i=>itemVersionId(i)===target.id)) {submission=candidate;break;}
    if(!items.length && (!candidate.attributes.platform || candidate.attributes.platform==='IOS')) {submission=candidate;break;}
  }
  if(!submission) submission=(await request('POST','/v1/reviewSubmissions',{data:{type:'reviewSubmissions',attributes:{platform:'IOS'},relationships:{app:relationship('apps',APP_ID)}}})).data;
  const items=(await request('GET',reviewItemsPath(submission.id))).data;
  if(items.some(i=>itemVersionId(i)!==target.id)) throw new Error('The draft contains other or unidentified content. It was not submitted.');
  if(!items.some(i=>itemVersionId(i)===target.id)) await request('POST','/v1/reviewSubmissionItems',{data:{type:'reviewSubmissionItems',relationships:{reviewSubmission:relationship('reviewSubmissions',submission.id),appStoreVersion:relationship('appStoreVersions',target.id)}}});
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
  releaseIOS({mode:process.env.RELEASE_MODE || 'inspect',version:process.env.RELEASE_VERSION,buildNumber:process.env.RELEASE_BUILD,previousVersion:process.env.RELEASE_PREVIOUS_VERSION,previousBuild:process.env.RELEASE_PREVIOUS_BUILD,request:appleRequest()})
    .then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
