import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCopilotProfile } from '../src/lib/copilot-profile.js';

function profileClient(response) {
  const observed = {};
  const query = {
    select() { return this; },
    eq(key, value) { observed.filter = [key, value]; return this; },
    abortSignal(signal) { observed.signal = signal; return this; },
    single() { return response; },
  };
  return { from(table) { assert.equal(table, 'profiles'); return query; }, observed };
}

test('a database failure never reports an inactive Copilot account', async () => {
  for (const response of [{ data: null, error: { status: 503 } }, { data: null, error: null }]) {
    const result = await loadCopilotProfile(profileClient(response), 'self');
    assert.equal(result.error, 'profile_unavailable');
  }
});

test('only a successful lookup without chat identity requests activation', async () => {
  const result = await loadCopilotProfile(profileClient({ data: { telegram_chat_id: null } }), 'self');
  assert.equal(result.error, 'not_paired');
});

test('web-only and Telegram identities both work and query only the signed-in profile', async () => {
  for (const chat of [-9000000000065, 7464451486]) {
    const data = { telegram_chat_id: chat, organization_id: 'own-org' };
    const client = profileClient({ data });
    assert.deepEqual(await loadCopilotProfile(client, 'self'), { profile: data, error: null });
    assert.deepEqual(client.observed.filter, ['id', 'self']);
  }
});

test('a stalled profile request is aborted and returns a retryable service error', async () => {
  const client = profileClient(new Promise(() => {}));
  const result = await loadCopilotProfile(client, 'self', 10);
  assert.equal(result.error, 'profile_unavailable');
  assert.equal(client.observed.signal.aborted, true);
});

test('a rejected network request returns a service error', async () => {
  const client = profileClient(Promise.reject(new TypeError('Failed to fetch')));
  assert.equal((await loadCopilotProfile(client, 'self')).error, 'profile_unavailable');
});
