<script setup lang="ts">
import { artworks, getArtwork, formatPrice } from "~/data/artworks";
import "~/assets/css/artwork-detail.css";

definePageMeta({ key: (route) => route.path });
const route = useRoute();
const config = useRuntimeConfig();
const artwork = getArtwork(String(route.params.slug));
if (!artwork)
  throw createError({ statusCode: 404, statusMessage: "Artwork not found" });
const selectedVariantId = ref(artwork.variants[0]!.id);
const selectedFrameId = ref(artwork.framing[0]!.id);
const view = ref<"artwork" | "detail" | "scale">("artwork");
const unit = ref<"cm" | "in">("cm");
const order = ref<{ open: () => void } | null>(null);
const shareStatus = ref("");
const variant = computed(
  () =>
    artwork.variants.find((option) => option.id === selectedVariantId.value) ||
    artwork.variants[0]!,
);
const frame = computed(
  () =>
    artwork.framing.find((option) => option.id === selectedFrameId.value) ||
    artwork.framing[0]!,
);
const total = computed(() => variant.value.price + frame.value.price);
const dimensions = computed(() =>
  unit.value === "cm"
    ? `${variant.value.widthCm} × ${variant.value.heightCm} cm`
    : `${Number((variant.value.widthCm / 2.54).toFixed(1))} × ${Number((variant.value.heightCm / 2.54).toFixed(1))} in`,
);
const actionLabel = computed(() =>
  artwork.status === "sold"
    ? "Collected"
    : artwork.purchaseMode === "enquiry"
      ? "Enquire about this work"
      : "Acquire artwork",
);
const related = artworks
  .filter((item) => item.id !== artwork.id)
  .sort(
    (a, b) =>
      Number(b.discipline === artwork.discipline) -
      Number(a.discipline === artwork.discipline),
  )
  .slice(0, 3);

useSeoMeta({
  title: `${artwork.title} — Kojo Appiah Oppong`,
  description: `${artwork.title}. ${artwork.medium}. ${artwork.description}`,
  ogTitle: `${artwork.title} — Kojo Appiah Oppong`,
  ogDescription: artwork.description,
  ogImage: `${config.public.siteUrl}/images/${artwork.image}-1600.jpg`,
  twitterCard: "summary_large_image",
});
useHead({
  link: [
    {
      rel: "canonical",
      href: `${config.public.siteUrl}/artworks/${artwork.id}`,
    },
  ],
});

async function share() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    shareStatus.value = "Artwork link copied.";
  } catch {
    shareStatus.value = "Copy this page’s address to share this artwork.";
  }
}
</script>

<template>
  <main id="main" class="art-detail-page" tabindex="-1">
    <div class="art-detail-breadcrumb page-gutter">
      <NuxtLink to="/artworks">All artworks</NuxtLink
      ><span aria-hidden="true">/</span><span>{{ artwork.title }}</span>
    </div>
    <section
      class="art-detail-layout page-gutter"
      aria-labelledby="art-detail-title"
    >
      <div class="art-detail-media">
        <div class="art-view-toolbar">
          <div class="art-view-buttons" role="group" aria-label="Artwork view">
            <button
              type="button"
              :aria-pressed="view === 'artwork'"
              @click="view = 'artwork'"
            >
              Artwork
            </button>
            <button
              type="button"
              :aria-pressed="view === 'detail'"
              @click="view = 'detail'"
            >
              Detail
            </button>
            <button
              type="button"
              :aria-pressed="view === 'scale'"
              @click="view = 'scale'"
            >
              View at scale
            </button>
          </div>
          <div
            class="art-unit-buttons"
            role="group"
            aria-label="Dimension units"
          >
            <button
              type="button"
              :aria-pressed="unit === 'cm'"
              @click="unit = 'cm'"
            >
              cm</button
            ><button
              type="button"
              :aria-pressed="unit === 'in'"
              @click="unit = 'in'"
            >
              in
            </button>
          </div>
        </div>
        <ArtworkScaleView
          v-if="view === 'scale'"
          :artwork="artwork"
          :variant="variant"
          :frame="frame"
          :unit="unit"
        />
        <figure v-else class="art-detail-figure">
          <button
            class="art-detail-image"
            :class="{ 'is-detail': view === 'detail' }"
            type="button"
            :aria-label="
              view === 'detail'
                ? 'Show the complete artwork'
                : 'Inspect a close detail of the artwork'
            "
            :data-cursor="view === 'detail' ? 'Full view' : 'Closer'"
            @click="view = view === 'detail' ? 'artwork' : 'detail'"
          >
            <ArtImage
              :image="artwork.image"
              :alt="artwork.alt"
              :width="artwork.width"
              :height="artwork.height"
              sizes="(max-width: 850px) calc(100vw - 40px), 60vw"
              priority
            />
            <span class="art-detail-inspect" aria-hidden="true"
              >{{
                view === "detail"
                  ? "Return to full artwork"
                  : "Look a little closer"
              }}
              <span>{{ view === "detail" ? "−" : "+" }}</span></span
            >
          </button>
          <figcaption>
            <span>{{
              view === "detail"
                ? "A closer study of the surface"
                : artwork.medium
            }}</span
            ><span>{{ dimensions }}</span>
          </figcaption>
        </figure>
        <div class="art-media-note">
          <span>{{ artwork.discipline }}</span
          ><button class="text-button" type="button" @click="share">
            Share artwork
          </button>
        </div>
        <p class="art-share-status" role="status">{{ shareStatus }}</p>
      </div>

      <div class="art-detail-info">
        <p class="eyebrow">{{ artwork.kind }} · {{ artwork.year }}</p>
        <h1 id="art-detail-title">{{ artwork.title }}</h1>
        <NuxtLink to="/#artist" class="art-artist-name"
          >Kojo Appiah Oppong</NuxtLink
        >
        <p class="art-detail-description">{{ artwork.description }}</p>
        <div class="art-price-row">
          <p
            v-if="artwork.purchaseMode === 'purchase'"
            class="art-detail-price"
          >
            {{ formatPrice(total, artwork.currency) }}
          </p>
          <p v-else class="art-detail-price art-on-enquiry">Price on enquiry</p>
          <span class="art-availability">{{
            artwork.status === "sold"
              ? "Collected"
              : artwork.kind === "Original"
                ? "Unique work"
                : "Available as a print"
          }}</span>
        </div>

        <fieldset class="art-options" :disabled="artwork.status === 'sold'">
          <legend>
            {{ artwork.kind === "Original" ? "Dimensions" : "Choose a size" }}
          </legend>
          <div class="art-size-options">
            <label
              v-for="option in artwork.variants"
              :key="option.id"
              :class="{ 'is-selected': selectedVariantId === option.id }"
              ><input
                v-model="selectedVariantId"
                type="radio"
                name="artwork-size"
                :value="option.id"
              /><span>{{ option.label }}</span
              ><small>{{
                unit === "cm"
                  ? `${option.widthCm} × ${option.heightCm} cm`
                  : `${Number((option.widthCm / 2.54).toFixed(1))} × ${Number((option.heightCm / 2.54).toFixed(1))} in`
              }}</small></label
            >
          </div>
        </fieldset>
        <fieldset class="art-options" :disabled="artwork.status === 'sold'">
          <legend>Presentation</legend>
          <div class="art-frame-options">
            <label
              v-for="option in artwork.framing"
              :key="option.id"
              :class="{ 'is-selected': selectedFrameId === option.id }"
              ><input
                v-model="selectedFrameId"
                type="radio"
                name="artwork-frame"
                :value="option.id"
              /><span>{{ option.label }}</span
              ><small>{{
                option.price > 0 && artwork.purchaseMode === "purchase"
                  ? `+ ${formatPrice(option.price, artwork.currency)}`
                  : option.price === 0
                    ? "Included"
                    : "On enquiry"
              }}</small></label
            >
          </div>
        </fieldset>
        <div class="art-selection-note" aria-live="polite">
          {{ dimensions }} <span aria-hidden="true">·</span> {{ frame.label }}
        </div>
        <div class="art-actions">
          <button
            class="art-primary-button"
            type="button"
            :disabled="artwork.status === 'sold'"
            @click="order?.open()"
          >
            {{ actionLabel }}</button
          ><SaveArtworkButton :artwork-id="artwork.id" />
        </div>
        <p class="art-delivery-note">{{ artwork.delivery }}</p>
        <dl class="art-facts">
          <div>
            <dt>Medium</dt>
            <dd>{{ artwork.medium }}</dd>
          </div>
          <div>
            <dt>Edition</dt>
            <dd>{{ artwork.edition }}</dd>
          </div>
          <div>
            <dt>Artist</dt>
            <dd>Kojo Appiah Oppong</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="art-story page-gutter" aria-labelledby="art-story-title">
      <p class="eyebrow">Behind the work</p>
      <h2 id="art-story-title">
        A moment.<br /><em>A different perspective.</em>
      </h2>
      <div>
        <p v-for="paragraph in artwork.story" :key="paragraph">
          {{ paragraph }}
        </p>
      </div>
    </section>

    <section
      class="art-related page-gutter"
      aria-labelledby="art-related-title"
    >
      <div class="art-related-heading">
        <h2 id="art-related-title">Keep looking.</h2>
        <NuxtLink to="/artworks" class="underlined-link"
          >Explore all artworks</NuxtLink
        >
      </div>
      <div class="art-related-grid">
        <article v-for="item in related" :key="item.id">
          <NuxtLink :to="`/artworks/${item.id}`" data-cursor="View"
            ><ArtImage
              :image="item.image"
              :alt="item.alt"
              :width="item.width"
              :height="item.height"
              sizes="(max-width: 700px) calc(100vw - 40px), 30vw"
            />
            <div>
              <h3>{{ item.title }}</h3>
              <span>{{ item.kind }}</span>
            </div></NuxtLink
          >
        </article>
      </div>
    </section>
    <div class="art-mobile-acquire">
      <div>
        <strong>{{
          artwork.purchaseMode === "purchase"
            ? formatPrice(total, artwork.currency)
            : "Price on enquiry"
        }}</strong
        ><span>{{ dimensions }}</span>
      </div>
      <button
        class="art-primary-button"
        type="button"
        :disabled="artwork.status === 'sold'"
        @click="order?.open()"
      >
        {{
          artwork.status === "sold"
            ? "Collected"
            : artwork.purchaseMode === "enquiry"
              ? "Enquire"
              : "Acquire artwork"
        }}
      </button>
    </div>
    <ArtworkOrderDialog
      ref="order"
      :artwork="artwork"
      :variant="variant"
      :frame="frame"
    />
  </main>
</template>
