# Kojo website API

Standalone Hono API on Cloudflare Workers, with Supabase Auth, a commissions workspace, public portfolio publishing, and stored enquiries. It has no dependency on the copied shop's database tables, tenant memberships, payments, queues, or scheduled jobs. Studio administrators manage clients, projects, enquiries, portfolio work, and project files. Clients read only their own records and download files shared with them.

## Local setup

Use Node 22.12+, 24+, or 26+ (Node 24.15+ also meets the website's requirements).

```sh
npm ci
# Already created in this workspace; for a new checkout:
cp .dev.vars.example .dev.vars.local
npm run dev
```

Fill in `.dev.vars.local` before using authentication:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | This website's Supabase project URL, from Project Settings → API. |
| `SUPABASE_PUBLISHABLE_KEY` | This project's publishable key (`sb_publishable_...`), or its legacy `anon` key. |
| `ALLOWED_ORIGINS` | Exact website origins, separated by commas. Local defaults cover `http://127.0.0.1:3000` and `http://localhost:3000`. |
| `AUTH_ALLOW_REGISTRATION` | `false` by default. Set `true` only when visitor registration is wanted. |

No service-role key, JWT signing secret, email-provider API key, or Cloudflare account token is needed in this file. Supabase handles identity verification and email delivery. `npm run dev` selects Wrangler's `local` environment and loads `.dev.vars.local`; the file and all other real environment files are ignored by Git. `.dev.vars.example` is the shareable template.

The copied `.dev.vars` was moved to `.local-backups/sanflavva.dev.vars` so these credentials are not loaded by this application. That backup is ignored by Git and is not part of deployment.

The Worker runs at `http://127.0.0.1:8787`. Check `GET /status` or `GET /api/v1/health` without credentials. Auth endpoints return a configuration error until the two Supabase values are provided. Health reports the Worker is running; it does not test connectivity to Supabase.

In `../website`, copy `.env.example` to `.env`. The API origin is already set to `NUXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787`. The homepage uses the public portfolio and enquiry routes. `/sign-in`, `/studio`, and `/portal` share this API; the website routes users according to the verified account role.

## Supabase setup

1. Use a dedicated Supabase project for this website and enable email authentication. Apply `supabase/migrations/20261127133114_studio_portal.sql` to that project. It creates the six `studio_*` tables, ownership policies, two storage buckets, and narrowly scoped permission helpers. Do not run it against the copied shop database.
2. Keep email confirmation enabled. Registration uses normal Supabase signup and never automatically confirms an address.
3. For email codes, set the **Magic Link** and **Confirm signup** email templates to include `{{ .Token }}`. The API verifies these codes with `/verify-otp`. The website supports code sign-in and password sign-in; email codes avoid requiring a link callback. Configure custom SMTP in Supabase before sending real production emails; its default mail service is limited.
4. Set the project's Site URL and allowed redirect URLs to the website. Keep Supabase's own **Allow new users to sign up** setting disabled for an admin-only site. The Worker's registration flag only controls this API; Supabase's public Auth endpoint has its own setting.
5. Create the first account through Supabase's trusted admin tools. Set its server-controlled `app_metadata.role` to `admin`. All other accounts map to `visitor`; user-editable metadata never grants permissions.

For example, after creating the account, run this in that project's Supabase SQL editor with its actual user ID:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where id = 'REPLACE_WITH_AUTH_USER_UUID';
```

The API resolves users from Supabase on protected requests, so it does not depend on a shared legacy JWT secret. Every workspace mutation uses both `authMiddleware()` and `requireAdmin()`; a client login never grants administration. The database independently checks current server-controlled admin metadata and verified email ownership through RLS. The API retains the `visitor` role value for ordinary accounts; the website displays this role as Client.

## HTTP contract

All auth routes are under `/api/v1/auth`. JSON request field names are camelCase. Passwords for new accounts and password changes must be 8–128 characters; email codes must be 6–10 digits. `lastName` is optional at registration. Login, registration, OTP, and password-change requests accept an optional `captchaToken` when CAPTCHA is enabled in Supabase. Protected routes require `Authorization: Bearer <accessToken>`.

| Method | Path | Request / behavior |
| --- | --- | --- |
| POST | `/login` | `{ email, password }`; returns a session. |
| POST | `/register` | `{ email, password, firstName, lastName }`; gated by registration flag. |
| POST | `/otp-login` | `{ email }`; sends a Supabase email code. Creates a user only when registration is enabled. |
| POST | `/verify-otp` | `{ email, code }`; returns a session after verification. |
| POST | `/refresh` | `{ refreshToken }`; returns rotated session tokens. |
| GET | `/me` | Protected; returns `{ user }`. |
| GET | `/context` | Protected; same current-user response, without tenant context. |
| PATCH | `/me` | Protected; editable `firstName`, `lastName`, `avatarUrl`, `email`. Email changes follow Supabase confirmation settings. |
| POST | `/change-password` | Protected; `{ currentPassword, newPassword }`. |
| POST | `/logout` | Protected; revokes the current session's refresh token. |

Session responses contain `accessToken`, `refreshToken`, `expiresIn`, `expiresAt`, and `user`. Store rotated tokens together after refresh. If registration needs email confirmation, the response contains `requiresEmailConfirmation: true` and a generic message instead of tokens. User objects contain `id`, `email`, `phone`, `firstName`, `lastName`, `avatarUrl`, and `role` (`admin` or `visitor`). Logout cannot revoke an already issued JWT before its expiry; clients must clear their local session as well.

Errors have `{ message, statusCode }`. Invalid input is rejected before authentication work. Unknown internal/provider details are not returned to callers. Auth responses use `Cache-Control: no-store`. Requests are limited to 16 KiB, and browser origins must exactly match `ALLOWED_ORIGINS`; an empty list or `*` does not grant access. CORS is a browser boundary, not authorization; protected routes always verify the token.

Supabase supplies Auth rate limits. Configure those limits and your Cloudflare edge controls for the deployment's traffic before exposing public signup. The Worker does not pretend that process-local counters provide a global abuse limit.

## Validation and deployment

```sh
npm run typecheck
npm test
npm run build   # Wrangler dry run; does not deploy
npm run lint
# Or formatting, typecheck, tests, and Worker build together:
npm run check
```

Tests mock Supabase responses and exercise real Hono requests. They do not create accounts, send email, or use the copied credentials. A live sign-in smoke test still needs the new project's configuration.

For a deployment, set production `ALLOWED_ORIGINS` in `wrangler.toml` to the deployed website origin. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the `kojo-api` Worker's secrets through Cloudflare or `wrangler secret put`, then use `npm run deploy`. Local secrets are not uploaded. Set the website's `NUXT_PUBLIC_API_BASE_URL` to the deployed Worker origin and rebuild the static website.

The inherited automatic deployment was replaced with validation-only CI. The copied Git history and remote are unchanged: **the current origin still points to the Sanflavva repository**. Use the intended new repository before pushing this project.

References: [Supabase user verification](https://supabase.com/docs/reference/javascript/auth-getuser), [email OTP setup](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Cloudflare local environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/).


## Commissions workspace

The first release is local implementation only. No production project, migration, account, or email was created during development. Connect the dedicated Kojo Supabase project before live sign-in, persistence, or uploads can work.

### Client onboarding and ownership

Create the client in Studio Dashboard using the email address they will use to sign in. Add their account through Supabase's trusted user tools and require email verification. With public registration disabled, provision accounts before inviting clients to sign in; this API does not send invitations. Email-code sign-in works for those existing accounts. A verified account automatically sees matching enquiries and projects assigned to the matching client record. An account's own editable profile cannot grant access or set a role.

Client matching uses the current verified email in `auth.users`, rather than stale token claims. If a client's account email changes, update the studio client record to the new verified email to restore project access. Enquiries remain associated with the email they were submitted under. Public requests can be submitted without an account.

### Workspace API

All paths below start with `/api/v1`. Private routes require `Authorization: Bearer <accessToken>` and return `Cache-Control: no-store`.

| Method | Path | Access and behavior |
| --- | --- | --- |
| GET | `/portfolio` | Public; returns `{ works }`, published only, ordered by `sort_order`. |
| POST | `/enquiries` | Public; `{ name, email, interest, message, website? }`. `website` is a honeypot; returns a generic confirmation without exposing a record. |
| GET | `/workspace` | Signed in; `{ clients, enquiries, projects, files, works }`. RLS filters clients to their own records. `works` and `internal_notes` are supplied only to administrators. |
| POST | `/workspace/clients` | Admin; `{ name, email, company? }`, returns `{ client }`. |
| PATCH | `/workspace/clients/:id` | Admin; partial client fields, returns `{ client }`. |
| POST | `/workspace/projects` | Admin; `{ client_id, title, description?, status?, next_step?, due_date? }`, returns `{ project }`. |
| PATCH | `/workspace/projects/:id` | Admin; partial project fields, returns `{ project }`. |
| PATCH | `/workspace/enquiries/:id` | Admin; `{ status?, internal_notes? }` saved atomically, returns `{ enquiry }`. |
| POST | `/workspace/works` | Admin; `{ title, discipline, image_url, alt, description?, width?, height?, sort_order?, published? }`, returns `{ work }`. |
| PATCH | `/workspace/works/:id` | Admin; partial portfolio fields, returns `{ work }`. |
| POST | `/workspace/portfolio-image` | Admin; multipart `file`, returns `{ image_url }`. |
| POST | `/workspace/files` | Admin; multipart `file` and `project_id`, returns `{ file }`. |
| GET | `/workspace/files/:id/download` | Assigned client or admin; returns `{ url }`, valid for 60 seconds. |

Project stages are `planning`, `in_progress`, `review`, and `completed`. Enquiry statuses are `new`, `in_progress`, and `closed`. Portfolio disciplines are `Fine art`, `Architecture`, `Fashion`, and `Advertising`. Dates use `YYYY-MM-DD` or null. IDs are UUIDs, and body keys use snake_case for studio data (auth retains camelCase).

Each collection is capped at 500 records for this small first release; add pagination before exceeding that scale. Project images, PDFs, and ZIP files are limited to 15 MiB; portfolio images accept JPEG, PNG, or WebP. The API verifies basic file signatures and stores generated object keys. Project assets remain in a private bucket; publishing an image places it in the public portfolio bucket. Unpublishing hides the portfolio entry, but does not revoke a previously shared public image URL. Do not upload confidential files as portfolio images.

Internal notes have their own admin-only table; they cannot leak through the direct Data API. Storage policies also check project ownership, so knowing an object path is insufficient to download it. No service-role key is used. The enquiry honeypot is a basic spam filter; configure Cloudflare rate limits for the public submission endpoint when enabling it in production.

### Local database verification

`tests/studio-rls.sql` is a disposable-PostgreSQL smoke test. It creates minimal Supabase-compatible auth/storage stubs, applies the migration, then checks administrator writes, client isolation, private storage, internal notes, guest submissions, published work, and revoked permissions. Run only on an empty disposable PostgreSQL cluster/database, never on a real Supabase project:

```sh
psql -v ON_ERROR_STOP=1 -d kojo_test -f tests/studio-rls.sql
```

The HTTP tests also cover role rejection, request validation, JWT forwarding, signed downloads, partial-update semantics, and upload boundaries. A real Supabase sign-in/storage smoke test still requires configuration and should follow the local checks.
