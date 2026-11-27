import { artworks } from "~/data/artworks";

const storageKey = "kojo:saved-works:v1";
let listeners = 0;
let storageListener: ((event: StorageEvent) => void) | undefined;

function decodeSavedWorks(raw: string | null): string[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  const values = Array.isArray(value)
    ? value
    : value && typeof value === "object" && "ids" in value
      ? (value as { ids: unknown }).ids
      : [];
  if (!Array.isArray(values)) return [];
  const knownIds = new Set(artworks.map((artwork) => artwork.id));
  return [
    ...new Set(
      values.filter(
        (id): id is string => typeof id === "string" && knownIds.has(id),
      ),
    ),
  ];
}

export function useSavedWorks() {
  const ids = useState<string[]>("saved-works:ids", () => []);
  const loaded = useState("saved-works:loaded", () => false);
  const persistent = useState("saved-works:persistent", () => true);
  const status = useState("saved-works:status", () => "");
  const count = computed(() => ids.value.length);

  function initialize() {
    if (!import.meta.client || loaded.value) return;
    try {
      ids.value = decodeSavedWorks(localStorage.getItem(storageKey));
    } catch {
      // A denied or malformed store must never break browsing or saving.
      persistent.value = false;
    }
    loaded.value = true;
  }

  function persist() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, ids: ids.value }),
      );
      persistent.value = true;
      return true;
    } catch {
      persistent.value = false;
      return false;
    }
  }

  function isSaved(id: string) {
    return ids.value.includes(id);
  }

  function toggle(id: string) {
    initialize();
    const artwork = artworks.find((item) => item.id === id);
    if (!artwork) return false;
    const saving = !isSaved(id);
    ids.value = saving
      ? [...ids.value, id]
      : ids.value.filter((saved) => saved !== id);
    const stored = persist();
    status.value = saving
      ? stored
        ? `${artwork.title} saved to your works.`
        : `${artwork.title} saved for this visit. Your browser cannot keep saved works after closing.`
      : `${artwork.title} removed from saved works.`;
    return saving;
  }

  function remove(id: string) {
    if (!isSaved(id)) return false;
    toggle(id);
    return true;
  }

  onMounted(() => {
    initialize();
    listeners++;
    if (!storageListener) {
      storageListener = (event: StorageEvent) => {
        if (event.key !== storageKey && event.key !== null) return;
        try {
          ids.value = decodeSavedWorks(event.newValue);
          status.value = "Saved works updated.";
        } catch {
          // Ignore malformed data arriving from another tab.
        }
      };
      window.addEventListener("storage", storageListener);
    }
  });
  onBeforeUnmount(() => {
    listeners = Math.max(0, listeners - 1);
    if (!listeners && storageListener) {
      window.removeEventListener("storage", storageListener);
      storageListener = undefined;
    }
  });

  return {
    ids,
    count,
    loaded,
    persistent,
    status,
    isSaved,
    toggle,
    remove,
    initialize,
  };
}
