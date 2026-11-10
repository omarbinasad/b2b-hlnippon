# API contracts

**Status: a contract, not an implementation.** No backend exists yet. This is what the frontend will call once one does, for Laravel or Django alike. Read [BACKEND-INTEGRATION-GUIDE.md](BACKEND-INTEGRATION-GUIDE.md) first. `openapi.yaml` holds the same endpoints in OpenAPI 3.0.

## Conventions

| | |
|---|---|
| Base path | `/api/v1`. Breaking changes get `/api/v2`. |
| Format | JSON, UTF-8. Field names in camelCase, exactly as in the types below. |
| Money | Numbers in the store's currency, rounded to its minor unit (whole yen for JPY). The backend calculates; the frontend only displays. |
| Weight | Grams in integer fields named `...Grams`, kilograms where the type says so. |
| Dates | ISO 8601 UTC for moments (`2026-01-31T04:00:00Z`), `YYYY-MM-DD` for calendar dates. Interpret calendar dates in the store's time zone from company settings. |
| Ids | Opaque strings. The frontend never parses them. |
| Caching | Anything specific to a customer: `Cache-Control: private, no-store`. Public catalog and content may be cached, and must never vary by customer price. |

### Errors

Every failure has the same shape:

```json
{ "error": { "code": "validation_failed", "message": "Check the highlighted fields.", "fields": { "email": ["This email is already registered."] } } }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `bad_request` | Malformed request |
| 401 | `unauthenticated` | Not signed in |
| 403 | `forbidden` | Signed in, missing the capability |
| 404 | `not_found` | Missing, or belongs to another customer: never reveal which |
| 409 | `conflict` | State changed: stock gone, order already moved on, edit conflict |
| 422 | `validation_failed` | Fields invalid, or a business rule refused it. `fields` is keyed by input field. |
| 429 | `rate_limited` | With `Retry-After` |
| 500 | `server_error` | No internals in the message |

`message` and `fields` are shown to the user as written, so keep them plain. Field keys match the request's field names. For nested fields use dots: `lines.0.quantity`.

### Lists

Every list returns:

```json
{ "items": [], "page": 1, "perPage": 20, "total": 0, "totalPages": 0 }
```

`page` starts at 1. `perPage` is capped at 100 (the frontend asks for at most 100). `q` or `search` is a text search, as listed per endpoint. `sort` is a field name and `dir` is `asc` or `desc`. Unknown sort values fall back to the default. All filtering and sorting happens on the server: the frontend never receives a whole table to filter.

### Writes

Every write returns the updated record, or 204 where the endpoint says so. `PUT /x/{id}` replaces, `PATCH` changes the named fields, `POST /x` creates. Checkout and refunds must be idempotent: checkout takes an `idempotencyKey`, and the same key returns the order already placed.

The acting user always comes from the session. Requests never name the actor, and customer endpoints never take a customer id: `/customer/...` is always "the signed-in customer". The frontend's repository signatures do pass a customer or an actor, for the mock's sake; the HTTP adapter drops them.

## Sessions

The frontend doesn't commit to one approach. It runs on a server (Next.js), so these both work:

| Option | How | Notes |
|---|---|---|
| **HTTP-only session cookie (recommended)** | The backend sets `HttpOnly; Secure; SameSite=Lax`. Next.js forwards the cookie on its server-side calls, as `src/lib/data/index.ts` already does. | Tokens are out of reach of browser scripts. Needs the API on the same parent domain, or a proxy route. Use CSRF protection: with `SameSite=Lax` plus a token from `GET /auth/csrf` on writes. |
| Bearer token kept in an HTTP-only cookie by Next.js | Next.js swaps credentials for a token at sign-in, stores it in its own cookie, and sends `Authorization: Bearer`. | For an API on another domain. Change `headers` in `src/lib/data/index.ts`. Never put tokens in `localStorage`. |

Whichever is chosen: regenerate the session at sign-in, end it on the server at sign-out, expire idle sessions, lock out repeated failures, and check capabilities on every protected call. The frontend's route guards are only for display and protect nothing.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATA_SOURCE` | Server | `http` switches from the mock to the backend |
| `API_BASE_URL` | Server | e.g. `https://api.example.com/api/v1`. Preferred, since it never reaches the browser |
| `NEXT_PUBLIC_API_BASE_URL` | Browser and server | Only if browser code must call the API directly; a fallback for `API_BASE_URL`. Never a secret |
| `NEXT_PUBLIC_MEDIA_HOST` | Build | Host allowed for `next/image` |
| `NEXT_PUBLIC_SITE_URL` | Build and server | The public address, for the sitemap, robots and canonical links |
| `DEMO_VIEW_SWITCHER` | Server | `off` hides the demo switcher. Must be off in production |

No secret goes in a `NEXT_PUBLIC_` variable. Gateway, mail and storage credentials belong to the backend alone.

## State transitions

**Order status**, from `src/lib/orders/status.ts`:

```
received → preparing → on_the_way → delivered
    └──────────┴────────────┴──→ cancelled (reason required)
```

Delivered and cancelled are final. Items can be added, removed or replaced until delivered or cancelled. Prices and delivered weights can be corrected unless cancelled. "Open" means received, preparing or on the way, and not fully refunded.

**Payment status:** `unpaid` → `invoiced` → `paid` → `partially_refunded` → `refunded`. Choosing a method at checkout never changes it. Only recorded payments or verified gateway events do.

**Customer status:** `pending` → `approved` or `rejected`; `approved` → `suspended` → `approved`. A reason is required to reject or suspend. Only approved customers see prices or can order.

**Quotation:** `requested` → `quoted` or `declined`; `quoted` → `accepted` (creates an order at the quoted prices), `rejected` or `expired`.

**Pages and posts:** `draft` ↔ `published`, `scheduled` → live at its time, any → `trash` → restored or deleted for good. Only live content is public.

**Email log:** `queued` → `sent` or `failed`; `failed` → `queued` on retry.

**Reminder campaign:** `draft` ↔ `active`, `paused`. Sending is a scheduled job, deduplicated per customer, campaign and delivery date.

## Backend responsibilities

The frontend only displays. The backend owns all of this, and must recalculate rather than trust a value sent by the browser:

- Authentication, sessions, password storage, rate limits, and a capability check on every protected operation.
- Prices, quantity rules, coupons, shipping, tax and order totals, using the rules in the pure engines under `src/lib` (see [BUSINESS-RULES.md](BUSINESS-RULES.md)). Their tests are the reference.
- Stock: atomic reservation, no overselling, a movement record for every change.
- Checkout: re-pricing, re-validation, idempotency, immutable item snapshots.
- Orders, adjustments and delivered weight, with audit history.
- Refunds and real payment processing, webhooks, reconciliation.
- Invoices: frozen documents, sequential numbers, server-generated PDFs, private downloads.
- Email sending, queues, retries and bounce handling; the reminder scheduler.
- File storage: validation, malware scanning, private documents.
- HTML sanitizing on save (`src/lib/html/sanitize.ts` shows the allowlist). The frontend also sanitizes on display.
- Scheduled publishing, reports computed in the database, exports with audit logs.
- Backups, migrations and the data model in [DATABASE-REQUIREMENTS.md](DATABASE-REQUIREMENTS.md).

## Topics

Every topic asked for is under Endpoints below:

| Topic | Section |
|---|---|
| Authentication, sessions, PDF downloads, exports | Sign-in, sessions, documents and exports |
| Users, staff, roles, capabilities | Staff and roles ([ROLES-AND-CAPABILITIES.md](ROLES-AND-CAPABILITIES.md)) |
| Registration, approval, profiles, addresses, groups | Customers, registration, approval, addresses and groups |
| Products, categories, variations, inventory | Products and inventory; Categories; Brands, tags, attributes and classes |
| Pricing rules | Price rules; Quantity rules |
| Cart, checkout, orders, adjustments, delivered weight, refunds, invoices | Cart and quick order; Orders, checkout, adjustments, delivered weight, refunds and invoices |
| Coupons | Coupons |
| Zones, methods, conditional rules, pickup | Shipping zones, methods, rules, classes and pickup ([SHIPPING-RULES-AND-CALCULATIONS.md](SHIPPING-RULES-AND-CALCULATIONS.md)) |
| Tax, payments | Tax; Payment methods |
| Quotations, saved lists | Quotations; Saved lists |
| Schedules, reminders | Delivery schedules; Location-based reminders |
| Email templates, email logs | Email templates and logs |
| Reports | Reports and dashboard |
| Pages, posts, media, menus, homepage | Pages; Blog posts; Media; Navigation menus; Homepage content |
| Company settings, branding, feature settings | Company settings and branding (feature switches are part of `CompanySettings`) |
