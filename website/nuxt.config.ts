export default defineNuxtConfig({
  compatibilityDate: "2026-11-27",
  devtools: { enabled: false },
  ssr: true,
  css: ["~/assets/css/main.css", "~/assets/css/collection.css", "~/assets/css/experience.css", "lenis/dist/lenis.css"],
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      title: "Kojo Appiah Oppong — The Living Exhibition",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#171714" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        {
          rel: "preload",
          href: "/fonts/dm-sans-latin.woff2",
          as: "font",
          type: "font/woff2",
          crossorigin: "",
        },
        {
          rel: "preload",
          href: "/fonts/cormorant-garamond-latin.woff2",
          as: "font",
          type: "font/woff2",
          crossorigin: "",
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      // Separate Hono Worker, following the existing OurAvow project boundary.
      apiBaseUrl: "",
      siteUrl: "https://kojo-living-exhibition.primeblock16.chatgpt.site",
      contactEmail: "",
      commerceApiBaseUrl: "",
      commerceEnabled: false,
      // This preview contains generated demonstration imagery, not Kojo's work.
      demoMode: true,
    },
  },
  routeRules: {
    "/studio": { ssr: false },
    "/portal": { ssr: false },
  },
  nitro: { prerender: { routes: ["/", "/login", "/studio", "/portal"], crawlLinks: true } },
  typescript: { strict: true },
});
