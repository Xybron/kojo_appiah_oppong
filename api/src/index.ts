import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './type/binding';
import { authRouter } from './features/auth/auth.routes';
import { commerceRouter } from './features/commerce/commerce.routes';
import { publicStudioRouter, studioRouter } from './features/studio/studio.routes';

export const app = new Hono<AppEnv>();

const allowedOrigins = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: (origin, c) =>
      allowedOrigins(c.env?.ALLOWED_ORIGINS).includes(origin) ? origin : null,
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Retry-After'],
    maxAge: 600,
  }),
);
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && !allowedOrigins(c.env?.ALLOWED_ORIGINS).includes(origin)) {
    throw new HTTPException(403, { message: 'This website origin is not allowed.' });
  }
  await next();
});

app.use('/api/v1/auth/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
app.use(
  '/api/v1/auth/*',
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) => c.json({ message: 'Request body is too large.', statusCode: 413 }, 413),
  }),
);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ message: error.message, statusCode: error.status }, error.status);
  }
  // Avoid logging credentials, request bodies, or upstream response details.
  console.error('request_failed', { method: c.req.method, path: c.req.path });
  return c.json({ message: 'An unexpected error occurred.', statusCode: 500 }, 500);
});
app.notFound((c) => c.json({ message: 'Route not found.', statusCode: 404 }, 404));

const health = () => ({
  status: 'healthy',
  service: 'kojo-api',
  timestamp: new Date().toISOString(),
});
app.get('/status', (c) => c.json(health()));
app.get('/api/v1/health', (c) => c.json(health()));
app.route('/api/v1/auth', authRouter);
app.route('/api/v1', commerceRouter);
app.route('/api/v1/workspace', studioRouter);
app.route('/api/v1', publicStudioRouter);

export default app;
