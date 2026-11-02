# Requirements checklist review (v2.0)

Review of the "B2B Wholesale E-commerce Platform — Master Features & Functional Requirements Checklist v2.0"
against this project, by code inspection on 2026-10-28. Updated the same day after building order editing and
stock management from the order page (sections 7, 8 and related items), then walk-in orders and invoices
(sections 6 and 10). Feature inventory: [FEATURE_SCOPE.md](FEATURE_SCOPE.md).

## Read this first

- This project is a **Next.js frontend with mock data**. The backend (Laravel or Django) is not chosen yet.
  WooCommerce is only a development import source for the sample catalog; the app never reads from or writes to it.
- **Completed** below means *working as an interactive demo on mock data* — not production-ready. No feature has
  real login, persistence, email sending or payment processing until the backend exists.
- Checklist items that name WooCommerce/WordPress internals (HPOS, WP menus, the native WooCommerce refund screen)
  are marked **N/A** or mapped to the equivalent in this app.
- Statuses: **C** completed (demo) · **P** partial · **M** missing · **N/A** not applicable. "Backend" = real
  behaviour needs the future backend regardless of frontend work.

## Summary

| Module | C | P | M | N/A | Overall |
| --- | --- | --- | --- | --- | --- |
| 1. Registration & accounts | 7 | 3 | 2 | 0 | Partial — online application works (demo); no password, profile read-only |
| 2. Wholesale pricing | 12 | 2 | 0 | 0 | Done (demo) — enforcement needs the backend |
| 3. Product catalog | 10 | 2 | 0 | 0 | Mostly done — gallery planned |
| 4. Quick order | 3 | 2 | 6 | 0 | Partial — search and reorder; multi-line quick order and saved lists missing |
| 5. Customer portal | 8 | 6 | 4 | 0 | Partial |
| 6. Admin order creation | 14 | 0 | 0 | 0 | Done (demo) |
| 7. Advanced order editing | 20 | 2 | 0 | 0 | Done (demo) — payment collection/refund of a balance needs the backend |
| 8. Stock from order details | 11 | 0 | 0 | 0 | Done (demo) |
| 9. Delivered weight pricing | 15 | 1 | 0 | 0 | Done (demo) |
| 10. Invoices | 12 | 0 | 0 | 0 | Done (demo) — printable page; PDF files and tax-invoice rules need the backend |
| 11. Refunds | 0 | 2 | 9 | 0 | Missing (model only); WooCommerce-native requirement does not apply |
| 12. Order & delivery status | 7 | 3 | 0 | 0 | Mostly done — delivery date not set on orders |
| 13. Delivery schedules | 0 | 4 | 6 | 0 | Mostly missing — read-only placeholder |
| 14. Email reminders | 0 | 1 | 17 | 0 | Missing — read-only list only |
| 15. Quotations | 0 | 0 | 8 | 0 | Missing |
| 16. Admin & permissions | 8 | 3 | 3 | 1 | Partial — no roles or permission checks |
| 17. Reports | 7 | 1 | 5 | 0 | Partial |
| 18. Frontend UI/UX | 13 | 4 | 1 | 0 | Mostly done — featured products missing |
| 19. Technical | 4 | 3 | 3 | 5 | Partial — security needs the backend |
| 20. Future scope | 0 | 3 | 7 | 0 | As expected (optional) |

## 1. B2B customer registration & account management

| # | Status | Notes |
| --- | --- | --- |
| 1.01 | C | `/register` saves an application as a pending customer (demo store). |
| 1.02 | C | Company, business type, contact, email, phone, trade licence, full business address, message. |
| 1.03 | M | No password field. Backend (auth). |
| 1.04 | C | New accounts are `pending`; `/application-pending` page. |
| 1.05 | C | Approve / reject (reason required) / suspend / reactivate with audit history in Admin → Customers. No emails. |
| 1.06 | P | UI hides prices for pending accounts via the mock viewer; no real enforcement. Backend. |
| 1.07 | P | Approved demo customer sees prices; login is a placeholder. Backend. |
| 1.08 | C | Admin quick-add customer. |
| 1.09 | C | Admin customer edit. |
| 1.10 | C | Multiple billing/shipping addresses (admin address book). |
| 1.11 | M | Portal profile and addresses are read-only ("Planned"). |
| 1.12 | P | Customer groups done; roles are mock only (guest / customer / admin). |

## 2. B2B pricing & wholesale rules

| # | Status | Notes |
| --- | --- | --- |
| 2.01 | P | Prices hidden for guests/unapproved in UI; enforcement needs real auth. |
| 2.02 | C | "Prices for approved customers" + Apply for B2B account CTA. |
| 2.03 | C | |
| 2.04–2.08 | C | Customer / group / all-customer rules; fixed, amount-off, %-off; up to 10 tiers; product / variation / category scope; tested engine (`src/lib/pricing/engine.ts`). |
| 2.09–2.11 | C | Min/max quantity rules; step on product. |
| 2.12 | C | Cart and checkout re-price on the server and enforce min/max/step and stock (`src/lib/orders/cart.ts`). |
| 2.13 | C | Admin order form fetches the customer price and stores a pricing snapshot. |
| 2.14 | P | Prices only change through server actions; no permission checks yet. |

## 3. Product catalog & shop management

| # | Status | Notes |
| --- | --- | --- |
| 3.01–3.04 | C | Shop with category tree, name/SKU search, brand/availability/price filters, sorting, pagination (server-side). |
| 3.05 | P | Product page shows main image and description; gallery planned. |
| 3.06 | C | Option selector with the customer's price per option on the product page. |
| 3.07 | P | Unit label and weight; no separate pack/case fields. |
| 3.08 | C | Stock badge on product page and quick order. |
| 3.09 | C | Quantity selector with min/max/step hints; enforced in the cart. |
| 3.10 | C | Add to cart for approved customers. |
| 3.11 | C | Add / edit / duplicate / archive (archive instead of hard delete). |
| 3.12 | C | Mobile-first; checked at 430px. |

## 4. Quick order & bulk purchasing

| # | Status | Notes |
| --- | --- | --- |
| 4.01 | P | Quick order section on Home; `/account/quick-order` is a placeholder. |
| 4.02 | C | Name/SKU search with category filter. |
| 4.03, 4.04 | M | |
| 4.05 | C | Prices shown to approved customers (server-side). |
| 4.06, 4.07 | M | Depend on the cart. |
| 4.08 | C | “Order again” on the customer's order page. |
| 4.09, 4.10 | M | Saved lists. |
| 4.11 | P | Search UI is responsive; ordering UI not built. |

## 5. B2B customer dashboard / portal

| # | Status | Notes |
| --- | --- | --- |
| 5.01 | P | Portal is at `/account`, not `/b2b-dashboard` (a redirect can be added if the old URL must keep working). |
| 5.02 | P | Order and notification counts; no customer info card. |
| 5.03, 5.04 | C | |
| 5.05 | M | Monthly spending chart. |
| 5.06 | C | Open orders count. |
| 5.07 | M | Upcoming delivery (needs delivery dates/routes). |
| 5.08–5.10 | C | Order history, details, status. |
| 5.11 | C | “Order again” adds the order's products at today's prices. |
| 5.12 | P | Link exists; page is a placeholder. |
| 5.13, 5.14 | M | Saved lists, quotes. |
| 5.15 | P | Issued invoices and the balance after changes are shown; no payment history or online payment. |
| 5.16, 5.17 | P | Read-only. |
| 5.18 | C | |

## 6. Admin order creation

| # | Status | Notes |
| --- | --- | --- |
| 6.01–6.07 | C | Customer search, multiple products/variations, quantities, customer price auto-filled, editable price + line discount, shipping (suggested or agreed), payment method. |
| 6.08–6.12 | C | Walk-in order: only the buyer's name is required (email, phone, company optional); store pickup (no address, taxed at the store) or delivery (address, phone optional). No account is created. Catalog prices (rules need an account). |
| 6.13 | C | Totals, shipping and tax calculated before saving. |
| 6.14 | C | Appears in Admin → Orders and the dashboard (there is no WooCommerce order list in this app). |

## 7. Advanced admin order editing

Admin → Orders → an order. Every edit opens one dialog (or an inline form for the date) with a live, server-calculated
before/after preview, requires a reason (except the date) and is recorded in the order's change history.

| # | Status | Notes |
| --- | --- | --- |
| 7.01–7.04 | C | Add item (customer price, re-quoted by quantity, editable), remove item (not the last one), change quantity (ordered weight follows; quantity rules enforced). |
| 7.05, 7.06 | C | Agreed price per line; catalog prices and price rules untouched. |
| 7.07–7.09 | C | Order discount: fixed ৳ or %, after line discounts and before tax; edit or remove. |
| 7.10 | C | |
| 7.11, 7.12 | C | Items editable while *Order received*, *Preparing* or *On the way* (this app's equivalents of pending/processing). After delivery only prices, weights and the discount can be corrected; cancelled orders are locked. |
| 7.13 | C | Unpaid orders (cash on delivery etc.): the new total is what's collected. |
| 7.14 | P | Paid orders: the amount already paid is kept and the balance due / overpaid is shown to admin and customer. Collecting the difference or refunding is not processed (backend/payment module). No online gateway exists in this app. |
| 7.15 | C | Billing/shipping address editor. |
| 7.16 | C | Delivery date edited inline from the order page. |
| 7.17, 7.18 | C | Server recalculates lines, order discount, tax (from the order's own tax snapshot) and totals. |
| 7.19 | C | Server actions; the page updates without a full reload. |
| 7.20 | C | Dialogs with Save/Cancel; inline Save/Cancel for the delivery date. |
| 7.21 | C | One dialog per action, no extra confirmation or success pop-ups. Behaviour checked via the server actions; not clicked through in a browser. |
| 7.22 | P | Full change history (who, when, reason, before/after). Permissions are mock checks (no real login yet). |

## 8. Stock & availability from order details

| # | Status | Notes |
| --- | --- | --- |
| 8.01–8.03 | C | Each line shows the product's current stock, read live from the catalog; a warning lists items that became out of stock or unavailable after the order was placed. |
| 8.04–8.07 | C | "Change stock" on a line: mark in/out of stock (status-managed) or set the counted quantity. Updates the global product stock; shop and product pages reflect it. |
| 8.08, 8.09 | C | Replace (one step, recorded as a replacement) or remove the item; totals update. |
| 8.10 | C | Stock changes never alter existing orders or their amounts (orders keep snapshots). |
| 8.11 | C | Variations with their own counted or status stock; options sharing the product's stock change together; archived products and disabled options can't be restocked from the order. |

## 9. Actual delivered weight adjustment

| # | Status | Notes |
| --- | --- | --- |
| 9.01–9.06 | C | `orderedWeight` + `fulfilledWeight`; admin enters actual weight (lower or higher); line total recalculated from the agreed per-kg price. |
| 9.07 | P | `isVariableWeight` flag exists; imported products default to `false`. |
| 9.08, 9.09 | C | Preview shows the difference; on paid orders the balance due / overpaid is stored against the amount already paid. |
| 9.10, 9.11 | C | Admin order detail. |
| 9.12 | C | Customer order detail shows ordered and packed weight, unit price and final line total (shared items table). |
| 9.13 | C | Invoice shows ordered → delivered weight and the final line amount. |
| 9.14 | C | |
| 9.15 | C | Tax re-run from the order's snapshot; order discount applied. |
| 9.16 | C | Before/after kept in the adjustment history. |

## 10. Invoices

| # | Status | Notes |
| --- | --- | --- |
| 10.01–10.08 | C | Invoice from the order: number, customer (or walk-in buyer), addresses, items, unit prices, ordered/delivered weight, line and order discounts, shipping, tax lines (fictional), total, paid/balance. Printable (browser print / save as PDF). |
| 10.09 | C | After changes the admin is told the invoice is out of date and issues a revision with the saved amounts. |
| 10.10 | C | Admin and customer pages read the same order and the same issued documents. |
| 10.11 | C | Customer portal: “Invoice” on the order page; issued documents only (no drafts). |
| 10.12 | C | Issued documents are frozen; revisions (`-R1`, `-R2`) and credit notes (`-CN`) are added instead of overwriting. |

## 11. Refunds

The checklist asks for WooCommerce's native refund screen. This app replaces WooCommerce, so the equivalent must be
built here and processed by the backend/payment provider.

| # | Status | Notes |
| --- | --- | --- |
| 11.01–11.09 | M | `Refund` type exists; no refund action. Gateway refunds need the backend. |
| 11.10 | P | Refunds shown read-only if present on an order. |
| 11.11 | P | Totals include `refundedTotal`. |

## 12. Order status & delivery workflow

| # | Status | Notes |
| --- | --- | --- |
| 12.01–12.04 | C | Received → preparing → on the way → delivered (+ cancel with reason). |
| 12.05 | P | Separate payment status (unpaid / invoiced / paid / refunded); no WooCommerce mapping needed. |
| 12.06, 12.07, 12.09 | C | |
| 12.08 | P | `deliveryRouteId` in the model; no delivery date. |
| 12.10 | P | Allowed transitions enforced; no payment-based rules. |

## 13. Delivery schedules & locations

| # | Status | Notes |
| --- | --- | --- |
| 13.01–13.03 | P | Admin → Delivery routes is a read-only placeholder with sample routes; Home lookup by prefecture. |
| 13.04 | M | Specific dates. |
| 13.05–13.08 | M | Customer ↔ route matching and with/without upcoming order lists. |
| 13.09 | P | Home lookup shows route days/cutoff (sample data). |
| 13.10 | M | |

## 14. Automated email reminders

| # | Status | Notes |
| --- | --- | --- |
| 14.01 | P | Admin → Reminders: read-only list. |
| 14.02–14.16 | M | Campaign editor, targeting, templates, with/without-order variants, logs, de-duplication. |
| 14.17, 14.18 | M | Scheduled sending and retries need a backend worker and email provider. |

Note: 14.10 mentions Tokyo/Osaka. Locations are configurable data; the store currently uses Bangladesh prefectures.

## 15. Quotations

| # | Status | Notes |
| --- | --- | --- |
| 15.01–15.08 | M | Not started (listed as "planned, behaviour not specified" in FEATURE_SCOPE). |

## 16. Admin B2B dashboard & permissions

| # | Status | Notes |
| --- | --- | --- |
| 16.01–16.03 | C | |
| 16.04 | P | Groups yes; roles no. |
| 16.05–16.08 | C | |
| 16.09 | C | See section 7. |
| 16.10 | P | Read-only. |
| 16.11 | M | Portal settings. |
| 16.12 | N/A | WordPress menus. Equivalent: shop-manager role — missing. |
| 16.13, 16.15 | M | No permission checks (admin is open with a preview banner). Backend. |
| 16.14 | P | Development WooCommerce import script only. |

## 17. Reports & analytics

| # | Status | Notes |
| --- | --- | --- |
| 17.01–17.03 | C | Admin dashboard with date range and comparison. |
| 17.04 | P | Revenue trend; no monthly report table/export. |
| 17.05, 17.06 | C | Customer detail: linked orders and total spend. |
| 17.07 | M | |
| 17.08–17.10 | M | New / returning customers, repeat orders. |
| 17.11, 17.12 | C | Top customers and products. |
| 17.13 | M | By group / delivery area. |

## 18. Website frontend & UI/UX

| # | Status | Notes |
| --- | --- | --- |
| 18.01–18.04 | C | |
| 18.05 | M | No featured products section on Home. |
| 18.06 | P | About page is a placeholder. |
| 18.07–18.11 | C | |
| 18.12 | P | Gallery / variation selector planned. |
| 18.13, 18.14 | C | Cart and checkout work (demo store, no payment). |
| 18.15 | P | |
| 18.16, 18.17 | C | |
| 18.18 | P | Loading and empty states exist; success/error states only where actions exist. |

## 19. Technical & performance

| # | Status | Notes |
| --- | --- | --- |
| 19.01, 19.02, 19.04, 19.08, 19.14 | N/A | WooCommerce/plugin/database items; the backend is not chosen. |
| 19.03 | P | Modular folders (admin / portal / storefront, pure engines); reminders module not built. |
| 19.05, 19.07 | M | Mock viewer only. Backend. |
| 19.06 | P | Pure tested engines + server actions; cart/checkout enforcement needs the backend. |
| 19.09, 19.10 | C | Server actions; admin code isolated from public pages. |
| 19.11 | M | |
| 19.12 | C | Server components, server-side pagination. |
| 19.13 | C | Settings, tax, shipping, payment pages. |
| 19.15 | P | Validation errors shown; no logging. |

## 20. Future scope (optional)

| # | Status | Notes |
| --- | --- | --- |
| 20.01–20.06 | M | |
| 20.07 | P | This project is the Next.js rebuild (in progress). |
| 20.08 | M | Backend not chosen. |
| 20.09 | P | Development import of a 60-product sample only. |
| 20.10 | P | API contract documented in [backend-api.md](backend-api.md); no APIs yet. |
