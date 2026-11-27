<script setup lang="ts">
import { formatPrice, type Artwork } from "~/data/artworks";
import { keepDialogFocus } from "~/utils/dialog";

const props = defineProps<{
  artwork: Artwork;
  variant: Artwork["variants"][number];
  frame: Artwork["framing"][number];
}>();
const config = useRuntimeConfig();
const dialog = ref<HTMLDialogElement | null>(null);
const name = ref("");
const email = ref("");
const message = ref("");
const status = ref("");
const busy = ref(false);
const prepared = ref("");
const output = ref<HTMLTextAreaElement | null>(null);
let attempt: { fingerprint: string; key: string } | undefined;

async function getAttemptKey() {
  const selection = JSON.stringify({
    artartworkId: props.artwork.id,
    variantId: props.variant.id,
    frameId: props.frame.id,
    name: name.value.trim(),
    email: email.value.trim().toLowerCase(),
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(selection),
  );
  const fingerprint = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (attempt?.fingerprint === fingerprint) return attempt.key;
  const storageKey = `kojo:checkout-attempt:${props.artwork.id}`;
  try {
    const previous = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (
      previous?.fingerprint === fingerprint &&
      typeof previous.key === "string" &&
      /^[0-9a-f-]{36}$/i.test(previous.key)
    ) {
      attempt = { fingerprint, key: previous.key };
      return previous.key as string;
    }
  } catch {
    /* A new attempt can still be created when optional storage fails. */
  }
  attempt = { fingerprint, key: crypto.randomUUID() };
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(attempt));
  } catch {
    /* Retry within this view reuses the in-memory key. */
  }
  return attempt.key;
}
let previousFocus: HTMLElement | null = null;
const purchaseAvailable = computed(
  () =>
    props.artwork.purchaseMode === "purchase" &&
    String(config.public.commerceEnabled) === "true" &&
    !!config.public.commerceApiBaseUrl,
);
const subtotal = computed(() => props.variant.price + props.frame.price);

function open() {
  if (props.artwork.status === "sold" || dialog.value?.open) return;
  previousFocus = document.activeElement as HTMLElement;
  status.value = "";
  prepared.value = "";
  dialog.value?.showModal();
  document.documentElement.classList.add("dialog-open");
  window.dispatchEvent(new CustomEvent("exhibition:dialog", { detail: true }));
}
function close() {
  if (!busy.value) dialog.value?.close();
}
function afterClose() {
  document.documentElement.classList.remove("dialog-open");
  window.dispatchEvent(new CustomEvent("exhibition:dialog", { detail: false }));
  previousFocus?.focus({ preventScroll: true });
}
async function submit() {
  if (busy.value) return;
  status.value = "";
  if (purchaseAvailable.value) {
    busy.value = true;
    try {
      const base = String(config.public.commerceApiBaseUrl).replace(/\/$/, "");
      const idempotencyKey = await getAttemptKey();
      const response = await $fetch<{
        checkoutUrl: string;
        reference: string;
        orderToken: string;
      }>(`${base}/api/v1/checkout`, {
        method: "POST",
        timeout: 15000,
        body: {
          artworkId: props.artwork.id,
          variantId: props.variant.id,
          frameId: props.frame.id,
          idempotencyKey,
          customer: {
            name: name.value.trim(),
            email: email.value.trim().toLowerCase(),
          },
        },
      });
      const destination = new URL(response.checkoutUrl);
      if (
        destination.protocol !== "https:" ||
        !["checkout.bachs.io", "sandbox-checkout.bachs.io"].includes(
          destination.hostname,
        ) ||
        destination.username ||
        destination.password ||
        destination.port ||
        typeof response.reference !== "string" ||
        !response.reference ||
        typeof response.orderToken !== "string" ||
        !response.orderToken
      )
        throw new Error("Invalid checkout destination");
      try {
        sessionStorage.setItem(
          `kojo:checkout:${response.reference}`,
          response.orderToken,
        );
      } catch {
        status.value =
          "This browser couldn’t keep your checkout session. Allow site storage or use another browser before continuing.";
        busy.value = false;
        return;
      }
      window.location.assign(destination.toString());
    } catch {
      status.value =
        "We couldn’t open checkout. Your selection is still here; please try again.";
      busy.value = false;
    }
    return;
  }
  prepared.value = `Hello Kojo,\n\nI would like to ${props.artwork.purchaseMode === "enquiry" ? "enquire about" : "order"} “${props.artwork.title}”.\n\n${props.artwork.kind} · ${props.artwork.medium}\nArtwork: ${props.variant.widthCm} × ${props.variant.heightCm} cm\nFraming: ${props.frame.label}\n${props.artwork.purchaseMode === "purchase" ? `Artwork and frame: ${formatPrice(subtotal.value, props.artwork.currency)}\n` : ""}\n${message.value.trim()}\n\nPlease confirm availability and delivery arrangements.\n\n${name.value.trim()}\n${email.value.trim()}`;
  if (config.public.contactEmail) {
    window.location.href = `mailto:${encodeURIComponent(String(config.public.contactEmail))}?subject=${encodeURIComponent(`Artwork enquiry: ${props.artwork.title}`)}&body=${encodeURIComponent(prepared.value)}`;
    status.value =
      "Your enquiry is ready in your email app. Send it there to start the conversation.";
    return;
  }
  try {
    await navigator.clipboard.writeText(prepared.value);
    status.value =
      "Your artwork enquiry is copied and ready to share. Nothing has been sent or reserved.";
  } catch {
    status.value = "Your enquiry is ready below. Copy it to share with Kojo.";
    await nextTick();
    output.value?.focus();
    output.value?.select();
  }
}
onBeforeUnmount(() => {
  if (dialog.value?.open) {
    document.documentElement.classList.remove("dialog-open");
    window.dispatchEvent(
      new CustomEvent("exhibition:dialog", { detail: false }),
    );
  }
});
defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="art-order-dialog"
    aria-labelledby="order-title"
    aria-describedby="order-intro"
    data-lenis-prevent
    @close="afterClose"
    @keydown="keepDialogFocus"
    @cancel="busy && $event.preventDefault()"
    @click="$event.target === dialog && close()"
  >
    <div class="art-order-shell">
      <div class="art-order-top">
        <p class="eyebrow">
          {{
            purchaseAvailable ? "Your selection" : "An artwork for your space"
          }}
        </p>
        <button
          class="text-button"
          type="button"
          :disabled="busy"
          autofocus
          @click="close"
        >
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
      <h2 id="order-title">
        {{ purchaseAvailable ? "Make it yours." : "A closer conversation." }}
      </h2>
      <p id="order-intro">
        {{
          purchaseAvailable
            ? "Review your artwork before continuing to secure payment."
            : "Prepare your selection to share with Kojo. Availability and delivery can be confirmed together."
        }}
      </p>
      <div class="art-order-summary">
        <ArtImage
          :image="artwork.image"
          :alt="artwork.alt"
          :width="artwork.width"
          :height="artwork.height"
          sizes="120px"
        />
        <div>
          <h3>{{ artwork.title }}</h3>
          <p>
            {{ artwork.kind }} · {{ variant.widthCm }} ×
            {{ variant.heightCm }} cm
          </p>
          <p>{{ frame.label }}</p>
          <strong v-if="artwork.purchaseMode === 'purchase'">{{
            formatPrice(subtotal, artwork.currency)
          }}</strong>
          <p v-else>Price on enquiry</p>
        </div>
      </div>
      <p v-if="purchaseAvailable" class="art-order-delivery">
        This order is for studio collection. For delivery, please enquire before
        purchasing.
      </p>
      <form @submit.prevent="submit">
        <div class="art-order-fields">
          <label
            >Your name<input
              v-model="name"
              name="name"
              autocomplete="name"
              required
              maxlength="120"
              :disabled="busy" /></label
          ><label
            >Email address<input
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              maxlength="200"
              :disabled="busy"
          /></label>
        </div>
        <label v-if="!purchaseAvailable"
          >Anything you’d like to know?
          <span class="field-optional">Optional</span
          ><textarea
            v-model="message"
            name="message"
            rows="3"
            maxlength="2000"
          />
        </label>
        <button class="art-primary-button" type="submit" :disabled="busy">
          {{
            busy
              ? "Opening checkout…"
              : purchaseAvailable
                ? "Continue to payment"
                : config.public.contactEmail
                  ? "Continue in email"
                  : "Copy artwork enquiry"
          }}
        </button>
        <p class="art-order-status" role="status">{{ status }}</p>
        <label v-if="prepared && status.includes('below')"
          >Your enquiry<textarea
            ref="output"
            :value="prepared"
            readonly
            rows="7"
          />
        </label>
      </form>
    </div>
  </dialog>
</template>
