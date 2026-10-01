import test from 'node:test';
import assert from 'node:assert/strict';
import { marker, patchZoomConsistency } from './copilot-zoom-consistency.mjs';

const nodes = [
  { id: 'dispatch', name: 'Dispatch verbatim', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1, 2], parameters: { url: 'old', jsonBody: 'old' } },
  { id: 'normalize', name: 'Normalize Reply', type: 'n8n-nodes-base.code', position: [3, 4], parameters: { jsCode: 'const item = $input.first().json;' } },
];
const connections = { 'Dispatch verbatim': { main: [[{ node: 'Normalize Reply', type: 'main', index: 0 }]] } };

test('adds a scoped Zoom-only synchronization branch', () => {
  const patched = patchZoomConsistency(nodes, connections);
  assert.equal(patched.nodes.length, 4);
  const sync = patched.nodes.find(node => node.name === marker);
  assert.match(sync.parameters.jsonBody, /set_zoom_datetime/);
  assert.match(sync.parameters.url, /bot_nlu_dispatch_gvintell_v2/);
  assert.match(sync.parameters.jsonBody, /Parse Pick/);
  assert.equal(sync.retryOnFail, true);
  assert.deepEqual(patched.connections['¿Sincronizar acción Zoom?'].main[1], [{ node: 'Normalize Reply', type: 'main', index: 0 }]);
  assert.deepEqual(patched.connections[marker].main[0], [{ node: 'Normalize Reply', type: 'main', index: 0 }]);
  assert.match(patched.nodes.find(node => node.name === '¿Sincronizar acción Zoom?').parameters.conditions.conditions[0].leftValue, /isExecuted/);
  assert.deepEqual(nodes[0].parameters, { url: 'old', jsonBody: 'old' });
  assert.match(patched.nodes.find(node => node.name === 'Normalize Reply').parameters.jsCode, /PRESERVE_PRIMARY_REPLY/);
});

test('patch is idempotent', () => {
  const once = patchZoomConsistency(nodes, connections);
  assert.deepEqual(patchZoomConsistency(once.nodes, once.connections), once);
});

test('fails closed when the dispatcher route changed', () => {
  assert.throws(
    () => patchZoomConsistency(nodes, { 'Dispatch verbatim': { main: [[]] } }),
    /Dispatcher connection changed/,
  );
});
