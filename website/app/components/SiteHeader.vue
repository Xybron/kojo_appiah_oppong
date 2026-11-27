<script setup lang="ts">
const route = useRoute();
const auth = useStudioAuth();
const menu = ref<HTMLDetailsElement | null>(null);
const guestAccount = ref<{ close: () => void } | null>(null);
const solid = ref(route.path !== '/');
const { count } = useSavedWorks();
let observer: IntersectionObserver | undefined;
function closeMenu() { if (menu.value) menu.value.open = false; }
function toggleMenu() { if (menu.value?.open) guestAccount.value?.close(); }
function escapeMenu() { closeMenu(); menu.value?.querySelector('summary')?.focus(); }
function leaveMenu(event: FocusEvent) { if (event.relatedTarget instanceof Node && !menu.value?.contains(event.relatedTarget)) closeMenu(); }
async function observeOpening() {
  observer?.disconnect();
  solid.value = route.path !== '/';
  await nextTick();
  const hero = document.querySelector('.hero');
  if (route.path === '/' && hero) {
    solid.value = hero.getBoundingClientRect().bottom <= 88;
    observer = new IntersectionObserver(([entry]) => { if (entry) solid.value = !entry.isIntersecting && entry.boundingClientRect.top < 0; }, {rootMargin:'-88px 0px 0px 0px'});
    observer.observe(hero);
  }
}
watch(() => route.fullPath, () => { closeMenu(); void observeOpening(); });
onMounted(() => {
  void auth.initialize();
  void observeOpening();
  const unhook = useNuxtApp().hook('page:finish', observeOpening);
  onScopeDispose(unhook);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <header class="site-header page-gutter" :class="{'is-solid':solid}">
    <SiteWordmark />
    <nav class="desktop-nav" aria-label="Main navigation">
      <NuxtLink to="/artworks" :aria-current="route.path.startsWith('/artworks') ? 'page' : undefined">The work <span>01</span></NuxtLink>
      <NuxtLink to="/#artist">The eye <span>02</span></NuxtLink>
      <NuxtLink to="/exhibitions" :aria-current="route.path.startsWith('/exhibitions') ? 'page' : undefined">Exhibitions <span>03</span></NuxtLink>
    </nav>
    <div class="site-header-actions">
    <NuxtLink class="header-contact saved-nav" to="/saved" :aria-label="`Saved works, ${count} ${count === 1 ? 'artwork' : 'artworks'}`"><svg width="16" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>Saved <span class="saved-count">{{ count }}</span></NuxtLink>
    <GuestAccount ref="guestAccount" @opened="closeMenu" />
    <details ref="menu" class="mobile-menu" @toggle="toggleMenu" @keydown.esc="escapeMenu" @focusout="leaveMenu">
      <summary><span>Explore</span><span class="menu-lines" aria-hidden="true"><i></i><i></i></span></summary>
      <nav aria-label="Mobile navigation" data-lenis-prevent @click="($event.target as HTMLElement).closest('a') && closeMenu()">
        <NuxtLink to="/artworks"><span>01</span>The work</NuxtLink>
        <NuxtLink to="/#artist"><span>02</span>The eye</NuxtLink>
        <NuxtLink to="/exhibitions"><span>03</span>Exhibitions</NuxtLink>
        <NuxtLink to="/saved"><span>{{ String(count).padStart(2,'0') }}</span>Saved works</NuxtLink>
        <NuxtLink to="/#contact"><span>↗</span>Get in touch</NuxtLink>
        <p>Photography & visual art<br>Kojo Appiah Oppong</p>
      </nav>
    </details>
    </div>
  </header>
</template>
