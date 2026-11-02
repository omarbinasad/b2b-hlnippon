# Frontend completion report

Status of the "Complete the B2B frontend and prepare the Laravel/Django backend handoff" work, including the
extended scope of 2026-10-29 (WordPress-like CMS, coupons, invoice and transactional email management). Updated
after every batch. Last update: 2026-10-29 (batch 2).

**What "done" means here.** The project is a frontend with an in-memory **demo** data layer
(`src/lib/data/mock-*.ts`, reset on every server restart). A screen marked *Demo* works end to end against that
layer: validation, totals, state changes and history. It is not production functionality until the backend
implements the same contract (`docs/backend-api.md`, later `docs/API-CONTRACTS.md`). No real login, payment, refund,
email, PDF generation or persistent storage exists. A screen alone is never marked done.

## Decisions taken

| Decision | Value | Where |
| --- | --- | --- |
| Store country, currency, time zone | Japan · JPY (¥, whole yen, no decimals) · Asia/Tokyo (UTC+9) | `src/config/currency.ts`, `src/config/site.ts` (confirmed by the owner, 2026-10-29) |
| Address format | 〒 postcode (7 digits, stored `NNN-NNNN`) · prefecture (47, `src/lib/locations.ts`) · city (市区町村) · optional town (町域) · street/building | `src/lib/types/customer.ts`, `src/lib/customers/contact.ts` |
| Phone format | Japanese domestic (03-…, 090-…) or +81 | `isJpPhone()` |
| Tax wording and demo rates | "Consumption tax"; fictional demo rates 9 % / 6 % (never official rates); tax off by default | `src/lib/data/mock/tax.ts`, `mock/pricing-rules.ts` |
| Sample data | Standalone sample catalog (60 products, 84 categories) + 19 hand-written demo products; demo customers, orders, zones in Japan | `src/lib/data/fixtures/sample-catalog.json`, `src/lib/data/mock/*` |
| WooCommerce | No runtime, build or test dependency; old import archived | `scripts/legacy/README.md` |
| Backend | Not chosen (Laravel or Django). Next.js stays the dedicated frontend; it talks only to the `Repositories` interface | `src/lib/data/repositories.ts` |
| Refund model | "order" refunds lower the order value; "overpayment" refunds return money paid above the total only | `src/lib/orders/refund.ts` |
| Coupons vs. admin discounts | Promotional coupon codes are a separate module from the order-specific admin discount (`OrderDiscount`) | batch 4 |

## Completion checklist

Legend: **Demo** = works against the in-memory demo layer · **Partial** = some of the behaviour · **Placeholder** =
labelled screen, no behaviour · **Missing** = no screen · *(n)* = planned batch.

### Public storefront

| Area | Status | Notes |
| --- | --- | --- |
| Home: header, navigation, hero, categories, benefits, delivery info, footer | Demo (hard-coded copy) | Copy in `src/config/storefront.ts`; moves to the CMS service *(7)* |
| Featured products section | Missing | Sample products carry `featured` (8 flagged) *(11)* |
| CMS pages (About, policies…) and blog | Placeholder / Missing | About is static *(6)* |
| Shop: search, filters, sorting, pagination, category pages | Demo | Server-side, `ListToolbar` |
| Product page: options, min/max/step, wholesale price, login-to-view, add to cart | Demo | Image gallery *(11)* |
| Cart, checkout | Demo | Idempotent, offline payment methods only. Coupon field *(4)* |
| Business registration | Demo | Japanese address, optional residence card + business license uploads |
| Login | Placeholder (mock viewer) | Forgot/reset password UI *(11)* |
| Contact page | Placeholder | Form UI + contract *(11)* |

### Customer portal

| Area | Status | Notes |
| --- | --- | --- |
| Overview, orders, order details, status, invoice view, reorder | Demo | Refunds show in the order totals |
| Quick order (multi-product, SKU search) | **Demo** (2026-11-01) | Shared sheet on Home and `/account/quick-order` (`src/components/quick-order/quick-order-sheet.tsx`): all products, search, category, load more, steppers, add one / add selected |
| Saved purchasing lists | Missing | *(3)* |
| Invoice list and detail | Partial (per-order invoice page) | List *(3)*; PDF download contract *(8)* |
| Upcoming deliveries, monthly spending | Missing | *(3)* |
| Company profile, account info, password update | Placeholder (read-only) | *(3)* |
| Billing/shipping addresses add/edit/delete | Placeholder (read-only) | *(3)* |
| Quotations | Missing | *(5)* |

### Admin — commerce

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard | Demo | New/returning/repeat metrics *(10)* |
| Products, categories, attributes, variations, prices, stock, quantity rules | Demo | Bulk actions *(10)* |
| Stock movement history | **Demo** (batch 2) | Product edits, order-page changes, refund restocks |
| Customers, approval, groups, customer pricing | Demo | |
| Admin order creation (registered + walk-in) | Demo | |
| Order editing: items, quantities, prices, delivered weight, discount, delivery date | Demo | |
| Order editing: billing/delivery address, delivery charge | **Demo** (batch 2) | |
| Record payment received | **Demo** (batch 2) | Bookkeeping only |
| Refunds (WooCommerce-like) | **Demo** (batch 2) | Recorded only; no money moved |
| Invoices: issue / revision / credit note, printable view | Demo | Settings, template, PDF contract, email attachment *(8)* |
| Pricing rules, rule tester | Demo | |
| Shipping: zones by prefecture/city/postcode, flat rate, weight tiers, free-shipping threshold, preview | Demo | Reviewed in batch 2: complete for the brief |
| Tax: on/off, inclusive/exclusive, classes, location rates, preview, order snapshots | Demo | Fictional rates only |
| Payment method settings | Demo | No processing |
| Coupons | Missing | *(4)* |
| Quotations | Missing | *(5)* |
| Delivery locations and schedules | Partial (read-only routes) | *(9)* |
| Location-based reminders, segmentation, log | Placeholder | *(9)*, preview only |
| Reports and CSV exports | Missing | *(10)* |
| Store settings | Partial | *(9)* |
| Admin roles and permissions | Missing (mock permission list only) | *(9)*, enforcement is backend |

### Admin — website CMS and communication

| Area | Status | Notes |
| --- | --- | --- |
| Pages: create, edit, preview, draft/publish/schedule, delete, SEO, slug | Missing | *(6)* |
| Posts/blog: categories, tags, featured image, statuses | Missing | *(6)* |
| Rich content editor (sanitised HTML) | Missing | *(6)*, reuses `src/lib/html/sanitize.ts` |
| Media library (upload, select) | Missing | *(6)* |
| Header and footer menu builder (nested, drag-and-drop, custom links) | Missing | *(7)* |
| Homepage content (banners, sections, headings, images, buttons) | Missing (config file) | *(7)* |
| Site settings: logo, contact, branding | Partial (`src/config/site.ts`) | *(7)* |
| Transactional emails: templates, edit, preview, recipients, attachments, send log | Missing | *(8)*, nothing is sent |

### Architecture and handoff

| Area | Status | Notes |
| --- | --- | --- |
| Shared types, validation, pure engines (pricing, order money, refunds, shipping, tax, payments) | Done | Tested |
| Service interfaces + mock adapter | Done | `Repositories` + `mockRepositories` |
| HTTP API adapter (prepared) | Missing | *(12)* `ApiDataAdapter` + env switch |
| API contract | Partial | `docs/backend-api.md` → *(12)* `API-CONTRACTS.md` + OpenAPI |
| DATABASE-REQUIREMENTS, BUSINESS-RULES, FRONTEND-ROUTE-MAP, BACKEND-INTEGRATION-GUIDE, BACKEND-PENDING-FEATURES, CMS-AND-CONTENT-MANAGEMENT | Missing | *(12)* |

## Batch plan

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Japan/JPY/Asia-Tokyo localization; whole-yen money; Japanese address/phone/postcode; standalone sample catalog; WooCommerce removed from runtime | **Done** |
| 2 | Order management: WooCommerce-like refunds (lines, shipping, other, overpayment, restock), record payment, edit addresses and delivery charge, stock movement history; tax/shipping review | **Done** |
| 3 | Customer portal: profile/account, address book CRUD, password UI, multi-product quick order, saved lists, invoice list + detail, upcoming deliveries, monthly spending | Next |
| 4 | Coupons: WooCommerce-like admin (fixed/%, product/category rules, minimum spend, expiry, usage limits, status), pure validation engine, cart/checkout coupon field and discount summary — separate from admin order discounts | |
| 5 | Quotations: customer request → admin quote → accept → order | |
| 6 | CMS I: pages and blog posts (rich editor, draft/publish/schedule, categories, tags, featured image, SEO, slug, preview), media library; public pages and blog read through the CMS service | |
| 7 | CMS II: header/footer menu builder (nested, drag-and-drop, custom links), homepage content management, site settings (logo, contact, branding); storefront reads them through the service instead of config files | |
| 8 | Invoice management (settings, template, preview, PDF download contract, email attachment settings) + transactional email management (order, status, delivery, invoice, refund, approval templates; editor, preview, recipients, attachments, send log — nothing sent) | |
| 9 | Delivery schedules, location-based reminders (segmentation, templates, log — preview only), store settings, admin roles and permissions | |
| 10 | Reports (sales, customers, new/returning, repeat), CSV exports, dashboard additions, bulk product actions | |
| 11 | Storefront polish: featured products, about/owners, contact form UI, forgot/reset password UI, product gallery, SEO, loading/error states | |
| 12 | `ApiDataAdapter` + handoff docs: API-CONTRACTS (+ OpenAPI), DATABASE-REQUIREMENTS, BUSINESS-RULES, FRONTEND-ROUTE-MAP, BACKEND-INTEGRATION-GUIDE, BACKEND-PENDING-FEATURES, CMS-AND-CONTENT-MANAGEMENT | |
| 13 | Final QA: every route, forms, 375/390/430 px layouts and browser tests (needs a browser), build | |

## Batch 2 — Order management completion (2026-10-29)

**Changed**
- **Refunds** (`src/lib/orders/refund.ts`, `orders.refund()`, admin order page → Payment card): WooCommerce-style
  dialog with refund quantity and amount per item (amount follows the quantity, editable), delivery charge, other
  amount, optional restock and a reason. Caps: each line's share of the paid total (tax included, after discounts),
  shipping share, and what is still paid and kept. Refund history lists lines, shipping, restock results, who and why,
  and a "Recorded only (demo)" badge. Payment status becomes Partially refunded / Refunded.
- **Overpayment refunds**: when an order was edited down after payment, "Refund overpayment" returns the overpaid
  amount without lowering the order value (fixes the earlier model where the balance could not be settled).
- **Record payment received** (unpaid / invoiced → paid, optional reference, internal note): bookkeeping only, so
  refunds can be demonstrated; it never charges anyone.
- **Order edits**: billing and delivery address (order only; customer address book untouched; tax not re-matched)
  and agreed delivery charge (recalculated with the order's own tax basis). Both are in the change history. Edits that
  would drop the total below the amount already refunded are rejected.
- **Stock movement history**: product edits, stock changes from order pages and refund restocks are logged
  (before → after, units, order link, note, who) and shown on the product edit page. The demo does not deduct stock at
  checkout; the backend owns reservations and deductions.
- Order address editor uses the prefecture dropdown (Tokyo 東京都 …) and the registration field order.
- Older seeded orders used 15 % / 5 % placeholder rates left from the template; they now use the same fictional
  9 % / 6 % demo rates (orders store key bumped). Visible "VAT" wording replaced by tax / consumption tax.
- Tax and shipping review against the brief: on/off, inclusive/exclusive, classes, location rates, postcode/city/
  prefecture zones, flat rate, weight tiers, free-shipping threshold and preview already exist — no change needed.

**Tests and checks**
- `npm test`: 172 passed, 0 failed (9 new in `tests/refunds.test.ts`: line/shipping shares, per-unit suggestion, caps,
  earlier refunds, overpayment, payment status).
- `npm run typecheck`, `npm run lint`: passed.
- Dev server, server actions called directly: refund before payment rejected; payment recorded once (second attempt
  rejected); refund qty above ordered rejected; ¥1,639 line refund with restock and ¥4,140 + ¥463 shipping refund
  recorded → refundable ¥11,223 → ¥4,981, status Partially refunded, product stock 8 → 9 logged with the order link;
  overpayment refund on a non-overpaid order rejected. Address edit: invalid postcode/missing city rejected, valid one
  saved as 530-0001. Delivery charge ¥0 → ¥1,000: total +¥1,090 (fictional 9 %); decimals rejected. Admin and account
  pages return 200.
- Not done: browser click-through and phone widths (no browser tool in this environment).

## Batch 1 — Japan localization and standalone sample data (2026-10-29)

**Changed**
- Currency is one setting: `STORE_CURRENCY = { code: "JPY", symbol: "¥", minorDigits: 0 }` (`src/config/currency.ts`).
  The order, pricing, shipping and tax engines compute in integer minor units (`toMinor` / `fromMinor`, formerly
  "paisa") and round half-up once **to the yen**. Amount inputs step by ¥1 (`AMOUNT_STEP`); amounts with decimals are
  rejected (`isValidAmount`); percentages keep 2 decimals (`isValidPercent`). Display: `¥1,248,000`.
- Store: country JP, `ja-JP` number grouping, Asia/Tokyo, fixed offset `+09:00` for date-only values
  (`siteConfig.utcOffset`), week starts Sunday, sample contact details in Tokyo.
- Addresses: `division` → `prefecture`, `district` → `city` across types, forms, engines, tests and docs; `area` is an
  optional town (町域). One prefecture list (`src/lib/locations.ts`) used by forms, shipping and tax. Postcodes
  `NNN-NNNN` (`isPostcode`, `normalizePostcode`, hyphen-insensitive matching via `postcodeKey`). Japanese phones
  (`isJpPhone`). Registration form uses the layout from the old store: Postcode / 郵便番号 + Prefecture / 都道府県,
  Town, City / 市区町村, Street address.
- Sample catalog: the saved import was converted once, offline, into `src/lib/data/fixtures/sample-catalog.json`:
  neutral stable ids (`sp-…`, `scat-…`, `sbrand-…`, `stag-…`), sample JPY wholesale prices (the source store was in
  JPY), no source-system fields, stock variety (48 in stock, 6 low, 6 out), 8 featured, duplicate options disabled.
  Hand-written demo products re-priced ×1.25 to the nearest ¥10. Every product is now orderable.
- Demo business data (customers, delivery routes, shipping zones, fictional tax rates 9 % / 6 %, bank-transfer
  instructions, orders) moved to Japan; store version keys bumped so a running dev server reseeds.
- WooCommerce: `ImportSource` type, import notices and source-price formatting removed; the import script and the
  original fixture are archived in `scripts/legacy/` (excluded from TypeScript, no npm script). The app, build and
  tests never read them. `WC_*` lines in `.env.local` are no longer used and can be deleted by the owner.
- Invoice registration number (適格請求書発行事業者登録番号) label replaces the Bangladesh VAT BIN label.

**Tests and checks**
- `npm test`: 163 passed, 0 failed. Money/pricing/shipping/tax tests rewritten in whole yen (e.g. 15 % of ¥2,450 =
  ¥367.5 → ¥368; delivered-weight example ¥5,000 → ¥4,000 / ¥6,000); new sample-catalog integrity test (prices,
  stock variety, no previous-system traces, no credentials); Japanese phone/postcode tests.
- `npm run typecheck`, `npm run lint`: passed.
- Dev server (`MOCK_VIEWER=customer`): all 40 storefront, account and admin routes return 200 (checkout redirects
  to the cart when empty); amounts display in ¥. Cart → checkout → order: 10 × ¥780 + ¥560 delivery = ¥8,360, one
  order for two simultaneous submissions, visible in account and admin; reorder scoped to own orders. Registration
  with a Japanese address and three document uploads saved (postcode normalised to 160-0023).
- Not done: browser visual check and 375/390/430 px layouts (no browser tool in this environment).

**Known gaps after batch 1**
- `docs/backend-api.md` still shows some pre-Japan examples (taka amounts, Dhaka ids); it is replaced by
  `docs/API-CONTRACTS.md` in batch 8.
- Admin prefecture dropdowns show English names; the registration form shows "Tokyo 東京都". (Order address editor fixed in batch 2.)
