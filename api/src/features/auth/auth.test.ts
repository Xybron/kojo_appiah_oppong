import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@supabase/supabase-js';
import type { AppEnv, Bindings } from '../../type/binding';
import { authMiddleware, requireAdmin } from '../../core/middleware/auth.middleware';
import { authRouter } from './auth.routes';
import { mapAuthUser, registerSchema } from './auth.types';

const env: Bindings = {
  SUPABASE_URL: 'https://auth.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AUTH_ALLOW_REGISTRATION: 'false',
};

const user: User = {
  id: 'df1bd80d-8d65-4d04-9276-17fb77a2cfa4',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'artist@example.test',
  app_metadata: { provider: 'email' },
  user_metadata: { first_name: 'Kojo', last_name: 'Oppong' },
  created_at: '2026-11-27T00:00:00Z',
};

const session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};

function makeApp() {
  const app = new Hono<AppEnv>();
  app.onError((error, c) => {
    const status = error instanceof HTTPException ? error.status : 500;
    return c.json({ message: error.message, statusCode: status }, status);
  });
  app.route('/auth', authRouter);
  app.get('/admin', authMiddleware(), requireAdmin(), (c) => c.json({ user: c.get('user') }));
  return app;
}

const app = makeApp();
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.reject(new Error('Unexpected upstream request')));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Supabase-Api-Version': '2024-01-01',
    },
  });
}

function request(
  path: string,
  body?: unknown,
  overrides: Partial<Bindings> = {},
  token?: string,
  method = 'POST',
) {
  return app.request(
    path,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...env, ...overrides },
  );
}

const signup = { email: 'artist@example.test', password: 'a-long-password', firstName: 'Kojo' };

describe('auth boundary', () => {
  it('does not call Supabase when registration is disabled', async () => {
    const response = await request('/auth/register', signup);
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose a fake registration user while confirmation is pending', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    const response = await request('/auth/register', signup, { AUTH_ALLOW_REGISTRATION: 'true' });
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.requiresEmailConfirmation).toBe(true);
    expect(body).not.toHaveProperty('user');
    expect(body).not.toHaveProperty('accessToken');
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).not.toHaveProperty('email_confirm');
    expect(payload.data).toEqual({ first_name: 'Kojo', last_name: '' });
  });

  it('rejects role fields rather than forwarding them to signup', async () => {
    const response = await request(
      '/auth/register',
      { ...signup, role: 'admin' },
      { AUTH_ALLOW_REGISTRATION: 'true' },
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses validated normalized input and returns a camelCase session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    const response = await request('/auth/login', {
      email: ' ARTIST@EXAMPLE.TEST ',
      password: ' a-long-password ',
    });
    expect(response.status).toBe(200);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.email).toBe('artist@example.test');
    expect(payload.password).toBe(' a-long-password ');
    expect(await response.json()).toMatchObject({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: { id: user.id, role: 'visitor' },
    });
  });

  it('returns a configuration error before making a request', async () => {
    const response = await request(
      '/auth/login',
      { email: signup.email, password: signup.password },
      { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' },
    );
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an absent bearer token without querying the provider', async () => {
    expect((await request('/auth/me', undefined, {}, undefined, 'GET')).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks Supabase to verify tokens and ignores editable role metadata', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...user, user_metadata: { role: 'admin' } }));
    const response = await request('/auth/me', undefined, {}, 'verified-token', 'GET');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: user.id, role: 'visitor' } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${env.SUPABASE_URL}/auth/v1/user`);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer verified-token');
  });

  it('blocks invalid tokens even if they contain administrator-looking text', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'invalid JWT', code: 'bad_jwt' }, 401));
    const response = await request('/admin', undefined, {}, 'forged-admin-token', 'GET');
    expect(response.status).toBe(401);
  });

  it('allows administrator access only through server-controlled app metadata', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...user, user_metadata: { role: 'admin' } }));
    expect((await request('/admin', undefined, {}, 'visitor-token', 'GET')).status).toBe(403);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...user, app_metadata: { role: 'admin' } }));
    expect((await request('/admin', undefined, {}, 'admin-token', 'GET')).status).toBe(200);
  });

  it('sends profile changes with the user JWT and only allowed profile attributes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...user, user_metadata: { first_name: 'Updated' } }),
    );
    const response = await request(
      '/auth/me',
      { firstName: ' Updated ', avatarUrl: null },
      {},
      'user-token',
      'PATCH',
    );
    expect(response.status).toBe(200);
    const [, update] = fetchMock.mock.calls[1];
    expect(update.headers.apikey).toBe(env.SUPABASE_PUBLISHABLE_KEY);
    expect(update.headers.Authorization).toBe('Bearer user-token');
    expect(JSON.parse(update.body)).toEqual({ data: { first_name: 'Updated', avatar_url: null } });
  });

  it('clears an optional last name without falling back to provider metadata', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...user, user_metadata: { last_name: '', family_name: 'Old name' } }),
    );
    const response = await request('/auth/me', { lastName: '   ' }, {}, 'user-token', 'PATCH');
    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ data: { last_name: '' } });
    expect(await response.json()).toMatchObject({ user: { lastName: '' } });
    expect(registerSchema.safeParse({ ...signup, lastName: '   ' }).success).toBe(false);
  });

  it('rejects profile privilege changes', async () => {
    const response = await request(
      '/auth/me',
      { app_metadata: { role: 'admin' } },
      {},
      'user-token',
      'PATCH',
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed avatars before authentication rather than throwing a URL error', async () => {
    const response = await request(
      '/auth/me',
      { avatarUrl: 'not a URL' },
      {},
      'user-token',
      'PATCH',
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes only the current session on logout', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await request('/auth/logout', undefined, {}, 'user-token');
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toBe(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer user-token');
  });

  it('does not create users through OTP when registration is disabled', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Signups not allowed for otp', code: 'otp_disabled' }, 422),
    );
    const response = await request('/auth/otp-login', { email: signup.email });
    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).create_user).toBe(false);
    expect(await response.text()).not.toContain('Signups not allowed');
  });

  it('preserves provider rate limits', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'rate limit', code: 'over_request_rate_limit' }, 429),
    );
    const response = await request('/auth/otp-login', { email: signup.email });
    expect(response.status).toBe(429);
  });

  it('reports CAPTCHA failures without claiming that a code was sent or exposing provider details', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'secret CAPTCHA provider details', code: 'captcha_failed' }, 400),
    );
    const response = await request('/auth/otp-login', {
      email: signup.email,
      captchaToken: 'rejected-token',
    });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).not.toContain('sent to your email');
    expect(body).not.toContain('secret CAPTCHA');
  });

  it('refreshes the session with the provided refresh token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...session, refresh_token: 'rotated-token' }));
    const response = await request('/auth/refresh', { refreshToken: 'old-token' });
    expect(response.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).refresh_token).toBe('old-token');
    expect(await response.json()).toMatchObject({ refreshToken: 'rotated-token' });
  });

  it('refuses a password change when the current password is wrong', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'invalid credentials', code: 'invalid_credentials' }, 400),
    );
    const response = await request(
      '/auth/change-password',
      { currentPassword: 'incorrect', newPassword: 'new-long-password' },
      {},
      'user-token',
    );
    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([, init]) => init.method === 'PUT')).toBe(false);
  });

  it('changes the password using the freshly verified session and revokes that temporary session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...session, access_token: 'temporary-access-token' }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await request(
      '/auth/change-password',
      { currentPassword: 'current-password', newPassword: 'new-long-password' },
      {},
      'user-token',
    );
    expect(response.status).toBe(200);
    const [, update] = fetchMock.mock.calls[2];
    expect(update.method).toBe('PUT');
    expect(update.headers.Authorization).toBe('Bearer temporary-access-token');
    expect(JSON.parse(update.body)).toEqual({ password: 'new-long-password' });
    const [url, logout] = fetchMock.mock.calls[3];
    expect(url).toBe(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`);
    expect(logout.headers.Authorization).toBe('Bearer temporary-access-token');
  });

  it('does not update an account if password verification resolves a different identity', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(user));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...session, user: { ...user, id: 'different-user' } }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await request(
      '/auth/change-password',
      { currentPassword: 'current-password', newPassword: 'new-long-password' },
      {},
      'user-token',
    );
    expect(response.status).toBe(401);
    expect(fetchMock.mock.calls.some(([, init]) => init.method === 'PUT')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not promote malformed display metadata', () => {
    expect(
      mapAuthUser({ ...user, user_metadata: { first_name: { role: 'admin' }, role: 'admin' } }),
    ).toMatchObject({ firstName: '', role: 'visitor' });
  });
});
