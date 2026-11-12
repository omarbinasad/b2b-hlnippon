@AGENTS.md

# b2b-commerce — project guide

Next.js (App Router, TypeScript, Tailwind v4) frontend for a white-label B2B wholesale store. The sample company is in Japan (JPY, whole yen, Asia/Tokyo). Product origin (e.g. Japan) is a product field, separate from the store location.
The backend (Laravel or Django) is not chosen yet; all data currently comes from mock repositories.

## Where things live
- `src/app/(store)` public storefront · `src/app/(auth)` login/register · `src/app/account` customer portal · `src/app/admin` admin panel
- CMS (see `docs/CMS-AND-CONTENT-MANAGEMENT.md`): `repositories.pages`, `posts`, `navigation`, `siteContent`, `media` · mock in `src/lib/data/mock-content.ts`, sample content in `src/lib/data/mock/site-content.ts` and `mock/posts.ts` · pure rules in `src/lib/content` · admin UI in `src/components/admin/content` · editor content renders with `<RichText rich>` (`sanitizeRichHtml`) · public `/[slug]`, `/blog`, `/blog/[slug]`, staff `/preview/[kind]/[id]`
- `src/components/admin/notification-bell.tsx` admin bell + `repositories.adminNotifications` (derived from orders, applications, stock, contact messages; `src/lib/data/mock-admin-notifications.ts`); sidebar badges in `admin-shell.tsx`
- Company settings (white label, see `docs/WHITE-LABEL-ARCHITECTURE.md`): `repositories.company` → `src/config/runtime.ts` → `siteConfig` getters in `src/config/site.ts` (read while rendering, never at module level) · sample values only in `src/config/sample-company.ts` · never hard-code a company, currency, country or time zone; use `isPhone`/`isPostcode` (`src/lib/customers/contact.ts`), `regionNames`/`addressLabels` (`src/lib/locations.ts`), `RegionField`
- `docs/FRONTEND-MASTER-CHECKLIST.md` is the live plan and status: read its Progress table first, update it after each batch
- `src/components/admin/media/media-picker.tsx` + `repositories.media` media library (uploads in server memory, served by `/media/[id]`)
- Home copy comes from `repositories.siteContent`, never config files · `src/config/storefront.ts` holds only display defaults (category icons, placeholder labels) · `src/components/storefront` Home sections take their content as props · `src/app/(store)/(pages)` route group gives non-Home store pages their container (URLs unchanged)
- `public/brand` logo/brand marks · `public/images` fixed site images · product photos come from the backend media host — the only exception is the sample catalog's local images (`public/images/products`, `public/images/categories`)
- `src/lib/data/fixtures/sample-catalog.json` standalone sample catalog (`src/lib/data/mock/sample-catalog.ts`; ids `sp-…`/`scat-…`) — no WooCommerce or other external dependency at runtime, build or test; the old import is archived in `scripts/legacy/` (unused) · `src/lib/html/sanitize.ts` allowlist sanitizer for product HTML
- `src/app/globals.css` design tokens (colors, radius, charts) as CSS variables, light + `[data-theme="dark"]`; theme script + toggle in `src/components/ui/theme*.tsx`
- `src/components/ui` shared primitives (`Select` in `select.tsx` replaces native <select>: same props, styled list, search above 12 options — never use a raw <select>) · `src/components/layout` area navigation · `src/components/<feature>` feature UI
- `src/lib/types` domain types · `src/lib/data/mock` mock records · `src/lib/data/repositories` interfaces + implementations
- `src/lib/auth/session.ts` mock viewer (NOT real auth): on-screen "Demo view" switcher (`demo-view` cookie, `src/components/layout/demo-view-switcher.tsx`; off with `DEMO_VIEW_SWITCHER=off`) → `MOCK_VIEWER` → guest. Viewer-dependent UI (prices, cards, header, quick order, cart) must read `getViewer()`
- `src/lib/validation` shared form/"server" validation · `src/app/admin/*/actions.ts` server actions (the only write path; they call repositories)
- `src/lib/orders` pure order money calc (integer minor units, half-up) + status flow + refund rules (`refund.ts`), shared by mock data and admin previews; covered by `npm test` (`tests/*.test.ts`, Node test runner)
- `src/lib/pricing/engine.ts` pure B2B price/quantity rule engine (documented precedence, paisa math); the reference the backend must match — tested in `tests/pricing-engine.test.ts`
- `src/lib/shipping/engine.ts` pure shipping zone matching + rate calculation (sample rates in mock data) — tested in `tests/shipping-engine.test.ts`
- `src/lib/tax/engine.ts` pure tax rate matching + calculation (fictional demo rates; orders store tax snapshots) — tested in `tests/tax-engine.test.ts`
- `src/lib/payments/methods.ts` payment method availability/validation (settings only — no processing, no secrets) — tested in `tests/payment-methods.test.ts`
- Demo editing: the mock catalog, orders, customers, rules, settings, shipping zones, tax and payment methods are in-memory stores on `globalThis` (not reliable on Vercel serverless — see docs/backend-api.md §7) — label any editable screen with `DemoEditingNotice`
- Cart/checkout: `src/lib/data/mock-cart.ts` (stores product/option/qty only, re-priced on every read) + `orders.checkout()`/`checkoutPreview()` (share `buildOrder()` with admin `create()`; idempotency key); pure rules in `src/lib/orders/cart.ts` (tested in `tests/cart-checkout.test.ts`). Shopper = `getShoppingCustomerId()` (approved customer viewer; preview with `MOCK_VIEWER=customer`)
- Money: integer minor units via `toMinor`/`fromMinor` in `src/lib/orders/calc.ts`, rounded half-up once to the currency's minor unit; validate amounts with `isValidAmount`, percentages with `isValidPercent`; amount inputs use `amountStep()`
- Addresses follow the store country: `prefecture` is the top level whatever its label (`src/lib/locations.ts`) · `city` · optional `area` · street · postcode and phone checks in `src/lib/customers/contact.ts`
- `src/lib/data/http` REST adapter: `endpoints.ts` maps every repository method to a route (TypeScript enforces coverage), `http-repositories.ts` makes the calls; on with `DATA_SOURCE=http`, never run against a real backend yet · `npm run docs:api` regenerates `docs/API-CONTRACTS.md` + `docs/openapi.yaml` (hand-written parts in `scripts/api-docs`) · `npm run docs:routes` regenerates `docs/FRONTEND-ROUTE-MAP.md` · start backend work at `docs/BACKEND-INTEGRATION-GUIDE.md`
- `src/lib/auth/capabilities.ts` roles + `module.action` capabilities + route rules, `src/lib/auth/permission-catalog.ts` Role Editor labels and warnings (`docs/ROLES-AND-CAPABILITIES.md`; UI only, not security) · a new admin action checks `actorWith("module.action")` (`src/lib/auth/session.ts`); in the UI use `Can`, `WriteGuard`, `AllowedLink`, `useCan` (`src/components/admin/capabilities-context.tsx`); a new capability goes in `MODULES` and the catalog (a test requires both) · `src/lib/shipping/rules.ts` conditional shipping rules (`docs/SHIPPING-RULES-AND-CALCULATIONS.md`) · `src/lib/coupons/engine.ts` coupons · `src/lib/reminders/segment.ts` reminder audiences · `src/lib/email/render.ts` email templates (logged, never sent) · `src/lib/reports/aggregate.ts` report definitions
- CMS history and blocks: `repositories.contentHistory` (revisions, autosave) + `repositories.blocks` (reusable blocks), rules in `src/lib/content/revisions.ts` / `blocks.ts`; render page/post bodies through `withBlocks()` (`src/lib/data/expand-blocks.ts`) so block markers expand · product order limits = `Product.quantityRule` in packages (precedence in `resolveQuantityLimits`, BUSINESS-RULES §3) · `src/lib/catalog/bulk.ts` bulk changes, `csv.ts` + `csv-import.ts` product CSV (`docs/PRODUCT-CSV.md`) · `src/lib/orders/money-summary.ts` + `src/components/order/money-summary.tsx` order money figures (credit note ≠ refund)
- `src/lib/data/all-pages.ts` `allPages()` for selectors that must offer every row (never a one-page `perPage` guess) · `docs/BUSINESS-RULES.md` + `docs/DATABASE-REQUIREMENTS.md` rules and data model · `docs/DEMO-MODE-GUIDE.md` · `docs/BACKEND-PENDING-FEATURES.md`
- Store prices by viewer: `getPricingCustomerId()` in `session.ts` (approved customer: their own; staff: `STANDARD_PRICING_ID`, the standard wholesale price; others: none) · shopping (cart, checkout) stays `getShoppingCustomerId()`, approved customers only
- `src/components/ui/navigation-progress.tsx` preloader on every page (root layout; styles under "Preloader" in `globals.css`). Don't add a `loading.tsx` to public pages just for this: it would stop not-found pages answering 404
- `src/components/layout/mobile-bottom-nav.tsx` phone menu (`data-bottom-nav` reserves its room in `globals.css`; floating buttons use `--bottom-nav-h`) · `src/app/admin/brands` brand manager, read by the homepage's `brands` section
- `docs/FRONTEND-COMPLETION-REPORT.md` batch plan and status for the frontend-completion / backend-handoff work
- `docs/B2B-WEBSITE-FEATURE-AUDIT.md` per-module status with file refs; `docs/B2B-WEBSITE-FINAL-REPORT.md` latest batch report
- `docs/backend-api.md` backend API contract — update it when types or repository interfaces change
- `docs/FEATURE_SCOPE.md` feature inventory and status — update statuses when a feature changes; a screen alone is not "done"

## Rules
- Build one requested feature at a time; avoid unrelated changes.
- Follow the existing structure and reuse existing components before adding new ones.
- Keep the frontend independent of the future Laravel/Django backend: pages call repositories (`@/lib/data`), never mock files or fetch URLs directly.
- Use TypeScript types from `@/lib/types`; format money/dates only via `@/lib/format`.
- Never calculate prices, taxes or shipping in UI components; those are backend rules (mock logic stays in `src/lib/data/mock`). The only exception: clearly labelled admin previews may call the shared pure engines in `src/lib/orders`, `src/lib/pricing`, `src/lib/shipping` and `src/lib/tax`.
- Use color tokens (never hard-coded colors) so light and dark mode both work.
- Server Components by default; add `"use client"` only to small interactive leaves, never to whole pages or layouts.
- Keep product lists paginated and filtered server-side; never send the entire catalog to the browser.
- Every listing uses `ListToolbar` + `SortHeader` (`src/components/ui/list-controls.tsx`) + `Pagination`, parses params with `src/lib/list-params.ts`, and passes them to a repository `ListQuery` — no client-side filtering.
- Use `next/image` with `sizes` for product images; no base64 product images.
- Never publicly cache customer-specific prices, orders, or account data.
- Mobile-first; check layouts at 430px width.
- Never present mock authentication, payment, or order submission as real functionality.
- Keep admin-only code under `src/app/admin` / `src/components/admin` so it never loads on public pages.
- HL Nippon is the example company: its name and assets may appear only in `src/config/sample-company.ts`, sample data and `public/brand`, never in reusable code. Any other real company name stays out entirely.
- Never present a tax rate as the current legal rate; demo rates must be labelled fictional. Tax stays off by default.
- Never collect card data, store gateway secrets in client code/browser storage, process payments, or mark orders paid on method selection.
- For multi-file changes make a brief plan; for simple changes work directly.
- Inspect only relevant files, run relevant checks (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`), report results concisely.
