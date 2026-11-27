<script setup lang="ts">
import { formatPrice, type Artwork } from "~/data/artworks";
import "~/assets/css/collection.css";

const props = withDefaults(
  defineProps<{ artwork: Artwork; priority?: boolean }>(),
  { priority: false },
);
const emit = defineEmits<{ savedChange: [saved: boolean] }>();
const fromPrice = computed(() => {
  const prices = props.artwork.variants.map((variant) => variant.price);
  return prices.length ? Math.min(...prices) : undefined;
});
</script>

<template>
  <article class="artwork-card" :aria-labelledby="`card-title-${artwork.id}`">
    <div class="artwork-card-media">
      <NuxtLink
        :to="`/artworks/${artwork.id}`"
        class="artwork-card-image"
        :aria-label="`View ${artwork.title}`"
        data-cursor="View"
      >
        <ArtImage
          :image="artwork.image"
          :alt="artwork.alt"
          :width="artwork.width"
          :height="artwork.height"
          :position="artwork.position"
          sizes="(max-width: 600px) 47vw, (max-width: 1000px) 46vw, (max-width: 1500px) 30vw, 23vw"
          :priority="priority"
        />
      </NuxtLink>
      <SaveArtworkButton
        :artwork-id="artwork.id"
        compact
        @changed="emit('savedChange', $event)"
      />
      <span v-if="artwork.status === 'sold'" class="artwork-card-status"
        >Sold</span
      >
    </div>
    <div class="artwork-card-caption">
      <div class="artwork-card-category">
        <span>{{ artwork.discipline }}</span
        ><span>{{ artwork.kind }}</span>
      </div>
      <h2 :id="`card-title-${artwork.id}`">
        <NuxtLink :to="`/artworks/${artwork.id}`">{{ artwork.title }}</NuxtLink>
      </h2>
      <div class="artwork-card-purchase">
        <span v-if="artwork.status === 'sold'">No longer available</span>
        <span v-else-if="artwork.purchaseMode === 'enquiry'"
          >Enquire about this work</span
        >
        <span v-else-if="fromPrice !== undefined"
          >{{ artwork.variants.length > 1 ? "From " : ""
          }}{{ formatPrice(fromPrice, artwork.currency) }}</span
        >
        <span v-else>Explore this work</span>
      </div>
    </div>
  </article>
</template>
