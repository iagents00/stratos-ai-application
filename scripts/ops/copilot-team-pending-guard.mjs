export const marker = '// TEAM_PLAN_TEXT_CONFIRM_GUARD_V3_20260923';

export function patchTeamPendingGuard(code) {
  if (code.includes(marker)) return code;
  const anchor = 'return [{ json: { tool_name, args } }];';
  if (code.split(anchor).length !== 2) {
    throw new Error('Parse Pick return changed; inspect instead of overwriting.');
  }
  const guard = `${marker}
// confirm_last/cancel_last are intercepted by a different pending table before
// bot_pending_confirm.team_plan. Let the database inspect the current pending
// row directly for a plain yes/no response to a team plan.
const _teamReply = String(inputText || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[.!¡¿?]/g, '').trim();
if (/^(?:si|claro|dale|ok|okey|okay|confirmo|confirmar|correcto|adelante|hazlo|sip|simon|afirmativo|no|nel|nop|nope|cancela|cancelar|mejor no|dejalo|olvidalo|para|stop)$/.test(_teamReply)) {
  try {
    const _teamContext = $('Contexto Reciente').item.json || {};
    const _teamPending = _teamContext.plan_esperando_confirmacion || {};
    if (_teamPending.action === 'team_plan' && Number(_teamPending.tareas_n || (_teamPending.tareas || []).length) > 0) {
      tool_name = 'team_pending_text';
      // The live DB normalizer removes ¿?! but not a final period. Pass the
      // already-normalized confirmation so "Sí."/"No." match its exact guard.
      args = { input_text: _teamReply };
    }
  } catch(e){}
}`;
  const legacy = /\/\/ TEAM_PLAN_TEXT_CONFIRM_GUARD(?:_V\d+)?_20260923[\s\S]*?(?=return \[\{ json: \{ tool_name, args \} \}\];)/;
  const next = legacy.test(code)
    ? code.replace(legacy, `${guard}\n`)
    : code.replace(anchor, `${guard}\n${anchor}`);
  new Function('$input', '$', next);
  return next;
}

export function patchTeamPendingDispatch(nodes) {
  const next = structuredClone(nodes);
  const matches = next.filter(node => node.name === 'Dispatch verbatim');
  if (matches.length !== 1) throw new Error('Expected one Dispatch verbatim node.');
  const node = matches[0];
  if (node.parameters.url.includes("$json.tool_name === 'team_pending_text'")) return next;
  const anchor = "'bot_nlu_dispatch_gvintell'";
  if (node.parameters.url.split(anchor).length !== 2) {
    throw new Error('Dispatch URL changed; inspect instead of overwriting.');
  }
  node.parameters.url = node.parameters.url.replace(
    anchor,
    "($json.tool_name === 'team_pending_text' ? 'bot_nlu_dispatch_gvintell_inner' : 'bot_nlu_dispatch_gvintell')",
  );
  return next;
}
