/**
 * Product CSV: the columns, a standards-following parser (RFC 4180: quotes, doubled quotes, line breaks in quotes,
 * a byte-order mark) and automatic column matching. Pure and tested (tests/product-csv.test.ts). Export and import use
 * the same column labels, so an exported file can be edited and imported back. Schema: docs/PRODUCT-CSV.md.
 */
import type { ProductCsvField } from "../types/index.ts";

export interface CsvFieldInfo {
  key: ProductCsvField;
  label: string;
  /** Other header names matched automatically (lowercase, spaces and punctuation ignored). */
  aliases: string[];
  help: string;
}

export const PRODUCT_CSV_FIELDS: CsvFieldInfo[] = [
  { key: "id", label: "ID", aliases: ["productid"], help: "Leave empty for new products. Given, it updates that product." },
  { key: "type", label: "Type", aliases: ["producttype"], help: "simple, variable or variation. Empty: simple, or variation when Parent SKU is filled." },
  { key: "sku", label: "SKU", aliases: ["code", "itemcode"], help: "Updates the product with this SKU if there is one." },
  { key: "parentSku", label: "Parent SKU", aliases: ["parent"], help: "Variation rows: the SKU of their variable product." },
  { key: "name", label: "Name", aliases: ["productname", "title"], help: "Required for new products." },
  { key: "status", label: "Status", aliases: ["published"], help: "draft or published. Empty: draft for new products, unchanged for updates." },
  { key: "categories", label: "Categories", aliases: ["category"], help: "Existing category names or slugs, separated by commas." },
  { key: "regularPrice", label: "Regular price", aliases: ["price", "baseprice"], help: "Per package, in the store currency." },
  { key: "salePrice", label: "Sale price", aliases: ["saleprice"], help: "Below the regular price." },
  { key: "manageStock", label: "Manage stock", aliases: ["managestock", "trackstock"], help: "yes or no: track a quantity." },
  { key: "stock", label: "Stock", aliases: ["stockquantity", "quantity", "qty"], help: "Packages in stock (when managing stock)." },
  { key: "stockStatus", label: "Stock status", aliases: ["instock", "availability"], help: "in_stock, out_of_stock or backorder (when not managing stock)." },
  { key: "weight", label: "Weight", aliases: ["packageweight", "weightkg"], help: "Weight of one package, used for shipping." },
  { key: "weightUnit", label: "Weight unit", aliases: ["unitofweight"], help: "kg or g. Empty: kg." },
  { key: "unitLabel", label: "Selling unit", aliases: ["unit", "sellingunit", "package"], help: "What one quantity is: bag, case, carton." },
  { key: "minQuantity", label: "Minimum quantity", aliases: ["minqty", "minimum", "minimumquantity"], help: "Packages per order line. Empty: 1 for new products." },
  { key: "maxQuantity", label: "Maximum quantity", aliases: ["maxqty", "maximum", "maximumquantity"], help: "Empty: no limit for new products, unchanged for updates. 0 removes the limit." },
  { key: "quantityStep", label: "Quantity step", aliases: ["step", "increment", "multiplesof"], help: "Order in multiples of. Empty: 1 for new products." },
  { key: "pricedByWeight", label: "Priced by weight", aliases: ["variableweight", "soldbyweight"], help: "yes or no: the price follows the delivered weight." },
  { key: "taxClass", label: "Tax class", aliases: ["taxclass"], help: "standard, reduced or exempt." },
  { key: "shortDescription", label: "Short description", aliases: ["summary"], help: "Plain text." },
  { key: "description", label: "Description", aliases: ["longdescription"], help: "Plain text or simple HTML (cleaned on save)." },
  { key: "attributeName", label: "Attribute name", aliases: ["attribute", "attribute1name", "option"], help: "Variable products: the option name, e.g. Size." },
  { key: "attributeValues", label: "Attribute values", aliases: ["attribute1values", "options", "values"], help: "Variable products: values separated by |. Variation rows: their one value." },
];

export const CSV_LIMITS = { rows: 1000, bytes: 2_000_000 } as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Each header's field, or null when nothing matches. A field is matched once at most. */
export function autoMapHeaders(headers: string[]): (ProductCsvField | null)[] {
  const used = new Set<ProductCsvField>();
  return headers.map((h) => {
    const n = norm(h);
    const f = PRODUCT_CSV_FIELDS.find((x) => !used.has(x.key) && (norm(x.label) === n || norm(x.key) === n || x.aliases.includes(n)));
    if (!f) return null;
    used.add(f.key);
    return f.key;
  });
}

/** Rows of cells. Handles quotes, doubled quotes, commas and line breaks inside quotes, CRLF and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  // Blank lines aren't rows.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** One CSV cell. A leading = + - @ is prefixed with ' so spreadsheets don't run it as a formula. */
export function csvCell(v: string | number | undefined | null) {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const toCsvText = (rows: (string | number | undefined | null)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

/** A cell exported with the formula guard, back to what was meant. */
export const unguard = (v: string) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v);
