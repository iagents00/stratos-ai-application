import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subscribeAuthEvents } from '../src/lib/auth-events.js';

for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT', 'USER_DELETED']) {
  test(`${event}: libera el bloqueo de Auth antes de consultar la sesión`, async () => {
    let callback;
    let locked = true;
    let release;
    const lock = new Promise(resolve => { release = resolve; });
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    const session = { user: { id: 'admin' } };
    const auth = {
      onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
      async getSession() { await lock; return session; },
    };
    const subscription = subscribeAuthEvents(auth, async (receivedEvent, receivedSession) => {
      try {
        assert.equal(locked, false);
        assert.equal(receivedEvent, event);
        assert.equal(receivedSession, session);
        assert.equal(await auth.getSession(), session);
        finish();
      } catch (error) { finish(error); }
    }, finish);
    // Supabase awaits its subscriber before releasing this same lock.
    assert.equal(callback(event, session), undefined);
    locked = false;
    release();
    assert.equal(await done, undefined);
    subscription.unsubscribe();
  });
}

test('desmontar cancela los eventos pendientes y la suscripción', async () => {
  let callback;
  let unsubscribed = false;
  let called = false;
  const auth = { onAuthStateChange(fn) {
    callback = fn;
    return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
  } };
  const subscription = subscribeAuthEvents(auth, () => { called = true; }, assert.fail);
  callback('SIGNED_IN', {});
  subscription.unsubscribe();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(called, false);
  assert.equal(unsubscribed, true);
});

test('los errores asíncronos se reportan sin rechazos no controlados', async () => {
  let callback;
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  const error = new Error('red no disponible');
  const auth = { onAuthStateChange(fn) {
    callback = fn;
    return { data: { subscription: { unsubscribe() {} } } };
  } };
  const subscription = subscribeAuthEvents(auth, async () => { throw error; }, finish);
  callback('TOKEN_REFRESHED', {});
  assert.equal(await done, error);
  subscription.unsubscribe();
});

test('AuthProvider usa el suscriptor que libera el bloqueo', () => {
  const source = readFileSync(new URL('../src/contexts/AuthContext.jsx', import.meta.url), 'utf8');
  assert.match(source, /subscribeAuthEvents\(supabase\.auth,/);
  assert.doesNotMatch(source, /supabase\.auth\.onAuthStateChange\(/);
});
