# Kojo deployment

## Website: Cloudflare Pages

- Project: `kojo-appiah-oppong`
- URL: https://kojo-appiah-oppong.pages.dev
- Repository: https://github.com/Xybron/kojo_appiah_oppong
- Production branch: `main`
- Root directory: `website`
- Build command: `npm run build`
- Output directory: `dist` (Nuxt selects `cloudflare-pages-static` in Cloudflare's build environment)
- Production build variables:
  - `NUXT_PUBLIC_API_BASE_URL=https://kojo-api.ronaldnettey360.workers.dev`
  - `NUXT_PUBLIC_SITE_URL=https://kojo-appiah-oppong.pages.dev`

Rebuild Pages after changing public environment variables: the website is statically generated.

## API: Cloudflare Workers

- Worker: `kojo-api`
- URL: https://kojo-api.ronaldnettey360.workers.dev
- Same repository and branch, root directory `api`
- Build command: empty
- Deploy command: `npm run deploy`
- Runtime secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- Allowed production origin is configured in `api/wrangler.toml`.
- Public registration remains disabled.

Secrets are stored in Cloudflare, never committed. Local `.dev.vars` files are not uploaded by Git deployment.

## Supabase

With the owner's approval, Kojo shares the existing **LAB** project (`xfppsgiothkvhndmbixx`) with Lumen. The studio migration `api/supabase/migrations/20261127133114_studio_portal.sql` was applied through the SQL editor on 2026-11-27. Do not run this initial migration again on LAB.

All six `studio_*` tables have row-level security enabled. The `studio-project-files` bucket is private; `studio-portfolio` is public. Existing Lumen tables and Auth settings were retained.

Supabase dashboard accounts and project Auth users are separate. The owner must provision a project Auth user before signing into Kojo. Studio administration requires the trusted `app_metadata.role` value `admin`; user-editable metadata cannot grant it.

## Verified on 2026-11-27

- Worker `/status` returns healthy.
- `/api/v1/portfolio` successfully reads Supabase and returns an empty collection.
- `/api/v1/workspace` rejects signed-out access with HTTP 401.
- The production login form reaches the Worker and rejects invalid credentials.
- The committed API passed 52 tests and TypeScript checking.

The first administrator account and a successful signed-in studio check are still pending.
