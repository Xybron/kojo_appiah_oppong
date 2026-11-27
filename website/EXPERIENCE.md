# The Living Exhibition — collector experience

Implemented locally on 27 November 2026. The approved palette, typography, hero, and existing narrative chapters are retained.

## Explore and collect

- `/`: an additional reversible, scroll-driven artwork encounter moves from the surface of Terra to its full composition and a gallery setting. It renders 121 camera positions from the same artwork image; it does not download a 121-image sequence or autoplay a video. Media loads only near the section, drawing occurs on scroll/resize, and rendering density is capped. Chapter buttons, a keyboard-operable range, and a skip link provide alternatives to scrolling.
- `/artworks`: eight works in a responsive masonry collection, with discipline, original/print, availability, and text filters.
- `/artworks/:slug`: complete artwork and close-detail views, a proportional 300 × 220 cm wall visualization, centimetres/inches, framing materials, outer dimensions, and GHS selection totals. Work-level purchase/enquiry modes support both originals and prints.
- `/saved`: local-device saved works, persistence across reloads, removal/undo, cross-tab updates, and a usable fallback when storage is unavailable. Saving does not reserve stock. Account synchronization is not connected.
- `/exhibitions`: upcoming encounters, archive, individual event stories, related artworks, ICS downloads, and Google Calendar links. Calendar links require valid explicit-offset start/end dates. Downloading a file does not automatically add an event to a calendar.
- `/checkout/return`: protected order verification; a browser redirect alone never confirms a payment.

Fine-pointer users receive contextual image cursors. Touch and reduced-motion users retain native behavior. The footer's persistent motion toggle disables the scroll sequence and smooth scrolling. Screens shorter than 660px use the complete static artwork rather than a sticky scene with unreachable controls.

The hero arrow has equal width and height at both breakpoints. Selected Work opens with The shape of silence, reserving Study in red for the hero. Vertical wheel gestures continue down the page over the gallery; horizontal gestures retain native sideways browsing. The sequence uses a thin custom progress rail, diamond playhead, numbered chapters, and a 44px range-input hit area.

The header's guest avatar opens saved works and account access. Its random UUID is stored under `kojo:guest-identity:v1`; it is an avatar seed, not an authentication credential. DiceBear Constellation is generated locally with lazy-loaded pinned packages, so no avatar request or visitor identifier is sent to DiceBear. The visitor keeps the same avatar after reload; restricted storage falls back to a visit-only identity. Existing authenticated account routing remains separate. Source and license notices are in `public/licenses/dicebear.txt`.

## Content and API boundaries

`app/data/artworks.ts` and `app/data/events.ts` contain the user-authorized local product and event fixtures. Prices, dimensions, dates, venues, and inventory must be replaced/verified before commerce activation. The collection and event pages are not yet driven by the Studio Dashboard. Generated source assets and exact prompts are recorded in `media-source/provenance.json`; no development provenance notice appears in the product UI.

Artwork enquiries use the existing Hono enquiry endpoint when `NUXT_PUBLIC_API_BASE_URL` is configured, with an email/copy handoff otherwise. Direct checkout uses the separate Hono commerce API and Bachs in GHS. Set `NUXT_PUBLIC_COMMERCE_API_BASE_URL` and `NUXT_PUBLIC_COMMERCE_ENABLED` only when the server is ready. Defaults leave checkout disabled. See `../api/docs-commerce.md` for migrations, server-only credentials, catalog verification, webhook configuration, and sandbox activation. Sanflavva's integration was used as a reference; its credentials and account were not reused.

Public collection and all individual artwork/event routes are explicitly prerendered, including archived exhibitions. The sitemap contains the public discovery routes; personal and checkout routes are excluded. Keep `NUXT_PUBLIC_DEMO_MODE=true` until real content is approved; this applies noindex without displaying development copy to visitors.

## Design checkpoint

The original approved website was committed **before this expansion** as `2d1ecb40c7d4efd51b92b921f917b511b66ba6df`, tag `approved-living-exhibition`.

During parallel project work, the website and API were consolidated into the root monorepo. The original tag has also been imported into that repository, and its old Git directory remains in `.local-repo-backups/website.git`. The tag's tree is the old **website root**, not the new monorepo root. Export it to a separate directory for comparison; do not reset the monorepo to that tree.

From the monorepo root, a non-destructive export is:

```sh
git archive approved-living-exhibition --output=/tmp/kojo-approved-homepage.tar
```

## Verification

- Nuxt typecheck and production static build passed. The build includes all eight artwork pages, all three event pages, and the checkout return route.
- Prerendered public HTML checked for one H1 per page, canonical/title metadata, image alternatives/dimensions, and absence of internal preview notices.
- Browser checks at 1440px desktop, 390px phone, and 320px narrow phone: collection and detail layouts, search, original filter, GHS size/frame totals, cm/in conversion, original enquiry mode, and modal Escape/focus restoration.
- Save → navigate → reload → remove → undo verified. Mobile masonry visually inspected; tested collection/detail pages have no horizontal overflow.
- Scroll sequence checked forward, backward, at its room endpoint, and through keyboard Home/chapter controls. Motion-off removes the enhanced scroll region; 667 × 375 landscape switches to the static artwork.
- Upcoming/archive filters and event details verified. An actual ICS download was inspected for UTC dates, escaped text, stable UID, and CRLF folding. `node scripts/test-calendar.mjs` passes.
- Missing-token payment return shows an unverified state. No real checkout, enquiry submission, or payment was performed in browser validation. Bachs backend validation is documented separately in `../api/docs-commerce.md`.
- No browser error/warning entries during the final UI checks. Physical-device touch, assistive-technology review, field performance, and a configured Bachs sandbox round trip remain launch checks.
- Follow-up correction checks: hero arrow measured 48×48px desktop / 42×42px phone; vertical scrolling over the gallery advanced the page without changing the selected image; sideways scrolling and the new photograph's viewer remained functional. New sequence controls reached both endpoints using Home/End. Guest avatar remained identical across reload, opened on desktop/mobile, restored focus with Escape, and closed the Explore menu when opened. Navigation showed no horizontal overflow at 320px.

Nothing in this change was deployed or pushed.
