import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProjectPlan, PROJECT_AGENT_PROMPT, projectReceipt } from '../supabase/functions/_shared/project-copilot.mjs';
import { buildCodexPrompt } from '../src/app/features/ISpace/codex-prompt.mjs';
const board={projects:[{id:'p',nombre:'App Amistad',updated_at:'v1'}],tasks:[{id:'t',titulo:'Revisar roles',project_id:'p',descripcion:'- [ ] Sin acceso indebido',updated_at:'v1'}],people:[{id:'u'}]};
const op=(patch,other={})=>({entity:'task',id:'t',expected_updated_at:'v1',patch_json:JSON.stringify(patch),...other});
test('project agent preserves omitted fields and allows explicit unassignment',()=>{
 const [r]=compileProjectPlan({operations:[op({assignee_id:null})]},board);
 assert.deepEqual(r.patch,{assignee_id:null});assert.equal(r.create,false);
});
test('project agent rejects stale updates, unknown ids and privilege fields',()=>{
 for(const o of [op({}, {expected_updated_at:'old'}),op({}, {id:'foreign'}),op({organization_id:'foreign'}),op({assignee_id:'foreign'})])assert.throws(()=>compileProjectPlan({operations:[o]},board));
});
test('project agent requires atomic action acceptance and resolves only prior new references',()=>{
 const project={entity:'project',id:'new:p',expected_updated_at:null,patch_json:JSON.stringify({nombre:'New'})};
 const task=op({titulo:'Comprobar permiso',descripcion:'- [ ] Acceso no autorizado rechazado',project_id:'new:p'},{id:'new:t',expected_updated_at:null});
 let n=0;const result=compileProjectPlan({operations:[project,task]},board,()=>`uuid${++n}`);
 assert.equal(result[1].patch.project_id,'uuid1');
 assert.throws(()=>compileProjectPlan({operations:[task,project]},board));
 assert.throws(()=>compileProjectPlan({operations:[op({titulo:'Vago'},{id:'new:t'})]},board));
});
test('project agent rejects duplicate tasks and arbitrary links',()=>{
 assert.throws(()=>compileProjectPlan({operations:[op({titulo:'Revisar roles',descripcion:'- [ ] Listo',project_id:'p'},{id:'new:t'})]},board));
 assert.throws(()=>compileProjectPlan({operations:[op({drive_url:'javascript:alert(1)'})]},board));
});
test('Codex handoff carries actual task, acceptance, dependency and evidence contract',()=>{
 const prompt=buildCodexPrompt({...board.tasks[0],depends_on:'missing',estado:'por_hacer'},board.projects[0],board.tasks);
 assert.match(prompt,/Amistad-app12/);assert.match(prompt,/Referencia: t/);assert.match(prompt,/Sin acceso indebido/);assert.match(prompt,/Dependencia no disponible/);assert.match(prompt,/No declares actualizada/);
 assert.match(PROJECT_AGENT_PROMPT,/No tienes conexión automática/);
 assert.match(projectReceipt([{entity:'task',created:true,title:'Validar permiso'}]),/Guardado.*\n• Tarea creada: Validar permiso/s);
});


test('board order keeps project work and prerequisites legible after a bulk split',async()=>{
 const {orderBoardTasks}=await import('../src/app/features/ISpace/board-model.mjs');
 const items=[{id:'b',titulo:'Después',project_id:'p',depends_on:'a'},{id:'x',titulo:'Otro',project_id:'q'},{id:'a',titulo:'Antes',project_id:'p'}];
 assert.deepEqual(orderBoardTasks(items,[{id:'p'},{id:'q'}]).map(t=>t.id),['a','b','x']);
 assert.deepEqual(orderBoardTasks([{...items[1],prioridad:'alta'},...items.filter(t=>t.id!=='x')],[{id:'p'},{id:'q'}]).map(t=>t.id),['x','a','b']);
});
