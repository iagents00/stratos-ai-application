import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('reminder confirmations stay deterministic and uncertain writes never fall through to another engine', async () => {
  const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false } });
  const originalFetch = globalThis.fetch;
  try {
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.js');
    const { isReminderReplyCandidate, replyToCopilotReminder } = await server.ssrLoadModule('/src/lib/copilot-reminders.js');
    for (const text of ['Te confirmo que lo voy a hacer', 'No voy a poder', 'Sí', 'Activa la insistencia', 'Desactiva la insistencia.']) assert.equal(isReminderReplyCandidate(text), true, text);
    for (const text of ['Muéstrame mis clientes', 'recuérdame llamar mañana', '¿Cuántos Zooms tengo?', 'registra este cliente']) assert.equal(isReminderReplyCandidate(text), false, text);
    let calls = [];
    supabase.rpc = async (name, args) => { calls.push({ name, args }); return { data: { handled: true, reply: 'Confirmación recibida.', persisted: true } }; };
    const id = '10000000-0000-4000-8000-000000000099';
    const result = await replyToCopilotReminder('Lo voy a hacer', `copilot_followup:will_do:${id}`);
    assert.deepEqual(calls, [{ name: 'copilot_reminder_reply', args: { p_text: 'Lo voy a hacer', p_followup_id: id, p_response: 'will_do' } }]);
    assert.equal(result.persisted, true);
    const { sendCopilotMessage } = await server.ssrLoadModule('/src/lib/telegram.js');
    supabase.auth.getSession=async()=>({data:{session:{access_token:'fixed-user-token',user:{id:'own-user'}}}});
    globalThis.fetch = async (url,options) => {
      assert.match(String(url), /rpc\/copilot_reminder_reply$/);
      calls.push({name:'copilot_reminder_reply',args:JSON.parse(options.body)});
      return new Response(JSON.stringify({handled:true,reply:'Confirmación recibida.',persisted:true}),{headers:{'Content-Type':'application/json'}});
    };
    calls = [];
    assert.equal((await sendCopilotMessage('Lo voy a hacer', { callback_data: `copilot_followup:will_do:${id}` })).reply, 'Confirmación recibida.');
    assert.equal(calls.length, 1); // No competing user-log trigger and no duplicate assistant log.
    globalThis.fetch=async()=>new Response(JSON.stringify({message:'response lost'}),{status:503,headers:{'Content-Type':'application/json'}});
    assert.equal((await sendCopilotMessage('No voy a poder', { callback_data: `copilot_followup:unavailable:${id}` })).error, 'reminder_response_unconfirmed');
    globalThis.fetch=async()=>{throw new TypeError('network interrupted');};
    assert.equal((await sendCopilotMessage('Activa la insistencia')).error, 'reminder_response_unconfirmed');
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
