import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {isAbsolute,relative,resolve} from 'node:path';
import {patchCopilotSessionGuard} from './copilot-session-guard.mjs';
const ids=['8ZasBukTkSx26m2A','lplLwsnJapOXtFcs','5YYDRgEQRMpj7NlE','ZoOugv5dN3bVeXof','rYCZkrrReAxmhWNl'];
const apply=process.argv.includes('--apply');
const backupDir=process.argv[process.argv.indexOf('--backup-dir')+1];
if(!process.env.N8N_API_KEY) throw Error('N8N_API_KEY required');
if(apply&&(!backupDir||!isAbsolute(backupDir)||!relative(process.cwd(),resolve(backupDir)).startsWith('..'))) throw Error('Private backup outside repository required');
const anon=readFileSync('src/lib/supabase.js','utf8').match(/const FALLBACK_KEY = '([^']+)'/)[1];
async function api(path,method='GET',body){
 const r=await fetch('https://personal-n8n.suwsiw.easypanel.host/api/v1'+path,{method,signal:AbortSignal.timeout(30000),headers:{'X-N8N-API-KEY':process.env.N8N_API_KEY,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw Error(`n8n ${method}: HTTP ${r.status}`);return r.json();
}
for(const id of ids){
 const before=await api('/workflows/'+id);
 if(!before.active||before.versionId!==before.activeVersionId)throw Error('Resolve unpublished changes: '+id);
 const patched=patchCopilotSessionGuard(before,anon);
 const changed=JSON.stringify(before.nodes)!==JSON.stringify(patched.nodes);
 console.log(JSON.stringify({id,version:before.versionId,changed,apply}));
 if(!changed||!apply)continue;
 mkdirSync(backupDir,{recursive:true});
 writeFileSync(resolve(backupDir,`${id}-${before.versionId}.json`),JSON.stringify(before),{flag:'wx',mode:0o600});
 const current=await api('/workflows/'+id);
 if(current.versionId!==before.versionId||current.activeVersionId!==before.activeVersionId)throw Error('Concurrent edit: '+id);
 const saved=await api('/workflows/'+id,'PUT',{name:before.name,nodes:patched.nodes,connections:patched.connections,settings:patched.settings});
 let after=await api('/workflows/'+id);
 if(after.activeVersionId!==saved.versionId){await api('/workflows/'+id+'/activate','POST',{versionId:saved.versionId});after=await api('/workflows/'+id);}
 if(!after.active||after.versionId!==saved.versionId||after.activeVersionId!==after.versionId)throw Error('Publication unconfirmed: '+id);
 if(JSON.stringify(after.nodes)!==JSON.stringify(patched.nodes)||JSON.stringify(after.connections)!==JSON.stringify(patched.connections))throw Error('Read-back differs: '+id);
 console.log(JSON.stringify({id,published:after.activeVersionId}));
}
