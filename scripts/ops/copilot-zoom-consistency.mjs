export const marker = 'Zoom consistency sync';
export const normalizeMarker = '// ZOOM_CONSISTENCY_PRESERVE_PRIMARY_REPLY_20260923';
const zoomCondition = "={{ $('Parse Pick').isExecuted ? ($('Parse Pick').item.json.tool_name === 'change_stage' && String((($('Parse Pick').item.json.args || {}).stage || '')).toLowerCase() === 'zoom agendado') : false }}";

function patchNormalizeReply(code) {
  if (code.includes(normalizeMarker)) return code;
  const anchor = 'const item = $input.first().json;';
  if (code.split(anchor).length !== 2) throw new Error('Normalize Reply changed; inspect instead of overwriting.');
  return code.replace(anchor, `${normalizeMarker}
let item;
try {
  const pickNode = $('Parse Pick');
  const picked = pickNode.isExecuted ? (pickNode.item.json || {}) : {};
  const stage = String(((picked.args || {}).stage || '')).toLowerCase();
  item = picked.tool_name === 'change_stage' && stage === 'zoom agendado'
    ? $('Dispatch verbatim').item.json
    : $input.first().json;
} catch(e) { item = $input.first().json; }`);
}

export function patchZoomConsistency(nodes, connections) {
  const nextNodes = structuredClone(nodes);
  const nextConnections = structuredClone(connections);
  const dispatches = nextNodes.filter(node => node.name === 'Dispatch verbatim');
  const normalizers = nextNodes.filter(node => node.name === 'Normalize Reply');
  if (dispatches.length !== 1 || normalizers.length !== 1) {
    throw new Error('Expected one dispatcher and one normalizer.');
  }

  const existingIf = nextNodes.filter(node => node.name === '¿Sincronizar acción Zoom?');
  const existingSync = nextNodes.filter(node => node.name === marker);
  if (existingIf.length || existingSync.length) {
    if (existingIf.length === 1 && existingSync.length === 1) {
      existingIf[0].parameters.conditions.conditions[0].leftValue = zoomCondition;
      existingSync[0].parameters.url = "={{ $('Global Config').item.json.SUPABASE_URL.replace(/\\s+/g, '') + '/rest/v1/rpc/bot_nlu_dispatch_gvintell_v2' }}";
      normalizers[0].parameters.jsCode = patchNormalizeReply(normalizers[0].parameters.jsCode);
      return { nodes: nextNodes, connections: nextConnections };
    }
    throw new Error('Partial Zoom consistency topology; inspect instead of overwriting.');
  }

  const dispatch = dispatches[0];
  const oldRoute = nextConnections['Dispatch verbatim'];
  if (JSON.stringify(oldRoute) !== JSON.stringify({ main: [[{ node: 'Normalize Reply', type: 'main', index: 0 }]] })) {
    throw new Error('Dispatcher connection changed; inspect instead of overwriting.');
  }

  const condition = {
    id: 'zoom-consistency-if-20260923',
    name: '¿Sincronizar acción Zoom?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [1840, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{
          id: 'zoom-consistency-condition',
          leftValue: zoomCondition,
          rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        }],
        combinator: 'and',
      },
      options: {},
    },
  };

  const sync = structuredClone(dispatch);
  sync.id = 'zoom-consistency-sync-20260923';
  sync.name = marker;
  sync.position = [2070, 180];
  sync.parameters.url = "={{ $('Global Config').item.json.SUPABASE_URL.replace(/\\s+/g, '') + '/rest/v1/rpc/bot_nlu_dispatch_gvintell_v2' }}";
  sync.parameters.jsonBody = `={{ {
    p_telegram_chat_id: Number($("Prepare AI Input").item.json.chat_id || 0),
    p_tool_name: 'set_zoom_datetime',
    p_args: {
      input_text: 'Zoom ' + String((($('Parse Pick').item.json.args || {}).client_name || '')) + ' ' + String((($('Parse Pick').item.json.args || {}).zoom_at || '')),
      client_name: ($('Parse Pick').item.json.args || {}).client_name,
      zoom_at: ($('Parse Pick').item.json.args || {}).zoom_at
    }
  } }}`;
  sync.retryOnFail = true;
  sync.maxTries = 2;
  sync.waitBetweenTries = 1000;
  normalizers[0].parameters.jsCode = patchNormalizeReply(normalizers[0].parameters.jsCode);

  nextNodes.push(condition, sync);
  nextConnections['Dispatch verbatim'] = { main: [[{ node: condition.name, type: 'main', index: 0 }]] };
  nextConnections[condition.name] = {
    main: [
      [{ node: sync.name, type: 'main', index: 0 }],
      [{ node: 'Normalize Reply', type: 'main', index: 0 }],
    ],
  };
  nextConnections[sync.name] = { main: [[{ node: 'Normalize Reply', type: 'main', index: 0 }]] };
  return { nodes: nextNodes, connections: nextConnections };
}
