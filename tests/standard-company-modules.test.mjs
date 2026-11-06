import test from 'node:test';
import assert from 'node:assert/strict';
import {newCompanyFeatures,managedTenantFeatures,MANAGED_TENANT_FEATURES} from '../src/clients/tenant/managed-features.js';
import {canAccessModule,getAccessibleNavigation,STRATOS_ORG_ID} from '../src/app/constants/navigation.js';
import {companyDriveFolders,driveFolder} from '../src/lib/company-drive.js';
const keys=['comandoDirectivo','erp','finanzas','miDrive','landingPages'];
const modules=['d','e','fa','midrive','lp'];
const config={id:'tenant',features:{...newCompanyFeatures({teamAdmin:true,mktModule:false,comandoDirectivo:false}),crm:true,copilotModule:true,cajaPolicy:{enabled:true,read_all:true,create:true,update_all:true}}};
const admin={id:'admin',role:'admin',organizationId:'company-a'};
test('every new company includes the five standard modules even with old or unchecked creation payloads',()=>{
 for(const input of [undefined,{teamAdmin:true,mktModule:false,comandoDirectivo:false},Object.fromEntries(MANAGED_TENANT_FEATURES.map(x=>[x.key,false]))]){
  const flags=newCompanyFeatures(input);for(const key of keys)assert.equal(flags[key],true,key);
 }
 assert.equal(managedTenantFeatures({teamAdmin:true,mktModule:false,comandoDirectivo:false}).finanzas,false,'existing companies are not silently backfilled');
 assert.equal(newCompanyFeatures().mktModule,false,'property catalog is separate from optional tasks');
});
test('administrators see standard modules on desktop, iOS and Android; financial access remains explicit',()=>{
 const oldWindow=globalThis.window;
 try{for(const platform of ['web','ios','android']){globalThis.window=platform==='web'?{}:{Capacitor:{isNativePlatform:()=>true,getPlatform:()=>platform}};const visible=getAccessibleNavigation(admin,config).map(x=>x.id);for(const module of modules)assert.ok(visible.includes(module),platform+':'+module);}
 assert.equal(canAccessModule('fa',admin,{...config,features:{...config.features,cajaPolicy:{enabled:true,read_all:false}}}),false);
 assert.equal(canAccessModule('fa',admin,{id:'new-white-label',features:{finanzas:true}}),true,'a dedicated company config can explicitly enable Finance without a managed-tenant policy projection');
 const advisor={...admin,role:'asesor'};assert.equal(canAccessModule('fa',advisor,config),false);assert.equal(canAccessModule('d',advisor,config),false);
 for(const module of ['e','lp','midrive'])assert.equal(canAccessModule(module,advisor,config),true);
 for(const module of modules)assert.equal(canAccessModule(module,{...admin,crmOnly:true},config),false);
 assert.equal(canAccessModule('midrive',{...admin,organizationId:STRATOS_ORG_ID},{features:{}}),true,'Duke keeps its existing area drive');
 assert.equal(canAccessModule('midrive',admin,{features:{}}),false,'an unrelated external tenant does not inherit Duke folders');
 }finally{globalThis.window=oldWindow;}
});
test('Drive embeds only saved Google Drive folders and rejects foreign providers, credentials and files',()=>{
 const id='company_folder_123';const url='https://drive.google.com/drive/folders/'+id+'?usp=sharing';
 assert.equal(driveFolder(url).id,id);assert.equal(driveFolder('https://drive.google.com/drive/u/0/folders/'+id).id,id);
 for(const url of ['https://drive.google.com.evil.test/drive/folders/'+id,'javascript:alert(1)','http://drive.google.com/drive/folders/'+id,'https://user:pass@drive.google.com/drive/folders/'+id,'https://drive.google.com/file/d/'+id,'https://docs.google.com/document/d/'+id])assert.equal(driveFolder(url),null,url);
 assert.deepEqual(companyDriveFolders([{title:'WOHA',url},{title:'Duplicate',url},null,{title:1,url:'https://drive.google.com/drive/folders/other_folder_123'}]).map(x=>x.title),['WOHA','Carpeta de Drive']);
 assert.deepEqual(companyDriveFolders(null),[]);
});
