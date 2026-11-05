import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

test('new and existing tenant users keep the same authorized modules in desktop, iOS and Android',async()=>{
 const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 const oldWindow=globalThis.window;
 try{
  const {getAccessibleNavigation}=await server.ssrLoadModule('/src/app/constants/navigation.js');
  const {getClientConfig}=await server.ssrLoadModule('/src/clients/index.js');
  const base=getClientConfig('tenant');
  for(const role of ['admin','asesor','director','colaborador']){
   const user={role,organizationId:'new-managed-company',isActive:true};
   for(const copilot of [true,false]){
    const cfg={...base,features:{...base.features,copilotModule:copilot}};
    globalThis.window={}; const desktop=getAccessibleNavigation(user,cfg).map(n=>n.id);
    assert.equal(desktop.includes('copilot'),copilot);
    for(const platform of ['ios','android']){
     globalThis.window={Capacitor:{isNativePlatform:()=>true,getPlatform:()=>platform}};
     assert.deepEqual(getAccessibleNavigation(user,cfg).map(n=>n.id),desktop);
    }
   }
  }
  assert.ok(base.features.copilotModule,'neutral new companies start with Copilot');
  assert.equal(getAccessibleNavigation({role:'asesor',organizationId:'new-company',crmOnly:true},base).some(n=>n.id==='copilot'),false,'per-user restrictions still apply');
 }finally{globalThis.window=oldWindow;await server.close();}
});
