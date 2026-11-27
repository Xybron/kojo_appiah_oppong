# Website validation

## Studio Dashboard and Client Portal — 27 November 2026

- Frontend TypeScript checks and the production static build passed, including `/login`, `/studio`, and `/portal` shells.
- `npm run test:auth`: 12 regression tests passed against the actual auth composable. They exercise sign-out during initialization, late responses after account switches, token refresh, expired sessions, role/email changes, and temporary outages.
- The API's full check passed: formatting, typecheck, 101 tests across the current API, and Worker dry-run build.
- Applied the studio migration to an isolated local PostgreSQL 17 database with Auth/Storage schema stubs. RLS assertions passed for admin writes, verified client ownership, cross-client denial, private-note isolation, unpublished portfolio isolation, and revoked admin access. No remote database was changed.
- Browser-tested both roles using a disposable fixture API, separate from the application: sign-in, sign-out, direct admin-route rejection for clients, client creation, project stage/next-step changes, enquiry status and private notes, client enquiry submission, image preview, and file upload.
- Visually checked desktop and 390px/320px layouts. Narrow project screens had no page-level horizontal overflow. Checked mobile navigation, editor focus restoration, and client read-only controls.
- Confirmed the ordinary local `/login` page honestly shows account access as unavailable without API configuration. No test accounts, bypasses, or client fixtures are shipped in the application.

Live Supabase sign-in, email delivery, and Storage transfers remain unverified until the dedicated project is connected. The browser fixture verifies frontend interactions; the API tests and PostgreSQL assertions independently verify the backend contract and authorization. Temporary browser-test services were stopped after verification.

## Earlier homepage validation

Rechecked for the cinematic redesign on 27 November 2026.

- Nuxt/Vue TypeScript check and production prerender build passed.
- Prerendered HTML includes one H1, all five narrative sections, seven images with meaningful alternative text and dimensions, canonical/social metadata, and ProfilePage/Person JSON-LD. It has no public preview, demo, or image-generation notices.
- Responsive layout checks at 320, 390, 768, and 1440 CSS pixels found no page-level horizontal overflow. Desktop and phone compositions were visually inspected. Gallery overflow is intentional and confined to its scroll region.
- Discipline selection changes the centered photograph and announces its title and position. Keyboard arrows from image links move focus to the selected photograph; Enter opens that photograph.
- Image viewer opens, contains Tab/Shift+Tab, closes with Escape, and restores the invoking image link's focus. Viewer images mount only while open.
- Mobile navigation opens and its section links close it and navigate. At 667×375 its panel is limited to the viewport height and can scroll internally; the contact link remained reachable. Leaving the disclosure by keyboard closes it.
- The enquiry dialog remains reachable from the contact section. Existing form validation and copy-only behavior are unchanged; it does not send or store enquiries.
- Motion toggle destroys Lenis, removes GSAP transforms, and restores static content. It can re-enable animation. System reduced-motion bypass uses the same setup guard; OS preference emulation was not available in this browser tool.
- Accessibility snapshots expose unsplit headings, meaningful link names, gallery status, and native dialog controls. The motion control's accessible name includes its visible label.
- Local responsive WebP/JPEG images load successfully. Original generated assets and exact prompts are recorded in media-source/provenance.json; provenance stays in development documentation.
- No browser error or warning entries occurred during the final interaction checks.
- Fixed navigation becomes opaque after the opening image to preserve text contrast across the light and dark chapters.

These are targeted implementation checks, not independent WCAG certification or field Core Web Vitals results. Physical-device touch and assistive-technology testing remain part of the launch review.
