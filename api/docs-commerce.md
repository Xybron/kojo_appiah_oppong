# Artwork checkout with Bachs

This local implementation follows the Sanflavva checkout-session flow while using current Bachs raw GHS pricing. It does not copy account keys, redirect hosts, products, tenant logic, or the previous USD currency workaround. Nothing has been deployed and no checkout or payment has been created.

## API contract

`POST /api/v1/checkout`

```json
{
  "artworkId": "earth-held-still",
  "variantId": "small",
  "frameId": "unframed",
  "customer": { "name": "Buyer name", "email": "buyer@example.com" },
  "idempotencyKey": "11111111-1111-4111-8111-111111111111"
}
```

Only product IDs and customer fields are accepted. Generate a fresh UUID for each new checkout attempt. The server selects its own verified catalog price, adds the selected frame in integer pesewas, and charges exactly that GHS amount. The first version is for studio collection; shipping is arranged by enquiry. Reuse the same idempotency key and unchanged payload after network failures. A changed selection/customer requires a new key.

The response is `{ checkoutUrl, reference, orderToken }`. Persist the reference and token together in session storage before following the HTTPS Bachs checkout URL. The token is an opaque order capability, not a Supabase JWT. Do not put it in a URL, log it, or expose it to another visitor.

`GET /api/v1/checkout/:reference` requires `Authorization: Bearer <orderToken>`. It returns `{ reference, status, artworkId, artworkTitle, variantId, frameId, amountMinor, currency, fulfilment, createdAt }`, with no customer name, email, or phone. Status is `creating | pending | paid | expired | review`; only `paid` means the signed, independently verified payment was settled in the database. Missing/invalid tokens return 401; unknown authorized references return 404. Configuration/provider/storage outages return 503 with a safe message.

Callbacks go to `/checkout/return?reference=...`; cancellation adds `cancelled=1`. Neither a redirect, a query parameter, nor the buyer's browser can mark an order paid. The return page reads the protected status endpoint.

`POST /api/v1/webhooks/bachs` validates the raw body's HMAC and a five-minute timestamp window, preferring the V2 signature header and accepting every rotation signature. It checks the configured Bachs account, retrieves the checkout server-to-server, checks checkout reference, paid status, charge status, exact amount, and GHS currency, then invokes an atomic settlement RPC. Subscribe to `checkout.completed`, `collection.succeeded`, and `checkout.expired`. A failed payment attempt does not release a still-open checkout.

## Durable state and original artworks

The migration `supabase/migrations/20261127133520_artwork_commerce.sql` creates a server-only ledger, inventory flags, and processed-event records. All tables have RLS enabled, with no anon/authenticated grants or policies. The narrowly scoped SECURITY INVOKER RPCs are executable only by `service_role`.

An original is reserved atomically when an order begins. Concurrent attempts cannot reserve the same original. Only provider-verified expiry releases the active reservation; a browser cancellation never does. Paid orders remain paid when duplicate or older expiry events arrive. Amount/currency or reference discrepancies go to `review`, never fulfillment. A late/conflicting original payment is held for studio review. Prints can be purchased more than once.

An uncertain provider create request remains `creating`; retry the same request/reference. Do not manually release that inventory until Bachs confirms that no payable session remains. After 23 hours the integration requires studio reconciliation instead of retrying beyond provider idempotency retention. Failed webhook deliveries must be monitored and replayed through Bachs after resolving outages. No automatic emails, shipping, refunds, or fulfillment are performed.

## Activation

1. Review/replace the product snapshot in `src/features/commerce/catalog.ts` and the matching Nuxt data with verified studio prices, purchase modes, dimensions, and inventory. The current authored catalog is provisional and must not be charged as real inventory.
2. Review and apply the new commerce migration to Kojo's own Supabase project. It has passed isolated local PostgreSQL tests but has not been applied to a Supabase project. Do not alter unrelated studio migrations. Verify RPC behavior and RLS against that project's configuration before activation.
3. Set the server-only `SUPABASE_COMMERCE_SECRET_KEY`, Kojo `BACHS_SECRET_KEY`, `BACHS_WEBHOOK_SECRET`, `BACHS_ACCOUNT_ID`, and a random `COMMERCE_ORDER_TOKEN_SECRET` of at least 32 characters. Never use Sanflavva's account or copy its keys.
4. Set `BACHS_ENVIRONMENT=sandbox`, a real public HTTPS website origin in `COMMERCE_APP_URL`, and matching CORS `ALLOWED_ORIGINS`. Configure the webhook URL on the API. There is intentionally no invented callback URL or localhost-to-production substitution.
5. Run sandbox round trips, including payment failure, cancellation, duplicate delivery, mismatched amounts, and concurrent original purchases; verify durable state and reservations. Configure edge rate limits for checkout creation before public exposure.
6. Only after catalog verification and sandbox validation set `CATALOG_VERIFIED=true`, `COMMERCE_ENABLED=true`, and the frontend commerce feature flag. A switch to live requires the live key/account and webhook configuration.

Turning `COMMERCE_ENABLED` off prevents new purchases while status lookups and verified webhooks continue processing existing orders. There are no live credentials or public deployment in this change.

## Verification and references

Run `npm run typecheck`, `npm test`, and `npm run build` (Wrangler dry run). Unit tests mock Bachs and storage and never contact a payment provider or database.

The migration was also applied successfully to an isolated temporary PostgreSQL database. `supabase/tests/commerce.sql` verifies role privileges, RLS, idempotency, original reservations, verified expiry, late conflicting payments, duplicate settlement, underpayment, and terminal review states. Separate concurrent database sessions confirmed that two buyers receive only one original reservation and that simultaneous retries share one order reference. The temporary server was then stopped. No remote database was accessed. Run the SQL test only in an isolated local database with Supabase's `anon`, `authenticated`, and `service_role` roles available; fixtures roll back. A sandbox Bachs round trip and verification against the intended Supabase project remain required before activation.

- [Bachs checkout sessions](https://docs.bachs.io/guides/checkout/checkout-sessions)
- [Bachs GHS pricing](https://docs.bachs.io/guides/checkout/any-currency-checkout)
- [Bachs webhook verification](https://docs.bachs.io/guides/webhooks/overview)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
