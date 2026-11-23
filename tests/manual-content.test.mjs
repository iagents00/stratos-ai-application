import test from 'node:test';
import assert from 'node:assert/strict';
import { MANUAL_SECTIONS as sections, CATEGORIES, searchManual } from '../src/landing/manual-content.js';
import { APP_STORES } from '../src/lib/app-stores.mjs';
import { INTEL_FEATURES } from '../src/app/constants/intelFeatures.js';

test('manual keeps shareable anchors and every related guide resolves', () => {
  const install = sections.find(s => s.id === 'instalar-app-celular');
  for (const store of Object.values(APP_STORES)) assert.ok(install.content.some(block => block.type === 'link' && block.url === store.url), store.label);
  assert.doesNotMatch(JSON.stringify(install), /github\.com|stratos-ai\.apk|orígenes desconocidos/i);
  const ids = new Set(sections.map(s => s.id));
  assert.equal(ids.size, sections.length);
  for (const id of ['fn-indice','primer-acceso','agregar-cliente-manual','copilot-registrar','mi-espacio-que-es','asignar-cliente-otro-asesor','roles-permisos']) assert.ok(ids.has(id), id);
  for (const feature of INTEL_FEATURES) assert.ok(ids.has('fn-' + feature.id));
  for (const section of sections) {
    assert.ok(CATEGORIES.some(category => category.id === section.category), section.id);
    for (const block of section.content) for (const id of block.ids || []) assert.ok(ids.has(id), section.id + ' → ' + id);
  }
  for (const category of CATEGORIES) assert.ok(sections.some(section => section.category === category.id), category.id);
});

test('search finds instructions beyond headings and ranks an exact phrase first', () => {
  assert.equal(searchManual('registrar sin fecha')[0].id, 'agenda-crear');
  assert.ok(searchManual('cómo crear un equipo').some(s => s.id === 'equipos-usuarios'));
  assert.ok(searchManual('micrófono').some(s => s.id === 'copilot-audios'));
  assert.deepEqual(searchManual('notificación'), searchManual('notificacion'));
});

test('search requires all meaningful words and empty queries keep the full index', () => {
  assert.deepEqual(searchManual(''), sections);
  assert.deepEqual(searchManual('   '), sections);
  assert.deepEqual(searchManual('agenda palabraquenuncaseusa'), []);
});


test('searching a displayed area name finds all of its guides, including plural Equipos', () => {
  for (const category of CATEGORIES) {
    const found = new Set(searchManual(category.label).map(s => s.id));
    for (const section of sections.filter(s => s.category === category.id)) assert.ok(found.has(section.id), category.label + ': ' + section.id);
  }
  assert.ok(searchManual('equipos').some(s => s.id === 'roles-permisos'));
  assert.ok(searchManual('varios clientes').some(s => s.id === 'copilot-registrar'));
});
