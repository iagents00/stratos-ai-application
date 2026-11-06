import { supabase } from './supabase';

// Only acknowledgement/settings phrases go to the deterministic reminder route.
// Other messages keep their existing Copilot route and latency.
export function isReminderReplyCandidate(text, callback = '') {
  if (callback.startsWith('copilot_followup:')) return true;
  const value = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return /^(?:por favor )?(?:activa|activar|enciende|habilita|desactiva|desactivar|apaga|quita)(?: la)? insistencia(?: del copilot)?[.!]*$/.test(value)
    || /^(?:(?:ah|si|te)\s+)*(?:confirmo\b|lo voy a hacer\b|voy a hacerlo\b|lo hare\b|la hare\b|en proceso\b|ya estoy en eso\b|ya lo estoy haciendo\b|(?:ahora |hoy )?no (?:puedo|podre|voy a poder)\b)/.test(value)
    || /^(?:ok|okay|vale|entendido|recibido|de acuerdo|si)[.!]*$/.test(value);
}

export async function replyToCopilotReminder(text, callback = '') {
  if (!isReminderReplyCandidate(text, callback)) return null;
  const parts = callback.startsWith('copilot_followup:') ? callback.split(':') : null;
  const { data, error } = await supabase.rpc('copilot_reminder_reply', {
    p_text: text,
    p_followup_id: parts?.[2] || null,
    p_response: parts?.[1] || null,
  });
  if (error) {
    // An explicit button must never fall through to a model after an uncertain write.
    if (parts) return { reply: null, error: 'reminder_response_unconfirmed' };
    throw error;
  }
  if (data?.settings_changed && typeof window !== 'undefined') window.dispatchEvent(new Event('stratos:reminder-settings-changed'));
  return data?.handled ? { reply: data.reply, persisted: true, error: null } : null;
}

export function followupButtons(id) {
  return [
    { label: 'Lo voy a hacer', action: `copilot_followup:will_do:${id}`, primary: true },
    { label: 'No voy a poder', action: `copilot_followup:unavailable:${id}`, primary: false },
  ];
}
