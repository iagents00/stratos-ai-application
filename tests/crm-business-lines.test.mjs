import test from 'node:test';
import assert from 'node:assert/strict';
import {businessLinesForPipeline,businessLineForStage,reconcileSavedLead} from '../src/lib/crm-business-lines.mjs';
test('business labels follow configured stages and clear when the organization has no configuration',()=>{
 const lines=businessLinesForPipeline([{id:'real-estate',label:'Bienes raíces',entryStage:'Contacto',stages:['Contacto','Visita']}],['Contacto','Visita']);
 assert.equal(businessLineForStage('Visita',lines).label,'Bienes raíces');
 assert.equal(businessLineForStage('Visita',businessLinesForPipeline(null,['Visita'])),null);
 assert.deepEqual(businessLinesForPipeline([{id:'stale',label:'Stale',entryStage:'Missing',stages:['Missing']}],['Contacto']),[]);
 assert.equal(businessLineForStage('Contacto',[...lines,...lines]),null);
});
test('server score is reconciled without undoing newer follow-ups, stage edits, manual scores or notes',()=>{
 const current={id:'lead',st:'Contacto',sc:14,seguimientos:2,notas:'Keep this note'};
 const saved={id:'lead',score:15,score_calc:15,hot_auto:false};
 const result=reconcileSavedLead(current,saved,current);assert.equal(result.sc,15);assert.equal(result.notas,current.notas);
 for(const newer of [{...current,seguimientos:3},{...current,st:'Reunión'},{...current,sc:90}])assert.equal(reconcileSavedLead(newer,saved,current),newer);
 assert.equal(reconcileSavedLead(null,saved,current),null);
});
