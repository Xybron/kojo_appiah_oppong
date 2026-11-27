import { emptyWorkspace, type StudioWorkspace } from "~/types/studio";

export function useStudioWorkspace() {
  const auth = useStudioAuth();
  const data = useState<StudioWorkspace>("studio-workspace", emptyWorkspace);
  const loading = useState("studio-workspace-loading", () => false);
  const error = useState("studio-workspace-error", () => "");
  const revision = useState("studio-workspace-request", () => 0);

  async function load() {
    const current = ++revision.value;
    const session = auth.epoch.value;
    loading.value = true;
    error.value = "";
    try {
      const result = await auth.request<StudioWorkspace>("/workspace");
      if (session === auth.epoch.value && current === revision.value) data.value = result;
    } catch (cause) {
      if (current === revision.value) error.value = studioError(cause, "We couldn't load your workspace. Please try again.");
    } finally { if (current === revision.value) loading.value = false; }
  }

  async function save<T = unknown>(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST"): Promise<T> {
    const result = await auth.request<T>(path, { method, body });
    await load();
    return result;
  }
  async function upload<T = unknown>(path: string, body: FormData): Promise<T> {
    const result = await auth.request<T>(path, { method: "POST", body });
    if (path !== "/workspace/portfolio-image") await load();
    return result;
  }
  async function download(id: string) {
    const result = await auth.request<{ url: string }>(`/workspace/files/${encodeURIComponent(id)}/download`);
    const url = new URL(result.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error("This file link is unavailable.");
    // Navigating after the request avoids popup blockers and retains the portal
    // when the storage response uses Content-Disposition: attachment.
    const link = document.createElement("a");
    link.href = url.href;
    link.rel = "noopener noreferrer";
    link.click();
  }
  return { data, loading, error, load, save, upload, download };
}
