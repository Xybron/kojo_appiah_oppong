<script setup lang="ts">
const {paused,systemReduced}=useMotionPreference();
const config=useRuntimeConfig();
const route=useRoute();
const isWorkspace=computed(()=>/^\/(studio|portal)(?:\/|$)/.test(route.path));
const isAccountPage=computed(()=>isWorkspace.value || /^\/login(?:\/|$)/.test(route.path));
useSeoMeta({robots:config.public.demoMode !== false && String(config.public.demoMode) !== 'false' ? 'noindex, nofollow':'index, follow'});
onMounted(()=>{
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');
 const sync=()=>{systemReduced.value=media.matches; let stored=false;try{stored=localStorage.getItem('kojo:motion-paused')==='true';}catch{} paused.value=media.matches||stored;};
 sync(); media.addEventListener('change',sync); onScopeDispose(()=>media.removeEventListener('change',sync));
});
</script>
<template>
 <div class="site-app" :class="{'motion-paused':paused}">
  <a v-if="!isWorkspace" class="skip-link" href="#main">Skip to content</a>
  <SiteHeader v-if="!isAccountPage" />
  <NuxtPage />
  <SiteFooter v-if="!isAccountPage" />
  <ExhibitionCursor v-if="!isAccountPage" />
 </div>
</template>
