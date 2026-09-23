import test from 'node:test';
import assert from 'node:assert/strict';
import { patchBulkStageDispatch } from './copilot-bulk-stage-dispatch.mjs';

test('changes only URL/body routing on the existing dispatch node', () => {
  const fixture = [
    { name: 'Other', parameters: { value: 1 } },
    { name: 'Dispatch verbatim', parameters: { url: 'old', jsonBody: 'old', method: 'POST' }, retryOnFail: true },
  ];
  const next = patchBulkStageDispatch(fixture);
  assert.equal(fixture[1].parameters.url, 'old');
  assert.match(next[1].parameters.url, /bot_bulk_change_stage/);
  assert.match(next[1].parameters.url, /bot_clientes_de_asesor/);
  assert.match(next[1].parameters.jsonBody, /p_args/);
  assert.match(next[1].parameters.jsonBody, /p_name/);
  assert.equal(next[1].parameters.method, 'POST');
  assert.equal(next[1].retryOnFail, true);
  assert.deepEqual(next[0], fixture[0]);
});
