<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    image: string;
    alt: string;
    width?: number;
    height?: number;
    sizes?: string;
    priority?: boolean;
    position?: string;
  }>(),
  {
    width: 1536,
    height: 1024,
    sizes: "(max-width: 700px) 100vw, 60vw",
    priority: false,
    position: "50% 50%",
  },
);
const failed = ref(false);
const preset = computed(() => /^[a-z0-9-]+$/i.test(props.image));
const source = computed(() => portfolioImageSource(props.image, 960));
watch(() => props.image, () => { failed.value = false; });
function refreshLayout() {
  window.dispatchEvent(new CustomEvent("exhibition:layout"));
}
</script>

<template>
  <div v-if="failed || !source" class="image-fallback" role="img" :aria-label="alt">
    <span>Image unavailable</span>
  </div>
  <picture v-else>
    <source
      v-if="preset"
      type="image/webp"
      :srcset="`/images/${image}-480.webp 480w, /images/${image}-960.webp 960w, /images/${image}-1600.webp ${Math.min(1600, width)}w`"
      :sizes="sizes"
    />
    <img
      :src="source"
      :srcset="preset ? `/images/${image}-480.jpg 480w, /images/${image}-960.jpg 960w, /images/${image}-1600.jpg ${Math.min(1600, width)}w` : undefined"
      :sizes="sizes"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
      decoding="async"
      :style="{ objectPosition: position }"
      @error="failed = true"
      @load="refreshLayout"
    />
  </picture>
</template>
