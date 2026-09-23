export const marker = '// ADVISOR_PRONOUN_MEMORY_GUARD_V2_20260923';

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
    const explicit = team.find(person => person && person.nombre && norm(inputText).includes(norm(person.nombre)));
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
