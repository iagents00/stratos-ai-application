import test from 'node:test';
import assert from 'node:assert/strict';
import { blockingReason, taskColumn, readDescription, writeDescription, validateTask, taskProgress, projectProgress, createsCycle, safeLink, isFocus } from '../src/app/features/ISpace/board-model.mjs';

test('task checklist survives a description round-trip and retains unknown notes', () => {
  const input = 'Resultado: entrega probada\nContexto adicional\n\nBloqueo: falta acceso\n\n- [x] Conectar\n- [ ] Probar';
  const parsed = readDescription(input);
  assert.equal(parsed.notes, 'Resultado: entrega probada\nContexto adicional');
  assert.deepEqual(readDescription(writeDescription(parsed)), parsed);
  assert.equal(taskProgress({ estado: 'por_hacer', descripcion: input }), 50);
});
test('dependencies block advancement, done work is never counted as blocked', () => {
  const parent = { id: 'a', titulo:'Conectar', estado:'por_hacer' };
  const child = { id:'b', titulo:'Probar', estado:'por_hacer', depends_on:'a' };
  assert.equal(taskColumn(child,[parent,child]),'bloqueada');
  assert.match(validateTask({...child,estado:'hecha'},[parent,child]),/dependencia/);
  assert.equal(blockingReason({...child,estado:'hecha'},[parent]),'');
  assert.equal(taskColumn(child,[{...parent,estado:'hecha'},child]),'por_hacer');
  assert.match(blockingReason(child,[]),/no disponible/);
});
test('reject self-dependency and multi-node cycles', () => {
  const tasks=[{id:'a',depends_on:'b'},{id:'b',depends_on:'c'},{id:'c'}];
  assert.equal(createsCycle('c','a',tasks),true);
  assert.equal(createsCycle('a','a',tasks),true);
  assert.equal(createsCycle('a','c',tasks),false);
});
test('checklist must be complete before closing; finishing increments project progress', () => {
  const task={id:'a',project_id:'p',titulo:'Entrega',estado:'hecha',descripcion:'- [ ] Validar'};
  assert.match(validateTask(task,[]),/checklist/);
  assert.equal(validateTask({...task,descripcion:'- [x] Validar'},[]),'');
  assert.deepEqual(projectProgress('p',[task,{project_id:'p',estado:'por_hacer'},{project_id:'other',estado:'hecha'}]),{done:1,total:2});
});
test('focus excludes completed tasks and evidence URLs reject executable protocols',()=>{
  assert.equal(isFocus({prioridad:'alta',estado:'hecha'}),false);
  assert.equal(isFocus({prioridad:'alta',estado:'en_curso'}),true);
  assert.equal(safeLink('javascript:alert(1)'),'');
  assert.equal(safeLink('https://example.com/'),'https://example.com/');
});

test('an in-progress task can record a blocker without advancing it', () => {
  const previous = { id: 'a', titulo: 'Entrega', estado: 'en_curso' };
  const blocked = { ...previous, descripcion: 'Bloqueo: Falta material' };
  assert.equal(validateTask(blocked, [], previous), '');
  assert.equal(taskColumn(blocked, []), 'bloqueada');
  assert.match(validateTask({ ...blocked, estado: 'en_revision' }, [], previous), /bloqueo/);
});
