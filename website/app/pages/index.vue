<script setup lang="ts">
import { getArtwork } from "~/data/artworks";
const {
  studies,
  usingDemo,
  loading: portfolioLoading,
  error: portfolioError,
  load: reloadPortfolio,
} = usePublicPortfolio();
const heroStudy = computed(() => studies.value[0]);

const config = useRuntimeConfig();
// The opening portrait has its own moment; Selected Work introduces new images.
// Keep the managed portfolio authoritative when its API is configured.
const selectedStudies = computed(() => {
  const remaining = studies.value.filter(
    (work) => work.id !== heroStudy.value?.id,
  );
  if (!usingDemo.value) return remaining;
  const opening = getArtwork("the-shape-of-silence");
  return opening ? [opening, ...remaining] : remaining;
});
const viewerStudies = computed(() =>
  heroStudy.value
    ? [heroStudy.value, ...selectedStudies.value]
    : selectedStudies.value,
);
const root = ref<HTMLElement | null>(null);
const viewer = ref<{ open: (id: string) => void } | null>(null);
const enquiry = ref<{ open: () => void } | null>(null);
const { paused } = useMotionPreference();
const demoMode =
  config.public.demoMode !== false &&
  String(config.public.demoMode) !== "false";
const description =
  "Step into the visual world of Kojo Appiah Oppong. Photography and fine art, exploring presence, form, and the beauty of simplicity.";

useSeoMeta({
  title: "Kojo Appiah Oppong — The Living Exhibition",
  description,
  ogTitle: "Kojo Appiah Oppong — The Living Exhibition",
  ogDescription: description,
  ogType: "website",
  ogImage: `${config.public.siteUrl}/images/hero-1600.jpg`,
  twitterCard: "summary_large_image",
  robots: demoMode ? "noindex, nofollow" : "index, follow",
});
useHead({
  link: [{ rel: "canonical", href: `${config.public.siteUrl}/` }],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: "Kojo Appiah Oppong",
        url: `${config.public.siteUrl}/`,
        mainEntity: {
          "@type": "Person",
          name: "Kojo Appiah Oppong",
          jobTitle: "Photographer and visual artist",
        },
      }),
    },
  ],
});
useExhibitionMotion(root, paused);
</script>

<template>
  <div
    id="top"
    ref="root"
    class="exhibition-site"
    :class="{ 'motion-paused': paused }"
  >
    <main id="main" tabindex="-1">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-image">
          <ArtImage
            v-if="heroStudy"
            :image="heroStudy.image"
            :alt="heroStudy.alt"
            :width="heroStudy.width"
            :height="heroStudy.height"
            sizes="100vw"
            position="63% 46%"
            priority
          />
        </div>
        <div class="hero-shade" aria-hidden="true"></div>
        <div class="hero-content page-gutter">
          <p class="hero-overline eyebrow">
            <span class="live-dot" aria-hidden="true"></span>The living
            exhibition
          </p>
          <ArtHeading
            id="hero-title"
            tag="h1"
            class="hero-title"
            text="Look closer."
            :break-before="1"
          />
          <p class="hero-byline">The world, through<br />Kojo Appiah Oppong.</p>
        </div>
        <div class="hero-edge-note" aria-hidden="true">
          A STUDY OF PRESENCE / 001
        </div>
        <div class="hero-footer page-gutter">
          <p>Photography.<br />A feeling, held in a frame.</p>
          <a class="scroll-cue" href="#work"
            ><span>Enter the exhibition</span
            ><span class="scroll-line" aria-hidden="true">↓</span></a
          >
          <a
            v-if="heroStudy"
            class="hero-art-link"
            :href="portfolioImageSource(heroStudy.image)"
            @click.prevent="viewer?.open(heroStudy.id)"
            >{{ heroStudy.title }} <span aria-hidden="true">↗</span></a
          >
        </div>
      </section>

      <div class="interlude page-gutter">
        <span class="interlude-mark" aria-hidden="true">↳</span>
        <p data-reveal>
          It begins with attention.<br />To a gesture. To the light.<br /><span
            >To what might otherwise pass us by.</span
          >
        </p>
        <p class="interlude-index">FOUR DISCIPLINES<br />ONE WAY OF SEEING</p>
      </div>

      <ExhibitionGallery
        :studies="selectedStudies"
        :loading="portfolioLoading"
        :error="portfolioError"
        @open="viewer?.open($event)"
        @retry="reloadPortfolio"
      />

      <div class="collection-bridge page-gutter">
        <p>Find a work to live with.</p>
        <NuxtLink to="/artworks" class="underlined-link"
          >Explore the collection <span aria-hidden="true">↗</span></NuxtLink
        >
      </div>

      <ArtworkJourney />

      <section
        id="artist"
        class="principle-section page-gutter"
        aria-labelledby="artist-title"
      >
        <div class="principle-heading">
          <p class="eyebrow">02 — The eye behind the image</p>
          <ArtHeading
            id="artist-title"
            text="Simplicity is perfection."
            :break-before="2"
          />
        </div>
        <figure class="principle-image">
          <ArtImage
            image="paper"
            alt="Raking light catches the curled cotton-paper edge of a photographic print on a wooden table."
            :width="1536"
            :height="1024"
            sizes="(max-width: 700px) 100vw, 55vw"
            position="47% 50%"
          />
          <figcaption>
            <span>Light. Texture. Intention.</span
            ><span aria-hidden="true">KAO.</span>
          </figcaption>
        </figure>
        <div class="principle-copy" data-reveal>
          <p class="artist-signature">Kojo Appiah Oppong</p>
          <p>
            Fine art, architecture, fashion, advertising. Kojo's practice moves
            between these worlds, guided by one belief: simplicity is
            perfection.
          </p>
          <p>
            A face, a surface, a space. Each offers a reason to slow down. To
            notice the essential. To let an image speak.
          </p>
          <a href="#exhibitions" class="underlined-link"
            >Beyond the frame <span aria-hidden="true">↘</span></a
          >
        </div>
      </section>

      <section
        id="exhibitions"
        class="exhibition-section"
        aria-labelledby="exhibition-title"
      >
        <div class="exhibition-scene">
          <div class="exhibition-photo">
            <ArtImage
              image="exhibition"
              alt="Three rust-coloured landscape prints hang in a sunlit gallery, with a timber bench facing the work."
              :width="1672"
              :height="941"
              sizes="100vw"
              position="57% 50%"
            />
          </div>
          <div class="exhibition-shade" aria-hidden="true"></div>
          <p class="eyebrow exhibition-overline">03 — In the room</p>
          <div class="exhibition-title-wrap page-gutter">
            <ArtHeading
              id="exhibition-title"
              text="Some things need to be felt."
              :break-before="2"
            />
            <span class="exhibition-marker" aria-hidden="true"
              >THE PHYSICAL<br />ENCOUNTER</span
            >
          </div>
        </div>
        <div class="exhibition-after page-gutter">
          <p class="exhibition-thought" data-reveal>
            An image can hold your attention.<br /><em>A room can hold you.</em>
          </p>
          <div class="exhibition-copy" data-reveal>
            <p>
              The scale of a work. The texture of its surface. The distance you
              choose to stand from it. Fine art takes on another life in person.
            </p>
            <p>
              For exhibitions, private viewings, and conversations around the
              work.
            </p>
            <NuxtLink class="underlined-link" to="/exhibitions"
              >Explore exhibitions <span aria-hidden="true">↗</span></NuxtLink
            >
          </div>
        </div>
      </section>

      <section
        id="contact"
        class="contact-section page-gutter"
        aria-labelledby="contact-title"
      >
        <p class="eyebrow">The next story starts with a conversation</p>
        <ArtHeading
          id="contact-title"
          text="What could we see together?"
          :break-before="2"
        />
        <div class="contact-bottom">
          <p>Commissions. Collaborations.<br />A different way of looking.</p>
          <button class="contact-link" type="button" @click="enquiry?.open()">
            Start a conversation <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
    </main>

    <StudyViewer ref="viewer" :studies="viewerStudies" />
    <EnquiryDialog ref="enquiry" />
  </div>
</template>
