import { HTTPException } from 'hono/http-exception';
import { allowedCheckoutUrl, type CommerceConfig } from './commerce.config';
import { decimalToMinor, minorToDecimal } from './catalog';
import type { BachsSession, CommerceOrder } from './commerce.types';

export class BachsCheckout {
  constructor(private config: CommerceConfig) {}
  private async request(
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<BachsSession> {
    let response: Response;
    try {
      response = await fetch(`${this.config.apiOrigin}/v1${path}`, {
        method: body ? 'POST' : 'GET',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      throw new HTTPException(503, {
        message: 'Payment service is temporarily unavailable. Please retry the same checkout.',
      });
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new HTTPException(503, {
        message: 'Payment service could not confirm this checkout. Please try again.',
      });
    }
    try {
      return (await response.json()) as BachsSession;
    } catch {
      throw new HTTPException(503, { message: 'Payment service returned an incomplete response.' });
    }
  }
  async create(order: CommerceOrder) {
    const callback = `${this.config.appOrigin}/checkout/return?reference=${encodeURIComponent(order.reference)}`;
    const session = await this.request(
      '/checkout-sessions',
      {
        pricing: { amount: minorToDecimal(order.amount_minor), currency: 'GHS' },
        billing_currency: 'GHS',
        reference: order.reference,
        customer: {
          name: order.customer.name,
          email: order.customer.email,
          ...(order.customer.phone ? { phone_number: order.customer.phone } : {}),
        },
        success_url: callback,
        cancel_url: `${callback}&cancelled=1`,
        expires_in_minutes: 30,
        metadata: {
          order_reference: order.reference,
          artwork_id: order.artwork_id,
          fulfilment: 'studio_collection',
        },
      },
      order.reference,
    );
    if (
      !session.checkout_id ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(session.checkout_id) ||
      !allowedCheckoutUrl(session.checkout_url)
    ) {
      throw new HTTPException(503, {
        message: 'Payment service did not provide a valid checkout. Please try again.',
      });
    }
    return session;
  }
  async retrieve(checkoutId: string) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(checkoutId))
      throw new HTTPException(400, { message: 'Invalid checkout reference.' });
    return this.request(`/checkout-sessions/${encodeURIComponent(checkoutId)}`);
  }
}
export function verifiedSessionState(
  session: BachsSession,
  order: CommerceOrder,
): 'paid' | 'expired' | 'pending' | 'review' {
  if (session.checkout_id !== order.checkout_id || session.reference !== order.reference)
    return 'review';
  if (session.status === 'expired' && session.payment_status !== 'paid') return 'expired';
  if (
    session.status !== 'completed' ||
    session.payment_status !== 'paid' ||
    session.mode !== 'payment'
  )
    return 'pending';
  const charge = session.charge;
  if (
    decimalToMinor(session.amount) !== order.amount_minor ||
    session.currency !== 'GHS' ||
    !charge ||
    charge.status?.toLowerCase() !== 'succeeded' ||
    decimalToMinor(charge.amount_paid ?? charge.amount) !== order.amount_minor ||
    charge.currency !== 'GHS'
  )
    return 'review';
  return 'paid';
}
