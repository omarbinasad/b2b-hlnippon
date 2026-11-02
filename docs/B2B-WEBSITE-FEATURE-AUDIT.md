# B2B website feature audit

Audit date: 2026-10-28. Scope: the 25 modules in the "Full B2B website feature audit" brief, checked against the code in
this repository (not against screens alone). Rows marked **(batch 1)** / **(batch 2)** changed during this task; see
[B2B-WEBSITE-FINAL-REPORT.md](B2B-WEBSITE-FINAL-REPORT.md). The earlier 270-item checklist review is
[requirements-review.md](requirements-review.md).

## Architecture findings (Phase 1)

| Area | Finding |
| --- | --- |
| Framework | Next.js 16.3.7 App Router, React 19.2, TypeScript, Tailwind v4. No other runtime dependencies. |
| Routing | `src/app/(store)` storefront, `(auth)` login/register, `account` customer portal, `admin` admin panel. Typed routes. |
| Backend | **None.** Laravel vs Django is undecided (see CLAUDE.md). No API routes, no database, no ORM, no migrations. |
| Data | Every page calls `repositories` from `src/lib/data/index.ts`; the only implementation is `mockRepositories` (`src/lib/data/mock-*.ts`), which keeps records **in memory on `globalThis`**. Changes survive refreshes but are lost on a server restart and are not shared between serverless instances. |
| Writes | Server actions in `src/app/admin/*/actions.ts` (and `src/app/(store)/actions.ts`, `src/app/(auth)/actions.ts`, `src/app/account/actions.ts` from batch 1) → repositories. Validation is shared in `src/lib/validation`. |
| Business logic | Pure, tested engines: pricing `src/lib/pricing/engine.ts`, order money `src/lib/orders/calc.ts`, shipping `src/lib/shipping/engine.ts`, tax `src/lib/tax/engine.ts`, payment availability `src/lib/payments/methods.ts`, invoices `src/lib/orders/invoice.ts`. A backend must reproduce them. |
| Authentication | **Mock only.** `src/lib/auth/session.ts` picks the viewer from the `MOCK_VIEWER` env var (`guest`, `customer`, `customer-pending`, `admin`). No passwords, sessions or permission enforcement; `/admin` and `/account` are reachable by anyone. |
| WooCommerce | Development-only, read-only import (`scripts/import-woocommerce.ts`, GET requests with credentials in a header from git-ignored `.env.local`) writes a local fixture (`src/lib/data/fixtures/woocommerce-catalog.json`) and images. The app and builds never contact WordPress. Business logic does not depend on WooCommerce. |
| Tests | Node test runner, `tests/*.test.ts`: pure engines, validation, fixture and sanitizer. No browser or end-to-end tests. |

**Consequence for statuses:** the brief says a feature is not IMPLEMENTED when data is only stored temporarily or
the API is mocked. Because no backend exists, **no feature in this project can be IMPLEMENTED today.** Features whose
logic, validation and screens are complete against the in-memory store are marked **PARTIALLY IMPLEMENTED** with
"Demo complete" in the backend column; the remaining work for those is persistence, real auth and backend enforcement.

## Foundation verification (batch 2, 2026-10-28)

Checked in the code, not from earlier reports:

| Question | Answer | Evidence |
| --- | --- | --- |
| Are applications, customers, orders, carts saved persistently? | **No.** All are in-memory `Map`s/arrays on `globalThis` (`__mockCustomersV`, `__mockOrdersV`, `__mockCarts`, `__mockCheckoutKeys`, `__mockCatalogV`, `__mockRulesV`, `__mockShippingV`, `__mockTaxV`, `__mockPaymentsV`) | No file, database or ORM code in `src/`; runtime dependencies are only `next`, `react`, `react-dom` |
| Does order data survive a restart? | **No.** A restart reloads the seed data; new orders, applications, carts and edits are lost | same |
| What works with a real backend? | **Nothing.** No API routes, database or external service. The only network code is the dev-time WooCommerce read-only import script | `scripts/import-woocommerce.ts` |
| What depends on `MOCK_VIEWER` / dev-only auth? | Everything that knows "who is asking": price visibility, product-page ordering, cart, checkout, reorder, the whole `/account` area (always customer `cus-001` via `getPortalCustomerId()`), and admin action authorship (`getAdminActor()` always "Demo admin" with every permission). `/admin` and `/account` have no access check | `src/lib/auth/session.ts` and its 17 callers |
| Can the current architecture take a real database, auth, roles and APIs without a rebuild? | **Yes.** Pages and actions only call `repositories` (`src/lib/data/index.ts`); a database-backed implementation of the `Repositories` interface can replace `mockRepositories` behind the same interface, and `session.ts` is the single place to swap in real sessions. The pure engines (pricing, order money, shipping, tax) are reused unchanged. Options are in the final report §0 | `src/lib/data/repositories.ts` |

Status legend: IMPLEMENTED · PARTIALLY IMPLEMENTED · UI ONLY · MISSING · BROKEN · NEEDS RUNTIME TESTING · NOT APPLICABLE.

## 1. Public storefront

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Homepage, B2B hero, categories, quick-order panel, delivery lookup | PARTIALLY IMPLEMENTED | `src/app/(store)/page.tsx`, `src/components/storefront/*`, `src/config/storefront.ts` | Demo complete (catalog from fixture) | Real hero images; backend catalog |
| Featured products section | MISSING | — (`storefront.ts` has featured categories only) | — | "Featured" product flag + section |
| Registration / Apply for B2B | PARTIALLY IMPLEMENTED **(batch 1)** | `src/app/(auth)/register/*`, `src/app/(auth)/actions.ts`, `src/lib/validation/registration.ts`, `customers.register()` | Demo: saves a pending customer in memory; no password or login account | Real account + password + email verification (backend) |
| Login / logout | UI ONLY | `src/app/(auth)/login/page.tsx` (disabled form) | No auth backend | Real authentication (backend) |
| Product listing, search, filters, category navigation | PARTIALLY IMPLEMENTED | `src/app/(store)/(pages)/shop/page.tsx`, `src/components/shop/filter-sidebar.tsx`, `products.list()` | Demo complete; server-side filtering + pagination | Backend search index |
| Product details | PARTIALLY IMPLEMENTED **(batch 1)** | `src/app/(store)/(pages)/shop/[slug]/page.tsx`, `src/components/product/add-to-cart.tsx` | Demo: customer price per option + add to cart for approved customers | Image gallery |
| Wholesale price visibility | PARTIALLY IMPLEMENTED | `canSeeWholesalePrices()` in `src/lib/auth/session.ts`, `src/lib/storefront/quick-order.ts` | Prices are resolved server-side only for approved viewers, but the viewer is mocked | Real session check (backend) |
| Shopping cart | PARTIALLY IMPLEMENTED **(batch 1)** | `src/app/(store)/(pages)/cart/*`, `src/lib/data/mock-cart.ts` | Demo: server-side cart per customer, in memory | Persistent cart (backend) |
| Checkout | PARTIALLY IMPLEMENTED **(batch 1)** | `src/app/(store)/(pages)/checkout/*`, `orders.checkoutPreview()` / `orders.checkout()` | Demo: creates a real in-memory order; no payment processing | Backend order API, payment gateway |
| About / delivery information / contact | UI ONLY | `about/page.tsx`, `contact/page.tsx`, `delivery-lookup.tsx` | Contact form needs email backend | Content; contact form |
| Responsive header/footer | PARTIALLY IMPLEMENTED | `src/components/layout/store-header.tsx`, `store-footer.tsx` | — | 430px manual check after each change (NEEDS RUNTIME TESTING) |
| SEO structure | PARTIALLY IMPLEMENTED | `generateMetadata` on product pages; private pages `robots: noindex` | — | Sitemap, robots.txt, canonical URLs, Product JSON-LD |

## 2. Customer registration & approval

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Business registration with custom fields | PARTIALLY IMPLEMENTED **(batch 1, document uploads batch 2)** | see §1; `src/lib/validation/documents.ts`, `src/components/auth/document-field.tsx`, `src/app/admin/customers/[id]/documents/[documentId]/route.ts` | Demo: ID files in server memory; staff route not protected (no auth) | Configurable extra fields; private file storage, virus scan, access log |
| Secure login, password handling, session security | MISSING | `src/lib/auth/session.ts` (mock) | Needs backend | Auth, hashing, sessions, CSRF, rate limiting |
| Pending approval page | PARTIALLY IMPLEMENTED | `src/app/(auth)/application-pending/page.tsx` | Demo | Tie to real session |
| Admin approve / reject / suspend with history | PARTIALLY IMPLEMENTED | `src/app/admin/customers/[id]/page.tsx`, `src/components/admin/customers/status-panel.tsx`, `customers.setStatus()` | Demo complete | Emails on decision; backend |
| Business profile, customer groups | PARTIALLY IMPLEMENTED | `src/app/admin/customers/*`, `src/app/admin/customer-groups/*` | Demo complete (admin side) | — |
| Customer edits own profile / addresses | UI ONLY | `src/app/account/profile/page.tsx`, `account/addresses/page.tsx` (read-only) | — | Edit forms + actions |
| Role-based permissions | MISSING | `getAdminActor()` returns a fixed permission list | Not enforced | Roles, staff users, checks on every action (backend) |

## 3. Wholesale pricing engine

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Customer / group / all-customer rules; product / variation / category scope | PARTIALLY IMPLEMENTED | `src/lib/pricing/engine.ts`, `src/lib/data/mock-pricing.ts`, `src/app/admin/pricing/*` | Demo complete; engine tested (`tests/pricing-engine.test.ts`) | Backend must reproduce the engine |
| % off, amount off, fixed price, up to 10 quantity tiers | PARTIALLY IMPLEMENTED | same | Demo complete | — |
| Sale price handling (lower of rule and sale, no stacking) | PARTIALLY IMPLEMENTED | `quotePrice()` in `src/lib/data/mock/pricing-rules.ts` | Demo complete, tested | — |
| Rule priority / conflict detection | PARTIALLY IMPLEMENTED | engine + `src/app/admin/pricing/page.tsx` (conflict filter) | Demo complete | — |
| MOQ / max / step | PARTIALLY IMPLEMENTED | quantity rules `src/app/admin/pricing/quantity/*`, `checkQuantity()` | Demo complete | — |
| Rules use the product's local (store-currency) price; products without one are never priced or orderable | PARTIALLY IMPLEMENTED **(batch 2 verified)** | `quotePrice()` returns null without a `basePrice`; imported source prices live only in `importSource` | Demo | Backend must keep the same rule |
| Prices in listings, cart, checkout, quick order, admin orders | PARTIALLY IMPLEMENTED **(batch 1)** | quick order, cart, checkout and admin orders all price server-side via `quotePrice()` | Demo | Backend enforcement |

## 4. Product management

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Add / edit / duplicate / archive products | PARTIALLY IMPLEMENTED | `src/app/admin/products/*`, `src/components/admin/products/*`, `src/lib/data/mock-catalog.ts` | Demo complete | Backend |
| Images | PARTIALLY IMPLEMENTED | `image-manager.tsx` | Demo: new uploads are not stored | Media storage (backend) |
| Categories / subcategories, brands, attributes | PARTIALLY IMPLEMENTED | `src/app/admin/categories/*`, attributes editor | Demo complete | — |
| Simple + variable products, SKUs, regular/sale price, weight, dimensions | PARTIALLY IMPLEMENTED | product form, variations editor | Demo complete | Packaging/case fields |
| Local selling price for imported products; products missing one clearly identified | PARTIALLY IMPLEMENTED **(batch 2)** | product form (BDT price per product/variation, source price shown as reference with "not converted and not used"), `/admin/products` "Price: No local price" filter, warning with the count, "No price" badge | Demo | Persistence |
| Stock quantity / status / low-stock threshold | PARTIALLY IMPLEMENTED | `inventory-shipping.tsx`; dashboard low-stock panel | Demo | Low-stock notifications |
| Bulk import / export | MISSING | Dev-only WooCommerce import script | — | CSV import/export |

## 5. Inventory

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Product and variation stock tracking | PARTIALLY IMPLEMENTED | `StockInfo` in `src/lib/types/catalog.ts`, `src/lib/orders/stock.ts` | Demo | — |
| Inventory validation at checkout | PARTIALLY IMPLEMENTED **(batch 1)** | `checkout()` rejects out-of-stock lines and counts above stock | Demo | Backend locking |
| Stock reduced when an order is placed / restored on cancel or edit | MISSING | — | — | Stock movements on create, edit, cancel, refund |
| Low-stock notifications | MISSING | dashboard panel only | — | Notifications |

## 6. Cart & checkout

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Add / remove / update quantities, MOQ/max/step checks | PARTIALLY IMPLEMENTED **(batch 1)** | `src/lib/data/mock-cart.ts`, `src/components/cart/*` | Demo | Backend |
| Wholesale prices, shipping, tax in cart/checkout | PARTIALLY IMPLEMENTED **(batch 1)** | `orders.checkoutPreview()` reuses the shipping quote and tax snapshot | Demo (fictional tax rates) | — |
| Coupons | MISSING | — | — | Coupon model + engine |
| Payment method selection | PARTIALLY IMPLEMENTED **(batch 1)** | `payments.checkoutMethods()` | Offline methods only; no gateway | Gateway (backend) |
| Order creation, duplicate-submission guard, confirmation | PARTIALLY IMPLEMENTED **(batch 1)** | `checkout()` with idempotency key; confirmation on `/account/orders/[id]?placed=1` | Demo | Backend |
| Payment success / failure / pending states | MISSING | — | No gateway | Gateway webhooks (backend) |

## 7. Customer dashboard

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Overview, total orders, recent orders, order history, details, statuses | PARTIALLY IMPLEMENTED | `src/app/account/page.tsx`, `account/orders/*` | Demo; scoped by `customerId` | Real session for isolation |
| Invoice access | PARTIALLY IMPLEMENTED | `src/app/account/orders/[id]/invoice/page.tsx` | Demo | PDF files |
| Reorder | PARTIALLY IMPLEMENTED **(batch 1)** | "Order again" on `account/orders/[id]` | Demo | — |
| Upcoming deliveries, monthly spending | MISSING | — | — | Widgets |
| Quick order page, saved lists | UI ONLY | `src/app/account/quick-order/page.tsx` (placeholder) | — | Multi-line quick order, saved lists |
| Quotations | MISSING | — | — | See §19 |
| Profile, addresses, account settings | UI ONLY | read-only pages | — | Edit forms |
| Data isolation | PARTIALLY IMPLEMENTED | `orders.getById(id, customerId)` scopes portal lookups | Only as safe as the mock viewer | Real auth |

## 8. Quick order & reorder

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Search by name / SKU with B2B prices | PARTIALLY IMPLEMENTED | `src/lib/storefront/quick-order.ts`, `src/components/storefront/quick-order.tsx` | Demo | — |
| Multi-product entry, bulk add to cart | MISSING | — | — | Quick-order form using the cart |
| Order again | PARTIALLY IMPLEMENTED **(batch 1)** | see §7 | Demo | — |
| Saved lists (create / edit / delete / add to cart) | MISSING | — | — | Model + screens |

## 9. Admin order creation

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Registered customer search, products + variations, quantities, wholesale prices | PARTIALLY IMPLEMENTED | `src/app/admin/orders/new/page.tsx`, `create-order-form.tsx`, `orders.create()` | Demo complete | Backend |
| Price override, line and order discounts | PARTIALLY IMPLEMENTED | same + `order-discount.tsx` | Demo complete | — |
| Shipping and payment selection | PARTIALLY IMPLEMENTED | same | Demo complete | — |
| Walk-in orders, no email or phone required, no account | PARTIALLY IMPLEMENTED | `walkIn` in `CreateOrderInput`, `validateCreateOrder()` | Demo complete; tested (`tests/invoices.test.ts`) | — |
| Correct totals | PARTIALLY IMPLEMENTED | `src/lib/orders/calc.ts`, `assemble.ts` | Paisa math, tested | — |

## 10. Advanced admin order editing

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Add / remove / replace items, quantities, prices, discounts, delivery date | PARTIALLY IMPLEMENTED | `src/app/admin/orders/[id]/page.tsx`, `src/components/admin/orders/item-edit.tsx`, `orders.edit()` | Demo complete; tested (`tests/order-editing.test.ts`) | Backend |
| Status changes, notes, change history | PARTIALLY IMPLEMENTED | `updateStatus()`, `addNote()`, `adjustments` | Demo complete | — |
| Edit billing/shipping address after creation | MISSING | addresses editable only on the create form | — | Address edit on existing orders |
| Adjust shipping fee on an existing order | MISSING | — | — | Shipping edit kind |
| Preserve payment records; catalog prices untouched | PARTIALLY IMPLEMENTED | `amountPaid`, `paymentBalance()` | Demo | — |

## 11. Global stock from order details

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Show availability, mark in/out of stock (incl. variations), remove/replace items, recalculate | PARTIALLY IMPLEMENTED | `src/components/admin/orders/line-stock.tsx`, `products.setStock()`, `setLineStockAction` | Demo complete; storefront reads the same catalog | Backend |

## 12. Delivered weight pricing

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Ordered vs delivered weight, price from agreed per-kg price, totals/tax/discount recalculated, balance due/refundable shown in admin, portal and invoice | PARTIALLY IMPLEMENTED | `adjust-item.tsx`, `applyLineChange()` in `src/lib/orders/calc.ts`, `order-details.tsx`, `invoice-document.tsx` | Demo complete; tested (`tests/order-calc.test.ts`) | No automatic charge/refund (by design) |

## 13. Invoices

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Generate, revise, credit note; all required fields; printable | PARTIALLY IMPLEMENTED | `src/lib/orders/invoice.ts`, `src/components/order/invoice-document.tsx`, admin + account invoice pages | Demo complete; tested | PDF file download, legal tax-invoice rules |

## 14. Refunds

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Full / partial / per-line / per-quantity / manual refunds, reasons, history, restock | MISSING | `Refund` type + `refundedTotal` only (`src/lib/types/order.ts`) | — | Refund recording + screens; restock |
| Gateway refunds | MISSING | — | No gateway | Backend + provider API |

## 15. Order status workflow

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Received → Preparing → On the way → Delivered, cancel; same on admin and portal | PARTIALLY IMPLEMENTED | `src/lib/orders/status.ts` | Demo complete | Customer notifications |
| Payment / refund statuses | PARTIALLY IMPLEMENTED | `paymentStatus` on orders | Demo; never marked paid automatically | Gateway |

## 16. Shipping

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Zones (prefecture/city/postcode), methods, weight/price rates, free shipping, preview | PARTIALLY IMPLEMENTED | `src/lib/shipping/engine.ts`, `src/app/admin/shipping/*` | Demo complete; tested | — |
| Delivery routes / schedules | UI ONLY | `src/app/admin/delivery/page.tsx` (read-only list) | — | Route editing, schedules, holidays |

## 17. Tax

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| On/off, inclusive/exclusive, classes, location rates, order snapshots, edit recalculation, invoice lines | PARTIALLY IMPLEMENTED | `src/lib/tax/engine.ts`, `src/app/admin/tax/*` | Demo complete with fictional rates; tested | Real rates confirmed by an accountant |

## 18. Payments

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Method settings (COD, bank transfer, mobile wallet, invoice), ordering, availability | PARTIALLY IMPLEMENTED | `src/app/admin/payments/*`, `src/lib/payments/methods.ts` | Settings only, by design | — |
| Online gateway, transactions, confirmation, failures | MISSING | — | No gateway | Backend + provider |
| Balance due after edits | PARTIALLY IMPLEMENTED | `paymentBalance()` | Demo | — |

## 19. Quotations

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Requests, admin management, prices, statuses, accept/reject, convert to order | MISSING | — | — | Whole module |

## 20. Delivery schedules & reminders

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Locations, recurring schedules, dates, segmentation | UI ONLY | `admin/delivery/page.tsx`, `DeliveryRoute` type | Read-only | Schedule model + editor + customer matching |
| Reminder templates, automated sending, duplicate prevention, logs | UI ONLY | `src/app/admin/reminders/page.tsx` (read-only list) | No email service or scheduler | Backend job scheduler + email provider |

## 21. Admin dashboard & reports

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Sales, orders, active customers, AOV, revenue chart, date range + comparison, status breakdown, top products/categories/customers, low stock, pending approvals | PARTIALLY IMPLEMENTED | `src/app/admin/page.tsx`, `src/lib/data/mock-analytics.ts`, `src/components/admin/dashboard/*` | Computed from the in-memory orders (not hard-coded) | Backend |
| New vs returning customers, repeat orders, monthly report, CSV export, refund report | MISSING | — | — | Reports + export |

## 22. Settings & roles

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Store settings, currency/timezone config | PARTIALLY IMPLEMENTED | `src/app/admin/settings/*`, `src/config/site.ts` | Demo | Currency/timezone editable in admin |
| Pricing, quantity, shipping, tax, payment settings | PARTIALLY IMPLEMENTED | respective admin modules | Demo complete | — |
| Email, delivery settings | MISSING | — | — | — |
| Staff users, roles, permissions | MISSING | — | — | Backend |

## 23. UI/UX

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Tokens, light/dark mode, mobile-first layouts, list toolbars, validation and feedback messages | PARTIALLY IMPLEMENTED | `src/app/globals.css`, `src/components/ui/*` | — | NEEDS RUNTIME TESTING at 430px for new screens |

## 24. SEO & content

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Metadata, private pages noindex, `next/image` | PARTIALLY IMPLEMENTED | page `metadata` exports | — | Sitemap, robots.txt, canonical, JSON-LD |
| Blog | NOT APPLICABLE | not part of the project | — | — |

## 25. Security, performance, architecture

| Feature | Status | Existing files | API/Backend status | Missing work |
| --- | --- | --- | --- | --- |
| Authentication, authorization, data isolation | MISSING | mock viewer | — | Backend |
| Server-side validation | PARTIALLY IMPLEMENTED | `src/lib/validation/*` used by every action | Demo | Backend must repeat it |
| No exposed credentials | PARTIALLY IMPLEMENTED | WooCommerce keys only in git-ignored `.env.local`, no `NEXT_PUBLIC_` | Verified | — |
| Pagination, server-side filtering, no full-catalog payloads | PARTIALLY IMPLEMENTED | `src/lib/list-params.ts`, repositories | Demo | — |
| Database, migrations, logging | MISSING | — | No backend | Backend |
| Automated tests | PARTIALLY IMPLEMENTED | `tests/*.test.ts` | Unit tests | E2E/browser tests |

## WooCommerce data source (Phase 3)

1. Integration: `scripts/import-woocommerce.ts` only (dev-time). Not used at runtime or build.
2. Products, categories, variations and prices are imported into the fixture; covered by `tests/woocommerce-fixture.test.ts`.
3. Read-only: GET requests only; no writes to WordPress.
4. Decoupled: the fixture is mapped to the app's own types in `src/lib/data/mock/imported-catalog.ts`; replacing the data
   source means implementing `Repositories`, not touching pages.
5. No secret reaches the browser; credentials are read only by the script.
6. **Prices:** the source store prices in JPY while this app uses BDT. Imported prices are kept in `importSource` only
   (not converted), so the 59 imported products have **no store price and cannot be added to the cart** until BDT prices
   are entered in Admin → Products. Cart and checkout were verified with the seeded sample products (e.g. `p-003`).
   Batch 2: Admin → Products shows how many products can't be ordered for lack of a BDT price and filters them
   (`?pricing=missing`; runtime check: 60 missing + 19 priced = 79). Entering a local price never writes to WordPress.
