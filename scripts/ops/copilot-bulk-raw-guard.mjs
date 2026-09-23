/**
 * Keep data-bearing bulk lead messages on the current turn.
 *
 * The Copilot interpreter may summarize away the list and the AI Agent may then
 * reuse leads from Postgres chat memory. These guards preserve the raw message
 * and make the database parser the only source of bulk-registration operands.
 */

export const interpreterMarker = '// BULK_RAW_INPUT_GUARD_V5_20260923';
export const pickMarker = '// BULK_REGISTER_CURRENT_TURN_GUARD_V5_20260923';

const detector = `function _bulkPhoneMatches(s){
  return (String(s || '').match(/\\+?\\d[\\d ().-]{6,}\\d/g) || [])
    .filter(v => v.replace(/\\D/g, '').length >= 8);
}
function _cleanBulkName(s){
  return String(s || '')
    .replace(/^\\s*(?:[-*•]|\\d+[.)-])\\s*/, '')
    .replace(/\\[QA-[^\\]]*\\]/ig, ' ')
    .replace(/\\b(?:nombre|cliente|lead)\\b\\s*[:=-]?/ig, ' ')
    .replace(/\\b(?:numero|número)\\s+de\\s+(?:telefono|teléfono|celular)\\b\\s*[:=-]?/ig, ' ')
    .replace(/\\b(?:telefono|teléfono|tel|celular|movil|móvil)\\b\\s*[:=-]?/ig, ' ')
    .replace(/^[\\s|,:=→>-]+|[\\s|,:=→>-]+$/g, '')
    .replace(/\\s+/g, ' ')
    .trim();
}
function _parseCurrentBulkLeads(s){
  const source = String(s || '');
  const seen = new Set();
  const leads = [];
  const pushLead = (rawName, phoneDigits, rawSegment) => {
    const campaignMatch = String(rawSegment || '').match(/\\bBAY\\s+VIEW\\s+GRAND(?:\\s+\\d+)?\\b/i);
    const campaign = campaignMatch ? campaignMatch[0].replace(/\\s+/g, ' ').trim() : '';
    const name = _cleanBulkName(rawName)
      .replace(/\\s+[—|,→>-]?\\s*(?:BAY\\s+VIEW\\s+GRAND.*)$/i, '')
      .trim();
    if (!name || seen.has(phoneDigits)) return;
    seen.add(phoneDigits);
    leads.push(campaign ? { name, phone: phoneDigits, campaign } : { name, phone: phoneDigits });
  };

  // CRM export used by Emanuel: phone<TAB>name+campaign<TAB>phone... in one line.
  if ((source.match(/\\t/g) || []).length >= 2 && !/[\\r\\n;]/.test(source)) {
    const anchors = [];
    const anchorRe = /\\+?\\d[\\d ().-]{6,}\\d/g;
    let anchor;
    while ((anchor = anchorRe.exec(source)) !== null) {
      const digits = anchor[0].replace(/\\D/g, '');
      if (digits.length >= 8 && digits.length <= 15) anchors.push({ ...anchor, digits });
    }
    for (let i = 0; i < anchors.length; i++) {
      const current = anchors[i];
      const end = i + 1 < anchors.length ? anchors[i + 1].index : source.length;
      const segment = source.slice(current.index + current[0].length, end);
      pushLead(segment, current.digits, segment);
    }
    if (leads.length >= 2) return leads;
    seen.clear();
    leads.length = 0;
  }

  for (const rawRow of source.split(/\\r?\\n|;/)) {
    const candidates = [];
    const re = /\\+?\\d[\\d ().-]{6,}\\d/g;
    let match;
    while ((match = re.exec(rawRow)) !== null) {
      const digits = match[0].replace(/\\D/g, '');
      if (digits.length >= 8 && digits.length <= 15) candidates.push({ ...match, digits });
    }
    if (!candidates.length) continue;
    candidates.sort((a, b) => b.digits.length - a.digits.length || b.index - a.index);
    const phone = candidates[0];
    const before = _cleanBulkName(rawRow.slice(0, phone.index));
    const after = _cleanBulkName(rawRow.slice(phone.index + phone[0].length));
    let name = before;
    if (!name || /^(?:telefono|teléfono|tel|celular|movil|móvil)$/i.test(name)) name = after;
    pushLead(name, phone.digits, rawRow);
  }
  return leads;
}
function _looksLikeBulkLeadInput(s){
  return _bulkPhoneMatches(s).length >= 2 && _parseCurrentBulkLeads(s).length >= 2;
}
function _bulkTargetsSelf(s){
  const norm = String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  return /\\b(?:asigname(?:los|las)?|reasigname(?:los|las)?|para mi|a mi)\\b/.test(norm)
    || /\\breparte\\b[\\s\\S]*\\bpara mi\\b/.test(norm);
}
function _bulkRequestedStage(s){
  const norm = String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  const stages = ['Contáctame Ya','Segundo Intento','Tercer Intento','Rotación','Remarketing IA','Zoom Agendado','Reactivar Zoom','Zoom Concretado','Seguimiento','Largo Plazo','Apartó','Visita Agendada','Cierre','Postventa'];
  for (const stage of stages) {
    const key = stage.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    if (norm.includes(key)) return stage;
  }
  if (/\\bprimera etapa\\b/.test(norm)) return 'Contáctame Ya';
  if (/\\bsegunda etapa\\b/.test(norm)) return 'Segundo Intento';
  if (/\\btercera etapa\\b/.test(norm)) return 'Tercer Intento';
  return '';
}`;

export function patchBulkInterpreter(code) {
  if (code.includes(interpreterMarker)) return code;
  const legacy = /\/\/ BULK_RAW_INPUT_GUARD(?:_V\d+)?_20260923[\s\S]*?const esAltaMasivaConDatos = _looksLikeBulkLeadInput\(raw\);/;
  if (legacy.test(code)) {
    const upgraded = code.replace(legacy, `${interpreterMarker}\n${detector}\nconst esAltaMasivaConDatos = _looksLikeBulkLeadInput(raw);`);
    new Function('$input', '$', upgraded);
    return upgraded;
  }
  const old = `const esAgendaPersonal = /^(?:\\/?agenda|mi agenda|mis pendientes|que tengo (?:hoy|manana|pendiente|pendientes))$/.test(agendaQuery);
if (esConfirmacion || esAgendaPersonal) ruta = 'crm';
const texto = (esConfirmacion || esAgendaPersonal) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);`;
  const replacement = `const esAgendaPersonal = /^(?:\\/?agenda|mi agenda|mis pendientes|que tengo (?:hoy|manana|pendiente|pendientes))$/.test(agendaQuery);
${interpreterMarker}
${detector}
const esAltaMasivaConDatos = _looksLikeBulkLeadInput(raw);
if (esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos) ruta = 'crm';
const texto = (esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);`;
  if (code.split(old).length !== 2) throw new Error('Interpreter changed; inspect instead of overwriting.');
  const next = code.replace(old, replacement);
  new Function('$input', '$', next);
  return next;
}

export function patchBulkPick(code) {
  if (code.includes(pickMarker)) return code;
  const upgradedBlock = `${pickMarker}
${detector}
if (_looksLikeBulkLeadInput(inputText)) {
  // Never reuse model-extracted leads from memory: parse the exact current turn here.
  const currentLeads = _parseCurrentBulkLeads(inputText);
  const targetStage = _bulkRequestedStage(inputText);
  const normBulk = inputText.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  const targetsSelf = _bulkTargetsSelf(inputText);
  const isStageMove = !targetsSelf && targetStage && /\\b(?:mueve|mover|pasa|pasar|cambia|cambiar|pon|poner|coloca|colocar)\\b/.test(normBulk);
  if (isStageMove) {
    tool_name = 'bulk_change_stage';
    args = { clients: currentLeads.map(lead => lead.phone), stage: targetStage, input_text: inputText };
  } else {
    tool_name = 'bulk_register';
    args = { leads: currentLeads, input_text: inputText };
  }
  if (!isStageMove && targetsSelf) {
    try {
      const current = $('Contexto Reciente').item.json;
      if (current && typeof current.quien_escribe === 'string' && current.quien_escribe.trim()) {
        args.target_asesor = current.quien_escribe.trim();
        // Live dispatcher currently reads asesor_name; keep both until its contract is migrated.
        args.asesor_name = current.quien_escribe.trim();
      }
    } catch(e){}
  }
}`;
  const legacy = /\/\/ BULK_REGISTER_CURRENT_TURN_GUARD(?:_V\d+)?_20260923[\s\S]*?(?=\n\/\/ Deterministic stage guard)/;
  if (legacy.test(code)) {
    const upgraded = code.replace(legacy, upgradedBlock);
    new Function('$input', '$', upgraded);
    return upgraded;
  }
  const anchor = `if (typeof args.input_text !== 'string' || !args.input_text) args.input_text = inputText;`;
  const replacement = `${anchor}\n${upgradedBlock}`;
  if (code.split(anchor).length !== 2) throw new Error('Parse Pick changed; inspect instead of overwriting.');
  const next = code.replace(anchor, replacement);
  new Function('$input', '$', next);
  return next;
}
