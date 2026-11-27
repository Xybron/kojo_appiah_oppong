<script setup lang="ts">
import "~/assets/css/login.css";
const auth = useStudioAuth();
const router = useRouter();
const mode = ref<"password" | "email" | "code">("password");
const email = ref("");
const password = ref("");
const code = ref("");
const busy = ref(false);
const error = ref("");
const notice = ref("");
const codeInput = ref<HTMLInputElement | null>(null);
const title = computed(() => mode.value === "code" ? "Check your inbox." : "Good to see you.");

useSeoMeta({ title: "Sign in — Kojo Studio", robots: "noindex, nofollow", description: "Your projects, conversations, and photographs, together in one place." });

onMounted(async () => {
  await auth.initialize();
  if (auth.user.value) await router.replace(auth.home.value);
  else if (auth.authError.value) error.value = auth.authError.value;
});

function changeMode(next: "password" | "email") {
  mode.value = next;
  error.value = "";
  notice.value = "";
  code.value = "";
}

async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    if (mode.value === "password") await auth.signIn(email.value.trim(), password.value);
    else if (mode.value === "email") {
      const result = await auth.sendCode(email.value.trim());
      notice.value = result.message;
      mode.value = "code";
      await nextTick();
      codeInput.value?.focus();
      return;
    } else await auth.verifyCode(email.value.trim(), code.value.trim());
    password.value = "";
    code.value = "";
    await router.replace(auth.home.value);
  } catch (cause) {
    error.value = studioError(cause, "We couldn't sign you in. Please try again.");
  } finally { busy.value = false; }
}
</script>

<template>
  <main id="main" class="studio-login" tabindex="-1">
    <section class="login-story" aria-label="Kojo Studio">
      <SiteWordmark />
      <div class="login-story-copy">
        <p class="login-kicker">THE STUDIO, CONNECTED</p>
        <h1>A space for<br /><em>what’s next.</em></h1>
        <p>From the first conversation to the final photograph. Your creative work, all in one place.</p>
      </div>
      <div class="login-story-footer"><span>Photography &amp; fine art</span><span>Accra, Ghana</span></div>
    </section>

    <section class="login-panel" aria-labelledby="sign-in-heading">
      <NuxtLink to="/" class="login-back">Back to the exhibition</NuxtLink>
      <div class="login-form-wrap">
        <p class="login-kicker">YOUR STUDIO ACCOUNT</p>
        <h2 id="sign-in-heading">{{ title }}</h2>
        <p class="login-intro">{{ mode === "code" ? `Enter the sign-in code sent to ${email}.` : "Sign in for your projects, updates, and shared files." }}</p>

        <p v-if="!auth.configured.value" class="login-notice" role="status">Account access is coming soon. You can still explore the work and contact the studio.</p>
        <form @submit.prevent="submit">
          <label v-if="mode !== 'code'" class="login-field">Email address
            <input v-model="email" type="email" name="email" autocomplete="username" placeholder="you@example.com" required maxlength="254" :disabled="busy" />
          </label>
          <label v-if="mode === 'password'" class="login-field">Password
            <input v-model="password" type="password" name="password" autocomplete="current-password" placeholder="Your password" required maxlength="128" :disabled="busy" />
          </label>
          <label v-if="mode === 'code'" class="login-field">Email code
            <input ref="codeInput" v-model="code" type="text" name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6,10}" minlength="6" maxlength="10" placeholder="Enter your code" required :disabled="busy" />
          </label>
          <p v-if="error" class="login-error" role="alert">{{ error }}</p>
          <p v-if="notice" class="login-notice" role="status">{{ notice }}</p>
          <button class="login-submit" type="submit" :disabled="busy || !auth.configured.value">{{ busy ? 'Please wait…' : mode === 'password' ? 'Sign in' : mode === 'email' ? 'Send a sign-in code' : 'Verify & sign in' }}</button>
        </form>
        <button v-if="mode === 'password'" class="login-alternative" type="button" :disabled="busy" @click="changeMode('email')">Prefer an email code?</button>
        <button v-else class="login-alternative" type="button" :disabled="busy" @click="changeMode(mode === 'code' ? 'email' : 'password')">{{ mode === 'code' ? 'Use another email or request a new code' : 'Sign in with a password' }}</button>
        <p class="login-help">New to the studio? Your account is set up when we begin working together. <NuxtLink to="/">Get in touch</NuxtLink></p>
      </div>
      <p class="login-footnote">A little less admin. A little more creating.</p>
    </section>
  </main>
</template>
