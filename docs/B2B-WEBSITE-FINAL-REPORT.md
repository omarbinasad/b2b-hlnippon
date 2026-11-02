# B2B website: final report (batches 1–2)

Date: 2026-10-28. Companion to [B2B-WEBSITE-FEATURE-AUDIT.md](B2B-WEBSITE-FEATURE-AUDIT.md) (per-module status with file
references) and [requirements-review.md](requirements-review.md) (270-item checklist).

## Batch 2 (2026-10-28): foundation check, local prices

**Verified (see the audit's "Foundation verification" section):** nothing is persistent. Applications, customers,
orders, carts, edits and settings live in server memory and are lost on restart. No feature works against a real
backend. Every "who is asking" decision comes from `MOCK_VIEWER` / `getPortalCustomerId()` / `getAdminActor()`.

**Order management (brief point 4), checked in code:** admin orders for registered customers, walk-in orders without
email/phone, add/remove/replace lines, quantity and price changes, fixed/percent order discounts, global stock changes
from the order page, delivered weight with re-pricing from the agreed unit price, updates shown in admin, portal and
revised invoices — all work **as demos** (in memory, tests in `tests/order-*.test.ts`). **Refunds and stock
movements on order create/edit/cancel are not built**: both need persistent, transactional storage first (to avoid
double deduction/restock and to keep refund records), so they wait for the decision below.

**Implemented:** Admin → Products: "Price" filter (No local price / Priced), a warning with the count of products that
can't be ordered and why, and a "No price" badge (`src/app/admin/products/page.tsx`, `pricing` on
`AdminProductListQuery`, `src/lib/data/mock-catalog.ts`). Already in place and re-verified: separate BDT price per
product/variation, source JPY price shown for reference only and never converted, unpriced products blocked from cart,
checkout and admin orders, rules priced from the local price.

**Tests:** `npm test` 160 passed · typecheck, lint passed · dev-server check of the filter: 79 products = 60 missing +
19 priced.

### §0. Decision needed: persistence and authentication

The repository layer means a database can be added **inside this Next.js project** without a rebuild and without
blocking a later Laravel/Django backend (that would be one more `Repositories` implementation, an API client).

| Option | What it adds | Good for | Cost / risk |
| --- | --- | --- | --- |
| A. PostgreSQL + Drizzle ORM + Better Auth, in Next.js (recommended) | `drizzle-orm`, `pg`, `drizzle-kit`, `better-auth`; migrations; row-locked transactions for stock and refunds; password login, sessions, roles | Production on any host (VPS, Vercel + managed Postgres such as Neon/Supabase) | 4 packages; needs a Postgres database (free tiers exist) |
| B. Same with Prisma instead of Drizzle | `prisma`, `@prisma/client`, auth library | Teams that know Prisma | Heavier client and build step |
| C. SQLite file via Node's built-in `node:sqlite` | No packages; one local file | Local demos and a single always-on server | Not for serverless hosting; Node 22's module is still experimental; later move to Postgres |
| D. Keep mocks, wait for Laravel/Django | Nothing | If that backend is definitely coming | Refunds, stock movements, login stay blocked |

## Read this first

The project is a **frontend with a complete in-memory demo backend**. No real backend exists: no database, no login,
no email, no payment gateway (Laravel vs Django is still undecided). Everything below "works" against data held in
server memory, which **resets on restart**. By the audit's own rule, that means no feature is fully IMPLEMENTED yet.
This batch made the store usable end to end for an approved customer: apply → (admin approves) → add to cart →
checkout → order appears in the account and admin → reorder.

## 1. Requirements reviewed

25 modules from the audit brief (the audit file) and the 270-item checklist. Checklist after this batch:
**151 working (demo) · 42 partial · 71 missing · 6 N/A** (before: 141 · 46 · 77 · 6).

## 2. Already in place before this task (demo, in memory)

Wholesale price and quantity rules engine; catalog and shop with server-side filters; admin product, category,
customer, group, shipping, tax and payment-method management; admin order creation including walk-in orders without
email/phone; advanced order editing with history; global stock changes from the order page; delivered-weight pricing;
invoices, revisions and credit notes; order status workflow; admin dashboard computed from orders.

## 3. Implemented during this task

| Feature | Where |
| --- | --- |
| Online wholesale application: validated form, creates a pending customer with business address, duplicate email/phone check, shows in Admin → Customers for the existing approve/reject flow | `src/app/(auth)/register/page.tsx`, `src/components/auth/register-form.tsx`, `src/app/(auth)/actions.ts`, `src/lib/validation/registration.ts`, `customers.register()` in `src/lib/data/mock-customers.ts` |
| Product page: option selector with the customer's price per option, quantity with min/max/step hints, add to cart (approved customers only; other viewers see the right message) | `src/app/(store)/(pages)/shop/[slug]/page.tsx`, `src/components/product/add-to-cart.tsx` |
| Server-side cart per customer: re-priced on every view (rules, sale price, bulk tiers), quantity rules, pack step and stock checks, edit/remove | `src/lib/data/mock-cart.ts`, `src/lib/orders/cart.ts`, `src/components/cart/cart-view.tsx`, `src/app/(store)/(pages)/cart/page.tsx` |
| Checkout: own delivery/billing addresses, delivery date, offline payment methods, live server totals (shipping quote + tax snapshot), duplicate-submission guard (idempotency key + disabled button), order confirmation | `orders.checkout()` / `orders.checkoutPreview()` in `src/lib/data/mock-orders.ts`, `src/components/cart/checkout-form.tsx`, `src/app/(store)/(pages)/checkout/page.tsx` |
| Online orders recorded as `createdVia: "storefront"`, "Placed online by the customer", never marked paid | `buildOrder()` in `src/lib/data/mock-orders.ts` |
| Reorder ("Order again") scoped to the customer's own orders | `src/components/order/reorder-button.tsx`, `reorderAction` in `src/app/(store)/actions.ts`, `src/app/account/orders/[id]/page.tsx` |

## 4. Fixed

- The registration postcode hint showed a Japanese format ("160-0000"); it now uses Bangladesh 4-digit postcodes.
- Removed the unused placeholder `Cart` / `CartItem` types from `src/lib/types/order.ts`; they are replaced by
  `src/lib/types/cart.ts`.
- `orders.create()` and checkout now share one validated build path (`buildOrder`), so online and admin orders are
  priced, shipped and taxed the same way.

## 5. Partially completed

- Quick order: Home search panel with prices exists. The multi-line `/account/quick-order` page and bulk add are not built.
- Inventory: checkout blocks out-of-stock lines and quantities above counted stock. Stock is **not yet reduced** when an
  order is placed, or restored on cancel or edit.
- Registration: no password or login account (needs auth backend).

## 6. Still missing

Real authentication, roles and permissions · saved lists · multi-line quick order · coupons · refunds (full, partial,
per line, restock) · stock movements on order create/edit/cancel · quotations · delivery schedules and reminder emails ·
customer profile and address editing · upcoming deliveries and monthly spending widgets · new/returning customer,
repeat-order and monthly reports, CSV export · editing addresses and shipping fee on existing orders · sitemap, robots,
canonical, JSON-LD · featured products · product image gallery · online payment.

## 7. Backend integrations still required

Database and migrations; authentication (sessions, password hashing, CSRF, rate limiting on login and registration);
authorization checks on every action; implementing `Repositories` (`src/lib/data/repositories.ts`) as an API client,
following `docs/backend-api.md`; email service and job scheduler (approvals, reminders); payment provider with webhooks
and refunds; media storage for product images.

## 8. Files

Created: `src/lib/types/cart.ts`, `src/lib/orders/cart.ts`, `src/lib/validation/registration.ts`, `src/lib/data/mock-cart.ts`,
`src/app/(auth)/actions.ts`, `src/components/auth/register-form.tsx`, `src/components/product/add-to-cart.tsx`,
`src/components/cart/cart-view.tsx`, `src/components/cart/checkout-form.tsx`, `src/components/cart/shopper-gate.tsx`,
`src/components/order/reorder-button.tsx`, `tests/cart-checkout.test.ts`, `docs/B2B-WEBSITE-FEATURE-AUDIT.md`, this report.

Modified: `src/lib/types/index.ts`, `src/lib/types/order.ts`, `src/lib/types/customer.ts`, `src/lib/data/repositories.ts`,
`src/lib/data/mock-repositories.ts`, `src/lib/data/mock-orders.ts`, `src/lib/data/mock-customers.ts`,
`src/lib/auth/session.ts` (`getShoppingCustomerId`), `src/app/(store)/actions.ts`, `src/app/(auth)/register/page.tsx`,
`src/app/(store)/(pages)/cart/page.tsx`, `src/app/(store)/(pages)/checkout/page.tsx`,
`src/app/(store)/(pages)/shop/[slug]/page.tsx`, `src/app/account/orders/[id]/page.tsx`, `src/components/ui/feedback.tsx`
(success notice tone), `docs/backend-api.md`, `docs/FEATURE_SCOPE.md`, `docs/requirements-review.md`, `CLAUDE.md`.

## 9. Database / schema changes

None. There is no database. New contract types for the backend: `CartLineInput`, `CartLine`, `Cart`, `CheckoutInput`,
`CheckoutPreview`, `RegistrationInput`; new repository methods `cart.*`, `orders.checkout`, `orders.checkoutPreview`,
`customers.register` (documented in `docs/backend-api.md`).

## 10. Tests

| Check | Result |
| --- | --- |
| `npm test` | 160 passed, 0 failed (10 new in `tests/cart-checkout.test.ts`: line merge, min/max/step, stock and backorders, unpriced/unavailable, delivery date, payment mapping, registration validation) |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; `/cart`, `/checkout`, `/shop/[slug]` render per request (customer prices never cached) |
| Server actions on a local dev server (`MOCK_VIEWER=customer`, port 3100) | Passed: add/merge/remove/invalid quantity; unpriced product rejected; checkout rejects an unavailable payment method, a past date and an address the customer doesn't own; preview total = items + shipping; **two simultaneous submissions with one key → one order**; cart emptied; order visible in the account (with confirmation) and admin ("Placed online by the customer"); reorder of a foreign order → not found; reorder of own order → cart; registration errors, success, duplicate email; applicant in the admin pending list |

Not tested: real browser click-through and the 430px mobile layout (no browser tool was available). Treat the new
screens as NEEDS RUNTIME TESTING on a phone-width viewport.

## 11. Known limitations

- All data is in memory: restarts wipe carts, orders and applications; serverless deployments don't share it.
- The viewer is chosen by `MOCK_VIEWER`. To try the cart and checkout locally, set `MOCK_VIEWER=customer` (the shared
  `.env.local` currently says `guest`). `/admin` and `/account` are open to anyone.
- Imported WooCommerce products have no BDT price (the source is in JPY), so only the seeded sample products can be
  ordered until prices are entered.
- Tax rates are fictional and tax is off by default. No payment is processed; orders are never marked paid.

## 12. Staging and production checks required

Real auth and per-customer isolation tests; price, quantity, stock and shipping enforcement in the backend at
cart, checkout and admin order time; idempotency on `POST /customer/orders`; concurrency and stock locking;
`Cache-Control: private, no-store` on customer responses; registration rate limiting and bot protection; mobile
(430px) and accessibility pass; real BDT prices for imported products; accountant-confirmed tax rates; payment
provider sandbox tests before live mode.
