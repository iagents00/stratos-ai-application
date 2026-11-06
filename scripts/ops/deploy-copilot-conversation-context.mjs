import {mkdirSync,writeFileSync} from 'node:fs';
import {isAbsolute,relative,resolve} from 'node:path';
import {patchConversationNodes} from './copilot-conversation-context.mjs';
const surface=process.argv.includes('--telegram')?'telegram':'copilot';
const id=surface==='copilot'?'8ZasBukTkSx26m2A':'vM5Yu1HRmUDPOCg7';
const apply=process.argv.includes('--apply');
const backupIndex=process.argv.indexOf('--backup-dir');
const backupDir=process.argv[backupIndex+1];
if(!process.env.N8N_API_KEY)throw Error('N8N_API_KEY required');
if(apply&&(!backupDir||!isAbsolute(backupDir)||!relative(resolve(process.cwd()),resolve(backupDir)).startsWith('..')))throw Error('Private backup directory outside repository required');
async function api(path,method='GET',body){
 const response=await fetch('https://personal-n8n.suwsiw.easypanel.host/api/v1'+path,{method,signal:AbortSignal.timeout(30000),headers:{'X-N8N-API-KEY':process.env.N8N_API_KEY,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Error(`n8n ${method}: HTTP ${response.status}`);return response.json();
}
const before=await api('/workflows/'+id);
if(!before.active||before.versionId!==before.activeVersionId)throw Error('Resolve unpublished changes first');
const nodes=patchConversationNodes(before.nodes,{surface});
const connections=structuredClone(before.connections);
if(surface==='telegram'){
 const route=connections['Switch IS_PAIR_CMD']?.main?.[1];
 if(!route||route.length!==1||!['AI Agent','CRM Conversation Context'].includes(route[0].node))throw Error('Pairing route changed');
 route[0].node='CRM Conversation Context';
 connections['CRM Conversation Context']={main:[[{node:'AI Agent',type:'main',index:0}]]};
}
const changed=JSON.stringify(nodes)!==JSON.stringify(before.nodes)||JSON.stringify(connections)!==JSON.stringify(before.connections);
console.log(JSON.stringify({id,surface,changed,version:before.versionId,apply}));
if(!apply||!changed)process.exit(0);
mkdirSync(backupDir,{recursive:true});
writeFileSync(resolve(backupDir,`${id}-${before.versionId}.json`),JSON.stringify(before),{flag:'wx',mode:0o600});
const current=await api('/workflows/'+id);
if(current.versionId!==before.versionId||current.activeVersionId!==before.activeVersionId)throw Error('Concurrent update; stopped');
const saved=await api('/workflows/'+id,'PUT',{name:before.name,nodes,connections,settings:before.settings});
let after=await api('/workflows/'+id);
if(after.activeVersionId!==saved.versionId){await api('/workflows/'+id+'/activate','POST',{versionId:saved.versionId});after=await api('/workflows/'+id);}
if(!after.active||after.versionId!==saved.versionId||after.activeVersionId!==after.versionId)throw Error('Publication unconfirmed');
if(JSON.stringify(after.nodes)!==JSON.stringify(nodes)||JSON.stringify(after.connections)!==JSON.stringify(connections))throw Error('Read-back differs from reviewed change');
console.log(JSON.stringify({id,published:after.activeVersionId,nodeCount:after.nodes.length}));
