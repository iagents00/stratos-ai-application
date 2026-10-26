import test from 'node:test';
import assert from 'node:assert/strict';
import { requestEmailChange, boundedAccountOperation } from '../src/lib/account-security.js';
const client = (update = {}) => ({ auth: { getUser: async () => ({data: {user: {id: 'self', email: 'old@example.com'}}}), updateUser: async () => ({data: {user: {id:'self', email:'old@example.com', ...update}}}) } });
test('email change normalizes address and distinguishes pending from applied', async () => {
 const c = client(); let sent;
 c.auth.updateUser = async body => { sent = body; return { data: {user:{id:'self',email:'old@example.com'}} }; };
 assert.equal((await requestEmailChange(c, ' NEW@Example.com ')).pending, true);
 assert.deepEqual(sent, {email:'new@example.com'});
 assert.equal((await requestEmailChange(client({email:'new@example.com'}),'new@example.com')).pending, false);
});
test('email change rejects invalid, same address, failed identity and unexpected mutation', async () => {
 const c = client();
 for (const address of ['bad', 'OLD@example.com', `${'a'.repeat(250)}@example.com`]) assert.equal((await requestEmailChange(c,address)).ok,false);
 c.auth.getUser = async () => ({error: new Error('expired')}); assert.equal((await requestEmailChange(c,'new@example.com')).ok,false);
 assert.equal((await requestEmailChange(client({id:'another'}),'new@example.com')).ok,false);
 c.auth.getUser = async () => { throw new Error('offline'); }; assert.equal((await requestEmailChange(c,'new@example.com')).ok,false);
});
test('bounded operations do not remain loading forever', async () => { await assert.rejects(boundedAccountOperation(new Promise(()=>{}), 5), /timeout/); });

import { readEmailConfirmation } from '../src/lib/email-confirmation.js';
test('email confirmation consumes only its own callback and removes bearer material from URL',()=>{
 let replacement;
 const history={replaceState:(_state,_title,path)=>{replacement=path;}};
 assert.equal(readEmailConfirmation({hash:'#type=recovery&access_token=secret'},history),null);
 assert.equal(replacement,undefined);
 assert.deepEqual(readEmailConfirmation({hash:'#type=email_change&access_token=secret',pathname:'/login',search:'?app'},history),{token:'secret'});
 assert.equal(replacement,'/login?app');
});
