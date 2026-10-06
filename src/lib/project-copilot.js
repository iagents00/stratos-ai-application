import { supabase } from './supabase';
export async function sendProjectCopilot(text, options = {}) {
  if (options.callback_data) return { reply: 'Describe el cambio de tarea por texto o voz para aplicarlo al Kanban.', error: null };
  const requestId = crypto.randomUUID();
  try {
    const { data, error } = await supabase.functions.invoke('project-copilot', { body: { text, request_id: requestId }, timeout: 125000 });
    if (!error && data?.reply) {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('i-space-board-changed'));
      return { ...data, error: null, buttons: [] };
    }
  } catch { /* A lost response is not a rejected write; never replay automatically. */ }
  try {
  const { data } = await supabase.from('project_copilot_receipts').select('result').eq('request_id', requestId).maybeSingle();
  if (data?.result?.length) return { reply: `Cambios confirmados en I Space:\n${data.result.map(x => `• ${x.title}`).join('\n')}`, error: null };
  } catch { /* Keep delivery uncertainty visible if receipt lookup also fails. */ }
  return { reply: 'No pude confirmar la respuesta. Revisa el tablero y el historial antes de repetir el cambio.', error: null };
}
