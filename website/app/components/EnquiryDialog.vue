<script setup lang="ts">
import { keepDialogFocus } from "~/utils/dialog";
const dialog = ref<HTMLDialogElement | null>(null);
const name = ref("");
const email = ref("");
const interest = ref("A photographic commission");
const message = ref("");
const status = ref("");
const preview = ref("");
const sending = ref(false);
const failed = ref(false);
const website = ref("");
const output = ref<HTMLTextAreaElement | null>(null);
const config = useRuntimeConfig();
const apiBase = computed(() => String(config.public.apiBaseUrl || "").replace(/\/+$/, ""));
let previousFocus: HTMLElement | null = null;

function open(context?: string) {
  if (context) message.value = context;
  if (!sending.value) status.value = "";
  previousFocus = document.activeElement as HTMLElement;
  dialog.value?.showModal();
  document.documentElement.classList.add("dialog-open");
  window.dispatchEvent(new CustomEvent("exhibition:dialog", { detail: true }));
}
function afterClose() {
  document.documentElement.classList.remove("dialog-open");
  window.dispatchEvent(new CustomEvent("exhibition:dialog", { detail: false }));
  previousFocus?.focus({ preventScroll: true });
}
async function prepare() {
  if (sending.value) return;
  status.value = "";
  failed.value = false;
  if (!name.value.trim() || !message.value.trim()) {
    failed.value = true;
    status.value = "Please add your name and a little about your idea.";
    return;
  }
  if (apiBase.value) {
    sending.value = true;
    try {
      await $fetch(`${apiBase.value}/api/v1/enquiries`, {
        method: "POST",
        body: {
          name: name.value.trim(),
          email: email.value.trim(),
          interest: interest.value,
          message: message.value.trim(),
          website: website.value,
        },
        timeout: 15000,
      });
      status.value = "Thank you. Your enquiry has been received by the studio.";
      message.value = "";
      preview.value = "";
    } catch {
      failed.value = true;
      status.value = "We couldn't send your enquiry. Your message is still here; please try again.";
    } finally {
      sending.value = false;
    }
    return;
  }
  preview.value = `Hello Kojo,\n\nI'm interested in ${interest.value.toLowerCase()}.\n\n${message.value}\n\n${name.value}\n${email.value}`;
  if (config.public.contactEmail) {
    window.location.href = `mailto:${encodeURIComponent(config.public.contactEmail)}?subject=${encodeURIComponent(interest.value)}&body=${encodeURIComponent(preview.value)}`;
    status.value =
      "Your enquiry is ready in your email app. Please send it there.";
    return;
  }
  try {
    await navigator.clipboard.writeText(preview.value);
    status.value =
      "Enquiry copied. You can paste it into your conversation with Kojo. Nothing has been sent.";
  } catch {
    status.value =
      "Your enquiry is ready below. Select and copy it to share with Kojo.";
    await nextTick();
    output.value?.focus();
    output.value?.select();
  }
}
defineExpose({ open });
</script>

<template>
  <dialog
    ref="dialog"
    class="enquiry-dialog"
    aria-labelledby="enquiry-title"
    aria-describedby="enquiry-intro"
    data-lenis-prevent
    @close="afterClose"
    @keydown="keepDialogFocus"
    @click="$event.target === dialog && dialog?.close()"
  >
    <div class="enquiry-shell">
      <button
        type="button"
        class="text-button enquiry-close"
        @click="dialog?.close()"
      >
        Close <span aria-hidden="true">×</span>
      </button>
      <p class="eyebrow">A conversation begins here</p>
      <h2 id="enquiry-title">What do you<br /><em>have in mind?</em></h2>
      <p id="enquiry-intro" class="enquiry-intro">
        A commission, an exhibition, or an idea worth exploring.
        {{ apiBase ? "Send your idea to the studio. No account needed." : "Prepare a note to share with Kojo." }}
      </p>
      <form :aria-busy="sending" @submit.prevent="prepare">
        <div class="enquiry-trap" aria-hidden="true"><label>Website<input v-model="website" name="website" tabindex="-1" autocomplete="off" /></label></div>
        <div class="form-row">
          <label
            >Your name<input
              v-model="name"
              name="name"
              autocomplete="name"
              :disabled="sending"
              required
              maxlength="120" /></label
          ><label
            >Email address<input
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              :disabled="sending"
              required
              maxlength="200"
          /></label>
        </div>
        <label
          >I'm interested in<select v-model="interest" name="interest" :disabled="sending">
            <option>A photographic commission</option>
            <option>Fine art and exhibitions</option>
            <option>A creative collaboration</option>
            <option>Something else</option>
          </select></label
        >
        <label
          >A little about your idea<textarea
            v-model="message"
            name="message"
            :disabled="sending"
            rows="3"
            required
            maxlength="4000"
          />
        </label>
        <button type="submit" class="solid-button" :disabled="sending">
          {{
            sending ? "Sending…" : apiBase ? "Send enquiry" : config.public.contactEmail ? "Continue in email" : "Copy enquiry"
          }}
        </button>
        <p :role="failed ? 'alert' : 'status'" class="form-status">{{ status }}</p>
        <label v-if="preview && status.includes('below')"
          >Your prepared enquiry<textarea
            ref="output"
            :value="preview"
            readonly
            rows="6"
          />
        </label>
      </form>
    </div>
  </dialog>
</template>
