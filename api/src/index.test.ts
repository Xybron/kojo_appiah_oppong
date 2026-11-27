import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from './index';
import type { Bindings } from './type/binding';

const allowedOrigin = 'http://127.0.0.1:3000';
const env = {
  ALLOWED_ORIGINS: ` ${allowedOrigin}, http://localhost:3000 `,
} as Bindings;

// Exercise the real global error handler without depending on an upstream outage.
app.get('/__test/unexpected-error', () => {
  throw new Error('private-upstream-token');
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('Unexpected upstream request'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API health and error responses', () => {
  it.each(['/status', '/api/v1/health'])('serves %s without Supabase credentials', async (path) => {
    const response = await app.request(path, {}, {} as Bindings);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { status: string; service: string; timestamp: string };
    expect(data).toMatchObject({ status: 'healthy', service: 'kojo-api' });
    expect(Number.isNaN(Date.parse(data.timestamp))).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns structured JSON for unknown routes', async () => {
    const response = await app.request('/api/v1/not-a-route', {}, env);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ message: expect.any(String), statusCode: 404 });
  });

  it('does not expose unexpected error details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await app.request('/__test/unexpected-error', {}, env);
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ message: expect.any(String), statusCode: 500 });
    expect(body).not.toContain('private-upstream-token');
    expect(body).not.toContain('stack');
  });
});

describe('website CORS boundary', () => {
  it.each([allowedOrigin, 'http://localhost:3000'])(
    'allows an explicitly configured origin: %s',
    async (origin) => {
      const response = await app.request('/status', { headers: { Origin: origin } }, env);
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    },
  );

  it('allows browser auth preflight with authorization and JSON headers', async () => {
    const response = await app.request(
      '/api/v1/auth/login',
      {
        method: 'OPTIONS',
        headers: {
          Origin: allowedOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      },
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    const headers = response.headers.get('access-control-allow-headers')?.toLowerCase();
    expect(headers).toContain('authorization');
    expect(headers).toContain('content-type');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'an unrelated origin', origin: 'https://untrusted.example', bindings: env },
    { label: 'a suffix attack', origin: `${allowedOrigin}.untrusted.example`, bindings: env },
    { label: 'missing origin configuration', origin: allowedOrigin, bindings: {} as Bindings },
    {
      label: 'wildcard origin configuration',
      origin: allowedOrigin,
      bindings: { ALLOWED_ORIGINS: '*' } as Bindings,
    },
  ])('rejects browser requests with $label', async ({ origin, bindings }) => {
    const response = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'visitor@example.com', password: 'example-password' }),
      },
      bindings,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(await response.json()).toEqual({ message: expect.any(String), statusCode: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not grant a preflight from an untrusted origin', async () => {
    const response = await app.request(
      '/api/v1/auth/login',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://untrusted.example',
          'Access-Control-Request-Method': 'POST',
        },
      },
      env,
    );
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('auth request boundary', () => {
  it('rejects malformed JSON before contacting Supabase and disables caching', async () => {
    const response = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
        body: '{"email":',
      },
      env,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(await response.json()).toEqual({ message: expect.any(String), statusCode: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects bodies larger than 16 KiB before contacting Supabase', async () => {
    const response = await app.request(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'visitor@example.com', password: 'x'.repeat(16 * 1024) }),
      },
      env,
    );
    expect(response.status).toBe(413);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ message: expect.any(String), statusCode: 413 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
