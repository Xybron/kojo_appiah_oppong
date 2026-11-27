<script setup lang="ts">
import { formatPrice } from "~/data/artworks";
import "~/assets/css/artwork-detail.css";

type OrderStatus = "creating" | "pending" | "paid" | "expired" | "review";
interface VerifiedOrder {
  reference: string;
  status: OrderStatus;
  artworkId: string;
  artworkTitle: string;
  variantId: string;
  frameId: string;
  amountMinor: number;
  currency: string;
  fulfilment: "studio_collection";
  createdAt: string;
}
const route = useRoute();
const config = useRuntimeConfig();
const reference = computed(() =>
  typeof route.query.reference === "string" ? route.query.reference : "",
);
const order = ref<VerifiedOrder | null>(null);
const checking = ref(true);
const message = ref("");
const missingSession = ref(false);
let controller: AbortController | undefined;
const heading = computed(() => {
  if (checking.value) return "Confirming your order.";
  if (order.value?.status === "paid") return "A new place for this work.";
  if (order.value?.status === "expired") return "This checkout has expired.";
  if (order.value?.status === "review") return "A moment for a closer look.";
  if (order.value) return "Your order is being confirmed.";
  return "Let’s confirm your order.";
});
const stateCopy = computed(() => {
  if (checking.value)
    return "Checking the studio’s payment record for your selection.";
  if (message.value) return message.value;
  if (order.value?.status === "paid")
    return "Payment confirmed. Your artwork order is recorded for studio collection.";
  if (order.value?.status === "expired")
    return "This checkout is no longer active. You can return to the artwork to begin a new order.";
  if (order.value?.status === "review")
    return "The studio needs to review this order before confirming it. Keep your reference and contact the studio; please don’t make another payment for this order.";
  if (order.value)
    return "We haven’t received a final payment confirmation yet. You can check again here. Please keep this page and your order reference.";
  return message.value;
});
const retryAvailable = computed(
  () =>
    !checking.value &&
    !missingSession.value &&
    order.value?.status !== "paid" &&
    order.value?.status !== "expired",
);

async function verify() {
  if (checking.value && controller) return;
  checking.value = true;
  message.value = "";
  missingSession.value = false;
  if (!reference.value || reference.value.length > 200) {
    message.value =
      "This page needs an order reference. Return using the link from your checkout session.";
    missingSession.value = true;
    checking.value = false;
    return;
  }
  let token = "";
  try {
    token = sessionStorage.getItem(`kojo:checkout:${reference.value}`) || "";
  } catch {
    /* Handled as a missing checkout session below. */
  }
  if (!token) {
    message.value =
      "We can’t verify this order in this tab. Reopen it in the browser tab you used for checkout, or contact the studio with your order reference. This page does not confirm payment.";
    missingSession.value = true;
    checking.value = false;
    return;
  }
  if (!config.public.commerceApiBaseUrl) {
    message.value =
      "Order verification is temporarily unavailable. Keep your reference and contact the studio before making another payment.";
    checking.value = false;
    return;
  }
  controller = new AbortController();
  try {
    const base = String(config.public.commerceApiBaseUrl).replace(/\/$/, "");
    const result = await $fetch<VerifiedOrder>(
      `${base}/api/v1/checkout/${encodeURIComponent(reference.value)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        timeout: 15000,
        retry: 0,
      },
    );
    if (
      result.reference !== reference.value ||
      !["creating", "pending", "paid", "expired", "review"].includes(
        result.status,
      ) ||
      !Number.isSafeInteger(result.amountMinor) ||
      result.amountMinor < 0 ||
      result.currency !== "GHS" ||
      result.fulfilment !== "studio_collection"
    )
      throw new Error("Invalid order response");
    order.value = result;
  } catch {
    message.value =
      "We couldn’t check the payment record just now. Please try again or contact the studio with your reference. A return from checkout alone does not confirm payment.";
  } finally {
    checking.value = false;
    controller = undefined;
  }
}
onMounted(() => void verify());
onBeforeUnmount(() => controller?.abort());
useSeoMeta({
  title: "Your artwork order — Kojo Appiah Oppong",
  robots: "noindex, nofollow",
});
</script>

<template>
  <main id="main" class="checkout-return-page page-gutter" tabindex="-1">
    <p class="eyebrow">Your artwork order</p>
    <h1>{{ heading }}</h1>
    <div class="checkout-return-state" role="status" :aria-busy="checking">
      <p>{{ stateCopy }}</p>
      <p
        v-if="
          route.query.cancelled === '1' &&
          !checking &&
          order &&
          order.status !== 'paid'
        "
        class="checkout-return-secondary"
      >
        You returned from the payment page. The status above reflects the
        studio’s record.
      </p>
    </div>
    <dl v-if="reference" class="checkout-return-facts">
      <div>
        <dt>Order reference</dt>
        <dd>{{ reference }}</dd>
      </div>
      <template v-if="order">
        <div>
          <dt>Artwork</dt>
          <dd>{{ order.artworkTitle }}</dd>
        </div>
        <div>
          <dt>
            {{ order.status === "paid" ? "Amount paid" : "Order amount" }}
          </dt>
          <dd>{{ formatPrice(order.amountMinor / 100, order.currency) }}</dd>
        </div>
        <div>
          <dt>Fulfilment</dt>
          <dd>Studio collection</dd>
        </div>
      </template>
    </dl>
    <div class="checkout-return-actions">
      <button
        v-if="retryAvailable"
        class="art-primary-button"
        type="button"
        @click="verify"
      >
        Check payment status
      </button>
      <NuxtLink
        v-if="order"
        :to="`/artworks/${order.artworkId}`"
        class="underlined-link"
        >Return to the artwork</NuxtLink
      >
      <NuxtLink v-else to="/artworks" class="underlined-link"
        >Explore the collection</NuxtLink
      >
      <NuxtLink to="/#contact" class="underlined-link"
        >Contact the studio</NuxtLink
      >
    </div>
  </main>
</template>
