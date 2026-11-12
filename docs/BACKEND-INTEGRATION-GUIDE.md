# Backend integration guide

For the developer building the backend, in Laravel or Django. Start here.

## What exists

A complete Next.js frontend running on in-memory demo data. Every page reads and writes through typed interfaces, so you can replace the data source without touching the pages.

```
Pages and server actions
        ↓
repositories (src/lib/data/repositories.ts: 31 typed interfaces)
        ↓
src/lib/data/index.ts  ← the one switch
   ↓                         ↓
mock (today)          HTTP adapter (ready, unused)
                             ↓
                      your REST API at /api/v1
```

The adapter in `src/lib/data/http/` is written and unit-tested against a fake server. **It has never run against a real backend**, so expect to find mismatches.

## Reading order

| Document | Why |
|---|---|
| [API-CONTRACTS.md](API-CONTRACTS.md), [openapi.yaml](openapi.yaml) | Every endpoint, with its permission, request, response and errors. Generated from the code |
| [BUSINESS-RULES.md](BUSINESS-RULES.md) | Every rule to implement. §29 lists what the demo doesn't really protect, and §30 lists open questions |
| [DATABASE-REQUIREMENTS.md](DATABASE-REQUIREMENTS.md) | Suggested data model |
| [ROLES-AND-CAPABILITIES.md](ROLES-AND-CAPABILITIES.md) | Permissions |
| [SHIPPING-RULES-AND-CALCULATIONS.md](SHIPPING-RULES-AND-CALCULATIONS.md) | The shipping calculation |
| [BACKEND-PENDING-FEATURES.md](BACKEND-PENDING-FEATURES.md) | What only you can make real |
| [WHITE-LABEL-ARCHITECTURE.md](WHITE-LABEL-ARCHITECTURE.md), [COMPANY-CONFIGURATION.md](COMPANY-CONFIGURATION.md) | One company per deployment, all of it in settings |
| [CMS-AND-CONTENT-MANAGEMENT.md](CMS-AND-CONTENT-MANAGEMENT.md) | Pages, posts, menus, homepage, revisions, autosave, reusable blocks |
| [PRODUCT-CSV.md](PRODUCT-CSV.md) | Product CSV import and export: columns, matching, results |
| [FRONTEND-ROUTE-MAP.md](FRONTEND-ROUTE-MAP.md) | Every screen, and what it reads |
| [DEMO-MODE-GUIDE.md](DEMO-MODE-GUIDE.md) | Running the demo to see expected behaviour |

`backend-api.md` is older, and `API-CONTRACTS.md` wins wherever they differ.

## The calculation reference

These files have no dependencies and are covered by `npm test`. They define the expected results, so port them, and port their test cases too:

| Logic | File | Tests |
|---|---|---|
| Money and order totals | `src/lib/orders/calc.ts` | `tests/order-calc.test.ts` |
| Prices and quantity limits | `src/lib/pricing/engine.ts` | `tests/pricing-engine.test.ts` |
| Coupons | `src/lib/coupons/engine.ts` | `tests/coupons.test.ts` |
| Shipping | `src/lib/shipping/engine.ts`, `rules.ts` | `tests/shipping-*.test.ts` |
| Tax | `src/lib/tax/engine.ts` | `tests/tax-engine.test.ts` |
| Refunds | `src/lib/orders/refund.ts` | `tests/refunds.test.ts` |
| Invoices | `src/lib/orders/invoice.ts` | `tests/invoices.test.ts` |
| Order status | `src/lib/orders/status.ts` | `tests/order-editing.test.ts` |
| Delivery dates | `src/lib/delivery/schedule.ts` | `tests/delivery-schedule.test.ts` |
| Reminder audiences | `src/lib/reminders/segment.ts` | `tests/notifications.test.ts` |
| Reports | `src/lib/reports/aggregate.ts` | `tests/roles-reports.test.ts` |
| Capabilities | `src/lib/auth/capabilities.ts` | `tests/roles-reports.test.ts` |
| HTML allowlist (incl. reusable-block markers) | `src/lib/html/sanitize.ts` | `tests/sanitize-html.test.ts`, `tests/cms-revisions-blocks.test.ts` |
| Product publishing checks and order limits | `src/lib/validation/product.ts` | `tests/product-quantity.test.ts` |
| Order money figures (received, outstanding, refund due, credit notes) | `src/lib/orders/money-summary.ts` | `tests/money-summary.test.ts` |
| Bulk product changes | `src/lib/catalog/bulk.ts` | `tests/product-bulk.test.ts` |
| Product CSV parsing and import planning | `src/lib/catalog/csv.ts`, `csv-import.ts` | `tests/product-csv.test.ts` |
| Content revisions and reusable blocks | `src/lib/content/revisions.ts`, `blocks.ts` | `tests/cms-revisions-blocks.test.ts` |

## Connecting a backend

1. **Build the sign-in endpoints first:** `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Choose a session approach from "Sessions" in `API-CONTRACTS.md`. An HTTP-only cookie is recommended.
2. **Replace the mock viewer.** `src/lib/auth/session.ts` decides who is signed in using demo cookies. Make `getViewer()`, `getCapabilities()` and `getAdminRole()` call `GET /auth/me`. Everything else already reads through these. Also replace the demo actions in `src/app/demo-view-actions.ts` and `src/lib/auth/demo-accounts.ts`, and wire the sign-in, forgot and reset password forms in `src/components/auth` to the endpoints.
3. **Serve company settings:** `GET /company`, since the whole site's branding, currency and country come from it. Today `src/config/runtime.ts` holds a copy in server memory. With a backend, load it per request, or cache it briefly and refresh it when settings change.
4. **Turn on the adapter:**

   ```
   DATA_SOURCE=http
   API_BASE_URL=https://api.example.com/api/v1
   DEMO_VIEW_SWITCHER=off
   ```

5. **Build one module at a time.** To run on a mix of mock and real data while building, in `src/lib/data/index.ts`:

   ```ts
   const http = fromHttp();
   export const repositories: Repositories = { ...mockRepositories, products: http.products, categories: http.categories };
   ```

   A suggested order: company, sign-in, catalog, customers, pricing, cart and checkout, orders, shipping and tax, then the rest.
6. **Check against the contract:** Run `npm run docs:api` after changing a repository interface or `src/lib/data/http/endpoints.ts`. TypeScript refuses to build if a repository method has no endpoint.

## Things that will need attention

The adapter works generically, and these specific places will need checking:

| Area | Why |
|---|---|
| Email-sending wrappers | `mock-repositories.ts` adds email log rows around mock calls. With a backend, you send the emails, and those wrappers disappear with the mock |
| Calculating previews | Admin order previews call the pure engines in the browser for instant feedback. They're display-only, and your result on save wins |
| `media.upload` | Sent as multipart with metadata as form fields. Check the form field names match |
| `testDraftZone`, `quoteLine`, `orders.search*` | Small helper endpoints for admin forms. Keep them fast |
| List filters | Query parameter names come from each repository's query type. See each endpoint |
| Dates | The mock stamps new records in UTC. "Day" logic in reports and filters must use the store's time zone |
| Cache | Next.js server rendering calls the API once per request. Nothing is cached, on purpose. Add caching only to public catalog and content, never for customer data |
| Reusable blocks | Pages store only block markers. The demo expands them in `src/lib/data/expand-blocks.ts` with `blocks.resolve`. Better: expand them in the API when serving a page or post, and keep usage in a table |
| Autosave | New, never-saved pages and posts autosave in the browser only; existing ones call `contentHistory.autosave` every few seconds while edited. Keep it cheap |
| Product import | The browser parses the CSV and sends rows (at most 1,000). A large catalog may need a background job instead |
| Build | With `DATA_SOURCE=http`, a build may call the API for statically rendered pages. Point it at a reachable API or render those pages dynamically |

## Who owns what

Full list under "Backend responsibilities" in `API-CONTRACTS.md`. In short, the frontend displays and collects input, and the backend decides everything: identity, permissions, prices, stock, totals, payments, emails, files and documents.

The frontend's permission checks, route guards and validation exist only for the user's convenience. **They protect nothing.** Repeat every check on the server.

## Running the project

```
npm install
npm run dev          # http://localhost:3000, on demo data
npm test             # pure logic, no backend needed
npm run typecheck
npm run lint
npm run build
npm run docs:api     # regenerate API-CONTRACTS.md and openapi.yaml
npm run docs:routes  # regenerate FRONTEND-ROUTE-MAP.md
```
