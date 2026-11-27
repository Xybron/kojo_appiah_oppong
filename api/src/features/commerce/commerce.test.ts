import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../index';
import type { Bindings } from '../../type/binding';
import { allowedCheckoutUrl, commerceConfig } from './commerce.config';
import { decimalToMinor, minorToDecimal, resolveCheckoutSelection } from './catalog';
import { hmacHex, orderToken, verifyBachsSignature } from './commerce.crypto';
import { BachsCheckout, verifiedSessionState } from './bachs';
import { CommerceService, publicOrder } from './commerce.service';
import type { OrderStore } from './commerce.store';
import type { CheckoutInput, CommerceOrder, BachsSession } from './commerce.types';

const env: Bindings = {
  SUPABASE_URL: 'https://kojo-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  SUPABASE_COMMERCE_SECRET_KEY: 'server-test-key',
  COMMERCE_ENABLED: 'true',
  CATALOG_VERIFIED: 'true',
  COMMERCE_APP_URL: 'https://art.example.com',
  COMMERCE_ORDER_TOKEN_SECRET: 'test-order-secret-that-is-at-least-thirty-two-characters',
  BACHS_SECRET_KEY: 'sk_sandbox_test-only',
  BACHS_WEBHOOK_SECRET: 'webhook-test-secret',
  BACHS_ACCOUNT_ID: 'acct_kojo_test',
  BACHS_ENVIRONMENT: 'sandbox',
  ALLOWED_ORIGINS: 'https://art.example.com',
};
const input: CheckoutInput = {
  artworkId: 'earth-held-still',
  variantId: 'small',
  frameId: 'oak',
  customer: { name: 'Test Buyer', email: 'buyer@example.com' },
  idempotencyKey: 'd071a944-0711-4b8a-a080-44730189e968',
};
function order(overrides: Partial<CommerceOrder> = {}): CommerceOrder {
  return {
    reference: 'KAO-71584da1-989f-4227-a8c3-a8cd19700eef',
    idempotency_key: input.idempotencyKey,
    request_hash: '',
    artwork_id: input.artworkId,
    artwork_title: 'Earth, held still',
    kind: 'Print',
    variant_id: 'small',
    frame_id: 'oak',
    amount_minor: 225000,
    currency: 'GHS',
    status: 'pending',
    customer: input.customer,
    checkout_id: 'chk_test',
    checkout_url: 'https://checkout.bachs.io/c/test',
    created_at: new Date().toISOString(),
    expires_at: null,
    ...overrides,
  };
}
function session(overrides: Partial<BachsSession> = {}): BachsSession {
  return {
    checkout_id: 'chk_test',
    checkout_url: 'https://checkout.bachs.io/c/test',
    reference: order().reference,
    mode: 'payment',
    status: 'completed',
    payment_status: 'paid',
    amount: '2250.00',
    currency: 'GHS',
    charge: { id: 'ch_test', status: 'succeeded', amount: '2250.00', currency: 'GHS' },
    ...overrides,
  };
}
function storeStub(): OrderStore {
  return {
    begin: vi.fn(),
    attach: vi.fn(),
    byReference: vi.fn(),
    byCheckout: vi.fn(),
    settle: vi.fn(),
  };
}
beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('Unexpected network call'))),
  ),
);
afterEach(() => vi.unstubAllGlobals());

describe('server price and currency boundary', () => {
  it('calculates a GHS total from server selection, including frame', () => {
    expect(resolveCheckoutSelection(input)).toMatchObject({ amountMinor: 225000, currency: 'GHS' });
    expect(minorToDecimal(225001)).toBe('2250.01');
    expect(decimalToMinor('2250.01')).toBe(225001);
    expect(decimalToMinor('0.1')).toBe(10);
  });
  it.each(['1.001', '1e3', '-20', ' 1', 'Infinity', '01.50', '', 2.5])(
    'rejects ambiguous money %s',
    (value) => expect(decimalToMinor(value)).toBeNull(),
  );
  it('rejects enquiry-only work and unlisted variants or inherited object keys', () => {
    expect(() =>
      resolveCheckoutSelection({
        ...input,
        artworkId: 'terra-in-balance',
        variantId: 'original',
        frameId: 'studio',
      }),
    ).toThrow();
    expect(() => resolveCheckoutSelection({ ...input, frameId: '__proto__' })).toThrow();
    expect(() => resolveCheckoutSelection({ ...input, variantId: 'free' })).toThrow();
  });
  it('fails closed until both payment and catalog flags are enabled', () => {
    expect(() => commerceConfig({ ...env, COMMERCE_ENABLED: 'false' })).toThrow();
    expect(() => commerceConfig({ ...env, CATALOG_VERIFIED: 'false' })).toThrow();
    expect(() => commerceConfig({ ...env, COMMERCE_APP_URL: 'http://127.0.0.1:3000' })).toThrow();
    expect(() => commerceConfig({ ...env, COMMERCE_APP_URL: 'https://192.168.1.1' })).toThrow();
    expect(() => commerceConfig({ ...env, BACHS_ENVIRONMENT: 'live' })).toThrow();
  });
  it.each([
    'http://checkout.bachs.io/c/test',
    'https://checkout.bachs.io.evil.test/c/test',
    'https://checkout.bachs.io@evil.test/c/test',
    'https://evil.test/c/test',
    'https://checkout.bachs.io:8443/c/test',
    'javascript:alert(1)',
  ])('rejects checkout redirect %s', (url) => expect(allowedCheckoutUrl(url)).toBe(false));
});

describe('Bachs transport', () => {
  it('creates a raw GHS session with stable idempotency and configured callback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(session({ status: 'open' }))),
    );
    await new BachsCheckout(commerceConfig(env)).create(order());
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://sandbox-api.bachs.io/v1/checkout-sessions');
    const body = JSON.parse(options?.body as string);
    expect(body.pricing).toEqual({ amount: '2250.00', currency: 'GHS' });
    expect(body.billing_currency).toBe('GHS');
    expect(body.product_cart).toBeUndefined();
    expect(body.success_url).toBe(
      `https://art.example.com/checkout/return?reference=${order().reference}`,
    );
    expect(body.cancel_url).toContain('cancelled=1');
    expect(options?.headers).toMatchObject({ 'Idempotency-Key': order().reference });
  });
  it('rejects a provider URL outside the hosted checkout origin', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(session({ checkout_url: 'https://evil.test/c/test' }))),
    );
    await expect(new BachsCheckout(commerceConfig(env)).create(order())).rejects.toThrow(
      'valid checkout',
    );
  });
  it('does not expose the provider error body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('secret upstream details', { status: 500 }),
    );
    await expect(new BachsCheckout(commerceConfig(env)).create(order())).rejects.not.toThrow(
      'secret upstream details',
    );
  });
});

describe('payment verification', () => {
  it('accepts only matching paid GHS checkout and charge', () =>
    expect(verifiedSessionState(session(), order())).toBe('paid'));
  it.each([
    { reference: 'another-order' },
    { checkout_id: 'another-checkout' },
    { amount: '2249.99' },
    { currency: 'USD' },
    { charge: { status: 'succeeded', amount: '2249.99', currency: 'GHS' } },
    { charge: { status: 'succeeded', amount: '2250.00', currency: 'USD' } },
    { charge: null },
  ])('holds mismatched provider evidence for review: %j', (change) =>
    expect(verifiedSessionState(session(change), order())).toBe('review'),
  );
  it('never treats an unfinished or free checkout as paid', () => {
    expect(verifiedSessionState(session({ status: 'open' }), order())).toBe('pending');
    expect(verifiedSessionState(session({ payment_status: 'no_payment_required' }), order())).toBe(
      'pending',
    );
    expect(
      verifiedSessionState(session({ status: 'expired', payment_status: 'unpaid' }), order()),
    ).toBe('expired');
  });
  it('verifies raw bytes, replay window and any V2 rotation signature', async () => {
    const raw = '{ "type": "collection.succeeded" }';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await hmacHex(env.BACHS_WEBHOOK_SECRET!, `${timestamp}.${raw}`);
    const headers = new Headers({
      'X-Bachs-Signature-V2': `t=${timestamp},v1=${'0'.repeat(64)},v1=${signature}`,
    });
    expect(await verifyBachsSignature(raw, headers, env.BACHS_WEBHOOK_SECRET!)).toBe(true);
    expect(
      await verifyBachsSignature(
        JSON.stringify(JSON.parse(raw)),
        headers,
        env.BACHS_WEBHOOK_SECRET!,
      ),
    ).toBe(false);
    expect(
      await verifyBachsSignature(raw, headers, env.BACHS_WEBHOOK_SECRET!, Date.now() + 301000),
    ).toBe(false);
    expect(
      await verifyBachsSignature(
        raw,
        new Headers({ 'X-Bachs-Timestamp': `${timestamp}x`, 'X-Bachs-Signature': signature }),
        env.BACHS_WEBHOOK_SECRET!,
      ),
    ).toBe(false);
  });
});

describe('durable-order orchestration', () => {
  it('returns the same stored checkout and token on retries without another provider call', async () => {
    const store = storeStub();
    vi.mocked(store.begin).mockImplementation(async (_reference, requestHash) =>
      order({ request_hash: requestHash }),
    );
    const service = new CommerceService(commerceConfig(env), store);
    const first = await service.checkout(input);
    const second = await service.checkout(input);
    expect(second).toEqual(first);
    expect(first.orderToken).toBe(
      await orderToken(env.COMMERCE_ORDER_TOKEN_SECRET!, first.reference),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not retry a provider create under a fresh reference after an uncertain result', async () => {
    const store = storeStub();
    vi.mocked(store.begin).mockImplementation(async (_reference, requestHash) =>
      order({
        request_hash: requestHash,
        checkout_id: null,
        checkout_url: null,
        status: 'creating',
      }),
    );
    const service = new CommerceService(commerceConfig(env), store);
    await expect(service.checkout(input)).rejects.toThrow();
    await expect(service.checkout(input)).rejects.toThrow();
    const keys = vi
      .mocked(fetch)
      .mock.calls.map(
        ([, options]) => (options?.headers as Record<string, string>)['Idempotency-Key'],
      );
    expect(keys).toEqual([order().reference, order().reference]);
    expect(store.attach).not.toHaveBeenCalled();
  });
  it('retrieves provider state before settlement and passes event ID to the atomic RPC', async () => {
    const store = storeStub();
    vi.mocked(store.byCheckout).mockResolvedValue(order());
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(session())));
    await new CommerceService(commerceConfig(env), store).webhook({
      id: 'evt_test',
      type: 'collection.succeeded',
      organization_id: env.BACHS_ACCOUNT_ID!,
      data: { checkout_id: 'chk_test' },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://sandbox-api.bachs.io/v1/checkout-sessions/chk_test',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(store.settle).toHaveBeenCalledWith(
      order().reference,
      'evt_test',
      expect.any(Object),
      'paid',
    );
  });
  it('holds wrong amount for review rather than fulfillment', async () => {
    const store = storeStub();
    vi.mocked(store.byCheckout).mockResolvedValue(order());
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(session({ amount: '100.00' }))));
    await new CommerceService(commerceConfig(env), store).webhook({
      id: 'evt_mismatch',
      type: 'checkout.completed',
      organization_id: env.BACHS_ACCOUNT_ID!,
      data: { checkout_id: 'chk_test' },
    });
    expect(store.settle).toHaveBeenCalledWith(
      order().reference,
      'evt_mismatch',
      expect.any(Object),
      'review',
    );
  });
  it('does not mark payment when provider verification fails', async () => {
    const store = storeStub();
    vi.mocked(store.byCheckout).mockResolvedValue(order());
    await expect(
      new CommerceService(commerceConfig(env), store).webhook({
        id: 'evt_test',
        type: 'collection.succeeded',
        organization_id: env.BACHS_ACCOUNT_ID!,
        data: { checkout_id: 'chk_test' },
      }),
    ).rejects.toThrow();
    expect(store.settle).not.toHaveBeenCalled();
  });
  it('does not disclose customer information in the public order status', () => {
    const view = publicOrder(order());
    expect(JSON.stringify(view)).not.toContain('buyer@example.com');
    expect(view).toMatchObject({
      status: 'pending',
      amountMinor: 225000,
      currency: 'GHS',
      fulfilment: 'studio_collection',
    });
  });
});

describe('HTTP checkout boundary', () => {
  it('rejects client-supplied prices before contacting any upstream service', async () => {
    const response = await app.request(
      '/api/v1/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, amount: 1 }),
      },
      env,
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps purchase unavailable when no live configuration is provided', async () => {
    const response = await app.request(
      '/api/v1/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
      {} as Bindings,
    );
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires the opaque order token, never an email or redirect flag', async () => {
    const response = await app.request(
      `/api/v1/checkout/${order().reference}?paid=true&email=buyer@example.com`,
      { headers: { Authorization: 'Bearer incorrect-token' } },
      env,
    );
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects an unsigned webhook before a database lookup', async () => {
    const response = await app.request(
      '/api/v1/webhooks/bachs',
      { method: 'POST', body: '{}' },
      env,
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ignores unrelated signed events without writing an order', async () => {
    const body = JSON.stringify({
      id: 'evt_other',
      type: 'customer.updated',
      organization_id: env.BACHS_ACCOUNT_ID,
      data: {},
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await hmacHex(env.BACHS_WEBHOOK_SECRET!, `${timestamp}.${body}`);
    const response = await app.request(
      '/api/v1/webhooks/bachs',
      {
        method: 'POST',
        headers: { 'X-Bachs-Timestamp': timestamp, 'X-Bachs-Signature': signature },
        body,
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });
});
