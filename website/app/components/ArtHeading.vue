<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string;
    tag?: "h1" | "h2" | "h3";
    italic?: string;
    breakBefore?: number;
  }>(),
  { tag: "h2", italic: "", breakBefore: -1 },
);
</script>

<template>
  <component :is="tag" class="art-heading" data-heading>
    <span class="sr-only">{{ text }}</span>
    <span aria-hidden="true" class="heading-visual">
      <template v-for="(word, index) in text.split(' ')" :key="index"
        ><br v-if="index === breakBefore" /><span
          class="word"
          :class="{ italic: italic.includes(word) }"
          >{{ word
          }}{{ index < text.split(" ").length - 1 ? "\u00a0" : "" }}</span
        ></template
      >
    </span>
  </component>
</template>
