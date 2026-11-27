import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { app } from '../../index';
import type { Bindings } from '../../type/binding';
import {
  MAX_FILE_SIZE,
  clientUpdateSchema,
  projectUpdateSchema,
  workUpdateSchema,
} from './studio.types';
const env: Bindings = {
  SUPABASE_URL: 'https://studio.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};
const admin = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-11-27T00:00:00Z',
  app_metadata: { role: 'admin' },
  user_metadata: {},
};
const visitor = {
  ...admin,
  email: 'client@example.test',
  app_metadata: {},
  user_metadata: { role: 'admin' },
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
let upstream: ReturnType<typeof vi.fn>;
beforeEach(() => {
  upstream = vi.fn(() => Promise.reject(new Error('Unexpected upstream request')));
  vi.stubGlobal('fetch', upstream);
});
afterEach(() => vi.unstubAllGlobals());
const request = (path: string, method = 'GET', body?: unknown, token = 'caller-token') =>
  app.request(
    `/api/v1${path}`,
    {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );

describe('studio authorization and data boundaries', () => {
  it('requires authentication for the workspace', async () => {
    const response = await request('/workspace', 'GET', undefined, '');
    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it.each(['/clients', '/projects', '/works', '/files', '/portfolio-image'])(
    'denies client mutations at %s',
    async (path) => {
      upstream.mockResolvedValueOnce(json(visitor));
      expect((await request(`/workspace${path}`, 'POST', {})).status).toBe(403);
      expect(upstream).toHaveBeenCalledTimes(1);
    },
  );
  it('uses the caller JWT for every database read and omits notes from the client response', async () => {
    upstream.mockResolvedValueOnce(json(visitor));
    upstream.mockImplementation(async (input: string, init: RequestInit) => {
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer caller-token');
      expect(input).not.toContain('studio_enquiry_notes');
      return json(
        input.includes('studio_enquiries') ? [{ id: 'enquiry-1', message: 'Own enquiry' }] : [],
      );
    });
    const response = await request('/workspace');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clients: [],
      enquiries: [{ id: 'enquiry-1', message: 'Own enquiry' }],
      projects: [],
      files: [],
      works: [],
    });
    expect(upstream).toHaveBeenCalledTimes(5);
  });
  it('does not sign a file hidden by RLS', async () => {
    upstream.mockResolvedValueOnce(json(visitor));
    upstream.mockResolvedValueOnce(json(null));
    expect(
      (await request('/workspace/files/00000000-0000-4000-8000-000000000002/download')).status,
    ).toBe(404);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('rejects client role fields and malformed URLs in portfolio writes', async () => {
    upstream.mockResolvedValueOnce(json(admin));
    const response = await request('/workspace/works', 'POST', {
      title: 'A work',
      discipline: 'Fine art',
      image_url: 'javascript:alert(1)',
      alt: 'A work',
      role: 'admin',
    });
    expect(response.status).toBe(400);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('persists validated admin client input under the caller JWT', async () => {
    upstream.mockResolvedValueOnce(json(admin));
    upstream.mockResolvedValueOnce(
      json({ id: 'client-id', name: 'Alice', email: 'alice@example.test', company: '' }),
    );
    const response = await request('/workspace/clients', 'POST', {
      name: ' Alice ',
      email: 'ALICE@EXAMPLE.TEST',
    });
    expect(response.status).toBe(201);
    const [, init] = upstream.mock.calls[1];
    expect(JSON.parse(init.body)).toEqual({
      name: 'Alice',
      email: 'alice@example.test',
      company: '',
    });
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer caller-token');
  });
  it('signs authorized downloads for sixty seconds', async () => {
    upstream.mockResolvedValueOnce(json(visitor));
    upstream.mockResolvedValueOnce(json({ name: 'Photo.jpg', storage_path: 'project/photo.jpg' }));
    upstream.mockResolvedValueOnce(
      json({ signedURL: '/object/sign/studio-project-files/project/photo.jpg?token=short' }),
    );
    const response = await request(
      '/workspace/files/00000000-0000-4000-8000-000000000002/download',
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(upstream.mock.calls[2][1].body).expiresIn).toBe(60);
    expect(((await response.json()) as { url: string }).url).toContain('download=Photo.jpg');
  });
});

describe('public studio routes', () => {
  it('stores guest enquiries without authenticating or returning private records', async () => {
    upstream.mockResolvedValueOnce(new Response(null, { status: 201 }));
    const response = await request(
      '/enquiries',
      'POST',
      {
        name: 'Guest',
        email: 'GUEST@EXAMPLE.TEST',
        interest: 'Commission',
        message: 'Please contact me.',
      },
      '',
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ message: expect.any(String) });
    expect(upstream.mock.calls[0][0]).toContain('/rest/v1/studio_enquiries');
    const payload = JSON.parse(upstream.mock.calls[0][1].body);
    expect(payload).toEqual({
      name: 'Guest',
      email: 'guest@example.test',
      interest: 'Commission',
      message: 'Please contact me.',
    });
  });
  it('discards honeypot requests and validates request fields', async () => {
    expect(
      (
        await request(
          '/enquiries',
          'POST',
          {
            name: 'Bot',
            email: 'bot@example.test',
            interest: 'Work',
            message: 'Spam',
            website: 'spam.test',
          },
          '',
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await request(
          '/enquiries',
          'POST',
          { name: 'Guest', email: 'bad', interest: 'Work', message: 'Hello' },
          '',
        )
      ).status,
    ).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('requests only published portfolio records', async () => {
    upstream.mockResolvedValueOnce(json([]));
    expect((await request('/portfolio', 'GET', undefined, '')).status).toBe(200);
    expect(upstream.mock.calls[0][0]).toContain('published=eq.true');
  });
});

describe('uploads', () => {
  it('rejects oversized multipart bodies before storage', async () => {
    upstream.mockResolvedValueOnce(json(admin));
    const form = new FormData();
    form.set(
      'file',
      new File([new Uint8Array(MAX_FILE_SIZE + 70 * 1024)], 'large.jpg', { type: 'image/jpeg' }),
    );
    const response = await app.request(
      '/api/v1/workspace/portfolio-image',
      { method: 'POST', headers: { Authorization: 'Bearer caller-token' }, body: form },
      env,
    );
    expect(response.status).toBe(413);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('checks content signatures instead of trusting an image MIME type', async () => {
    upstream.mockResolvedValueOnce(json(admin));
    const form = new FormData();
    form.set('file', new File(['<script>bad</script>'], 'image.jpg', { type: 'image/jpeg' }));
    const response = await app.request(
      '/api/v1/workspace/portfolio-image',
      { method: 'POST', headers: { Authorization: 'Bearer caller-token' }, body: form },
      env,
    );
    expect(response.status).toBe(400);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('partial updates', () => {
  it('does not reset omitted fields to create defaults', () => {
    expect(clientUpdateSchema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
    expect(projectUpdateSchema.parse({ status: 'review' })).toEqual({ status: 'review' });
    expect(workUpdateSchema.parse({ published: true })).toEqual({ published: true });
    expect(workUpdateSchema.safeParse({}).success).toBe(false);
  });
});
