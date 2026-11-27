<script setup lang="ts">
const cursor = ref<HTMLElement | null>(null);
const label = ref("");
const visible = ref(false);
const { paused } = useMotionPreference();
let cleanup: (() => void) | undefined;
onMounted(() => {
  const media = window.matchMedia("(hover: hover) and (pointer: fine)");
  let frame = 0,
    x = 0,
    y = 0;
  const hide = () => {
    visible.value = false;
    document.documentElement.classList.remove("exhibition-cursor-active");
  };
  const update = (event: PointerEvent) => {
    if (!media.matches || paused.value || event.pointerType !== "mouse") {
      hide();
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-cursor]",
    );
    if (!target || document.querySelector("dialog[open]")) {
      hide();
      return;
    }
    label.value = target.dataset.cursor || "View";
    visible.value = true;
    document.documentElement.classList.add("exhibition-cursor-active");
    x = event.clientX;
    y = event.clientY;
    if (!frame)
      frame = requestAnimationFrame(() => {
        if (cursor.value)
          cursor.value.style.transform = `translate3d(${x}px,${y}px,0)`;
        frame = 0;
      });
  };
  const stop = watch(paused, hide);
  const unhook = useNuxtApp().hook("page:start", hide);
  document.addEventListener("keydown", hide);
  window.addEventListener("exhibition:dialog", hide);
  document.addEventListener("pointermove", update, { passive: true });
  document.addEventListener("pointerleave", hide);
  window.addEventListener("blur", hide);
  window.addEventListener("scroll", hide, { passive: true });
  media.addEventListener("change", hide);
  cleanup = () => {
    stop();
    unhook();
    cancelAnimationFrame(frame);
    hide();
    document.removeEventListener("keydown", hide);
    window.removeEventListener("exhibition:dialog", hide);
    document.removeEventListener("pointermove", update);
    document.removeEventListener("pointerleave", hide);
    window.removeEventListener("blur", hide);
    window.removeEventListener("scroll", hide);
    media.removeEventListener("change", hide);
  };
});
onBeforeUnmount(() => cleanup?.());
</script>
<template>
  <div
    ref="cursor"
    class="exhibition-cursor"
    :class="{ 'is-visible': visible }"
    aria-hidden="true"
  >
    <span>{{ label }}</span>
  </div>
</template>
