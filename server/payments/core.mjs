/** Provider-neutral payment boundary. Production activation requires a durable store and an audited adapter. */
export class PaymentError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export const PAYMENT_PROVIDERS = Object.freeze(['stripe', 'openpay']);
export function validateOrder(order) {
  if (!order?.id || !order.organizationId || !order.customerId) throw new PaymentError('invalid_order');
  if (!Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0) throw new PaymentError('invalid_amount');
  if (!/^[A-Z]{3}$/.test(order.currency || '')) throw new PaymentError('invalid_currency');
  return order;
}
export function authorizeOrder(actor, order) {
  if (!actor?.id || !actor.active) throw new PaymentError('unauthorized', 401);
  if (actor.organizationId !== order.organizationId || !['admin', 'super_admin', 'ceo'].includes(actor.role)) throw new PaymentError('forbidden', 403);
}
/** Browser supplies only an order ID. Price, tenant, customer and idempotency key come from the store. */
export async function createCheckout({ actor, orderId, store, adapter, returnUrl }) {
  if (!store || !adapter) throw new PaymentError('payments_not_configured', 503);
  const order = await store.getOrder(orderId);
  if (!order) throw new PaymentError('order_not_found', 404);
  authorizeOrder(actor, order); validateOrder(order);
  if (order.status !== 'pending') throw new PaymentError('order_not_payable', 409);
  if (order.provider !== adapter.provider || !PAYMENT_PROVIDERS.includes(adapter.provider)) throw new PaymentError('provider_mismatch', 409);
  const url = new URL(returnUrl);
  if (url.protocol !== 'https:' || !adapter.allowedReturnOrigins.includes(url.origin)) throw new PaymentError('invalid_return_url');
  // Store must acquire a durable per-order lease; concurrent requests return the existing checkout.
  return store.withOrderLock(order.id, async () => {
    const fresh = await store.getOrder(order.id);
    if (fresh.status !== 'pending') throw new PaymentError('order_not_payable', 409);
    if (fresh.checkout) return fresh.checkout;
    const checkout = await adapter.createCheckout({ order: fresh, returnUrl: url.href, idempotencyKey: `stratos:${order.organizationId}:${order.id}` });
    const redirect = new URL(checkout.url);
    if (redirect.protocol !== 'https:' || !adapter.allowedCheckoutOrigins.includes(redirect.origin)) throw new PaymentError('invalid_checkout_url', 502);
    await store.saveCheckout(order.id, checkout);
    return checkout;
  });
}
/** Only a verified provider event can settle an order. A return URL can never mark it paid. */
export async function receivePaymentEvent({ rawBody, headers, adapter, store }) {
  if (!adapter || !store) throw new PaymentError('payments_not_configured', 503);
  const event = await adapter.verifyEvent(rawBody, headers);
  if (!event?.id || !event.orderId || event.provider !== adapter.provider) throw new PaymentError('invalid_event');
  if (!['paid', 'failed', 'refunded'].includes(event.status)) return { ignored: true };
  // This transaction MUST atomically deduplicate (provider,event.id), lock the order and persist its state.
  return store.applyEventOnce(event.provider, event.id, async tx => {
    const order = await tx.getOrderForUpdate(event.orderId);
    if (!order) throw new PaymentError('order_not_found', 404);
    validateOrder(order);
    if (order.provider !== event.provider || order.organizationId !== event.organizationId || order.amountMinor !== event.amountMinor || order.currency !== event.currency) throw new PaymentError('event_order_mismatch', 409);
    const next = { pending: ['paid', 'failed'], failed: ['paid'], paid: ['refunded'], refunded: [] };
    if (!next[order.status]?.includes(event.status)) return { ignored: true };
    await tx.setOrderStatus(order.id, event.status, event.paymentId);
    return { applied: true };
  });
}
