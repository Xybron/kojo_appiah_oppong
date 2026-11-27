import { HTTPException } from 'hono/http-exception';
import type { Bindings } from '../../type/binding';

export function commerceConfig(env: Bindings, requireEnabled = true) {
  if (requireEnabled && (env.COMMERCE_ENABLED !== 'true' || env.CATALOG_VERIFIED !== 'true')) {
    throw new HTTPException(503, {
      message: 'Online purchase is not available yet. Please send an artwork enquiry.',
    });
  }
  let appOrigin = '';
  let supabaseUrl = '';
  try {
    const app = new URL(env.COMMERCE_APP_URL || '');
    const host = app.hostname.toLowerCase();
    if (
      app.protocol !== 'https:' ||
      app.username ||
      app.password ||
      app.port ||
      app.search ||
      app.hash ||
      app.pathname !== '/' ||
      !host.includes('.') ||
      /^[\d.]+$/.test(host) ||
      host.startsWith('[') ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    )
      throw new Error('Invalid application origin');
    appOrigin = app.origin;
    const db = new URL(env.SUPABASE_URL);
    if (
      db.protocol !== 'https:' ||
      db.username ||
      db.password ||
      db.search ||
      db.hash ||
      db.pathname !== '/'
    )
      throw new Error('Invalid database origin');
    supabaseUrl = db.origin;
  } catch {
    throw new HTTPException(503, {
      message: 'Checkout is not configured. Please contact the studio.',
    });
  }
  const apiKey = env.BACHS_SECRET_KEY?.trim();
  const webhookSecret = env.BACHS_WEBHOOK_SECRET?.trim();
  const accountId = env.BACHS_ACCOUNT_ID?.trim();
  const orderSecret = env.COMMERCE_ORDER_TOKEN_SECRET?.trim();
  const databaseKey = env.SUPABASE_COMMERCE_SECRET_KEY?.trim();
  const environment = env.BACHS_ENVIRONMENT || 'sandbox';
  if (
    !apiKey ||
    !webhookSecret ||
    !accountId ||
    !orderSecret ||
    orderSecret.length < 32 ||
    !databaseKey ||
    !['sandbox', 'live'].includes(environment) ||
    (environment === 'live' && apiKey.startsWith('sk_sandbox_')) ||
    (environment === 'sandbox' && apiKey.startsWith('sk_live_'))
  ) {
    throw new HTTPException(503, {
      message: 'Checkout is not configured. Please contact the studio.',
    });
  }
  return {
    appOrigin,
    supabaseUrl,
    apiKey,
    webhookSecret,
    accountId,
    orderSecret,
    databaseKey,
    apiOrigin: environment === 'live' ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io',
  };
}
export type CommerceConfig = ReturnType<typeof commerceConfig>;
export function allowedCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'checkout.bachs.io' &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^\/c\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) &&
      !url.hash
    );
  } catch {
    return false;
  }
}
