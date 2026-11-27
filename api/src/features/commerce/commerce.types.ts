import { z } from 'zod';

export const checkoutInputSchema = z
  .object({
    artworkId: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/),
    variantId: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9-]+$/),
    frameId: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9-]+$/),
    customer: z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z
          .email()
          .max(200)
          .transform((value) => value.toLowerCase()),
        phone: z
          .string()
          .trim()
          .max(30)
          .regex(/^[+\d ()-]*$/)
          .optional(),
      })
      .strict(),
    idempotencyKey: z.uuid(),
  })
  .strict();
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type OrderStatus = 'creating' | 'pending' | 'paid' | 'expired' | 'review';
export interface CommerceOrder {
  reference: string;
  idempotency_key: string;
  request_hash: string;
  artwork_id: string;
  artwork_title: string;
  kind: 'Original' | 'Print';
  variant_id: string;
  frame_id: string;
  amount_minor: number;
  currency: 'GHS';
  status: OrderStatus;
  customer: CheckoutInput['customer'];
  checkout_id: string | null;
  checkout_url: string | null;
  created_at: string;
  expires_at: string | null;
}
export interface CheckoutSelection {
  artworkId: string;
  artworkTitle: string;
  kind: 'Original' | 'Print';
  variantId: string;
  frameId: string;
  amountMinor: number;
  currency: 'GHS';
}
export interface BachsSession {
  checkout_id: string;
  checkout_url?: string;
  status: string;
  payment_status?: string;
  mode?: string;
  amount?: string;
  currency?: string;
  reference?: string;
  expires_at?: string;
  charge?: {
    id?: string;
    status?: string;
    amount?: string;
    amount_paid?: string;
    currency?: string;
  } | null;
}
export interface BachsEvent {
  id: string;
  type: string;
  organization_id: string;
  data: { checkout_id?: string; reference?: string; metadata?: { order_reference?: string } };
}
