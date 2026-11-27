<script setup lang="ts">
import { getEvent, eventDateLabel, eventTimeLabel } from "~/data/events";
import { getArtwork } from "~/data/artworks";
import {
  createCalendarFile,
  createGoogleCalendarUrl,
  hasCalendarDates,
  type CalendarEvent,
} from "~/utils/calendar";
import "~/assets/css/events.css";
import "~/assets/css/collection.css";

const route = useRoute();
const config = useRuntimeConfig();
const event = computed(() => getEvent(String(route.params.slug)));
if (!event.value)
  throw createError({ statusCode: 404, statusMessage: "Exhibition not found" });
const enquiry = ref<{ open: (context?: string) => void } | null>(null);
const calendarStatus = ref("");
const relatedWorks = computed(() =>
  event.value!.artworkIds.map(getArtwork).filter((work) => work !== undefined),
);
const canAddCalendar = computed(
  () => event.value!.status !== "past" && hasCalendarDates(event.value!),
);
const calendarEvent = computed<CalendarEvent | null>(() =>
  canAddCalendar.value
    ? {
        id: event.value!.id,
        title: `${event.value!.title} — Kojo Appiah Oppong`,
        startsAt: event.value!.startsAt!,
        endsAt: event.value!.endsAt!,
        description: event.value!.description,
        location: [event.value!.venue, event.value!.address]
          .filter(Boolean)
          .join(", "),
        url: `${config.public.siteUrl}/exhibitions/${event.value!.id}`,
        timeZone: event.value!.timeZone,
      }
    : null,
);
const googleCalendarUrl = computed(() =>
  calendarEvent.value ? createGoogleCalendarUrl(calendarEvent.value) : "",
);

function downloadCalendar() {
  if (!calendarEvent.value) return;
  try {
    const content = createCalendarFile(calendarEvent.value);
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.value!.id}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    calendarStatus.value =
      "Calendar file downloaded. Open it in your calendar to add the event.";
  } catch {
    calendarStatus.value =
      "The calendar file could not be prepared. Please try again.";
  }
}

useSeoMeta({
  title: () => `${event.value!.title} — Exhibitions — Kojo Appiah Oppong`,
  description: () => event.value!.description,
  ogTitle: () => `${event.value!.title} — Kojo Appiah Oppong`,
  ogDescription: () => event.value!.description,
  ogImage: () =>
    `${config.public.siteUrl}/images/${event.value!.image}-1600.jpg`,
});
useHead(() => ({
  link: [
    {
      rel: "canonical",
      href: `${config.public.siteUrl}/exhibitions/${event.value!.id}`,
    },
  ],
}));
</script>

<template>
  <main id="main" class="event-detail-page" tabindex="-1">
    <template v-if="event">
      <section class="event-detail-hero" aria-labelledby="event-title">
        <ArtImage
          :image="event.image"
          :alt="event.alt"
          :width="event.width"
          :height="event.height"
          :position="event.position"
          sizes="100vw"
          priority
        />
        <div class="event-detail-shade" aria-hidden="true"></div>
        <NuxtLink class="event-back-link" to="/exhibitions"
          >All exhibitions</NuxtLink
        >
        <div class="event-detail-hero-copy page-gutter">
          <p class="eyebrow">
            {{ event.status === "past" ? "From the archive" : event.type }}
          </p>
          <ArtHeading id="event-title" tag="h1" :text="event.title" />
          <p>{{ event.subtitle }}</p>
          <div class="event-hero-date">
            <span>{{ eventDateLabel(event) }}</span
            ><span>{{ event.address || "Location to be announced" }}</span>
          </div>
        </div>
      </section>

      <section
        class="event-story-grid page-gutter"
        aria-labelledby="event-story-title"
      >
        <div class="event-story">
          <p class="eyebrow">An invitation to look</p>
          <h2 id="event-story-title">{{ event.description }}</h2>
          <p v-for="paragraph in event.story" :key="paragraph">
            {{ paragraph }}
          </p>
        </div>
        <aside class="event-visit" aria-labelledby="event-visit-title">
          <p class="eyebrow">
            {{ event.status === "past" ? "The encounter" : "Plan your visit" }}
          </p>
          <h2 id="event-visit-title">
            {{ event.status === "past" ? "A moment, held." : "Meet the work." }}
          </h2>
          <dl>
            <div>
              <dt>When</dt>
              <dd>
                {{ eventDateLabel(event)
                }}<span>{{ eventTimeLabel(event) }}</span>
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>
                {{ event.venue || "Venue to be announced"
                }}<span v-if="event.address">{{ event.address }}</span>
              </dd>
            </div>
            <div>
              <dt>Visiting</dt>
              <dd>
                {{ event.admission || "Visiting details to be announced" }}
              </dd>
            </div>
          </dl>
          <template v-if="canAddCalendar">
            <button
              class="event-calendar-button"
              type="button"
              @click="downloadCalendar"
            >
              Add to calendar <span aria-hidden="true">+</span>
            </button>
            <a
              :href="googleCalendarUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="event-google-calendar"
              >Open in Google Calendar
              <span class="sr-only">(opens a new tab)</span></a
            >
            <p class="event-calendar-status" role="status">
              {{ calendarStatus }}
            </p>
          </template>
          <p v-else-if="event.status !== 'past'" class="event-visit-note">
            Calendar invitations will open when the dates are confirmed.
          </p>
          <p v-if="event.accessNote" class="event-visit-note">
            {{ event.accessNote }}
          </p>
          <button
            v-if="event.status !== 'past'"
            type="button"
            class="underlined-link"
            @click="enquiry?.open(`Visiting ${event.title}`)"
          >
            Enquire about visiting <span aria-hidden="true">↗</span>
          </button>
          <NuxtLink v-else to="/exhibitions" class="underlined-link"
            >Discover upcoming encounters
            <span aria-hidden="true">↗</span></NuxtLink
          >
        </aside>
      </section>

      <section
        v-if="relatedWorks.length"
        class="event-related page-gutter"
        aria-labelledby="event-related-title"
      >
        <div class="event-related-heading">
          <div>
            <p class="eyebrow">A closer conversation</p>
            <h2 id="event-related-title">The works in the room.</h2>
          </div>
          <NuxtLink to="/artworks" class="underlined-link"
            >All artworks <span aria-hidden="true">↗</span></NuxtLink
          >
        </div>
        <p class="event-related-intro">
          Begin here. Save the pieces that speak to you, or explore their
          stories and scale.
        </p>
        <div class="event-related-grid">
          <ArtworkCard
            v-for="artwork in relatedWorks"
            :key="artwork.id"
            :artwork="artwork"
          />
        </div>
      </section>
      <EnquiryDialog ref="enquiry" />
    </template>
  </main>
</template>
