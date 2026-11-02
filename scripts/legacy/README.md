# Legacy: one-time WooCommerce import (archived, not used)

The frontend no longer depends on WooCommerce. Nothing in the app, the build or the tests reads these files,
and no npm script runs them.

- `woocommerce-catalog.original.json`: the original development import (October 2026), kept as historical source data.
  The app uses `src/lib/data/fixtures/sample-catalog.json` instead, a standalone sample catalog derived from it once,
  offline (neutral `sp-…` ids, sample JPY prices, no source-system fields).
- `import-woocommerce.ts`: the read-only import script that produced it. It needs WooCommerce API credentials, which the
  frontend does not use. Safe to delete together with any `WC_*` lines in your local `.env.local`.
