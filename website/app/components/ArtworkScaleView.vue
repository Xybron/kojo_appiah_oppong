<script setup lang="ts">
import type { Artwork } from "~/data/artworks";

const props = defineProps<{
  artwork: Artwork;
  variant: Artwork["variants"][number];
  frame: Artwork["framing"][number];
  unit: "cm" | "in";
}>();
const wallWidth = 300;
const wallHeight = 220;
const outerWidth = computed(
  () => props.variant.widthCm + props.frame.borderCm * 2,
);
const outerHeight = computed(
  () => props.variant.heightCm + props.frame.borderCm * 2,
);
const sizeLabel = (cm: number) =>
  props.unit === "cm"
    ? `${Number(cm.toFixed(1))} cm`
    : `${Number((cm / 2.54).toFixed(1))} in`;
const frameStyle = computed(() => ({
  width: `${(outerWidth.value / wallWidth) * 100}%`,
  aspectRatio: `${outerWidth.value} / ${outerHeight.value}`,
}));
const printStyle = computed(() => ({
  // CSS percentage padding on every side is relative to the containing block's
  // width. The frame fills scale-work, so border / outerWidth gives equal,
  // physically proportional borders horizontally and vertically.
  padding: `${(props.frame.borderCm / outerWidth.value) * 100}%`,
}));
</script>

<template>
  <div class="art-scale-view">
    <div
      class="scale-wall"
      role="img"
      :aria-label="`${artwork.title} at scale on a ${sizeLabel(wallWidth)} wide wall. ${frame.label}. Artwork ${sizeLabel(variant.widthCm)} wide by ${sizeLabel(variant.heightCm)} high. Outer dimensions ${sizeLabel(outerWidth)} by ${sizeLabel(outerHeight)}.`"
      :style="{ aspectRatio: `${wallWidth} / ${wallHeight}` }"
    >
      <span class="scale-wall-title" aria-hidden="true"
        >A room to imagine it in</span
      >
      <div class="scale-work" :style="frameStyle" aria-hidden="true">
        <span class="scale-width-dimension"
          ><span>{{ sizeLabel(outerWidth) }}</span></span
        >
        <span class="scale-height-dimension"
          ><span>{{ sizeLabel(outerHeight) }}</span></span
        >
        <div
          class="scale-frame"
          :class="{
            'is-unframed': frame.borderCm === 0,
            'is-oak': frame.id === 'oak',
            'is-black': frame.id === 'black',
          }"
          :style="printStyle"
        >
          <img
            :src="`/images/${artwork.image}-960.webp`"
            alt=""
            :width="artwork.width"
            :height="artwork.height"
          />
        </div>
      </div>
      <div class="scale-floor" aria-hidden="true"></div>
      <span class="scale-wall-width" aria-hidden="true"
        ><span>{{ sizeLabel(wallWidth) }} wall</span></span
      >
    </div>
    <div class="scale-measurements">
      <div>
        <span>Artwork</span
        ><strong
          >{{ sizeLabel(variant.widthCm) }} ×
          {{ sizeLabel(variant.heightCm) }}</strong
        >
      </div>
      <div>
        <span>{{ frame.borderCm > 0 ? "Including frame" : "Unframed" }}</span
        ><strong
          >{{ sizeLabel(outerWidth) }} × {{ sizeLabel(outerHeight) }}</strong
        >
      </div>
      <div v-if="frame.depthCm > 0">
        <span>{{ frame.borderCm > 0 ? "Frame depth" : "Depth" }}</span
        ><strong>{{ sizeLabel(frame.depthCm) }}</strong>
      </div>
    </div>
    <p class="scale-caption">
      Proportional to a measured wall. Use the dimensions above to check your
      space; screen size does not represent physical size.
    </p>
  </div>
</template>
