<script setup lang="ts">
const {paused,systemReduced,toggleMotion}=useMotionPreference();
</script>
<template>
<footer class="site-footer page-gutter">
 <div class="footer-discover"><NuxtLink to="/artworks">Explore the collection</NuxtLink><NuxtLink to="/exhibitions">Exhibitions & encounters</NuxtLink><NuxtLink to="/saved">Your saved works</NuxtLink><NuxtLink to="/login">Client Portal</NuxtLink></div>
 <div class="footer-top"><NuxtLink to="/#top" class="footer-signature" aria-label="Kojo Appiah Oppong, back to top">kojo.</NuxtLink><p>APPIAH OPPONG<br>PHOTOGRAPHY & VISUAL ART</p><NuxtLink to="/#top" class="text-button">Back to top <span aria-hidden="true">↑</span></NuxtLink></div>
 <div class="footer-bottom"><span>© {{ new Date().getUTCFullYear() }} Kojo Appiah Oppong</span><span class="footer-mantra">Simplicity is perfection.</span><button type="button" class="motion-toggle" :aria-pressed="paused" :disabled="systemReduced" :aria-label="systemReduced ? 'Reduced motion, matching your system preference' : paused ? 'Motion off. Enable animation' : 'Motion on. Pause animation'" @click="toggleMotion">{{ systemReduced ? 'Reduced motion' : paused ? 'Motion off' : 'Motion on' }}<span aria-hidden="true" class="toggle-track"><span></span></span></button></div>
</footer>
</template>
