import { supabase } from './supabase';
export async function sendHuliMessage(text) {
  try {
    const { data, error } = await supabase.functions.invoke('huli-copilot', { body: { text } });
    if (error || data?.error) return { reply: null, error: data?.error || 'No se pudo consultar Huli. Revisa que la integración esté habilitada.' };
    if (typeof data?.reply !== 'string') return { reply: null, error: 'Respuesta inválida de Huli.' };
    return { reply: data.reply, error: null };
  } catch { return { reply: null, error: 'No se pudo conectar con Huli.' }; }
}
