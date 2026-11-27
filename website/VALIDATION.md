# Homepage validation

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
