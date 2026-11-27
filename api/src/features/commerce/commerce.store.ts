import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HTTPException } from 'hono/http-exception';
import type { CommerceConfig } from './commerce.config';
import { decimalToMinor } from './catalog';
import type {
  BachsSession,
  CheckoutInput,
  CheckoutSelection,
  CommerceOrder,
} from './commerce.types';

export interface OrderStore {
  begin(
    reference: string,
    requestHash: string,
    input: CheckoutInput,
    selection: CheckoutSelection,
  ): Promise<CommerceOrder>;
  attach(reference: string, session: BachsSession): Promise<CommerceOrder>;
  byReference(reference: string): Promise<CommerceOrder | null>;
  byCheckout(checkoutId: string): Promise<CommerceOrder | null>;
  settle(
    reference: string,
    eventId: string,
    session: BachsSession,
    state: 'paid' | 'expired' | 'review',
  ): Promise<CommerceOrder>;
}
const columns =
  'reference,idempotency_key,request_hash,artwork_id,artwork_title,kind,variant_id,frame_id,amount_minor,currency,status,customer,checkout_id,checkout_url,created_at,expires_at';
function result<T>({ data, error }: { data: T | null; error: { code?: string } | null }): T {
  if (error) {
    if (['23505', 'P0001'].includes(error.code || ''))
      throw new HTTPException(409, {
        message:
          'This selection is unavailable or the checkout details changed. Please try a new checkout.',
      });
    throw new HTTPException(503, {
      message: 'Orders are temporarily unavailable. Please try again.',
    });
  }
  return data as T;
}
export class SupabaseOrderStore implements OrderStore {
  private db: SupabaseClient;
  constructor(config: CommerceConfig) {
    this.db = createClient(config.supabaseUrl, config.databaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(2500) }),
      },
    });
  }
  async begin(
    reference: string,
    requestHash: string,
    input: CheckoutInput,
    selection: CheckoutSelection,
  ) {
    return result<CommerceOrder>(
      await this.db.rpc('commerce_begin_checkout', {
        p_reference: reference,
        p_idempotency_key: input.idempotencyKey,
        p_request_hash: requestHash,
        p_artwork_id: selection.artworkId,
        p_artwork_title: selection.artworkTitle,
        p_kind: selection.kind,
        p_variant_id: selection.variantId,
        p_frame_id: selection.frameId,
        p_amount_minor: selection.amountMinor,
        p_currency: selection.currency,
        p_customer: input.customer,
      }),
    );
  }
  async attach(reference: string, session: BachsSession) {
    return result<CommerceOrder>(
      await this.db.rpc('commerce_attach_checkout', {
        p_reference: reference,
        p_checkout_id: session.checkout_id,
        p_checkout_url: session.checkout_url,
        p_expires_at: session.expires_at ?? null,
      }),
    );
  }
  async byReference(reference: string) {
    return result<CommerceOrder | null>(
      await this.db
        .from('commerce_orders')
        .select(columns)
        .eq('reference', reference)
        .maybeSingle(),
    );
  }
  async byCheckout(checkoutId: string) {
    return result<CommerceOrder | null>(
      await this.db
        .from('commerce_orders')
        .select(columns)
        .eq('checkout_id', checkoutId)
        .maybeSingle(),
    );
  }
  async settle(
    reference: string,
    eventId: string,
    session: BachsSession,
    state: 'paid' | 'expired' | 'review',
  ) {
    return result<CommerceOrder>(
      await this.db.rpc('commerce_settle_checkout', {
        p_reference: reference,
        p_event_id: eventId,
        p_checkout_id: session.checkout_id,
        p_state: state,
        p_amount_minor: state === 'paid' ? decimalToMinor(session.amount) : null,
        p_currency: session.currency ?? null,
      }),
    );
  }
}
