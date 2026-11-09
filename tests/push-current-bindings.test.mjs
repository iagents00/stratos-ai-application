import test from 'node:test';
import assert from 'node:assert/strict';
import {currentBindings} from '../supabase/functions/send-push/current-bindings.js';
test('shared web and native endpoints receive only the latest account notices',()=>{
 for(const key of ['endpoint','token']) {
  const old={user_id:'tenant-a-user',[key]:'same-device',updated_at:'2026-11-08T10:00Z'};
  const active={...old,user_id:'tenant-b-user',updated_at:'2026-11-09T10:00Z'};
  assert.deepEqual(currentBindings([old],[old,active],key),[]);
  assert.deepEqual(currentBindings([active],[old,active],key),[active]);
  assert.deepEqual(currentBindings([active],[{...old,updated_at:active.updated_at},active],key),[]);
  assert.deepEqual(currentBindings([active],[],key),[]);
 }
});
