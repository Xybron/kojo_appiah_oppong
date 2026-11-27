<script setup lang="ts">
import { artworks } from "~/data/artworks";
import { disciplines } from "~/data/exhibition";
import "~/assets/css/collection.css";

const config = useRuntimeConfig();
const query = ref("");
const discipline = ref("All work");
const kind = ref("All works");
const availableOnly = ref(false);
const { count, status } = useSavedWorks();
const resultCount = ref<HTMLElement | null>(null);
const visibleArtworks = computed(() => {
  const terms = query.value
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return artworks.filter((artwork) => {
    const text =
      `${artwork.title} ${artwork.discipline} ${artwork.medium} ${artwork.kind} ${artwork.description}`.toLocaleLowerCase();
    return (
      (discipline.value === "All work" ||
        artwork.discipline === discipline.value) &&
      (kind.value === "All works" || artwork.kind === kind.value) &&
      (!availableOnly.value || artwork.status === "available") &&
      terms.every((term) => text.includes(term))
    );
  });
});
const hasFilters = computed(
  () =>
    query.value.trim() ||
    discipline.value !== "All work" ||
    kind.value !== "All works" ||
    availableOnly.value,
);
function clearFilters() {
  query.value = "";
  discipline.value = "All work";
  kind.value = "All works";
  availableOnly.value = false;
}
useSeoMeta({
  title: "Artworks — Kojo Appiah Oppong",
  description:
    "Explore fine art, photographic prints, and original works by Kojo Appiah Oppong. Find a work to live with, or save a piece that stays with you.",
});
useHead({
  link: [{ rel: "canonical", href: `${config.public.siteUrl}/artworks` }],
});
</script>

<template>
  <main id="main" class="collection-page" tabindex="-1">
    <section
      class="collection-intro page-gutter"
      aria-labelledby="collection-title"
    >
      <div>
        <p class="eyebrow">The collection</p>
        <ArtHeading
          id="collection-title"
          tag="h1"
          text="Find what stays with you."
          :break-before="2"
        />
      </div>
      <div class="collection-intro-aside">
        <p>
          Original works. Photographic prints.<br />Different ways to bring an
          image into your life.
        </p>
        <NuxtLink to="/saved" class="collection-saved-link"
          >Your saved works
          <span>{{ count.toString().padStart(2, "0") }}</span></NuxtLink
        >
      </div>
    </section>

    <section
      class="collection-browser page-gutter"
      aria-label="Browse artworks"
    >
      <div class="collection-filter-top">
        <div
          class="collection-disciplines"
          role="group"
          aria-label="Choose an artwork discipline"
        >
          <button
            v-for="option in disciplines"
            :key="option"
            type="button"
            :aria-pressed="discipline === option"
            @click="discipline = option"
          >
            {{ option === "All work" ? "All disciplines" : option }}
          </button>
        </div>
        <div class="collection-search">
          <label class="sr-only" for="artwork-search">Search artworks</label>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
            fill="none"
          >
            <circle
              cx="10.5"
              cy="10.5"
              r="6.5"
              stroke="currentColor"
              stroke-width="1.4"
            />
            <path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.4" />
          </svg>
          <input
            id="artwork-search"
            v-model="query"
            type="search"
            placeholder="Find a work"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="collection-filter-bottom">
        <div class="collection-refinements">
          <label class="collection-select"
            ><span class="sr-only">Artwork type</span
            ><select v-model="kind">
              <option>All works</option>
              <option value="Original">Originals</option>
              <option value="Print">Prints</option>
            </select></label
          >
          <label class="collection-availability"
            ><input v-model="availableOnly" type="checkbox" /><span
              >Available works</span
            ></label
          >
          <button
            v-if="hasFilters"
            type="button"
            class="collection-reset"
            @click="clearFilters"
          >
            Reset
          </button>
        </div>
        <p
          ref="resultCount"
          class="collection-result-count"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ visibleArtworks.length }}
          {{ visibleArtworks.length === 1 ? "work" : "works" }}
        </p>
      </div>
      <div v-if="visibleArtworks.length" class="artwork-masonry">
        <ArtworkCard
          v-for="(artwork, index) in visibleArtworks"
          :key="artwork.id"
          :artwork="artwork"
          :priority="index < 2"
        />
      </div>
      <div v-else class="collection-empty">
        <p class="eyebrow">A different perspective</p>
        <h2>No works found.</h2>
        <p>Try another word or open up your filters.</p>
        <button type="button" class="underlined-link" @click="clearFilters">
          View all artworks
        </button>
      </div>
    </section>
    <section class="collection-closing page-gutter" aria-label="Exhibitions">
      <p>Some encounters happen in person.</p>
      <NuxtLink to="/exhibitions" class="underlined-link"
        >Step into the exhibitions</NuxtLink
      >
    </section>
    <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
  </main>
</template>
