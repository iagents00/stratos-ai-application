export const marker = '// ADVISOR_PRONOUN_MEMORY_GUARD_V3_20260923';
export const interpreterMarker = '// ADVISOR_CLIENT_QUESTION_GUARD_20260923';

export function patchAdvisorInterpreter(code) {
  if (code.includes(interpreterMarker)) return code;
  const routeAnchor = "let ruta = ['redistribuir','actividades','completar','correccion','recordatorio','equipo','crm'].includes(p.ruta) ? p.ruta : 'crm';";
  const routeGuard = `${routeAnchor}
${interpreterMarker}
let advisorClientText = '';
const advisorQuestion = raw.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
if (/\\b(?:cuantos|cuantas|que|cuales)\\b[\\s\\S]*\\b(?:clientes|leads|cartera)\\b[\\s\\S]*\\b(?:ella|el)\\b/.test(advisorQuestion)) {
  try {
    const advisorCtx = $('Contexto Reciente').item.json || {};
    const advisorTeam = Array.isArray(advisorCtx.equipo) ? advisorCtx.equipo : [];
    const recentUsers = Array.isArray(advisorCtx.ultimos_mensajes) ? [...advisorCtx.ultimos_mensajes].reverse() : [];
    const advisorNorm = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    for (const message of recentUsers) {
      if (!message || message.rol !== 'user' || String(message.texto || '').trim() === raw.trim()) continue;
      const found = advisorTeam.find(person => person && person.nombre && advisorNorm(message.texto).includes(advisorNorm(person.nombre)));
      if (found) { advisorClientText = 'clientes de ' + String(found.nombre).trim(); break; }
    }
  } catch(e){}
  if (advisorClientText) ruta = 'crm';
}`;
  const textAnchor = "const texto = (esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw);";
  const textReplacement = "const texto = advisorClientText || ((esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw));";
  if (code.split(routeAnchor).length !== 2 || code.split(textAnchor).length !== 2) {
    throw new Error('Interpreter changed; inspect instead of overwriting.');
  }
  const next = code.replace(routeAnchor, routeGuard).replace(textAnchor, textReplacement);
  new Function('$input', '$', next);
  return next;
}

export function patchAdvisorMemory(code) {
  if (code.includes(marker)) return code;
  const anchor = 'return [{ json: { tool_name, args } }];';
  const guard = `${marker}
if (tool_name === 'list_clients' && !args.advisor_name && !args.asesor_name) {
  try {
    const ctx = $('Contexto Reciente').item.json || {};
    const team = Array.isArray(ctx.equipo) ? ctx.equipo : [];
    const recent = Array.isArray(ctx.ultimos_mensajes) ? [...ctx.ultimos_mensajes].reverse() : [];
    const norm = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    const requestText = (typeof args.input_text === 'string' && args.input_text.trim()) ? args.input_text : inputText;
    const explicit = team.find(person => person && person.nombre && norm(requestText).includes(norm(person.nombre)));
    let advisor = explicit ? String(explicit.nombre).trim() : '';
    if (!advisor && /\\b(?:ella|el|él|ese asesor|esa asesora)\\b/i.test(inputText)) {
      for (const message of recent) {
        if (!message || message.rol !== 'user' || String(message.texto || '').trim() === inputText.trim()) continue;
        const textNorm = norm(message.texto);
        const found = team.find(person => person && person.nombre && textNorm.includes(norm(person.nombre)));
        if (found) { advisor = String(found.nombre).trim(); break; }
      }
    }
    if (advisor) {
      args.advisor_name = advisor;
      args.asesor_name = advisor;
      args.input_text = 'clientes de ' + advisor;
    }
  } catch(e){}
}`;
  const legacy = /\/\/ ADVISOR_PRONOUN_MEMORY_GUARD(?:_V\d+)?_20260923[\s\S]*?(?=return \[\{ json: \{ tool_name, args \} \}\];)/;
  const next = legacy.test(code)
    ? code.replace(legacy, `${guard}\n`)
    : code.replace(anchor, `${guard}\n${anchor}`);
  if (next === code) throw new Error('Parse Pick return changed; inspect instead of overwriting.');
  new Function('$input', '$', next);
  return next;
}
