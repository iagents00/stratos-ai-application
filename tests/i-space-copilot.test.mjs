import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('I Space resolves by authenticated organization and keeps its Copilot isolated', async () => {
  const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  const originalFetch = globalThis.fetch;
  try {
    const clients = await server.ssrLoadModule('/src/clients/index.js');
    const nav = await server.ssrLoadModule('/src/app/constants/navigation.js');
    const { supabase } = await server.ssrLoadModule('/src/lib/supabase.js');
    const cfg = clients.getClientConfig('i-space');
    const user = { id: 'test-owner', role: 'admin', organizationId: cfg.tenant.organizationId };
    for (const path of ['/', '/tenant', '/nsg']) {
      const loc = new URL(`https://stratoscapitalgroup.com${path}`);
      assert.equal(new URL(clients.resolveRedirectForUser(user, clients.matchClientFromLocation(loc), loc)).pathname, '/i-space');
    }
    const unknown = clients.resolveRedirectForUser({ organizationId: 'unknown-org' }, 'i-space', new URL('https://stratoscapitalgroup.com/i-space'));
    assert.equal(new URL(unknown).pathname, '/tenant');
    assert.equal(clients.getClientConfigByOrgId(user.organizationId).id, 'i-space');
    for (const module of ['copilot', 'mkt', 'plan', 'miespacio', 'c']) assert.equal(nav.canAccessModule(module, user, cfg), true, module);
    for (const module of ['wa', 'fa', 'hr', 'e', 'chat']) assert.equal(nav.canAccessModule(module, user, cfg), false, module);
    assert.equal(clients.getClientConfig('tenant').features.copilotModule, false);
    assert.equal(cfg.features.procesoGuiado, false);
    assert.ok(cfg.copilot.capabilities.every(x => x.kind === 'pedis'));
    supabase.auth.getSession = async () => ({ data: { session: { user: { id: user.id } } } });
    supabase.from = () => ({ select() { return this; }, eq() { return this; }, abortSignal() { return this; }, single: async () => ({ data: { telegram_chat_id: -9000000000999, role: 'admin', organization_id: user.organizationId } }) });
    const called = [];
    supabase.rpc = async (name) => { called.push(name); return { data: null, error: null }; };
    let webhook;
    globalThis.fetch = async (url) => { webhook = url; return new Response(JSON.stringify({ reply: 'Tu espacio está listo.' })); };
    const { sendCopilotMessage } = await server.ssrLoadModule('/src/lib/telegram.js');
    const help = await sendCopilotMessage('¿Qué puedes hacer?');
    assert.match(help.reply, /I Space/);
    assert.doesNotMatch(help.reply, /NSG|Duke|inmobiliari/);
    assert.equal(webhook, undefined);
    const reply = await sendCopilotMessage('¿Qué tengo pendiente?');
    assert.equal(reply.reply, 'Tu espacio está listo.');
    assert.equal(webhook, cfg.tenant.copilotWebhook);
    assert.equal(called.includes('copilot_send'), false);
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});
