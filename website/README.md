# Kojo Appiah Oppong — The Living Exhibition

Nuxt portfolio with a cinematic opening, a native swipeable gallery, a tactile artist chapter, a physical exhibition scene, and an enquiry composer. Image provenance and replacement notes live in source documentation only, as requested; there are no public preview notices. Photographs and study metadata are provisional. No client, award, or scheduled-event claims are made.

## Run locally

Use Node 24.15+ (see `.node-version` / `.nvmrc`).

```sh
npm ci
npm run dev
```

The default local URL is http://127.0.0.1:3000. `npm run typecheck` checks the TypeScript and Vue code. `npm run build` creates a prerendered, SEO-readable homepage in `.output/public`; `npm run build:ssr` prepares server deployment when dynamic rendering is needed.

## Creative direction

- Visual thesis: a continuous visual journey, from presence to form, material, and physical encounter. The references inform spatial depth, pacing, and restrained navigation; no reference assets or code are reused.
- Hero: an edge-to-edge red silk portrait with oversized sans-serif typography: “Look closer.” Mobile uses a separate composition and crop.
- Typography: self-hosted Cormorant Garamond and DM Sans; SIL Open Font License files are in `public/fonts`.
- Palette: warm near-black, ivory, mineral green, and the red of the photographs. The artist chapter introduces warm paper and expressive serif typography.
- Sequence: cinematic invitation, a short passage about attention, four photographic perspectives, the artist's principle and a close-up print, a gallery encounter, conversation.
- Motion: GSAP for the introductory and sectional transitions. Lenis is the sole smooth-scroll engine, with native touch scrolling (`syncTouch: false`). Locomotive was evaluated; its additional scroll/animation layer is unnecessary for this page.
- Three.js: omitted because the images and composition carry the concept without a continuous rendering cost.
- Skills applied: `build-awwwards-quality-sites` and `sites`.

## Content and assets

`app/data/exhibition.ts` holds typed presentation data, isolated from UI and ready to be replaced with a Hono API response. `media-source/` contains the original demo PNGs; `media-source/provenance.json` contains the exact built-in image-generation prompts. `public/images/` contains optimized WebP and progressive JPEG variants. Regenerate with `python3 scripts/prepare-images.py` after installing Pillow; browsers need no Python or image-processing runtime.

Image sources: OpenAI built-in image generation, explicitly requested by the user for this preview. Fonts: Google Fonts / Fontsource, self-hosted with their license notices. The custom text favicon is authored locally. There are no external image or font requests at runtime.

Replace the demo imagery, update the work metadata and alt text, and provide genuine exhibition information before launch. Set `NUXT_PUBLIC_DEMO_MODE=false` only after replacing the demo content. Demo mode sets `noindex, nofollow`; it does not imply that the live content has been approved.

## Accessibility and performance

Semantic regions and heading levels, skip navigation, visible focus, native disclosure navigation, native modal focus containment, Escape to close, arrow-key image navigation, and focus restoration are included. Gallery selection announces the selected photograph and position. Native swipe, visible previous/next controls, discipline selection, and keyboard arrows are supported. Focus follows arrow selection when navigating image links. Screen readers receive unsplit heading text; decorative animation spans are hidden from the accessibility tree.

Reduced motion disables Lenis and GSAP rather than merely speeding up animations. The footer also provides a persistent motion toggle. Content and image links are present in server-rendered HTML and remain readable without JavaScript; enhanced gallery controls and dialogs require JavaScript. The horizontal contact sheet remains natively scrollable without it. Media dimensions reserve space, the hero is prioritised, and later images load lazily. All motion listeners and animation resources are cleaned up on unmount.

## API and authentication boundary

The homepage runs independently of backend credentials. The separate Hono Cloudflare Worker in `../api` now provides Supabase authentication without a tenant or commerce schema. See `../api/README.md` for setup and the endpoint contract.

For local API development, fill in `../api/.dev.vars.local`, run `npm run dev` in `../api`, then copy this website's `.env.example` to `.env`. `NUXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` is the API origin; endpoint paths start with `/api/v1`. Set the deployed Worker origin here when connecting production features. A static build needs these public values set at build time; rebuild after changing them.

The homepage does not yet call the API or display sign-in screens. Future authenticated requests should send `Authorization: Bearer <accessToken>` to the Worker. The API verifies identities against Supabase, and administrator authorization uses server-managed `app_metadata.role`. Public registration stays disabled until visitor accounts have a defined purpose. The API includes a reusable admin guard for future content-management routes.

The enquiry composer currently copies a message for the visitor to share. It does not submit or store personal data. Set `NUXT_PUBLIC_CONTACT_EMAIL` to enable a mail-app handoff, or add a Hono enquiry endpoint in the backend phase.

## SEO and hosting

The prerender contains real text, image descriptions, a canonical URL, social metadata, and ProfilePage/Person structured data. `public/sitemap.xml` and `public/robots.txt` must be updated with the final domain. Deploy `.output/public` to static hosting, including Cloudflare Pages. Future dynamic SSR can be configured independently of the separate Hono API.

`.openai/hosting.json` identifies the owner-private Sites preview. It uses the same static output. No Supabase project, schema, production auth, or admin account has been created for this homepage phase.
