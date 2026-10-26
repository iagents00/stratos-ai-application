import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckout, receivePaymentEvent, validateOrder } from '../server/payments/core.mjs';
import handler from '../api/payments.js';
const order = {id:'order',organizationId:'org',customerId:'customer',amountMinor:10000,currency:'MXN',status:'pending',provider:'stripe'};
const actor = {id:'user',organizationId:'org',role:'admin',active:true};
const adapter = {provider:'stripe',allowedReturnOrigins:['https://app.getstratosai.com'],allowedCheckoutOrigins:['https://checkout.stripe.com'],createCheckout:async()=>({id:'checkout',url:'https://checkout.stripe.com/session'})};
const store = {getOrder:async()=>({...order}),withOrderLock:async(_id,fn)=>fn(),saveCheckout:async()=>{}};
test('checkout rejects missing configuration, cross-tenant access, invalid amounts and unsafe returns', async()=>{
 await assert.rejects(createCheckout({actor, orderId:'order'}), /payments_not_configured/);
 for(const changed of [{organizationId:'other'}, {role:'asesor'}, {active:false}]) await assert.rejects(createCheckout({actor:{...actor,...changed},orderId:'order',store,adapter,returnUrl:'https://app.getstratosai.com'}));
 for(const amountMinor of [0,-1,1.5,NaN,Infinity]) assert.throws(()=>validateOrder({...order,amountMinor}));
 await assert.rejects(createCheckout({actor,orderId:'order',store,adapter,returnUrl:'https://evil.test'}),/invalid_return_url/);
});
test('checkout takes price from trusted store, reuses checkout and sends stable idempotency key', async()=>{
 let calls=0, checkout;
 const s={...store,getOrder:async()=>({...order,checkout}),saveCheckout:async(_id,value)=>{checkout=value;}};
 const a={...adapter,createCheckout:async args=>{calls++;assert.equal(args.order.amountMinor,10000);assert.equal(args.idempotencyKey,'stratos:org:order');return adapter.createCheckout();}};
 for(let i=0;i<2;i++) await createCheckout({actor,orderId:'order',store:s,adapter:a,returnUrl:'https://app.getstratosai.com'});
 assert.equal(calls,1);
});
test('webhook verifies before accessing store and rejects mismatched amount or tenant',async()=>{
 const event={id:'evt',orderId:'order',provider:'stripe',organizationId:'org',amountMinor:10000,currency:'MXN',status:'paid',paymentId:'payment'};
 let updates=0, row={...order}; const seen=new Set();
 const s={applyEventOnce:async(provider,id,fn)=>{if(seen.has(id))return {duplicate:true};const result=await fn({getOrderForUpdate:async()=>row,setOrderStatus:async(_id,status)=>{updates++;row={...row,status};}});seen.add(id);return result;}};
 await assert.rejects(receivePaymentEvent({adapter:{...adapter,verifyEvent:async()=>{throw Error('invalid signature');}},store:s}),/signature/);
 for(const changed of [{amountMinor:1},{organizationId:'other'},{currency:'USD'}]) await assert.rejects(receivePaymentEvent({adapter:{...adapter,verifyEvent:async()=>({...event,...changed})},store:s}),/mismatch/);
 const a={...adapter,verifyEvent:async()=>event};
 await receivePaymentEvent({adapter:a,store:s}); await receivePaymentEvent({adapter:a,store:s}); assert.equal(updates,1);
 await receivePaymentEvent({adapter:{...a,verifyEvent:async()=>({...event,id:'late',status:'failed'})},store:s});assert.equal(row.status,'paid');
});
test('public payment endpoint cannot activate charges',()=>{
 let code,body;const res={setHeader(){},status(value){code=value;return this;},json(value){body=value;}};
 handler({method:'GET'},res);assert.equal(body.enabled,false);
 handler({method:'POST',body:{enabled:true,amount:1}},res);assert.equal(code,503);
});
