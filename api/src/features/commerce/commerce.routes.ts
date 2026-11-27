import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../../type/binding';
import { commerceConfig } from './commerce.config';
import { constantTimeEqual, orderToken, verifyBachsSignature } from './commerce.crypto';
import { SupabaseOrderStore } from './commerce.store';
import { CommerceService, publicOrder } from './commerce.service';
import { checkoutInputSchema, type BachsEvent } from './commerce.types';

export const commerceRouter = new Hono<AppEnv>();
commerceRouter.use('/checkout*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
commerceRouter.use(
  '/checkout',
  bodyLimit({
    maxSize: 8 * 1024,
    onError: (c) => c.json({ message: 'Request body is too large.', statusCode: 413 }, 413),
  }),
);
commerceRouter.post('/checkout', async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Provide valid checkout details.' });
  }
  const input = checkoutInputSchema.safeParse(raw);
  if (!input.success)
    throw new HTTPException(400, {
      message: 'Check your artwork selection, name, email, and checkout reference.',
    });
  const config = commerceConfig(c.env);
  const service = new CommerceService(config, new SupabaseOrderStore(config));
  return c.json(await service.checkout(input.data));
});
commerceRouter.get('/checkout/:reference', async (c) => {
  const reference = c.req.param('reference');
  if (!/^KAO-[a-f\d-]{36}$/i.test(reference))
    throw new HTTPException(404, { message: 'Order not found.' });
  const config = commerceConfig(c.env, false);
  const token = c.req.header('Authorization')?.match(/^Bearer ([a-f\d]{64})$/i)?.[1] || '';
  if (!token || !constantTimeEqual(token, await orderToken(config.orderSecret, reference)))
    throw new HTTPException(401, {
      message: 'Open this order using the browser where you began checkout.',
    });
  const order = await new SupabaseOrderStore(config).byReference(reference);
  if (!order) throw new HTTPException(404, { message: 'Order not found.' });
  return c.json(publicOrder(order));
});
commerceRouter.use(
  '/webhooks/bachs',
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ message: 'Request body is too large.', statusCode: 413 }, 413),
  }),
);
commerceRouter.post('/webhooks/bachs', async (c) => {
  c.header('Cache-Control', 'no-store');
  const config = commerceConfig(c.env, false);
  const rawBody = await c.req.text();
  if (!(await verifyBachsSignature(rawBody, c.req.raw.headers, config.webhookSecret)))
    throw new HTTPException(400, { message: 'Invalid payment event signature.' });
  let event: BachsEvent;
  try {
    event = z
      .object({
        id: z.string().min(1).max(128),
        type: z.string().min(1).max(80),
        organization_id: z.string().min(1).max(128),
        data: z
          .object({
            checkout_id: z.string().max(128).optional(),
            reference: z.string().max(128).optional(),
            metadata: z
              .object({ order_reference: z.string().max(128).optional() })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      })
      .passthrough()
      .parse(JSON.parse(rawBody));
  } catch {
    throw new HTTPException(400, { message: 'Invalid payment event.' });
  }
  await new CommerceService(config, new SupabaseOrderStore(config)).webhook(event);
  return c.json({ received: true });
});
