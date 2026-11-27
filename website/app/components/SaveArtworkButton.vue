<script setup lang="ts">
import { artworks } from "~/data/artworks";
import "~/assets/css/collection.css";

const props = withDefaults(
  defineProps<{ artworkId: string; compact?: boolean }>(),
  { compact: false },
);
const emit = defineEmits<{ changed: [saved: boolean] }>();
const { isSaved, toggle } = useSavedWorks();
const saved = computed(() => isSaved(props.artworkId));
const artworkTitle = computed(
  () =>
    artworks.find((artwork) => artwork.id === props.artworkId)?.title ||
    "artwork",
);
function change() {
  emit("changed", toggle(props.artworkId));
}
</script>

<template>
  <button
    class="save-artwork"
    :data-save-artwork="artworkId"
    :class="{ 'save-artwork--compact': compact, 'is-saved': saved }"
    type="button"
    :aria-pressed="saved"
    :aria-label="`${saved ? 'Saved' : 'Save'}: ${artworkTitle}${saved ? '. Remove from saved works' : ''}`"
    @click="change"
  >
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4V4.75Z"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
        :fill="saved ? 'currentColor' : 'none'"
      />
    </svg>
    <span>{{ saved ? "Saved" : "Save" }}</span>
  </button>
</template>
