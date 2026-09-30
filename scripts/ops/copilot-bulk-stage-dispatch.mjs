/** Route deterministic list-stage operations to their dedicated, org-scoped RPC. */
export function patchBulkStageDispatch(nodes) {
  const next = structuredClone(nodes);
  const matches = next.filter(node => node.name === 'Dispatch verbatim');
  if (matches.length !== 1) throw new Error('Expected one Dispatch verbatim node.');
  const node = matches[0];
  node.parameters.url = "={{ $('Global Config').item.json.SUPABASE_URL.replace(/\\s+/g, '') + '/rest/v1/rpc/' + ($json.tool_name === 'bulk_change_stage' ? 'bot_bulk_change_stage' : ($json.tool_name === 'team_pending_text' ? 'bot_nlu_dispatch_gvintell_inner' : ($json.tool_name === 'list_clients' && ($json.args || {}).advisor_name ? 'bot_clientes_de_asesor' : 'bot_nlu_dispatch_gvintell'))) }}";
  node.parameters.jsonBody = `={{ $json.tool_name === 'bulk_change_stage'
  ? { p_telegram_chat_id: Number($("Prepare AI Input").item.json.chat_id || 0), p_args: ($json.args || {}) }
  : ($json.tool_name === 'list_clients' && ($json.args || {}).advisor_name
    ? { p_chat: Number($("Prepare AI Input").item.json.chat_id || 0), p_name: $json.args.advisor_name, p_context: ($json.args.input_text || '') }
    : { p_telegram_chat_id: Number($("Prepare AI Input").item.json.chat_id || 0), p_tool_name: $json.tool_name, p_args: ($json.args || {}) })
}}`;
  return next;
}
