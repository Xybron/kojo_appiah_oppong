<script setup lang="ts">
import { artworks } from "~/data/artworks";
import "~/assets/css/collection.css";

const { ids, loaded, persistent, status, isSaved, toggle } = useSavedWorks();
const removedId = ref<string | null>(null);
const undoButton = ref<HTMLButtonElement | null>(null);
const savedArtworks = computed(() =>
  ids.value
    .map((id) => artworks.find((work) => work.id === id))
    .filter((work): work is (typeof artworks)[number] => !!work),
);
const removedTitle = computed(
  () => artworks.find((work) => work.id === removedId.value)?.title,
);
async function changed(id: string, saved: boolean) {
  if (!saved) {
    removedId.value = id;
    // Removing a focused card also removes its save button. Keep keyboard focus
    // on the reversible action rather than letting it fall back to the document.
    await nextTick();
    undoButton.value?.focus({ preventScroll: true });
  }
}
async function undo() {
  const restoredId = removedId.value;
  if (restoredId && !isSaved(restoredId)) toggle(restoredId);
  removedId.value = null;
  await nextTick();
  if (restoredId)
    document
      .querySelector<HTMLButtonElement>(
        `[data-save-artwork="${CSS.escape(restoredId)}"]`,
      )
      ?.focus({ preventScroll: true });
}
useSeoMeta({
  title: "Saved works — Kojo Appiah Oppong",
  description: "Return to the artworks that caught your eye.",
  robots: "noindex, nofollow",
});
</script>

<template>
  <main id="main" class="collection-page saved-page" tabindex="-1">
    <section class="collection-intro page-gutter" aria-labelledby="saved-title">
      <div>
        <p class="eyebrow">A little closer to you</p>
        <ArtHeading
          id="saved-title"
          tag="h1"
          text="The ones you keep coming back to."
          :break-before="3"
        />
      </div>
      <div class="collection-intro-aside">
        <p>A place for the images that stayed with you.</p>
        <p class="saved-storage-note">
          {{
            persistent
              ? "Saved on this device."
              : "Saved for this visit. Your browser cannot keep these works after closing."
          }}
          Saving a work does not reserve it.
        </p>
        <NuxtLink to="/artworks" class="underlined-link"
          >Explore the collection</NuxtLink
        >
      </div>
    </section>
    <section
      class="saved-collection page-gutter"
      aria-label="Your saved artworks"
    >
      <div class="saved-toolbar">
        <p class="collection-result-count">
          {{ loaded ? savedArtworks.length : "—" }}
          {{ savedArtworks.length === 1 ? "saved work" : "saved works" }}
        </p>
        <div v-if="removedId" class="saved-undo">
          <p>{{ removedTitle }} removed.</p>
          <button
            ref="undoButton"
            class="text-button"
            type="button"
            @click="undo"
          >
            Undo
          </button>
        </div>
      </div>
      <div
        v-if="!loaded"
        class="collection-empty saved-loading"
        aria-busy="true"
      >
        <p>Opening your saved works…</p>
      </div>
      <div v-else-if="savedArtworks.length" class="artwork-masonry">
        <ArtworkCard
          v-for="(artwork, index) in savedArtworks"
          :key="artwork.id"
          :artwork="artwork"
          :priority="index < 2"
          @saved-change="changed(artwork.id, $event)"
        />
      </div>
      <div v-else class="saved-empty">
        <NuxtLink
          to="/artworks"
          class="saved-empty-image"
          aria-label="Explore artworks"
          data-cursor="Explore"
          ><ArtImage
            image="fine-art"
            alt="Rust-coloured sand ridges traced by light and shadow."
            :width="1536"
            :height="1024"
            sizes="(max-width: 700px) 80vw, 40vw"
        /></NuxtLink>
        <div>
          <p class="eyebrow">Follow your eye</p>
          <h2>Your collection<br /><em>starts with a feeling.</em></h2>
          <p>
            When a work speaks to you, save it. It will be waiting here whenever
            you want another look.
          </p>
          <NuxtLink to="/artworks" class="underlined-link"
            >Find your first work</NuxtLink
          >
        </div>
      </div>
    </section>
    <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
  </main>
</template>
