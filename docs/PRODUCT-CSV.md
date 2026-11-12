# Product CSV import and export

For store staff preparing files and for the backend developer implementing `POST /admin/products/import` and the export. The frontend rules are the reference: `src/lib/catalog/csv.ts` (columns, parsing, cell guard) and `src/lib/catalog/csv-import.ts` (row planning), tested in `tests/product-csv.test.ts`. Screens: **Products → Import CSV** (`/admin/products/import`) and **Products → Export CSV** (dialog on the product list). Business rules summary: `BUSINESS-RULES.md` §21.

In the demo, imports change the in-memory store only.

## File format

- UTF-8 CSV, comma-separated, first row = column headers. A UTF-8 byte order mark is accepted (exports include one so spreadsheet apps open them correctly).
- Quotes as in RFC 4180: a cell with a comma, quote or line break is wrapped in `"`, and a `"` inside is written `""`.
- At most **1,000 rows** and **2 MB** per file.
- Headers are matched to columns automatically by label or alias (case, spaces and punctuation ignored). The import screen lets staff change each match, or choose "Don't import" for a column.
- Numbers use a dot for decimals; thousands separators are not allowed. Money is per package, in the store currency, rounded half-up to its minor unit.

## Columns

| Header | Field | Also recognised | Meaning |
| --- | --- | --- | --- |
| ID | `id` | productid | Leave empty for new products. Given, it updates that product. |
| Type | `type` | producttype | simple, variable or variation. Empty: simple, or variation when Parent SKU is filled. |
| SKU | `sku` | code, itemcode | Updates the product with this SKU if there is one. |
| Parent SKU | `parentSku` | parent | Variation rows: the SKU of their variable product. |
| Name | `name` | productname, title | Required for new products. |
| Status | `status` | published | draft or published. Empty: draft for new products, unchanged for updates. |
| Categories | `categories` | category | Existing category names or slugs, separated by commas. |
| Regular price | `regularPrice` | price, baseprice | Per package, in the store currency. |
| Sale price | `salePrice` | saleprice | Below the regular price. |
| Manage stock | `manageStock` | managestock, trackstock | yes or no: track a quantity. |
| Stock | `stock` | stockquantity, quantity, qty | Packages in stock (when managing stock). |
| Stock status | `stockStatus` | instock, availability | in_stock, out_of_stock or backorder (when not managing stock). |
| Weight | `weight` | packageweight, weightkg | Weight of one package, used for shipping. |
| Weight unit | `weightUnit` | unitofweight | kg or g. Empty: kg. |
| Selling unit | `unitLabel` | unit, sellingunit, package | What one quantity is: bag, case, carton. |
| Minimum quantity | `minQuantity` | minqty, minimum, minimumquantity | Packages per order line. Empty: 1 for new products. |
| Maximum quantity | `maxQuantity` | maxqty, maximum, maximumquantity | Empty: no limit for new products, unchanged for updates. 0 removes the limit. |
| Quantity step | `quantityStep` | step, increment, multiplesof | Order in multiples of. Empty: 1 for new products. |
| Priced by weight | `pricedByWeight` | variableweight, soldbyweight | yes or no: the price follows the delivered weight. |
| Tax class | `taxClass` | taxclass | standard, reduced or exempt. |
| Short description | `shortDescription` | summary | Plain text. |
| Description | `description` | longdescription | Plain text or simple HTML (cleaned on save). |
| Attribute name | `attributeName` | attribute, attribute1name, option | Variable products: the option name, e.g. Size. |
| Attribute values | `attributeValues` | attribute1values, options, values | Variable products: values separated by \|. Variation rows: their one value. |

Quantity is always counted in packages (the selling unit), never in weight: see BUSINESS-RULES.md §3.

## How rows are matched

1. A row with an **ID** updates that product (an unknown ID is an error).
2. Otherwise a **SKU** that already exists (product or variation, case-insensitive) updates it.
3. Otherwise the row **creates** a new product.

The ID is the stable key: SKUs can change, IDs never do. Exports always include it.

## Updating

- **Only cells with a value change.** An empty cell keeps what's saved, so a file with just `SKU` and `Regular price` changes prices and nothing else.
- To clear a maximum quantity, write `0`.
- Every change is validated like a save in the product editor. An update that would make a published product unpublishable is refused.

## Variable products

- The parent row has `Type` = `variable`, its own SKU, `Attribute name` and all `Attribute values` (`5 L|18 L`).
- Each option is a row with `Type` = `variation` (or empty with a Parent SKU), `Parent SKU` = the parent's SKU, its own SKU, price, stock and weight, and its one value in `Attribute values`.
- The parent can be in the same file (earlier or later) or already in the store.
- Stock of a new variation: with a `Stock` value it tracks its own quantity; without one it shares the parent's stock when the parent manages stock, otherwise it uses a stock status (`Stock status`, default in stock).

## Problems and results

- The **Check rows** step runs every rule without saving and shows each row as Create, Update or Skip, with its errors and notes. Nothing is saved until **Import** is pressed, and the import repeats every check.
- A product with any problem is skipped together with its variation rows; the message names the line and the field. The other rows still import.
- The same ID or SKU twice in one file: the later row is skipped as a duplicate.
- Unknown categories, an unknown Parent SKU, a bad number, a sale price not below the regular price, invalid order limits and a published row that fails the publishing checks are all errors.
- New products are created as drafts unless the row says `published` and passes the publishing checks (SKU, price, category, package weight, selling unit).
- The result reports how many products were created, updated and skipped, row by row.

## Export

- **Scope:** all products matching the list's current filters, or the products ticked on the page.
- **Columns:** any subset of the columns above (the dialog lists them).
- Each product row is followed by its variation rows, in the same columns the importer reads, so an export can be edited and imported back.
- **Template:** `GET /admin/products/export?template=1` gives the headers with example rows (a simple product, a variable product and two variations).
- **Formula guard:** a cell starting with `=`, `+`, `-`, `@`, tab or carriage return is written with a leading `'` so spreadsheet apps don't run it as a formula. The importer removes that `'` again (`unguard`).
- Exports are private (`Cache-Control: private, no-store`) and need `products.export`.

## Backend contract

| Call | Route | Notes |
| --- | --- | --- |
| Check or import | `POST /admin/products/import` | Body `{ rows: ProductImportRow[], apply }`. Each row is `{ line, values }`, `values` keyed by the field names above, raw text. `apply: false` only checks. Returns `ProductImportResult` (`rows`, `created`, `updated`, `skipped`). Needs `products.create` and `products.edit` |
| Export | `GET /admin/products/export` | Query: the list filters (`q`, `category`, `type`, `stock`, `status`, `pricing`), or `ids` (comma-separated, at most 500); `cols` (comma-separated field names); `template=1`. Returns `text/csv` |

The browser parses the file and sends rows, so the backend never receives an uploaded file in this design. For large catalogs the backend may instead accept the file and run the import as a background job, reporting the same per-row results. Generated reference: `docs/API-CONTRACTS.md`.
