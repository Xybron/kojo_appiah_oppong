import { createClient } from '@supabase/supabase-js';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from '../../type/binding';

export function getSupabaseConfig(env: Bindings) {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  let validUrl = false;
  try {
    const parsed = new URL(url);
    validUrl =
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname));
    validUrl &&= !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch {
    /* Report configuration errors without exposing the configured values. */
  }
  if (!validUrl || !key || key.startsWith('sb_secret_')) {
    throw new HTTPException(503, {
      message: 'Authentication is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    });
  }
  return { url, key };
}

export function createSupabaseAuthClient(env: Bindings) {
  const { url, key } = getSupabaseConfig(env);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function throwAuthError(
  error: { status?: number; name?: string } | null,
  status: 400 | 401,
  message: string,
): never {
  if (error?.status === 429) {
    throw new HTTPException(429, {
      message: 'Too many authentication attempts. Please try again later.',
    });
  }
  if ((error?.status ?? 0) >= 500 || error?.name === 'AuthRetryableFetchError') {
    throw new HTTPException(503, {
      message: 'Authentication is temporarily unavailable. Please try again.',
    });
  }
  throw new HTTPException(status, { message });
}

/** Auth REST endpoints use the caller's JWT and a public key, never an admin key. */
export async function authenticatedAuthRequest(
  env: Bindings,
  accessToken: string,
  path: '/user' | '/logout?scope=local',
  method: 'PUT' | 'POST',
  body?: Record<string, unknown>,
): Promise<Response> {
  const { url, key } = getSupabaseConfig(env);
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1${path}`, {
      method,
      redirect: 'manual',
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new HTTPException(503, {
      message: 'Authentication is temporarily unavailable. Please try again.',
    });
  }
  if (!response.ok) {
    const status = response.status;
    await response.body?.cancel();
    throwAuthError(
      { status },
      status === 401 || status === 403 ? 401 : 400,
      status === 401 || status === 403
        ? 'Your session has expired. Please sign in again.'
        : 'Unable to update your account. Check your details and try again.',
    );
  }
  return response;
}
