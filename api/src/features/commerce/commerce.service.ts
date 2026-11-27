import { HTTPException } from 'hono/http-exception';
import { allowedCheckoutUrl, type CommerceConfig } from './commerce.config';
import { orderToken, sha256 } from './commerce.crypto';
import { BachsCheckout, verifiedSessionState } from './bachs';
import { resolveCheckoutSelection } from './catalog';
import type { OrderStore } from './commerce.store';
import type { BachsEvent, CheckoutInput, CommerceOrder } from './commerce.types';

export class CommerceService {
  constructor(
    private config: CommerceConfig,
    private store: OrderStore,
    private provider = new BachsCheckout(config),
  ) {}
  async checkout(input: CheckoutInput) {
    const selection = resolveCheckoutSelection(input);
    const requestHash = await sha256(JSON.stringify({ ...selection, customer: input.customer }));
    const order = await this.store.begin(
      `KAO-${crypto.randomUUID()}`,
      requestHash,
      input,
      selection,
    );
    if (order.request_hash !== requestHash)
      throw new HTTPException(409, {
        message: 'Checkout details have changed. Please start a new checkout.',
      });
    if (['paid', 'expired', 'review'].includes(order.status))
      throw new HTTPException(409, {
        message: 'This checkout has already finished. View its status or start a new checkout.',
      });
    // Keep the same provider reference for every uncertain retry. Never create a
    // second charge under a new key if the first provider response was lost.
    if (Date.now() - Date.parse(order.created_at) > 23 * 60 * 60 * 1000)
      throw new HTTPException(409, {
        message: 'This checkout needs studio review before retrying.',
      });
    let url = order.checkout_url;
    if (!url) {
      const session = await this.provider.create(order);
      const attached = await this.store.attach(order.reference, session);
      url = attached.checkout_url;
    }
    if (!allowedCheckoutUrl(url))
      throw new HTTPException(503, { message: 'A secure checkout URL is unavailable.' });
    return {
      checkoutUrl: url,
      reference: order.reference,
      orderToken: await orderToken(this.config.orderSecret, order.reference),
    };
  }
  async webhook(event: BachsEvent) {
    if (event.organization_id !== this.config.accountId)
      throw new HTTPException(400, { message: 'This payment event belongs to another account.' });
    if (!['collection.succeeded', 'checkout.completed', 'checkout.expired'].includes(event.type))
      return;
    const checkoutId = event.data.checkout_id;
    if (!checkoutId)
      throw new HTTPException(400, { message: 'Payment event is missing its checkout reference.' });
    let order = await this.store.byCheckout(checkoutId);
    if (!order) {
      const reference = event.data.reference || event.data.metadata?.order_reference;
      if (reference) order = await this.store.byReference(reference);
    }
    // A webhook can beat the create response. Returning 503 preserves the retry;
    // do not acknowledge an order association that has not been durably written.
    if (!order)
      throw new HTTPException(503, {
        message: 'This order is not ready for payment confirmation. Please retry.',
      });
    const session = await this.provider.retrieve(checkoutId);
    const candidate = { ...order, checkout_id: order.checkout_id || checkoutId };
    const state = verifiedSessionState(session, candidate);
    if (state === 'pending')
      throw new HTTPException(503, {
        message: 'Payment confirmation is still pending. Please retry.',
      });
    await this.store.settle(order.reference, event.id, session, state);
  }
}
export function publicOrder(order: CommerceOrder) {
  return {
    reference: order.reference,
    status: order.status,
    artworkId: order.artwork_id,
    artworkTitle: order.artwork_title,
    variantId: order.variant_id,
    frameId: order.frame_id,
    amountMinor: order.amount_minor,
    currency: order.currency,
    fulfilment: 'studio_collection',
    createdAt: order.created_at,
  };
}
