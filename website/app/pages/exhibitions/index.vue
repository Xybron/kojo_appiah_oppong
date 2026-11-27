<script setup lang="ts">
import { events, eventDateLabel } from "~/data/events";
import "~/assets/css/events.css";

const config = useRuntimeConfig();
const filter = ref<"upcoming" | "past" | "all">("upcoming");
const shownEvents = computed(() =>
  events.filter(
    (event) =>
      filter.value === "all" ||
      (filter.value === "upcoming"
        ? event.status !== "past"
        : event.status === "past"),
  ),
);
const tabs = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "The archive" },
  { value: "all", label: "All encounters" },
] as const;

useSeoMeta({
  title: "Exhibitions & encounters — Kojo Appiah Oppong",
  description:
    "Meet the work in person. Explore exhibitions, artist encounters, and the photographs that bring them together.",
  ogTitle: "Art is also a place — Kojo Appiah Oppong",
  ogDescription: "Exhibitions, artist encounters, and moments with the work.",
  ogImage: `${config.public.siteUrl}/images/exhibition-1600.jpg`,
});
useHead({
  link: [{ rel: "canonical", href: `${config.public.siteUrl}/exhibitions` }],
});
</script>

<template>
  <main id="main" class="events-page" tabindex="-1">
    <header class="events-intro page-gutter">
      <p class="eyebrow">Exhibitions & encounters</p>
      <ArtHeading tag="h1" text="Art is also a place." :break-before="3" />
      <div class="events-intro-bottom">
        <p>A room. A conversation.<br />A little time with the work.</p>
        <span>IN PERSON / IN THE MOMENT</span>
      </div>
    </header>

    <div class="events-toolbar page-gutter">
      <div class="events-filters" role="group" aria-label="Filter exhibitions">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          :aria-pressed="filter === tab.value"
          @click="filter = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <p role="status" aria-live="polite">
        {{ shownEvents.length }}
        {{ shownEvents.length === 1 ? "encounter" : "encounters" }}
      </p>
    </div>

    <section
      class="events-list page-gutter"
      aria-label="Exhibitions and artist encounters"
    >
      <article v-for="event in shownEvents" :key="event.id" class="event-card">
        <NuxtLink
          :to="`/exhibitions/${event.id}`"
          class="event-card-image"
          data-cursor="Explore"
          :aria-label="`Explore ${event.title}`"
        >
          <ArtImage
            :image="event.image"
            :alt="event.alt"
            :width="event.width"
            :height="event.height"
            :position="event.position"
            sizes="(max-width: 700px) 100vw, 60vw"
          />
          <span class="event-image-label">{{
            event.status === "past"
              ? "From the archive"
              : event.status === "forthcoming"
                ? "Forthcoming"
                : "Coming together"
          }}</span>
        </NuxtLink>
        <div class="event-card-info">
          <p class="event-type">{{ event.type }}</p>
          <h2>
            <NuxtLink :to="`/exhibitions/${event.id}`">{{
              event.title
            }}</NuxtLink>
          </h2>
          <p class="event-card-description">{{ event.description }}</p>
          <div class="event-card-meta">
            <p>{{ eventDateLabel(event) }}</p>
            <p>
              {{
                event.venue
                  ? `${event.venue} · ${event.address}`
                  : "Location to be announced"
              }}
            </p>
          </div>
          <NuxtLink :to="`/exhibitions/${event.id}`" class="underlined-link"
            >{{
              event.status === "past"
                ? "Revisit the exhibition"
                : "Explore the encounter"
            }}<span aria-hidden="true">↗</span></NuxtLink
          >
        </div>
      </article>
      <div v-if="!shownEvents.length" class="events-empty">
        <p>No encounters in this view yet.</p>
        <button type="button" class="underlined-link" @click="filter = 'all'">
          View all encounters
        </button>
      </div>
    </section>

    <section
      class="event-collection-invitation page-gutter"
      aria-labelledby="encounter-collection-title"
    >
      <p class="eyebrow">Stay with an image</p>
      <h2 id="encounter-collection-title">
        Some encounters<br /><em>come home with you.</em>
      </h2>
      <p>
        Discover original works and photographic prints. Save a piece, explore
        its scale, or begin a conversation about making it yours.
      </p>
      <NuxtLink to="/artworks" class="underlined-link"
        >Explore the collection <span aria-hidden="true">↗</span></NuxtLink
      >
    </section>
  </main>
</template>
