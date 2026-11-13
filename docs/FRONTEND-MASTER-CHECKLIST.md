# Frontend master checklist

Single source of truth for the "Complete B2B ecommerce frontend" brief. Update it after every change of status. To resume in a new session, read **Progress** and **Open issues**.

**Statuses**

| Status | Meaning |
| --- | --- |
| COMPLETED | Functional demo, and the interaction was actually verified (browser check or automated test) |
| PARTIAL | Exists, needs more behaviour or a required part is missing |
| MISSING | Not implemented |
| BACKEND PENDING | Frontend ready; the real function needs the server |
| NEEDS TESTING | Implemented, but the interaction has not been verified in a browser |

**COMPLETED never means production-ready.** It means the demo works on in-memory data. Everything real is listed in `BACKEND-PENDING-FEATURES.md`.

## Progress

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Audit, architecture cleanup, this checklist | Done |
| 2 | White-label company configuration and branding | Done |
| 3 | CMS: pages, posts, editor, media, menus, homepage | Done |
| 4 | Product, customer, wholesale-pricing completion | Done |
| 5 | Customer dashboard: profile, addresses, saved lists, quotations, deliveries | Done |
| 6 | Advanced orders, refund UI, weight adjustments, coupons, invoice settings | Done |
| 7 | Shipping manager, conditional rules, tax and payment settings | Done |
| 8 | Delivery schedules, reminders, email templates and logs | Done |
| 9 | Roles, staff, capabilities, reports | Done |
| 10 | API adapter, database docs, backend handoff, final QA | Done |
| 11 | Final improvements: package quantities and order limits, publishing checks, quotation payment method, money summary, bulk product changes, product CSV import and export, CMS revisions, autosave and reusable blocks; frontend freeze | Done; see **Final verification** |

## Final verification

Run on 2026-11-12 (batch 11, frontend freeze) and re-run in full on 2026-11-13 after the phone hero and floating bottom-menu changes. Browser tests ran in headless Chrome against a production build on a separate test server (`next start -p 3100`), one suite at a time, each on a fresh server.

| Check | Result |
| --- | --- |
| Type check, lint | No errors or warnings |
| Unit tests | 409 passed, 0 failed (32 files; new: `product-quantity`, `money-summary`, `product-bulk`, `product-csv`, `cms-revisions-blocks`, postcode inputs) |
| Production build | Compiled |
| API docs | `npm run docs:api`: 256 repository endpoints, 17 others, 310 types, no warnings. `npm run docs:routes`: 120 pages, 6 handlers |
| Browser suites, final build (2026-11-13) | 28 suites, 1,235 checks, all passing: roles 160, hero 61, ui2 43, cardqty 20, adminstore 23, steps 29, progress 33, cursor 12, bottom 45, qa 67, qa2 15, qa3 45, brands 38, brand 38, cms 85, verify23 52, b4 37, b5 50, b6 36, b7 46, b8 47, b9 56, **f1** 36 (quantity limits, publishing, bulk, CSV), **f2** 23 (quotation payment, money summary), **f3** 52 (blocks, revisions, autosave), **f4** 19 (variable product from scratch, tax classes and exempt, postcode typing), **f5** 64 (phone hero: size, centred card, links on one row, phone photo per theme and only that photo downloaded), sweep 3. f5, hero, ui2 and bottom were run again after the last change (centring the phone hero card) |
| Responsive sweep | 115 of 120 routes × 375, 390, 430, 768, 1024, 1366px (690 page loads): no server errors, no sideways page scroll |
| New screens at 768 and 430px | Product editor, product list, import, product page, checkout, order pages, quotation, blocks list/new/edit, revisions, page editor, public page and blog post: no sideways scroll (f1–f4) |
| Dark mode | Revisions screen, blocks (editor preview and public post) checked by screenshot |
| `npm audit` | 2026-11-13: 7 moderate, all in lint tooling only (`minimatch` under `typescript-eslint`, not shipped to the site); a non-breaking `npm audit fix` is available and not yet applied |

**Fixed while testing this batch:** the product page ignored the product's own order limits; a store-wide quantity rule overrode a product's maximum; a new draft failed on empty weight, stock or selling unit; a variable product whose options track their own stock still needed a product-level quantity; five postcode fields were capped at 4 digits although Japanese postcodes have 7 (customer address form, shipping zone, shipping preview, tax rate, tax preview; tests had set values without typing); a page made only of a reusable block couldn't be published; the "Version restored" notice stayed after saving; a stale "coming later" hint on the product tax class.

**Old tests updated for intended changes:** accepting a quote now needs a payment choice when several methods are enabled (b5); updating, scheduling or unpublishing a live page asks first (roles, cms, verify23). The test helper now answers the browser's "leave this page?" prompt, which the editor now shows when you leave with unsaved changes.

**Not in the sweep:** `/account/lists/[id]`, `/account/quotations/[id]`, `/admin/quotations/[id]`, `/admin/tax/rates/[id]`, `/preview/[kind]/[id]`, because the sweep had no link to follow to them on fresh sample data. `/account/quotations/[id]` was checked at 768 and 430px in f2.

**What the browser suites can't show:** they check behaviour and sideways scroll, not appearance. Only some screens were reviewed by eye. Nothing has run against a real backend, and no real phone or Safari has been used: all browser tests ran in headless Chrome.

## Storefront

| Feature | Status | Notes |
| --- | --- | --- |
| Home sections from the CMS, order and visibility | COMPLETED | Browser-checked. Featured products is switched off in the sample at the owner's request, and can be turned on in the builder |
| Hero matching the owner's light and dark designs: photo per theme, frosted card, second link, three-slide carousel with the notch pagination | COMPLETED | No side arrows on photo slides (they'd sit on the card). Browser-checked at 375, 430, 768, 1024, 1280, 1440px in both themes; the card is identical in both themes, slightly see-through, and lines up with the photo within 2px from 1280px. Editable in the homepage builder |
| Owner section matching the owner's reference | COMPLETED | Browser-checked at 6 widths, light and dark |
| Trusted brands section | COMPLETED | Logos, order and choice from Admin → Brands. Browser-checked |
| Header, footer, nested menus, mobile menu | COMPLETED | Below 1280px the menu button replaces the full navigation row. Quick order is out of the sample header menu (still in the footer) |
| All categories dropdown: sub-panel beside its row, main categories link to their page | COMPLETED | Browser-checked at 1440px |
| Hand cursor on everything clickable, "not allowed" when disabled | COMPLETED | One rule in `globals.css`. Browser-checked on all routes without an id in the URL, plus 5 detail pages, on desktop |
| Preloader on every page: top bar, dimming, spinner if slow, fade-in | COMPLETED | Browser-checked with a slowed connection, with and without a skeleton page. Navigations made from code after a save use their button's own "Saving…" state instead |
| Phone bottom bar: Shop, Wishlist, Cart, My account | COMPLETED | Browser-checked on 375 and 430px. Wishlist opens saved lists; there's no separate wishlist. Items are fixed in code |
| Shop: search, category, price range, pagination, guest restrictions | COMPLETED | Browser-checked |
| Shop: grid/list view | COMPLETED | Browser-checked. Cards don't show the SKU (owner's request); the product page and quick order still do |
| Staff see the store like an approved customer: standard wholesale prices on cards, product pages, quick order and the price filter; Create order instead of a cart | COMPLETED | Browser-checked. Guests and applicants still see no prices |
| Hero button orange, the same in both themes | COMPLETED | Browser-checked |
| "How it works" steps to the owner's design: round cards, numbered badges, arrows | COMPLETED | One row with arrows from 1280px, two per row on tablets, one on phones. Browser-checked at 375 to 1440px, light and dark. Icons and colours follow the step's position |
| Quantity control on product cards: − / number / + and add | COMPLETED | Follows the minimum, maximum and pack size. Only on products an approved customer can order from the card. Browser-checked at 375 and 1440px |
| Shop: sort order | NEEDS TESTING | Opens; the resulting order isn't asserted in a browser |
| Product page: options, price per option, add to cart | COMPLETED | Browser-checked |
| Product gallery | COMPLETED | Browser-checked |
| Quick order sheet: 10 products per page, load more, add | COMPLETED | Browser-checked. Pages count products, so a product with options adds a row per option |
| Blog sidebar: search, category checkboxes (any of several), suggested articles | COMPLETED | Filtered on the server. Browser-checked. Keeping several categories across pages isn't browser-checked: the sample has fewer than 12 matching posts. It uses this sidebar in place of the usual list toolbar |
| Blog, CMS pages, about, contact | COMPLETED | Sample policy text needs legal review |
| Login, logout, forgot and reset password | COMPLETED | Demo only. Real sign-in is BACKEND PENDING |
| Registration through to the requests list | COMPLETED | Browser-checked |
| Cart, coupon, checkout, confirmation | COMPLETED | Browser-checked |

## CMS

| Feature | Status | Notes |
| --- | --- | --- |
| Pages and posts: draft, publish, schedule, trash, restore, preview, visibility | COMPLETED | Browser-checked |
| Blog category and tag management | COMPLETED | Browser-checked |
| Rich editor | COMPLETED | Bold, alignment, link, table browser-checked; the other tools NEEDS TESTING |
| Sanitization | COMPLETED | Unit-tested. The backend must also sanitize on save |
| Media library: upload, edit, search | COMPLETED | Browser-checked |
| Menu builder: nesting, drag and drop | COMPLETED | Browser-checked |
| Homepage builder: order, visibility, content | COMPLETED | Browser-checked |
| SEO, sitemap, robots | COMPLETED | Browser-checked |
| Revisions: history, compare, restore (asks first on a live item) | COMPLETED | Browser-checked (suite f3); rules unit-tested. Newest 25 kept |
| Autosave: status, recover or discard, browser copy for new items; confirm before changing live content; unsaved-changes warning | COMPLETED | Browser-checked (f3). Stale-save conflicts are BACKEND PENDING |
| Reusable blocks: list, add, edit, usage, insert into pages and posts, delete refused while used | COMPLETED | Browser-checked (f3), light and dark; markers sanitized and expanded on the server |

## White label

| Feature | Status | Notes |
| --- | --- | --- |
| Company, branding, general settings, setup wizard | COMPLETED | Browser-checked |
| Logo, favicon, mobile logo, light/dark logos | COMPLETED | Browser-checked |
| Switching country and currency | COMPLETED | Browser-checked to Bangladesh and BDT and back: forms, tax and shipping examples follow |
| Sample company only in sample files | COMPLETED | Searched. Comments still mention JPY as an example |

## Catalog and customers

| Feature | Status | Notes |
| --- | --- | --- |
| Simple product: create, publish, edit, reaches the shop | COMPLETED | Browser-checked |
| Variable product: open and save | COMPLETED | Browser-checked |
| Variable product: create from scratch, attributes, variations | NEEDS TESTING | |
| Categories: create, rename, assign | COMPLETED | Browser-checked. Fixed: forms showed only the first 48 categories |
| Brands: add, edit, logo upload, homepage choice, order, delete | COMPLETED | Browser-checked |
| Inventory and stock history | COMPLETED | Browser-checked. Real stock transactions BACKEND PENDING |
| Customers: add, edit, suspend, reinstate, approve | COMPLETED | Browser-checked |
| Customer groups | NEEDS TESTING | Filter checked; create, edit and member changes not clicked through |
| Price rule: percent for everyone, tester | COMPLETED | Browser-checked |
| Price rule: other targets and types, tiers | NEEDS TESTING | Engine unit-tested |
| Quantity rules | COMPLETED | Browser-checked |
| Bulk product changes with preview: publish, draft, stock status, categories, prices, order limits, archive, delete | COMPLETED | Browser-checked (f1: unpublish, and a stock-status skip for tracked products); every operation unit-tested |
| Order quantity per product in packages: minimum, maximum, multiples | COMPLETED | Browser-checked (f1): editor validation, product page, export. Precedence with rules unit-tested |
| Publishing checks: drafts may be incomplete, publishing may not (editor, bulk publish, import) | COMPLETED | Browser-checked (f1); unit-tested |
| Product CSV import (map, check, import, results) and export (filters or selection, columns, template) | COMPLETED | Browser-checked (f1); unit-tested. Schema in PRODUCT-CSV.md |

## Customer portal

All browser-checked: overview, orders, order again, saved lists, quotations, profile, addresses, invoices, deliveries. PDF downloads are BACKEND PENDING.

Accepting a quotation: the customer chooses from the enabled payment methods (none pre-selected); with none enabled the screen says so and accept is disabled; the order is created unpaid at the quoted prices. Browser-checked (f2).

## Orders

| Feature | Status | Notes |
| --- | --- | --- |
| Create order: registered and walk-in | COMPLETED | Browser-checked |
| Status flow, final states, cancel with reason | COMPLETED | Browser-checked |
| Adjust quantity, price, delivered weight | COMPLETED | Browser-checked, by role |
| Replace product | COMPLETED | Dialog browser-checked |
| Invoice, revision, credit note, frozen seller details | COMPLETED | Browser-checked. Print view is not a PDF |
| Refund: partial, reason, history | COMPLETED | Recorded only. Real refunds BACKEND PENDING |
| Coupons: admin, cart, checkout, usage | COMPLETED | Browser-checked |
| Money summary on admin and customer order pages: original and current total, received, refunds recorded and processed, outstanding, overpaid, refund due, invoice total, credit notes | COMPLETED | Browser-checked (f2) before and after recording a payment; unit-tested |

## Shipping, tax, payments

| Feature | Status | Notes |
| --- | --- | --- |
| Zones, wizard, methods, rules, classes, pickup, settings, calculator | COMPLETED | Browser-checked |
| Tax on/off, preview, checkout effect | COMPLETED | Browser-checked. Rates fictional |
| Tax classes per product, exempt | NEEDS TESTING | Unit-tested |
| Payment method on/off reaches checkout | COMPLETED | Browser-checked |
| Live payments | BACKEND PENDING | |

## Roles and staff

Permissions decide what the demo shows and accepts. They aren't security: the backend must check every call.

| Feature | Status | Notes |
| --- | --- | --- |
| Role Editor: choose a role, name, description, 23 groups with explanations, allow and remove all, search, expand and collapse | COMPLETED | Browser-checked. The old table stays as Advanced view |
| Save, discard, feedback, unsaved-change warning | COMPLETED | Browser-checked. The browser's back button can't be intercepted |
| Dependency and conflict warnings with one-click fix | COMPLETED | Unit-tested and browser-checked |
| Templates, create, duplicate, delete | COMPLETED | Browser-checked |
| 14 separate order permissions | COMPLETED | Each one gates its control and its server action. Browser-checked for Warehouse, Support, Shop Manager |
| Every other capability checked by its own server action | COMPLETED | Fixed: products had no check; media, shipping extras, delivery, reminders and email were tied to company settings; posts, menus and homepage shared one check; coupons used the pricing check. Server refusal browser-checked on a sample of screens, not all of them |
| Staff list, add and invite (demo), assign role, effective permissions, preview | COMPLETED | Browser-checked. No email is sent. One role per person |
| Sidebar, Access denied, View only, hidden actions | COMPLETED | Browser-checked. Not every capability on every screen was clicked through for every role |
| Safeguards: Administrator, self-lockout, escalation, nobody above you, last administrator | COMPLETED | Unit-tested and browser-checked |
| Export orders, products, customers; delete eligible orders; delete customers without orders | COMPLETED | Added so these permissions control something real. CSV demo only |

## Delivery, notifications, reports

All browser-checked (Batches 8 and 9): delivery schedules, reminder campaigns with audience preview, email templates and logs, reports, CSV export. Nothing is ever sent.

## Handoff

| Item | Status | Notes |
| --- | --- | --- |
| Service interfaces and mock adapter | COMPLETED | Enforced by the type check |
| HTTP adapter | COMPLETED | Unit-tested with a fake server. **Never run against a real backend** |
| API contracts and OpenAPI | COMPLETED | Generated from the code. YAML parses, references resolve, no duplicate operations. Not run through a third-party validator |
| Handoff docs | COMPLETED | Start at `BACKEND-INTEGRATION-GUIDE.md` |

## Open issues

- **Business decisions for the owner** are in `BUSINESS-RULES.md` §30, under "Still open".
- **Sample wording:** "Invoice & Credit Support" promises credit, which doesn't exist yet. Change it unless credit will be offered.
- **Brand names:** the sample catalog came from an older import and still names real brands in its data. Reusable code doesn't. Logos for those brands must be the owner's own, uploaded in Admin → Brands.
- Demo data lives in server memory: it resets on restart and is unreliable on serverless hosting.
- `backup/` is still tracked by git (146 files). It's excluded from builds, lint and type checks, and nothing was deleted. `*.zip` is ignored. The owner decides whether to untrack it.
- A sample product ("Duck Whole") has duplicate options, two of them unavailable. Sample data only.
- Next.js warns in the dev console about the sample logo's aspect ratio. Cosmetic.
- Wide admin tables scroll inside their own box on phones and tablets; there's no card view.
