const guestStorageKey = "kojo:guest-identity:v1";
const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

function newGuestId() {
  // This identifier is only an avatar seed, never an authentication credential.
  try {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return "";
  }
}

export function useGuestIdentity() {
  const id = useState<string>("guest-identity:id", () => "");
  const loaded = useState("guest-identity:loaded", () => false);
  const persistent = useState("guest-identity:persistent", () => false);

  function initialize() {
    if (!import.meta.client || loaded.value) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(guestStorageKey); } catch { /* Use this visit's identity. */ }
    id.value = stored && uuidPattern.test(stored) ? stored.toLowerCase() : newGuestId();
    if (id.value) {
      try {
        localStorage.setItem(guestStorageKey, id.value);
        persistent.value = true;
      } catch {
        // Storage restrictions must not prevent guests from browsing or saving.
        persistent.value = false;
      }
    }
    loaded.value = true;
  }

  function updateFromStorage(event: StorageEvent) {
    if (event.key !== guestStorageKey || !event.newValue || !uuidPattern.test(event.newValue)) return;
    id.value = event.newValue.toLowerCase();
    persistent.value = true;
  }

  onMounted(() => {
    initialize();
    window.addEventListener("storage", updateFromStorage);
  });
  onBeforeUnmount(() => window.removeEventListener("storage", updateFromStorage));

  return { id: readonly(id), loaded: readonly(loaded), persistent: readonly(persistent), initialize };
}
