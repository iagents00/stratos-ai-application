/** Route deterministic list-stage operations to their dedicated, org-scoped RPC. */
export function patchBulkStageDispatch(nodes) {
  const next = structuredClone(nodes);
  const matches = next.filter(node => node.name === 'Dispatch verbatim');
  if (matches.length !== 1) throw new Error('Expected one Dispatch verbatim node.');
  const node = matches[0];
  node.parameters.url = "={{ $('Global Config').item.json.SUPABASE_URL.replace(/\\s+/g, '') + '/rest/v1/rpc/' + ($json.tool_name === 'bulk_change_stage' ? 'bot_bulk_change_stage' : 'bot_nlu_dispatch_gvintell') }}";
  node.parameters.jsonBody = `={{ $json.tool_name === 'bulk_change_stage'
  ? { p_telegram_chat_id: Number($("Prepare AI Input").item.json.chat_id || 0), p_args: ($json.args || {}) }
  : { p_telegram_chat_id: Number($("Prepare AI Input").item.json.chat_id || 0), p_tool_name: $json.tool_name, p_args: ($json.args || {}) }
}}`;
  return next;
}

