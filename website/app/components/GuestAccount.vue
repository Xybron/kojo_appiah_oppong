<script setup lang="ts">
import "~/assets/css/guest-account.css";

const emit = defineEmits<{ opened: [] }>();
const route = useRoute();
const auth = useStudioAuth();
const guest = useGuestIdentity();
const saved = useSavedWorks();
const disclosure = ref<HTMLDetailsElement | null>(null);
const trigger = ref<HTMLElement | null>(null);
const avatar = ref("");
const imageFailed = ref(false);
const accountPath = computed(() => auth.user.value ? auth.home.value : "/login");
const accountLabel = computed(() => auth.user.value ? "My account" : "Sign in");
const identityLabel = computed(() => auth.user.value?.firstName || (auth.user.value ? "Your account" : "Guest"));
const storageLabel = computed(() => {
  if (!guest.loaded.value || !saved.loaded.value) return "Your collection, close at hand.";
  return guest.persistent.value && saved.persistent.value ? "Saved on this device" : "Saved for this visit";
});

function close(restoreFocus = false) {
  if (!disclosure.value?.open) return;
  disclosure.value.open = false;
  if (restoreFocus) trigger.value?.focus();
}
function toggle() {
  if (disclosure.value?.open) emit("opened");
}
function leave(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && !disclosure.value?.contains(event.relatedTarget)) close();
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !disclosure.value?.contains(event.target)) close();
}

// Load only the selected, pinned style. No guest or account data leaves the device.
watch(guest.id, async (seed) => {
  avatar.value = "";
  imageFailed.value = false;
  if (!seed || !import.meta.client) return;
  try {
    const [{ Avatar, Style }, { default: constellation }] = await Promise.all([
      import("@dicebear/core"),
      import("@dicebear/styles/constellation.json"),
    ]);
    if (guest.id.value !== seed) return;
    avatar.value = new Avatar(new Style(constellation), { seed }).toDataUri();
  } catch {
    // The account remains usable if avatar rendering is unavailable.
    avatar.value = "";
  }
}, { immediate: true });

watch(() => route.fullPath, () => close());
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
defineExpose({ close });
</script>

<template>
  <details ref="disclosure" class="guest-account" @toggle="toggle" @keydown.esc.stop.prevent="close(true)" @focusout="leave">
    <summary ref="trigger" class="guest-account-trigger" :aria-label="auth.user.value ? 'Your account' : 'Guest account'">
      <span class="guest-avatar" aria-hidden="true">
        <img v-if="avatar && !imageFailed" :src="avatar" width="34" height="34" alt="" decoding="async" @error="imageFailed = true">
        <span v-else class="guest-avatar-placeholder">{{ auth.user.value ? 'K' : 'G' }}</span>
      </span>
    </summary>
    <div class="guest-account-panel" data-lenis-prevent>
      <div class="guest-account-intro">
        <p class="guest-account-eyebrow">{{ auth.user.value ? 'Welcome back' : 'Make yourself at home' }}</p>
        <p class="guest-account-name">{{ identityLabel }}</p>
        <p class="guest-account-note">{{ storageLabel }}</p>
      </div>
      <nav class="guest-account-links" aria-label="Account navigation">
        <NuxtLink to="/saved" @click="close()">
          <span>Saved works</span>
          <span class="guest-account-count" :aria-label="`${saved.count.value} ${saved.count.value === 1 ? 'artwork' : 'artworks'}`">{{ String(saved.count.value).padStart(2, '0') }}</span>
        </NuxtLink>
        <NuxtLink :to="accountPath" @click="close()">
          <span>{{ accountLabel }}</span><span aria-hidden="true">↗</span>
        </NuxtLink>
      </nav>
    </div>
  </details>
</template>
