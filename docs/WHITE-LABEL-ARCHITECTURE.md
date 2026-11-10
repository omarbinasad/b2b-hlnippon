# White-label architecture

For developers. The same source code runs any wholesale company: one company per deployment, each with its own
settings, data and (later) backend. It is not a multi-tenant SaaS.

## How company settings reach the code

```
repositories.company.get()          today: mock in server memory · later: GET /api/v1/company
        │
        ▼
src/app/layout.tsx                  on every render
   ├─ setCompany(settings)          server: src/config/runtime.ts (globalThis)
   ├─ <RuntimeBootstrap settings>   browser: same setter, during render, before the page
   └─ <style>{brandCss(branding)}   CSS variable overrides for the design tokens
        │
        ▼
company()  →  siteConfig (getters) · STORE_CURRENCY (getters) · format.ts · address rules · regionNames()
```

| Piece | File | Rule |
| --- | --- | --- |
| Types | `src/lib/types/company.ts` | `CompanySettings` is the whole contract |
| Sample identity | `src/config/sample-company.ts` | The only file holding the sample company's values |
| Live value | `src/config/runtime.ts` | Public settings only. Never put secrets or customer data here: it reaches the browser |
| Compatibility layer | `src/config/site.ts` | `siteConfig.*` are getters. Read them while rendering, never in a module-level constant |
| Currency | `src/config/currency.ts` | Engines read digits on each call, so rounding follows the setting |
| Address rules | `src/lib/customers/contact.ts`, `src/lib/locations.ts` | Per-country phone, postcode, region list and labels, with a generic fallback |
| Branding CSS | `src/lib/branding/css.ts` | Pure and tested. A value at the sample default emits nothing, so the tuned default theme stays exact |
| Validation | `src/lib/validation/company.ts` | The backend must enforce the same rules |

## Rules for new code

- Read names, contact details and locale from `siteConfig` or `@/lib/format`. Never hard-code a company, currency symbol, country or time zone.
- Use `RegionField`, `addressLabels()`, `isPhone()`, `isPostcode()`, `isKnownRegion()`; never Japan-only checks.
- Use color tokens. `brandCss` overrides tokens, so anything hard-coded will not follow the brand.
- Client components may read `siteConfig` while rendering, but not at module load: the browser's value is set during the first render.

## Connecting the backend

Implement `CompanyRepository` over HTTP. `layout.tsx` already calls `setCompany()` with what the service returns, so nothing else changes. Cache that response briefly. It is public data. Settings must be revalidated after an update, as `refreshAll()` does in `src/app/admin/settings/actions.ts`.

## Known limits

- Interface text is English only. `locale.language` sets the page language attribute; it does not translate anything.
- Sample data (customers, zones, tax rates, product copy) stays Japanese when the demo country changes. A real deployment starts with its own data.
- Changing currency relabels amounts and never converts them. On a live store it needs a data migration.
- Region lists exist for Japan, Bangladesh and the United States. Other countries get a free-text field, which is correct behaviour, not a gap in validation.
- Five fonts are offered (`FONT_OPTIONS`); more can be added in `layout.tsx` and that list. Brand fonts for a specific company need their own files.
- Home page copy is still in `src/config/storefront.ts` until the CMS batch moves it.
