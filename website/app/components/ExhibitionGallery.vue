<script setup lang="ts">
import type { Study } from "~/data/exhibition";
const props = defineProps<{
  studies: Study[];
  loading?: boolean;
  error?: string;
}>();

const emit = defineEmits<{ open: [id: string]; retry: [] }>();
const gallery = ref<HTMLElement | null>(null);
const activeIndex = ref(0);
const activeStudy = computed(() => props.studies[activeIndex.value]);
let frame = 0;
let resizeObserver: ResizeObserver | undefined;

function cards() {
  return gallery.value?.querySelectorAll<HTMLElement>(".gallery-card");
}

function reducedMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !!gallery.value?.closest(".motion-paused")
  );
}

function select(index: number, animate = true) {
  const container = gallery.value;
  const nextIndex = Math.max(0, Math.min(props.studies.length - 1, index));
  const card = cards()?.[nextIndex];
  if (!container || !card) return;

  const viewport = container.getBoundingClientRect();
  const bounds = card.getBoundingClientRect();
  const left =
    container.scrollLeft +
    bounds.left -
    viewport.left -
    (container.clientWidth - bounds.width) / 2;

  activeIndex.value = nextIndex;
  container.scrollTo({
    left,
    behavior: animate && !reducedMotion() ? "smooth" : "instant",
  });
}

function updateActive() {
  frame = 0;
  const container = gallery.value;
  const items = cards();
  if (!container || !items?.length) return;
  const viewport = container.getBoundingClientRect();
  const center = viewport.left + container.clientWidth / 2;
  let closest = 0;
  let distance = Infinity;

  items.forEach((card, index) => {
    const bounds = card.getBoundingClientRect();
    const nextDistance = Math.abs(bounds.left + bounds.width / 2 - center);
    if (nextDistance < distance) {
      distance = nextDistance;
      closest = index;
    }
  });
  activeIndex.value = closest;
}

function onScroll() {
  if (!frame) frame = window.requestAnimationFrame(updateActive);
}

function onKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();

  const items = [...(cards() ?? [])];
  const focusedLink =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>(".gallery-image")
      : null;
  const focusedCard = focusedLink?.closest<HTMLElement>(".gallery-card");
  const focusedIndex = focusedCard ? items.indexOf(focusedCard) : -1;
  const origin = focusedIndex >= 0 ? focusedIndex : activeIndex.value;
  const nextIndex = Math.max(
    0,
    Math.min(
      props.studies.length - 1,
      origin + (event.key === "ArrowRight" ? 1 : -1),
    ),
  );

  // Keep Enter aligned with the photograph reached by arrow-key navigation.
  // The region itself retains focus when navigation starts on its container.
  if (focusedLink) {
    items[nextIndex]
      ?.querySelector<HTMLAnchorElement>(".gallery-image")
      ?.focus({ preventScroll: true });
  }
  select(nextIndex);
}

watch(
  () => props.studies,
  async () => {
    activeIndex.value = 0;
    await nextTick();
    select(0, false);
    window.dispatchEvent(new CustomEvent("exhibition:layout"));
  },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(() => select(activeIndex.value, false));
  watch(
    gallery,
    (element, previous) => {
      if (previous) resizeObserver?.unobserve(previous);
      if (element) resizeObserver?.observe(element);
    },
    { immediate: true },
  );
});

onBeforeUnmount(() => {
  if (frame) window.cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
});
</script>

<template>
  <section id="work" class="gallery-section" aria-labelledby="work-title">
    <div class="gallery-heading page-gutter">
      <p class="eyebrow">01 — Selected work</p>
      <ArtHeading
        id="work-title"
        class="gallery-title"
        text="One eye. Many worlds."
        :break-before="2"
      />
      <p class="gallery-intro">
        A gesture. A line. A landscape. An object.<br />
        A different subject. The same attention.
      </p>
    </div>

    <div
      v-if="!studies.length"
      class="portfolio-empty page-gutter"
      role="status"
    >
      <p>
        {{
          loading
            ? "Opening the portfolio…"
            : error || "New work will appear here soon."
        }}
      </p>
      <button
        v-if="error && !loading"
        type="button"
        class="text-button"
        @click="emit('retry')"
      >
        Try again
      </button>
    </div>
    <p v-else-if="error" class="portfolio-notice page-gutter" role="status">
      {{ error }}
      <button
        type="button"
        class="text-button"
        :disabled="loading"
        @click="emit('retry')"
      >
        Try again
      </button>
    </p>
    <div v-if="studies.length" class="gallery-toolbar page-gutter">
      <div
        class="discipline-tabs"
        role="group"
        aria-label="Choose a discipline"
      >
        <button
          v-for="(study, index) in studies"
          :key="study.id"
          type="button"
          :aria-pressed="activeIndex === index"
          aria-controls="gallery-window"
          @click="select(index)"
        >
          {{ study.discipline }}
        </button>
      </div>
      <p id="gallery-instruction" class="gallery-instruction">
        <span class="desktop-only">Explore sideways</span>
        <span class="mobile-only">Swipe sideways</span>
        <span aria-hidden="true">↔</span>
        <span class="sr-only"
          >Use the left and right arrow keys, or the previous and next controls.
          Scroll vertically to continue down the exhibition.</span
        >
      </p>
    </div>

    <div
      v-if="studies.length"
      id="gallery-window"
      ref="gallery"
      class="gallery-window"
      role="region"
      aria-label="Selected photographs"
      aria-describedby="gallery-instruction"
      tabindex="0"
      @scroll.passive="onScroll"
      @keydown="onKeydown"
    >
      <div class="gallery-track">
        <article
          v-for="(study, index) in studies"
          :key="study.id"
          class="gallery-card"
          :class="{ 'is-active': activeIndex === index }"
          :aria-labelledby="`gallery-title-${study.id}`"
        >
          <a
            class="gallery-image"
            data-cursor="View"
            :href="portfolioImageSource(study.image)"
            :aria-label="`View ${study.title}, ${study.discipline}`"
            @click.prevent="emit('open', study.id)"
          >
            <ArtImage
              :image="study.image"
              :alt="study.alt"
              :width="study.width"
              :height="study.height"
              :position="study.position"
              sizes="(max-width: 700px) 84vw, 58vw"
            />
            <span class="gallery-open" aria-hidden="true"
              >Look closer <span>↗</span></span
            >
          </a>
          <div class="gallery-caption">
            <div class="gallery-caption-heading">
              <span class="gallery-number" aria-hidden="true"
                >0{{ index + 1 }}</span
              >
              <h3 :id="`gallery-title-${study.id}`">{{ study.title }}</h3>
            </div>
            <p class="gallery-description">{{ study.description }}</p>
          </div>
        </article>
      </div>
    </div>

    <div v-if="activeStudy" class="gallery-navigation page-gutter">
      <div class="gallery-progress">
        <span aria-hidden="true"
          >0{{ activeIndex + 1 }}
          <span class="gallery-total">/ 0{{ studies.length }}</span></span
        >
        <span class="gallery-progress-track" aria-hidden="true">
          <span
            class="gallery-progress-fill"
            :style="{ width: `${((activeIndex + 1) / studies.length) * 100}%` }"
          ></span>
        </span>
        <p class="sr-only" role="status" aria-atomic="true">
          {{ activeStudy.discipline }}: {{ activeStudy.title }}. Image
          {{ activeIndex + 1 }} of {{ studies.length }}.
        </p>
      </div>
      <div
        class="gallery-controls"
        role="group"
        aria-label="Navigate photographs"
      >
        <button
          type="button"
          aria-label="Previous photograph"
          aria-controls="gallery-window"
          :disabled="activeIndex === 0"
          @click="select(activeIndex - 1)"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          aria-label="Next photograph"
          aria-controls="gallery-window"
          :disabled="activeIndex === studies.length - 1"
          @click="select(activeIndex + 1)"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  </section>
</template>
