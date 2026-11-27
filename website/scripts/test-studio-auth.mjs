import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual composable without a browser, generated Nuxt bundle, or live accounts.
const source = readFileSync(new URL('../app/composables/useStudioAuth.ts', import.meta.url), 'utf8')
  .replace('import { emptyWorkspace } from "~/types/studio";', 'const emptyWorkspace = globalThis.__emptyWorkspace;')
  .replaceAll('import.meta.server', 'false');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const emptyWorkspace = () => ({ clients: [], enquiries: [], projects: [], files: [], works: [] });
const future = () => Math.floor(Date.now() / 1000) + 3600;
const user = (id, role = 'visitor', email = `${id}@example.com`) => ({ id, role, email, firstName: id, lastName: '' });
const session = (id, overrides = {}) => ({
  accessToken: `access-${id}`, refreshToken: `refresh-${id}`, expiresAt: future(), user: user(id), ...overrides,
});
const unauthorized = () => Object.assign(new Error('Session expired'), { status: 401 });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(handler) {
  const states = new Map();
  const storage = new Map();
  const calls = [];
  const routes = [];
  const app = {};
  const context = {
    exports: {}, console, Date, FormData, __emptyWorkspace: emptyWorkspace,
    useNuxtApp: () => app,
    useRouter: () => ({ replace: async (route) => { routes.push(route); } }),
    useRuntimeConfig: () => ({ public: { apiBaseUrl: 'https://api.kojo.test' } }),
    useState: (key, factory) => {
      if (!states.has(key)) states.set(key, { value: factory() });
      return states.get(key);
    },
    computed: (getter) => ({ get value() { return getter(); } }),
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    $fetch: async (url, options) => {
      const path = url.replace('https://api.kojo.test/api/v1', '');
      calls.push({ path, ...options });
      return handler(path, options);
    },
  };
  vm.runInNewContext(compiled, context, { filename: 'useStudioAuth.ts' });
  const auth = context.exports.useStudioAuth();
  return {
    auth, calls, routes, state: (key) => states.get(key),
    stored: () => JSON.parse(storage.get('kojo:session:v1') || 'null'),
    seedStorage: (value) => storage.set('kojo:session:v1', JSON.stringify({
      accessToken: value.accessToken, refreshToken: value.refreshToken, expiresAt: value.expiresAt,
    })),
  };
}

test('sign-out during session initialization cannot resurrect the old user', async () => {
  const me = deferred();
  const started = deferred();
  const h = harness((path) => {
    if (path === '/auth/me') { started.resolve(); return me.promise; }
    if (path === '/auth/logout') return {};
    throw new Error(`Unexpected ${path}`);
  });
  h.seedStorage(session('a'));
  const initializing = h.auth.initialize();
  await started.promise;
  await h.auth.signOut();
  me.resolve({ user: user('a', 'admin') });
  await initializing;
  assert.equal(h.auth.user.value, null);
  assert.equal(h.stored(), null);
  assert.equal(h.routes.at(-1), '/login');
});

test('a mutation waiting for A’s refresh never executes using B’s credentials', async () => {
  const refresh = deferred();
  const started = deferred();
  const h = harness((path, options) => {
    if (path === '/auth/login') return options.body.email === 'a@example.com'
      ? session('a', { expiresAt: Math.floor(Date.now() / 1000) + 10 }) : session('b');
    if (path === '/auth/refresh') { started.resolve(); return refresh.promise; }
    if (path === '/auth/logout') return {};
    if (path === '/workspace/projects') return { project: { id: 'unexpected' } };
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  const mutation = h.auth.request('/workspace/projects', { method: 'POST', body: { title: 'A’s project' } });
  const rejected = assert.rejects(mutation, /account access changed/i);
  await started.promise;
  await h.auth.signOut();
  await h.auth.signIn('b@example.com', 'password');
  refresh.resolve(session('a', { accessToken: 'rotated-a' }));
  await rejected;
  assert.equal(h.calls.filter((call) => call.path === '/workspace/projects').length, 0);
  assert.equal(h.auth.user.value.id, 'b');
  assert.equal(h.stored().accessToken, 'access-b');
});

test('a late initialization 401 cannot clear a newly signed-in account', async () => {
  const me = deferred();
  const started = deferred();
  const h = harness((path) => {
    if (path === '/auth/me') { started.resolve(); return me.promise; }
    if (path === '/auth/login') return session('b');
    throw new Error(`Unexpected ${path}`);
  });
  h.seedStorage(session('a'));
  const initializing = h.auth.initialize();
  await started.promise;
  await h.auth.signIn('b@example.com', 'password');
  me.reject(unauthorized());
  await initializing;
  assert.equal(h.auth.user.value.id, 'b');
  assert.equal(h.stored().accessToken, 'access-b');
  assert.equal(h.auth.authError.value, '');
  assert.equal(h.calls.filter((call) => call.path === '/auth/refresh').length, 0);
});

test('a late protected-request 401 cannot clear a new login or retry as that account', async () => {
  const response = deferred();
  const started = deferred();
  const h = harness((path, options) => {
    if (path === '/auth/login') return session(options.body.email.startsWith('a') ? 'a' : 'b');
    if (path === '/workspace') { started.resolve(); return response.promise; }
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  const request = h.auth.request('/workspace');
  const rejected = assert.rejects(request, /account access changed/i);
  await started.promise;
  await h.auth.signIn('b@example.com', 'password');
  response.reject(unauthorized());
  await rejected;
  assert.equal(h.auth.user.value.id, 'b');
  assert.equal(h.stored().accessToken, 'access-b');
  assert.equal(h.routes.length, 0);
  assert.equal(h.calls.filter((call) => call.path === '/workspace').length, 1);
});

test('a same-account role downgrade clears privileged workspace data', async () => {
  const h = harness((path) => {
    if (path === '/auth/login') return session('a', { user: user('a', 'admin') });
    if (path === '/auth/me') return { user: user('a', 'visitor') };
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  h.state('studio-workspace').value = { ...emptyWorkspace(), clients: [{ id: 'private-client' }] };
  const before = h.auth.epoch.value;
  await h.auth.initialize(true);
  assert.equal(h.auth.isAdmin.value, false);
  assert.equal(h.auth.home.value, '/portal');
  assert.ok(h.auth.epoch.value > before);
  assert.equal(h.state('studio-workspace').value.clients.length, 0);
});

test('a verified email change clears records linked to the previous address', async () => {
  const h = harness((path) => {
    if (path === '/auth/login') return session('a');
    if (path === '/auth/me') return { user: user('a', 'visitor', 'new@example.com') };
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  h.state('studio-workspace').value = { ...emptyWorkspace(), projects: [{ id: 'old-email-project' }] };
  const before = h.auth.epoch.value;
  await h.auth.request('/auth/me', { method: 'PATCH', body: { email: 'new@example.com' } });
  assert.equal(h.auth.user.value.email, 'new@example.com');
  assert.ok(h.auth.epoch.value > before);
  assert.equal(h.state('studio-workspace').value.projects.length, 0);
});

test('ordinary sign-in refreshes expiring tokens before a protected request', async () => {
  const h = harness((path) => {
    if (path === '/auth/login') return session('a', { expiresAt: Math.floor(Date.now() / 1000) + 10 });
    if (path === '/auth/refresh') return session('a', { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' });
    if (path === '/workspace') return { projects: [{ id: 'a-project' }] };
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  const result = await h.auth.request('/workspace');
  assert.equal(result.projects[0].id, 'a-project');
  assert.equal(h.calls.find((call) => call.path === '/workspace').headers.Authorization, 'Bearer rotated-access');
  assert.equal(h.calls.find((call) => call.path === '/auth/refresh').body.refreshToken, 'refresh-a');
  assert.equal(h.stored().refreshToken, 'rotated-refresh');
  assert.equal(h.auth.user.value.id, 'a');
});

test('an invalid refresh ends the session and routes a protected request to sign-in', async () => {
  const h = harness((path) => {
    if (path === '/auth/login') return session('a', { expiresAt: Math.floor(Date.now() / 1000) + 10 });
    if (path === '/auth/refresh') throw unauthorized();
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  await assert.rejects(h.auth.request('/workspace'), /Session expired/);
  assert.equal(h.auth.user.value, null);
  assert.equal(h.stored(), null);
  assert.equal(h.routes.at(-1), '/login');
});

test('a temporary refresh outage retains the session for a later retry', async () => {
  let unavailable = true;
  const h = harness((path) => {
    if (path === '/auth/login') return session('a', { expiresAt: Math.floor(Date.now() / 1000) + 10 });
    if (path === '/auth/refresh') {
      if (unavailable) throw Object.assign(new Error('Temporarily unavailable'), { status: 503 });
      return session('a', { accessToken: 'recovered-access' });
    }
    if (path === '/workspace') return emptyWorkspace();
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  await assert.rejects(h.auth.request('/workspace'), /Temporarily unavailable/);
  assert.equal(h.stored().refreshToken, 'refresh-a');
  assert.equal(h.auth.user.value.id, 'a');
  assert.equal(h.routes.length, 0);
  unavailable = false;
  await h.auth.request('/workspace');
  assert.equal(h.stored().accessToken, 'recovered-access');
});

for (const status of [400, 403]) {
  test(`refresh rejection ${status} ends the session but ordinary ${status} does not`, async () => {
    const invalid = () => Object.assign(new Error('Rejected'), { status });
    const refreshing = harness((path) => {
      if (path === '/auth/login') return session('a', { expiresAt: Math.floor(Date.now() / 1000) + 10 });
      if (path === '/auth/refresh') throw invalid();
      throw new Error(`Unexpected ${path}`);
    });
    await refreshing.auth.signIn('a@example.com', 'password');
    await assert.rejects(refreshing.auth.request('/workspace'), /session has ended/i);
    assert.equal(refreshing.auth.user.value, null);
    assert.equal(refreshing.stored(), null);
    assert.equal(refreshing.routes.at(-1), '/login');

    const ordinary = harness((path) => {
      if (path === '/auth/login') return session('a');
      if (path === '/workspace/projects') throw invalid();
      throw new Error(`Unexpected ${path}`);
    });
    await ordinary.auth.signIn('a@example.com', 'password');
    await assert.rejects(ordinary.auth.request('/workspace/projects', { method: 'POST', body: {} }), /Rejected/);
    assert.equal(ordinary.auth.user.value.id, 'a');
    assert.equal(ordinary.stored().refreshToken, 'refresh-a');
    assert.equal(ordinary.routes.length, 0);
  });
}

test('a late refresh rejection cannot end a newer session', async () => {
  const refresh = deferred();
  const started = deferred();
  const h = harness((path, options) => {
    if (path === '/auth/login') return options.body.email === 'a@example.com'
      ? session('a', { expiresAt: Math.floor(Date.now() / 1000) + 10 }) : session('b');
    if (path === '/auth/refresh') { started.resolve(); return refresh.promise; }
    throw new Error(`Unexpected ${path}`);
  });
  await h.auth.signIn('a@example.com', 'password');
  const request = h.auth.request('/workspace');
  const rejected = assert.rejects(request, /session has ended/i);
  await started.promise;
  await h.auth.signIn('b@example.com', 'password');
  refresh.reject(Object.assign(new Error('Invalid refresh token'), { status: 400 }));
  await rejected;
  assert.equal(h.auth.user.value.id, 'b');
  assert.equal(h.stored().accessToken, 'access-b');
  assert.equal(h.routes.length, 0);
});
