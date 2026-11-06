import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccessModule,resolveImmersiveBackView,STRATOS_ORG_ID} from '../src/app/constants/navigation.js';
import {mergeCopilotHistory} from '../src/lib/copilot-history.js';
const external={id:'external-admin',role:'admin',organizationId:'10000000-0000-4000-a000-000000000001'};
const config={id:'tenant',features:{copilotModule:true,comandoDirectivo:false}};
test('a restored Copilot always has a permitted exit; an inaccessible Comando never restores the saved chat',()=>{
 assert.equal(canAccessModule('d',external,config),false);
 for(const previous of [null,'d','copilot','wa','miespacio','mi_espacio','removed-module']){
  const target=resolveImmersiveBackView(previous,external,config);
  assert.equal(target,'c');assert.equal(canAccessModule(target,external,config),true);
 }
 assert.equal(resolveImmersiveBackView('perfil',external,config),'perfil');
});
test('return destination respects the current role and tenant, including changes while a chat was open',()=>{
 const duke={...external,organizationId:STRATOS_ORG_ID};
 assert.equal(resolveImmersiveBackView(null,duke,config),'d');
 assert.equal(resolveImmersiveBackView(null,{...external,role:'colaborador'},config),'plan');
 assert.equal(resolveImmersiveBackView('c',external,{...config,features:{crm:false,copilotModule:true}}),'perfil');
 const marketing={...duke,role:'marketing'};
 const target=resolveImmersiveBackView('d',marketing,{features:{copilotModule:true}});
 assert.equal(canAccessModule(target,marketing,{features:{copilotModule:true}}),true);
 assert.ok(!['d','c','copilot','wa','miespacio'].includes(target));
 const crmOnly={...duke,crmOnly:true};
 assert.equal(resolveImmersiveBackView('d',crmOnly,config),'c');
});
const message=(id,seconds,role='ai',content='Respuesta '+id)=>({id,role,content,occurred_at:new Date(1700000000000+seconds*1000).toISOString()});
test('reading preserves older loaded messages outside the server window, including simultaneous new reminders',()=>{
 const previous=[message(1,1),message(2,2),message(3,3)];
 const incoming=[{...message(2,2),buttons:[{label:'Hecho',action:'done'}]},message(3,3),message(4,4)];
 const retained=mergeCopilotHistory(previous,incoming,{merge:true,preserveEarlier:true});
 assert.deepEqual(retained.map(m=>m.id),[1,2,3,4]);assert.deepEqual(retained[1].buttons,incoming[0].buttons);
 assert.deepEqual(mergeCopilotHistory(previous,incoming,{merge:true}).map(m=>m.id),[2,3,4]);
 assert.equal(mergeCopilotHistory(previous,incoming),incoming);
});
test('refresh preserves optimistic turns and ordering without dropping legitimate repeated actions',()=>{
 const previous=[message(1,1,'user','Hecho'),message('tmp-new',200,'user','Hecho'),message('ai-local',201,'ai','Respuesta local')];
 const incoming=[message(1,1,'user','Hecho'),message(2,190)];
 const result=mergeCopilotHistory(previous,incoming,{merge:true});
 assert.deepEqual(result.map(m=>m.id),[1,2,'tmp-new','ai-local']);
 const logged=[...incoming,message(3,202,'user','Hecho'),message(4,203,'ai','Respuesta local')];
 assert.deepEqual(mergeCopilotHistory(previous,logged,{merge:true}).map(m=>m.id),[1,2,3,4]);
 assert.deepEqual(mergeCopilotHistory(previous,[],{merge:true,preserveEarlier:true}).map(m=>m.id),['tmp-new','ai-local']);
});
