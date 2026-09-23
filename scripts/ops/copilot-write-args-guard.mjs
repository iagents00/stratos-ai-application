export const marker = '// CURRENT_TURN_WRITE_ARGS_GUARD_20260923';

export function patchWriteArgsGuard(code) {
  if (code.includes(marker)) return code;
  const anchor = '// Anti-override del backend:';
  if (code.split(anchor).length !== 2) throw new Error('Parse Pick write anchor changed; inspect instead of overwriting.');
  const guard = `${marker}
{
  const currentWriteText = String(inputText || args.input_text || '');
  if (tool_name === 'agendar_visita' && !args.lugar && !args.location && !args.ubicacion) {
    const places = [...currentWriteText.matchAll(/\\ben\\s+([^,.]{2,80})[.!]?\\s*$/ig)];
    if (places.length) args.lugar = String(places[places.length - 1][1] || '').trim();
  }
  if ((tool_name === 'add_expediente_note' || tool_name === 'add_expediente_voice') && !args.phone) {
    const withoutQaTags = currentWriteText.replace(/\\bQA-\\d{8}-[A-Z0-9-]+\\b/ig, ' ');
    const phones = (withoutQaTags.match(/\\+?\\d[\\d ().-]{6,}\\d/g) || [])
      .map(value => value.replace(/\\D/g, ''))
      .filter(value => value.length >= 8 && value.length <= 15);
    if (phones.length === 1) args.phone = phones[0];
  }
}`;
  const next = code.replace(anchor, `${guard}\n${anchor}`);
  new Function('$input', '$', next);
  return next;
}
