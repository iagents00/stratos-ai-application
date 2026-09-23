import test from 'node:test';
import assert from 'node:assert/strict';
import { patchTeamPendingDispatch, patchTeamPendingGuard } from './copilot-team-pending-guard.mjs';

const fixture = 'return [{ json: { tool_name, args } }];';

function run(text, pending, initialTool = 'confirm_last') {
  const code = patchTeamPendingGuard(fixture);
  return new Function('$input', '$', `let tool_name=${JSON.stringify(initialTool)}, args={input_text:$input}, inputText=$input; ${code}`)(text, name => {
    assert.equal(name, 'Contexto Reciente');
    return { item: { json: { plan_esperando_confirmacion: pending } } };
  })[0].json;
}

test('plain yes bypasses the wrong pending interceptor for a team plan', () => {
  const result = run('Sí.', { action: 'team_plan', tareas_n: 1, tareas: [{ texto: 'Revisar' }] });
  assert.equal(result.tool_name, 'team_pending_text');
  assert.deepEqual(result.args, { input_text: 'si' });
});

test('plain no uses the same database team-plan handler', () => {
  const result = run('No', { action: 'team_plan', tareas_n: 1 }, 'cancel_last');
  assert.equal(result.tool_name, 'team_pending_text');
  assert.deepEqual(result.args, { input_text: 'no' });
});

test('does not change confirmations for other pending mechanisms', () => {
  const result = run('Sí', { action: 'delete', tareas_n: 0 });
  assert.equal(result.tool_name, 'confirm_last');
});

test('does not change a non-confirmation', () => {
  const result = run('Sí, pero mañana', { action: 'team_plan', tareas_n: 1 });
  assert.equal(result.tool_name, 'confirm_last');
});

test('patch is idempotent', () => {
  const once = patchTeamPendingGuard(fixture);
  assert.equal(patchTeamPendingGuard(once), once);
});

test('team pending text bypasses only the outer database dispatcher', () => {
  const nodes = [{ name: 'Dispatch verbatim', parameters: {
    url: "={{ base + '/rest/v1/rpc/' + ($json.tool_name === 'bulk_change_stage' ? 'bot_bulk_change_stage' : 'bot_nlu_dispatch_gvintell') }}",
  } }];
  const patched = patchTeamPendingDispatch(nodes);
  assert.match(patched[0].parameters.url, /team_pending_text.*bot_nlu_dispatch_gvintell_inner/);
  assert.equal(patchTeamPendingDispatch(patched)[0].parameters.url, patched[0].parameters.url);
});
