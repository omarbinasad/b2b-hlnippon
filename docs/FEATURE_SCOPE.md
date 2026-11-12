# Feature scope

Inventory of what the new system must cover to replace the current WordPress/WooCommerce site, and where each
feature stands in this frontend. The API contract is in [backend-api.md](backend-api.md).

Store defaults (mock, configurable in [`src/config/site.ts`](../src/config/site.ts)): Japan, JPY (¥), `Asia/Tokyo`.
Product origin (e.g. Japan) is a product attribute, separate from the store location.

## Legend

**Source**
- **WC**: standard WooCommerce/WordPress behaviour.
- **Plugin?**: believed to come from a custom or third-party plugin on the current site. **Confirm against the live site.**
- **New**: a new request; does not exist on the current site.

**Frontend status**. A screen existing does not make a feature complete.
- **—**: not started.
- **Types**: modelled in `src/lib/types`, no UI.
- **Placeholder**: route exists with a "planned" note; no working behaviour.
- **Read-only demo**: shows mock data; no actions.
- **Interactive demo**: controls work against mock data; nothing is saved.
- **Done**: works end-to-end with the real backend. *Nothing is Done yet.*

**Backend**: **Yes** means real behaviour needs the backend (data, persistence, enforcement or integrations).

---

## 1. Products and inventory

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Simple and variable products, variations | WC | Interactive demo: admin form (both types, generated or manual variations, confirm for large sets, duplicate-combination check) | Yes |
| SKU, GTIN/barcode, categories, tags, brands (several per product), descriptions | WC | Interactive demo (field validation; inline "Add new category/brand"; most-used tags; new tags created on save) | Yes |
| Attributes: store-wide reusable values (+ "Create value") and product-specific values, visible / used-for-variations, order, default selection | WC | Interactive demo (store attributes are seeded; no attribute management screen yet) | Yes |
| Product images / gallery (product, plus per-variation uploaded or gallery image) | WC | Interactive demo: order, main image, alt text — local previews only, **not uploaded** | Yes (upload + media host) |
| Country of origin | New (may exist as a WC attribute; confirm) | Interactive demo (admin form, list column, product page) | Yes |
| Weight, dimensions, shipping class (product + variation overrides) | WC | Interactive demo; shipping classes reference future rate settings | Yes |
| Tax status and tax class (product + variation override) | WC | Interactive demo; classes reference future tax settings | Yes |
| Regular price | WC | Interactive demo (admin only; hidden from public API) | Yes |
| Sale price and sale dates | WC | Interactive demo (product + variation) | Yes (applying the schedule) |
| Inventory: track stock, quantity / status, backorders, low-stock threshold (store-wide default shown), sold individually | WC | Interactive demo (variations: same as product, own quantity or own status) | Yes |
| Variation bulk actions (set price/sale/stock, enable/disable all, delete all, expand/collapse) | WC | Interactive demo | Yes |
| Bulk product changes from the product list (publish, draft, stock status, categories, prices, order limits, archive, delete) with a preview | WC | Interactive demo: per-row skip reasons, at most 200 at once | Yes |
| Publishing checks (drafts may be incomplete) | WC | Interactive demo: the same checks in the editor, bulk publish and CSV import | Yes |
| Enabled variation without a price | WC | Warning in the editor and list; publishing blocked | Yes |
| Visibility, status (draft/published/archived), featured | WC | Interactive demo; public list respects status and visibility | Yes |
| Upsells and cross-sells | WC | Interactive demo (server-side product search picker) | Yes |
| Purchase note, display order, reviews toggle | WC | Interactive demo (stored; reviews feature itself not built) | Yes |
| Legacy WooCommerce IDs, "initial number in stock", "unit of measurement" | WC (migration) | Typed optional fields; the last two edited in Inventory (as on the old store); no logic | Yes (migration) |
| Rich-text description, scheduled publishing, private/password visibility, SEO fields, virtual/downloadable | WC / plugins | — (deferred) | Yes |
| Per-product min / max / increment | Plugin? | Interactive demo: product's own minimum, maximum and multiple in packages (Inventory → Order quantity); variation and product rules override them, they beat category and store-wide rules (BUSINESS-RULES §3); shown and enforced on the product page, cart, checkout and admin orders | Yes |
| Product preview | New | Interactive demo (approved-customer view) | No |
| Admin add / edit / duplicate / archive products | WC | Interactive demo — in-memory mock store (survives refresh and navigation, lost on restart) | Yes |
| Category management (name, slug, parent, description, image, status) + product assignment | WC | Interactive demo — same in-memory store | Yes |
| Brand / tag / attribute / shipping-class management screens | WC | — (selectors use seeded lists) | Yes |
| Search, filter, pagination | WC | Interactive demo (shop: search from the header with a removable search chip, sort, left filter bar: customer-only price range slider (approved customers, server-side), availability, category tree (expandable subcategories), brands with counts; active-filter chips; admin: search incl. variation SKU, category tree, type, stock, status) | Yes |
| Sorting | WC | Interactive demo (shop sort select; admin column sorting) | Yes |
| Import existing products and images | New (migration) | Product CSV import and export: interactive demo (map columns, check every row, import, per-row results; export by filters or selection, chosen columns, template). See docs/PRODUCT-CSV.md. The old WooCommerce import stays archived in `scripts/legacy/` | Yes |

## 2. B2B accounts and permissions

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Business registration form | Plugin? | Interactive demo: business, contact, address, optional Japan Residence Card (front/back) and business license copy upload (staff-only view); validated; creates a pending customer for admin approval. No password/login account; files kept in memory only | Yes (accounts, password, email) |
| Optional document upload | New | — | Yes (file storage) |
| Approval / rejection / suspension | Plugin? | Interactive demo: All Requests page (`/admin/customers/requests`, sidebar + banner on Customers) lists every application with its status (pending first, filter by status), documents and Approve / Decline buttons; pending → approved/rejected, suspend/reactivate, reopen; reason required to reject/suspend; audit history. No emails | Yes |
| Price hiding for guests and unapproved accounts | Plugin? | UI hint only via mock viewer | Yes (**enforcement**) |
| Admin quick-add customer (few fields, details later) | New | Interactive demo (name + phone or email + initial status; "details to complete" prompt) | Yes |
| Admin customer list / detail / edit | WC | Interactive demo (filters, order count, total spend, linked orders, multiple addresses) | Yes |
| Customer groups | Plugin? | Interactive demo: create, rename, add/remove members, member counts. Group IDs ready for future price/quantity rules; delete not built | Yes |
| Roles and capabilities: six templates, custom roles, per-action permissions | WC | Demo only, see ROLES-AND-CAPABILITIES.md. Not security | Yes |
| Access and permission enforcement | — | **None**: portal and admin are open, with a preview banner | Yes |

## 3. Pricing and quantity rules

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Customer-specific and group pricing | Plugin? | Interactive demo: create, edit, enable/disable; audience = one customer, a group or all approved customers | Yes (**enforcement at cart/checkout**) |
| Fixed price, amount-off and percentage-off by customer / group / all × variation / product / category / all | Plugin? | Interactive demo; negative prices rejected | Yes |
| Bulk / tier pricing | Plugin? | Interactive demo: up to 10 non-overlapping tiers per rule with live preview | Yes |
| Product / variation min / max per line | Plugin? | Interactive demo (quantity rules plus each product's own limits); product page shows the effective limit | Yes |
| Global and category min / max per line | Plugin? | Interactive demo; applies to each product line, not the category total | Yes |
| Cart-level rules (e.g. minimum order value) | Plugin? | — | Yes |
| **Rule precedence** | — | **Decided** (docs/backend-api.md §6.1–6.2): customer > group > all; then variation > product > category > all; then priority; then older rule (flagged as conflict). One rule per line, no stacking. Rules use the regular price (fixed rules their own amount); the customer pays the lower of the rule price and the active sale price — compared, never combined. Pure engine + tests in `src/lib/pricing/engine.ts` | Yes (same rules) |
| Overlap / conflict detection | New | Interactive demo (list filter, rule page) | Yes |
| Test rules panel (customer + product + quantity → price, limits, explanation) | New | Interactive demo with examples (demo calculation) | Yes (endpoint) |
| Rule used for an order line's price | New | Snapshot on admin-created orders (`OrderItem.pricing`); unchanged when rules change | Yes |

## 4. Storefront, cart, checkout and orders

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Home | WC (theme) | Interactive demo from the design reference: hero, benefits, category cards, Quick order sheet (same component as `/account/quick-order`: name/SKU search, category filter, load more, qty steppers, add one / add selected to cart; prices and ordering only for approved customers, decided server-side), business section, delivery lookup by prefecture (sample route data), account steps, journal cards with Read more, contact strip. Images are labelled placeholders until files are added to /public/images (see src/config/storefront.ts) | Content/CMS later; articles; cart |
| Storefront header / footer | WC (theme) | Logo, product/SKU search → /shop, account, cart, "All categories" menu with the complete public category tree (multi-column on desktop, collapsible groups on mobile), nav, Apply for B2B account; footer links only to existing routes. Demo seed categories are hidden, so navigation shows the imported catalog | — |
| Shop, product page | WC | Interactive demo | Yes |
| About, contact | WC (pages) | About page with mission, vision, values and audiences (draft copy in `aboutContent`). Contact: interactive demo form (validated, spam trap, stored in server memory, shown in the admin notification bell, no email, no inbox screen yet), details, OpenStreetMap embed (sample point until the real address is set) | Yes (contact form email, inbox) |
| Cart | WC | Interactive demo: header cart icon with product count on the store and customer portal opens a right-hand cart panel (lines, quantity +/−, remove, subtotal, View cart / Checkout; updates after every cart change); server-side cart per approved customer, re-priced on each view (rules, sale, tiers), min/max/step and stock checks; add from product page with option selector | Yes (persistence) |
| Checkout: addresses, shipping estimate, tax display, payment method, summary | WC | Interactive demo: own addresses, delivery date, suggested shipping, fictional tax, offline payment methods, live totals; places an in-memory order (idempotent, never paid) | Yes |
| Order confirmation | WC | — | Yes |
| Order history and details | WC | Read-only demo (portal) | Yes |
| Reorder | WC | Interactive demo: “Order again” adds a past order's products to the cart at today's prices | Yes |
| Notifications | Plugin? / New | Read-only demo; bell icon with unread count in the customer portal header | Yes |
| Invoices | Plugin? | Interactive demo: issue invoice (frozen snapshot, `INV-<year>-NNNN`), revised invoice after order changes, credit note for cancelled orders; printable admin and customer pages (browser print / PDF); labelled “not a valid tax invoice” | Yes (numbering rules, PDF, tax-invoice compliance) |
| Order notes | WC | Interactive demo: internal vs customer-visible notes (admin); portal shows customer-visible only. Nothing is sent | Yes |
| Order statuses | WC | Interactive demo: received → preparing → on the way → delivered, cancel with reason, status history | Yes |
| Cancellations, refunds | WC | Cancel: interactive demo. Refunds: interactive demo (WooCommerce-style per line / shipping / other amount, overpayment refunds, optional restock, history; recorded only — no money moved) | Yes (processing) |
| Record payment received | New | Interactive demo: admin marks unpaid/invoiced orders paid with a reference (bookkeeping, no charge) | Yes |
| Edit order address and delivery charge | New | Interactive demo: billing/delivery address and agreed charge on existing orders, kept in the change history | Yes |
| Stock movement history | New | Interactive demo: product edits, order-page changes and refund restocks logged per product (no checkout deduction in the demo) | Yes (reservations/deductions) |
| Admin order list and detail | WC | Interactive demo (search, filters, sort, pagination, quick next step) | Yes |
| Admin creates order for a customer | WC | Interactive demo (customer search, saved/edited addresses, products + variations at customer price, totals preview) | Yes |
| Walk-in orders (no account; email and phone optional) | New | Interactive demo: buyer name required, catalog prices, store pickup (no address, taxed at the store location) or delivery; no account created | Yes |
| Admin adjusts item quantity / fulfilled weight / agreed price | Plugin? | Interactive demo with reason, before/after preview and change history; quantity until delivery (ordered weight follows, quantity rules enforced) | Yes |
| Admin edits order items: add, remove, replace | Plugin? / New | Interactive demo: customer price re-quoted by quantity (editable), server-side preview, reason, change history; allowed while received / preparing / on the way; last item can't be removed | Yes |
| Order discount (fixed or %), delivery date edit | New | Interactive demo: discount after line discounts and before tax, split over lines for tax; inline delivery date; both in the change history | Yes |
| Money summary on order pages (received, outstanding, overpaid, refund due, invoice total, credit notes kept apart) | New | Interactive demo on admin and customer order pages | Yes |
| Balance after editing a paid order | New | Interactive demo: amount already paid kept on first edit; balance due / overpaid shown to admin and customer; nothing charged or refunded | Yes (payment/refund module) |
| Stock from the order page | New | Interactive demo: live stock per line, warning for items now out of stock/unavailable, mark in/out of stock or set counted quantity (global catalog change; orders unchanged) | Yes |

## 5. Japan locations, shipping and delivery

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Store address, country, currency, timezone | WC | Static config (JP / JPY / Asia-Tokyo) | Yes (admin editing) |
| Store prefecture, city/city, postcode; selling locations; shipping destinations | WC + New (prefecture/city) | Interactive demo: store location in Settings; shipping destinations via zones (Bangladesh only) | Yes |
| Customer address: prefecture, city, upazila/thana/locality, postcode, street, phone | New (WC has state/city only) | Interactive demo (admin address book, one default per type) | Yes |
| Postcode lookup suggesting location fields, with manual correction | New | Interface demo with 12 labelled sample postcodes; suggestions applied only on click | Yes (verified dataset) |
| Multiple delivery addresses | Plugin? | Interactive demo (admin address book) | Yes |
| Shipping zones (prefecture / city / postcode + fallback) | WC + New | Interactive demo; one zone per location; deterministic matching (postcode > city > prefecture > fallback) | Yes |
| Shipping methods: flat rate, weight tiers, subtotal tiers, free over subtotal, local pickup, class adjustments | WC | Interactive demo with **sample rates**; tier/overlap validation; variation weight overrides product | Yes (same calculation at cart/checkout) |
| Shipping charge on admin orders (suggested or agreed with reason) | New | Interactive demo; decision stored on the order; saved amounts never recalculated | Yes |
| Admin shipping rate preview (address + cart → zone, weight, subtotal, method, charge) | New | Interactive demo with examples | Yes (endpoint) |
| Delivery date / route tied to the order address | Plugin? | Types | Yes |

## 6. Tax, payment and store settings

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Tax on/off (off by default), prices include/exclude tax, shipping taxable + shipping class | WC | Interactive demo (Tax settings) | Yes |
| Tax classes on products, inherited/overridden by variations | WC | Existing product editor fields; classes overview with usage and fallback status | Yes |
| Tax rates by class and location (country / prefecture / city / postcode, country = fallback) | WC + New | Interactive demo with **fictional** rates; conflict/range/class validation; deterministic matching | Yes (**authoritative calculation**) |
| Tax preview (address, customer, products, discounts, shipping method) | New | Interactive demo with examples | Yes (endpoint) |
| Tax on admin orders with rate/amount snapshots | New | Interactive demo: calculated before saving; snapshot stored; rate edits never change orders | Yes |
| Tax filing, collection, refunds | WC / New | Not in scope | Yes |
| Payment methods: enable/disable, display order, titles and instructions; bank transfer details | WC | Interactive demo (Admin → Payments), fictional bank values; checkout list method prepared | Yes |
| Online payment provider connection, test/live mode | WC | Placeholder only: always "Not connected" and unavailable at checkout | Yes (integration) |
| Gateway keys, processing, webhooks, refunds, marking orders paid | WC | — (secrets never in client code or browser storage; choosing a method never marks an order paid) | Yes |
| Store contact details, address, weight/dimension units (currency JPY and Asia/Tokyo fixed) | WC | Interactive demo (Settings) | Yes |
| Email templates | WC | — | Yes |
| Staff settings | WC | — | Yes |

## 7. Customer portal

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Admin notifications | WC / New | Interactive demo: bell in the admin top bar with unread count and dropdown (new orders, registration requests, stock alerts, contact messages; mark read), sidebar badges on Orders (in progress, not yet delivered or cancelled) and All Requests (pending only); refreshed about once a minute | Yes (per-user read marks, push) |
| Dashboard (order counts) | New | Read-only demo: revenue, orders, active customers, average order, new (first) orders and repeat orders for the chosen dates with comparison; Orders / New / Repeat boxes open the matching filtered order list | Yes |
| Spending metrics | New | — | Yes |
| Order history and details | WC | Read-only demo | Yes |
| Quick order | Plugin? | Interactive demo (`/account/quick-order`): every published product, one row per orderable option; name/SKU (incl. variation SKU) search, category filter, Load more (server-side pages of 20 products); customer prices at the minimum quantity, stock, quantity rules; qty steppers, per-row Add and Add selected to cart (selection kept across searches). Prices only for approved customers | Yes |
| Reorder | WC | — | Yes |
| Profile, addresses, notifications | WC / New | Read-only demo | Yes |
| Quotes, saved lists, CSV order upload | New | Quotes and saved lists: interactive demo; accepting a quote lets the customer choose an enabled payment method and creates an unpaid order at the quoted prices. CSV order upload: not built | Yes |

## 8. Delivery reminders

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Admin reminder list | Plugin? | Read-only demo | Yes |
| Create / edit, details, templates, previews | Plugin? | — | Yes |
| Schedules and send logs | Plugin? | — (schedule is free text) | Yes |
| Location / route targeting | Plugin? | Types | Yes |
| Targeting customers with multiple saved addresses | New | — | Yes |
| Different messages with vs without an upcoming order | New | — | Yes |
| Scheduling and sending | — | — | Yes (worker) |

## 9. Analytics

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Revenue (net sales excluding tax for tax-inclusive and tax-exclusive orders), orders, average order value, active customers | WC (Analytics) | Interactive demo (admin dashboard) | Yes |
| Revenue trend and order-status breakdown | WC (Analytics) | Interactive demo | Yes |
| Date range filter | WC (Analytics) | Interactive demo (presets + custom) | Yes |
| Comparison between two periods | WC (Analytics) | Interactive demo (previous period, same period last year, custom) | Yes |
| Top products / categories / customers with change vs comparison | WC (Analytics) | Interactive demo (top 5) | Yes |
| Further ranking filters (e.g. by category or location) | WC (Analytics) | — | Yes |
| Low-stock alerts | WC | Read-only demo | Yes |
| Pending approvals summary | Plugin? | Read-only demo | Yes |
| Other operational summaries (orders to prepare, routes today) | New | — | Yes |

## Cross-cutting

| Feature | Source | Frontend status | Backend |
| --- | --- | --- | --- |
| Light / dark theme (system default, saved choice) | New | Done (frontend-only) | No |
| Search, filters, sorting and date ranges on every admin and portal listing (server-side, state in the URL) | New | Interactive demo | Yes (real queries) |
| Collapsible admin sidebar (saved per browser) | New | Done (frontend-only) | No |
| Mobile layout (430px) | New | Mobile-first throughout; admin dashboard verified at 430px in both themes | No |

## Status moved

From 2026-11-04 the live status of every feature is in `docs/FRONTEND-MASTER-CHECKLIST.md`. This file remains as the original inventory and may lag behind, notably for white-label settings and the CMS, which are now built.
