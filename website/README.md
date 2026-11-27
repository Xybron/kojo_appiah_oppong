# Kojo Appiah Oppong — The Living Exhibition

Nuxt portfolio with a cinematic opening, a native swipeable gallery, a tactile artist chapter, a physical exhibition scene, and an enquiry composer. Image provenance and replacement notes live in source documentation only, as requested; there are no public preview notices. Artwork and event records are provisional. See [EXPERIENCE.md](./EXPERIENCE.md) for the scroll encounter, artwork collection, saved works, exhibitions, GHS checkout, and the approved-design checkpoint.

## Run locally

Use Node 24.15+ (see `.node-version` / `.nvmrc`).

```sh
npm ci
npm run dev
```

The default local URL is http://127.0.0.1:3000. `npm run typecheck` checks the TypeScript and Vue code. `npm run test:auth` runs session and account-isolation regression tests. `npm run build` creates the static website and account-page shells in `.output/public`; `npm run build:ssr` prepares server deployment when dynamic rendering is needed.

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

`app/data/exhibition.ts` holds the local demonstration portfolio. When an API origin is configured, the homepage gallery loads published work from the Studio Dashboard through `usePublicPortfolio`; an empty managed portfolio stays empty. `media-source/` contains the original demo PNGs; `media-source/provenance.json` contains the exact built-in image-generation prompts. `public/images/` contains optimized WebP and progressive JPEG variants. Regenerate with `python3 scripts/prepare-images.py` after installing Pillow; browsers need no Python or image-processing runtime.

Image sources: OpenAI built-in image generation, explicitly requested by the user for this preview. Fonts: Google Fonts / Fontsource, self-hosted with their license notices. The custom text favicon is authored locally. There are no external image or font requests at runtime.

Replace the demo imagery, update the work metadata and alt text, and provide genuine exhibition information before launch. Set `NUXT_PUBLIC_DEMO_MODE=false` only after replacing the demo content. Demo mode sets `noindex, nofollow`; it does not imply that the live content has been approved.

## Accessibility and performance

Semantic regions and heading levels, skip navigation, visible focus, native disclosure navigation, native modal focus containment, Escape to close, arrow-key image navigation, and focus restoration are included. Gallery selection announces the selected photograph and position. Native swipe, visible previous/next controls, discipline selection, and keyboard arrows are supported. Focus follows arrow selection when navigating image links. Screen readers receive unsplit heading text; decorative animation spans are hidden from the accessibility tree.

Reduced motion disables Lenis and GSAP rather than merely speeding up animations. The footer also provides a persistent motion toggle. Content and image links are present in server-rendered HTML and remain readable without JavaScript; enhanced gallery controls and dialogs require JavaScript. The horizontal contact sheet remains natively scrollable without it. Media dimensions reserve space, the hero is prioritised, and later images load lazily. All motion listeners and animation resources are cleaned up on unmount.

## API and authentication boundary

The public website runs independently of backend credentials. The separate Hono Cloudflare Worker in `../api` provides Supabase authentication, portfolio publishing, enquiries, projects, and private file storage. See `../api/README.md` for the migration, account setup, storage policies, and endpoint contract.

For local API development, fill in `../api/.dev.vars.local`, run `npm run dev` in `../api`, then copy this website's `.env.example` to `.env`. `NUXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` is the API origin; endpoint paths start with `/api/v1`. Set the deployed Worker origin here when connecting production features. A static build needs these public values set at build time; rebuild after changing them.

One website has three account routes:

- `/login`: password or email-code sign-in. Existing accounts only while registration is disabled.
- `/studio`: the Studio Dashboard for the verified platform owner `ronaldnettey360@gmail.com`.
- `/portal`: the Client Portal for other accounts (the API retains the existing `visitor` role name).

Both areas provide an overview, enquiry tracking, projects, shared files, and profile/password settings. Admins also manage clients, update project stages and next steps, write private enquiry notes, upload files, and create/edit/order/publish portfolio work. Clients cannot edit projects or see other clients' data. A client record links to its separately provisioned Auth account by its verified email; creating the record does not send an invitation or create an Auth account.

`useStudioAuth` stores session tokens in sessionStorage for the browser tab, verifies the account with the API on protected navigation, rotates refresh tokens, and clears cached workspace data when identity or access changes. Tokens are not included in server-rendered page payloads; authenticated pages are client-rendered shells. Route guards provide navigation behavior, while API authorization and database row-level policies enforce access independently. Private download links expire after 60 seconds.

With the API configured, the public enquiry composer submits and stores enquiries without requiring sign-in. Without an API origin, it retains the labelled copy/email handoff and states that nothing has been sent. Account access is unavailable until the API and dedicated Supabase project are configured. No fake accounts or demonstration client records are shipped.

The commissioning workflow is intentionally small: no subscription billing, live chat, booking calendar, or automated email invitations. Artwork purchases use the separate Bachs commerce flow documented in `../api/docs-commerce.md`; activation remains disabled pending configuration and sandbox validation. API workspace lists are bounded at 500 records per collection; pagination is a future scaling step.

## SEO and hosting

The prerender contains real text, image descriptions, a canonical URL, social metadata, and ProfilePage/Person structured data. `public/sitemap.xml` and `public/robots.txt` must be updated with the final domain. Deploy `.output/public` to static hosting, including Cloudflare Pages. Future dynamic SSR can be configured independently of the separate Hono API.

`.openai/hosting.json` preserves the existing owner-private Site identity. This dashboard phase was completed locally at the user's request. No Supabase project or live account was provisioned, and no dashboard deployment was performed. The checked-in migration is ready to apply to the dedicated Kojo project when connected.
