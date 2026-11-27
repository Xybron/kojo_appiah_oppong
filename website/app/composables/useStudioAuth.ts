import type { StudioSession, StudioUser, StudioWorkspace } from "~/types/studio";
import { emptyWorkspace } from "~/types/studio";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | FormData;
};
type StoredTokens = Pick<StudioSession, "accessToken" | "refreshToken" | "expiresAt">;
const storageKey = "kojo:session:v1";
// Promises belong to the Nuxt application, never to serialized page state.
const operations = new WeakMap<object, { init?: Promise<void>; initEpoch?: number; refresh?: Promise<void>; refreshEpoch?: number }>();

export function studioError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const value = error as { data?: { message?: string }; message?: string };
  return value?.data?.message || value?.message || fallback;
}

export function useStudioAuth() {
  const app = useNuxtApp();
  const router = useRouter();
  const config = useRuntimeConfig();
  const base = String(config.public.apiBaseUrl || "").replace(/\/+$/, "");
  const user = useState<StudioUser | null>("studio-user", () => null);
  const tokens = useState<StoredTokens | null>("studio-tokens", () => null);
  const initialized = useState("studio-initialized", () => false);
  const epoch = useState("studio-session-epoch", () => 0);
  const authError = useState("studio-auth-error", () => "");
  const workspace = useState<StudioWorkspace>("studio-workspace", emptyWorkspace);
  if (!operations.has(app)) operations.set(app, {});
  const pending = operations.get(app)!;
  const configured = computed(() => Boolean(base));
  const isAdmin = computed(() => user.value?.role === "admin");
  const home = computed(() => isAdmin.value ? "/studio" : "/portal");

  function persist() {
    if (import.meta.server) return;
    try {
      if (tokens.value) sessionStorage.setItem(storageKey, JSON.stringify(tokens.value));
      else sessionStorage.removeItem(storageKey);
    } catch { /* In-memory sign-in still works when browser storage is disabled. */ }
  }

  function clear() {
    epoch.value++;
    user.value = null;
    tokens.value = null;
    workspace.value = emptyWorkspace();
    persist();
  }

  function updateUser(next: StudioUser) {
    const previous = user.value;
    if (previous && (previous.id !== next.id || previous.role !== next.role || previous.email !== next.email)) {
      epoch.value++;
      workspace.value = emptyWorkspace();
    }
    user.value = next;
  }

  function accept(session: StudioSession) {
    if (!session.accessToken || !session.refreshToken || !session.user?.id) {
      throw new Error("Unable to open your session. Please sign in again.");
    }
    tokens.value = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt || Math.floor(Date.now() / 1000) + (session.expiresIn || 3600),
    };
    updateUser(session.user);
    initialized.value = true;
    authError.value = "";
    persist();
  }

  async function raw<T>(path: string, options: RequestOptions = {}, accessToken?: string): Promise<T> {
    if (!base) throw new Error("Account access is not available yet. Please contact the studio.");
    return await $fetch<T>(`${base}/api/v1${path}`, {
      method: options.method || "GET",
      body: options.body,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      retry: 0,
      timeout: options.body instanceof FormData ? 90000 : 20000,
    }) as T;
  }

  async function refresh() {
    if (pending.refresh && pending.refreshEpoch === epoch.value) return pending.refresh;
    const refreshToken = tokens.value?.refreshToken;
    if (!refreshToken) throw new Error("Please sign in to continue.");
    const started = epoch.value;
    pending.refreshEpoch = started;
    pending.refresh = (async () => {
      try {
        const result = await raw<StudioSession>("/auth/refresh", { method: "POST", body: { refreshToken } });
        if (epoch.value === started) accept(result);
      } catch (error) {
        const status = (error as { status?: number }).status;
        // A rejected refresh ends this session. Ordinary validation/permission
        // errors from other endpoints must not sign the user out.
        if (status === 400 || status === 403) {
          throw Object.assign(new Error("Your session has ended. Please sign in again."), { status: 401 });
        }
        throw error;
      } finally { if (pending.refreshEpoch === started) pending.refresh = undefined; }
    })();
    return pending.refresh;
  }

  async function initialize(force = false) {
    if (import.meta.server) return;
    if (pending.init && pending.initEpoch === epoch.value) return pending.init;
    if (initialized.value && !force) return;
    const started = epoch.value;
    pending.initEpoch = started;
    pending.init = (async () => {
      authError.value = "";
      if (!tokens.value) {
        try {
          const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
          if (stored && typeof stored.accessToken === "string" && typeof stored.refreshToken === "string" && typeof stored.expiresAt === "number") {
            tokens.value = { accessToken: stored.accessToken, refreshToken: stored.refreshToken, expiresAt: stored.expiresAt };
          }
        } catch { /* Invalid or blocked storage is treated as signed out. */ }
      }
      if (!tokens.value) { initialized.value = true; return; }
      try {
        if (tokens.value.expiresAt < Date.now() / 1000 + 60) await refresh();
        if (epoch.value !== started) return;
        let result: { user: StudioUser };
        try {
          result = await raw<{ user: StudioUser }>("/auth/me", {}, tokens.value?.accessToken);
        } catch (error) {
          if (epoch.value !== started) return;
          if ((error as { status?: number }).status !== 401) throw error;
          await refresh();
          if (epoch.value !== started) return;
          result = await raw<{ user: StudioUser }>("/auth/me", {}, tokens.value?.accessToken);
        }
        if (epoch.value === started) updateUser(result.user);
      } catch (error) {
        if (epoch.value !== started) return;
        const status = (error as { status?: number }).status;
        if (status === 400 || status === 401 || status === 403) clear();
        else { user.value = null; workspace.value = emptyWorkspace(); }
        authError.value = studioError(error, "We could not verify your session. Please try again.");
      } finally { if (epoch.value === started) initialized.value = true; }
    })().finally(() => { if (pending.initEpoch === started) pending.init = undefined; });
    return pending.init;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const started = epoch.value;
    const assertSession = () => {
      if (epoch.value !== started) throw new Error("Your account access changed. Please try again.");
    };
    await initialize();
    assertSession();
    if (!tokens.value) throw new Error("Please sign in to continue.");
    try {
      if (tokens.value.expiresAt < Date.now() / 1000 + 60) await refresh();
      assertSession();
      let result: T;
      try { result = await raw<T>(path, options, tokens.value?.accessToken); }
      catch (error) {
        assertSession();
        if ((error as { status?: number }).status !== 401) throw error;
        await refresh();
        assertSession();
        result = await raw<T>(path, options, tokens.value?.accessToken);
      }
      assertSession();
      if (path === "/auth/me" && (result as { user?: StudioUser })?.user) updateUser((result as { user: StudioUser }).user);
      return result;
    } catch (error) {
      if (epoch.value !== started) throw error;
      if (!tokens.value || (error as { status?: number }).status === 401) {
        clear();
        authError.value = "Your session has ended. Please sign in again.";
        await router.replace("/login");
      }
      throw error;
    }
  }

  async function signIn(email: string, password: string) {
    clear();
    const started = epoch.value;
    const result = await raw<StudioSession>("/auth/login", { method: "POST", body: { email, password } });
    if (epoch.value === started) accept(result);
  }
  async function sendCode(email: string) {
    return raw<{ message: string }>("/auth/otp-login", { method: "POST", body: { email } });
  }
  async function verifyCode(email: string, code: string) {
    clear();
    const started = epoch.value;
    const result = await raw<StudioSession>("/auth/verify-otp", { method: "POST", body: { email, code } });
    if (epoch.value === started) accept(result);
  }
  async function signOut() {
    const accessToken = tokens.value?.accessToken;
    clear();
    await router.replace("/login");
    if (accessToken) {
      try { await raw("/auth/logout", { method: "POST" }, accessToken); }
      catch { /* Local access is already cleared; expired sessions cannot be revoked. */ }
    }
  }
  return { user, isAdmin, home, configured, initialized, authError, epoch, initialize, request, signIn, sendCode, verifyCode, signOut };
}
