<script setup lang="ts">
import type { Study } from "~/data/exhibition";
import { keepDialogFocus } from "~/utils/dialog";

const props = defineProps<{ studies: Study[] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const index = ref(0);
const isOpen = ref(false);
const selected = computed(() =>
  isOpen.value ? props.studies[index.value] : undefined,
);
let previousFocus: HTMLElement | null = null;

async function open(id: string) {
  if (dialog.value?.open || !props.studies.some((study) => study.id === id)) return;
  index.value = Math.max(
    0,
    props.studies.findIndex((study) => study.id === id),
  );
  previousFocus = document.activeElement as HTMLElement;
  isOpen.value = true;
  await nextTick();
  dialog.value?.showModal();
  document.documentElement.classList.add("dialog-open");
  window.dispatchEvent(new CustomEvent("exhibition:dialog", { detail: true }));
}
function close() {
  dialog.value?.close();
}
function afterClose() {
  isOpen.value = false;
  document.documentElement.classList.remove("dialog-open");
  window.dispatchEvent(new CustomEvent("exhibition:dialog", { detail: false }));
  previousFocus?.focus({ preventScroll: true });
}
function step(delta: number) {
  if (!props.studies.length) return;
  index.value =
    (index.value + delta + props.studies.length) % props.studies.length;
}
function keydown(event: KeyboardEvent) {
  keepDialogFocus(event);
  if (event.key === "ArrowRight") {
    event.preventDefault();
    step(1);
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    step(-1);
  }
}
function backdrop(event: MouseEvent) {
  if (event.target === dialog.value) close();
}
watch(() => props.studies, () => { if (isOpen.value) close(); });
defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="study-dialog"
    aria-labelledby="viewer-title"
    aria-describedby="viewer-note"
    data-lenis-prevent
    @close="afterClose"
    @keydown="keydown"
    @click="backdrop"
  >
    <div v-if="selected" class="viewer-shell">
      <div class="viewer-top">
        <span class="eyebrow">A closer look</span
        ><button type="button" class="text-button" autofocus @click="close">
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="viewer-image">
        <ArtImage
          :key="selected.id"
          :image="selected.image"
          :alt="selected.alt"
          :width="selected.width"
          :height="selected.height"
          sizes="90vw"
          priority
        />
      </div>
      <div class="viewer-caption" aria-live="polite">
        <div>
          <p class="eyebrow">{{ selected.discipline }}</p>
          <h2 id="viewer-title">{{ selected.title }}</h2>
        </div>
        <p id="viewer-note">{{ selected.description }}</p>
      </div>
      <div class="viewer-bottom">
        <div class="viewer-controls">
          <button type="button" class="text-button" @click="step(-1)">
            Previous</button
          ><span>{{ index + 1 }} / {{ studies.length }}</span
          ><button type="button" class="text-button" @click="step(1)">
            Next
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>
