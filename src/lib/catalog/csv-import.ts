/**
 * Product CSV import plan: what each file row would do (create, update, skip) and why, and the product inputs to save.
 * Pure and tested (tests/product-csv.test.ts). The mock store saves the plan; the backend must apply the same rules.
 *
 * Rules
 *  - A row updates the product with its ID, else the product with its SKU (any case); otherwise it creates one.
 *  - On an update only the filled-in cells change. An empty cell keeps the current value.
 *  - Variation rows (Type "variation", or a Parent SKU) belong to the variable product with that SKU, in the file or
 *    already saved. They update the option with their SKU, or add one with their attribute value.
 *  - Every product is checked like the product editor (validateProduct) plus SKU and slug uniqueness. A product with any
 *    problem is skipped as a whole, with its variation rows; other rows still import.
 *  - A SKU twice in the file: the later row is skipped. Unknown categories are an error (nothing is created silently).
 */
import { slugify, validateProduct } from "../validation/product.ts";
import { unguard } from "./csv.ts";
import { productToInput } from "./product-input.ts";
import type { Product, ProductImportRow, ProductImportRowResult, ProductInput, StockStatus, TaxClass, VariationInput } from "../types/index.ts";

export interface ImportContext {
  products: Product[];
  categories: { id: string; name: string; slug: string }[];
  tagName?: (id: string) => string;
}

export interface ImportWrite {
  /** Saved product to update; absent = create. */
  id?: string;
  input: ProductInput;
  /** File lines this write covers (the product row and its variation rows). */
  lines: number[];
}

type Parsed = { line: number; type: "simple" | "variable" | "variation"; sku: string; parentSku: string; name: string; errors: string[]; warnings: string[]; v: ProductImportRow["values"] };

const yes = (s: string) => /^(yes|y|true|1)$/i.test(s.trim());
const isYesNo = (s: string) => /^(yes|y|true|1|no|n|false|0)$/i.test(s.trim());
const STOCK: StockStatus[] = ["in_stock", "out_of_stock", "backorder"];
const TAX: TaxClass[] = ["standard", "reduced", "exempt"];

/** Field label for messages, from an editor error key such as "variations.2.basePrice". */
const FIELD_NAMES: Record<string, string> = { basePrice: "Regular price", salePrice: "Sale price", sku: "SKU", name: "Name", weight: "Weight", categoryIds: "Categories", stockQuantity: "Stock", minQuantity: "Minimum quantity", maxQuantity: "Maximum quantity", quantityStep: "Quantity step", variations: "Variations", slug: "Name", soldIndividually: "Sold individually", unitLabel: "Selling unit", stockMode: "Stock", stockStatus: "Stock status", attributes: "Attribute", defaultAttributes: "Attribute" };
const fieldName = (key: string) => FIELD_NAMES[key.split(".").pop() ?? key] ?? key;

function parseRow(row: ProductImportRow): Parsed {
  const v: ProductImportRow["values"] = {};
  for (const [k, raw] of Object.entries(row.values)) if (raw !== undefined) v[k as keyof typeof v] = unguard(String(raw)).trim();
  const errors: string[] = [];
  const typeText = (v.type ?? "").toLowerCase();
  const type = typeText === "variable" ? "variable" : typeText === "variation" || (!typeText && v.parentSku) ? "variation" : typeText === "" || typeText === "simple" ? "simple" : null;
  if (!type) errors.push(`Type “${v.type}” isn't simple, variable or variation.`);
  const num = (key: keyof typeof v, label: string, opts: { whole?: boolean; min?: number } = {}) => {
    const s = v[key];
    if (!s) return;
    const n = Number(s.replace(/,/g, ""));
    if (!Number.isFinite(n) || (opts.whole && !Number.isInteger(n)) || n < (opts.min ?? 0)) errors.push(`${label}: “${s}” isn't a valid ${opts.whole ? "whole number" : "number"}.`);
  };
  num("regularPrice", "Regular price");
  num("salePrice", "Sale price");
  num("stock", "Stock", { whole: true });
  num("weight", "Weight");
  num("minQuantity", "Minimum quantity", { whole: true, min: 1 });
  num("maxQuantity", "Maximum quantity", { whole: true });
  num("quantityStep", "Quantity step", { whole: true, min: 1 });
  for (const key of ["manageStock", "pricedByWeight"] as const) if (v[key] && !isYesNo(v[key]!)) errors.push(`${key === "manageStock" ? "Manage stock" : "Priced by weight"}: use yes or no.`);
  if (v.status && !/^(draft|published)$/i.test(v.status)) errors.push(`Status “${v.status}” isn't draft or published.`);
  if (v.stockStatus && !STOCK.includes(v.stockStatus.toLowerCase().replace(/\s+/g, "_") as StockStatus)) errors.push(`Stock status “${v.stockStatus}” isn't in_stock, out_of_stock or backorder.`);
  if (v.weightUnit && !/^(kg|g)$/i.test(v.weightUnit)) errors.push("Weight unit: use kg or g.");
  if (v.taxClass && !TAX.includes(v.taxClass.toLowerCase() as TaxClass)) errors.push(`Tax class “${v.taxClass}” isn't standard, reduced or exempt.`);
  if (type === "variation" && !v.parentSku) errors.push("A variation row needs a Parent SKU.");
  return { line: row.line, type: type ?? "simple", sku: v.sku ?? "", parentSku: v.parentSku ?? "", name: v.name ?? "", errors, warnings: [], v };
}

const n = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : undefined);

/** Applies the filled-in cells of a product row to an input. */
function applyProductCells(input: ProductInput, p: Parsed, ctx: ImportContext, isNew: boolean): string[] {
  const errors: string[] = [];
  const v = p.v;
  if (v.name) input.name = v.name;
  if (v.sku) input.sku = v.sku;
  if (p.type !== "variation") input.type = p.type;
  if (v.status) input.status = v.status.toLowerCase() as ProductInput["status"];
  else if (isNew) input.status = "draft";
  if (v.categories) {
    const wanted = v.categories.split(",").map((c) => c.trim()).filter(Boolean);
    const found = wanted.map((w) => ctx.categories.find((c) => c.name.toLowerCase() === w.toLowerCase() || c.slug === w.toLowerCase()));
    const missing = wanted.filter((_, i) => !found[i]);
    if (missing.length) errors.push(`Categories not found: ${missing.join(", ")}. Create them first, or fix the names.`);
    else input.categoryIds = [...new Set(found.map((c) => c!.id))];
  }
  if (v.regularPrice) input.basePrice = n(v.regularPrice);
  if (v.salePrice) input.salePrice = n(v.salePrice);
  if (v.manageStock) input.manageStock = yes(v.manageStock);
  else if (isNew) input.manageStock = Boolean(v.stock);
  if (v.stock) input.stockQuantity = n(v.stock);
  if (v.stockStatus) input.stockStatus = v.stockStatus.toLowerCase().replace(/\s+/g, "_") as StockStatus;
  if (v.weight) input.weight = { value: n(v.weight)!, unit: (v.weightUnit?.toLowerCase() as "kg" | "g") || input.weight.unit || "kg" };
  else if (v.weightUnit) input.weight = { ...input.weight, unit: v.weightUnit.toLowerCase() as "kg" | "g" };
  if (v.unitLabel) input.unitLabel = v.unitLabel;
  if (v.minQuantity) input.minQuantity = n(v.minQuantity)!;
  if (v.maxQuantity) input.maxQuantity = n(v.maxQuantity) === 0 ? undefined : n(v.maxQuantity);
  if (v.quantityStep) input.quantityStep = n(v.quantityStep)!;
  if (v.pricedByWeight) input.isVariableWeight = yes(v.pricedByWeight);
  if (v.taxClass) input.taxClass = v.taxClass.toLowerCase() as TaxClass;
  if (v.shortDescription) input.shortDescription = v.shortDescription;
  if (v.description) input.description = v.description;
  if (p.type === "variable" && (v.attributeName || v.attributeValues)) {
    const name = v.attributeName || input.attributes.find((a) => a.variation)?.name;
    if (!name) errors.push("Attribute name: a variable product needs one, such as Size.");
    else {
      const values = (v.attributeValues ?? "").split("|").map((s) => s.trim()).filter(Boolean);
      const existing = input.attributes.find((a) => a.name.toLowerCase() === name.toLowerCase());
      if (existing) existing.values = [...new Set([...existing.values, ...values])];
      else input.attributes.push({ name, values, visible: true, variation: true });
    }
  }
  return errors;
}

function newInput(name: string): ProductInput {
  return {
    type: "simple", name, slug: slugify(name), sku: "", shortDescription: "", description: "", status: "draft", visibility: "visible", featured: false,
    categoryIds: [], tags: [], brandIds: [], images: [], unitLabel: "item", taxStatus: "taxable", taxClass: "standard", manageStock: false,
    stockStatus: "in_stock", backorders: "no", soldIndividually: false, weight: { value: 0, unit: "kg" }, isVariableWeight: false,
    attributes: [], defaultAttributes: {}, variations: [], upsellIds: [], crossSellIds: [], menuOrder: 0, reviewsEnabled: false,
    minQuantity: 1, quantityStep: 1,
  };
}

export function planProductImport(rows: ProductImportRow[], ctx: ImportContext): { results: ProductImportRowResult[]; writes: ImportWrite[] } {
  const parsed = rows.map(parseRow);
  const byLine = new Map(parsed.map((p) => [p.line, p]));
  const actions = new Map<number, ProductImportRowResult["action"]>();

  // A SKU twice in the file: the later row is skipped.
  const seen = new Map<string, number>();
  for (const p of parsed) {
    const key = p.sku.toLowerCase();
    if (!key) continue;
    if (seen.has(key)) p.errors.push(`SKU ${p.sku} is already on line ${seen.get(key)} of this file.`);
    else seen.set(key, p.line);
  }

  const lowerSku = (s: string) => s.trim().toLowerCase();
  const productBySku = (sku: string) => ctx.products.find((x) => lowerSku(x.sku) === lowerSku(sku));
  const optionOwner = (sku: string) => ctx.products.find((x) => x.variations.some((v) => lowerSku(v.sku) === lowerSku(sku)));

  // Products: rows in the file, plus saved variable products that variation rows point to.
  const groups: { head?: Parsed; existing?: Product; variations: Parsed[] }[] = [];
  for (const p of parsed.filter((x) => x.type !== "variation")) {
    let existing: Product | undefined;
    if (p.v.id) {
      existing = ctx.products.find((x) => x.id === p.v.id);
      if (!existing) p.errors.push(`No product has the ID ${p.v.id}.`);
    } else if (p.sku) {
      existing = productBySku(p.sku);
      const owner = !existing && optionOwner(p.sku);
      if (owner) p.errors.push(`SKU ${p.sku} belongs to an option of “${owner.name}”.`);
    }
    if (!existing && !p.name && !p.errors.length) p.errors.push("A new product needs a name.");
    if (existing && p.type === "simple" && existing.type === "variable" && p.v.type) p.errors.push("This product has options. Type must be variable.");
    groups.push({ head: p, existing, variations: [] });
  }
  for (const vRow of parsed.filter((x) => x.type === "variation")) {
    if (!vRow.parentSku) continue;
    let g = groups.find((x) => x.head && lowerSku(x.head.sku || x.existing?.sku || "") === lowerSku(vRow.parentSku));
    if (!g) {
      const existing = productBySku(vRow.parentSku);
      if (!existing) { vRow.errors.push(`No variable product with SKU ${vRow.parentSku} in the file or the store.`); continue; }
      g = groups.find((x) => !x.head && x.existing?.id === existing.id) ?? (groups.push({ existing, variations: [] }), groups[groups.length - 1]);
    }
    g.variations.push(vRow);
  }

  const writes: ImportWrite[] = [];
  for (const g of groups) {
    const lines = [g.head?.line, ...g.variations.map((v) => v.line)].filter((x): x is number => x !== undefined);
    const fail = (message?: string) => {
      const culprit = lines.find((l) => byLine.get(l)!.errors.length);
      for (const line of lines) {
        const p = byLine.get(line)!;
        if (message && !p.errors.includes(message)) p.errors.push(message);
        else if (!p.errors.length && culprit !== undefined) p.errors.push(`Not imported: its product has a problem on line ${culprit}.`);
        actions.set(line, "skip");
      }
    };
    if (g.head?.errors.length) { fail(g.head ? `Skipped with its product on line ${g.head.line}.` : undefined); if (g.head) g.head.errors = g.head.errors.filter((e) => !e.startsWith("Skipped with")); continue; }
    if (g.variations.some((v) => v.errors.length)) { fail(); continue; }

    const isNew = !g.existing;
    const input = g.existing ? productToInput(g.existing, ctx.tagName) : newInput(g.head?.name ?? "");
    const cellErrors = g.head ? applyProductCells(input, g.head, ctx, isNew) : [];
    if (g.variations.length && input.type !== "variable") cellErrors.push("Variation rows need a variable product.");
    const attrName = input.attributes.find((a) => a.variation)?.name;
    const variationLine = new Map<number, number>();
    for (const vRow of g.variations) {
      const value = (vRow.v.attributeValues ?? "").split("|")[0]?.trim();
      let idx = input.variations.findIndex((x) => vRow.sku && lowerSku(x.sku) === lowerSku(vRow.sku));
      if (idx < 0) {
        if (!attrName || !value) { vRow.errors.push(attrName ? "Attribute values: a new option needs its value, e.g. 5 kg." : "The parent product has no option attribute (Attribute name)."); continue; }
        const attr = input.attributes.find((a) => a.name === attrName)!;
        if (!attr.values.includes(value)) attr.values.push(value);
        input.variations.push({ sku: vRow.sku, attributes: { [attrName]: value }, status: "active", gallery: [], stockMode: vRow.v.stock ? "track" : input.manageStock ? "parent" : "status", stockStatus: "in_stock" } as VariationInput);
        idx = input.variations.length - 1;
      }
      const target = input.variations[idx];
      const v = vRow.v;
      if (v.regularPrice) target.basePrice = n(v.regularPrice);
      if (v.salePrice) target.salePrice = n(v.salePrice);
      if (v.stock) { target.stockMode = "track"; target.stockQuantity = n(v.stock); }
      if (v.stockStatus && !v.stock) { target.stockMode = "status"; target.stockStatus = v.stockStatus.toLowerCase().replace(/\s+/g, "_") as StockStatus; }
      if (v.weight) target.weight = { value: n(v.weight)!, unit: (v.weightUnit?.toLowerCase() as "kg" | "g") || input.weight.unit };
      if (v.status) target.status = /^published$/i.test(v.status) ? "active" : "disabled";
      variationLine.set(idx, vRow.line);
    }
    if (g.variations.some((v) => v.errors.length) || cellErrors.length) {
      if (g.head) g.head.errors.push(...cellErrors);
      fail(cellErrors.length && !g.head ? cellErrors.join(" ") : undefined);
      continue;
    }

    // Slug for new products: unique among saved products and earlier rows.
    if (isNew) {
      const taken = new Set([...ctx.products.map((x) => x.slug), ...writes.map((w) => w.input.slug)]);
      let slug = slugify(input.name) || "product";
      for (let i = 2; taken.has(slug); i++) slug = `${slugify(input.name)}-${i}`;
      input.slug = slug;
    }
    const errors = validateProduct(input, g.existing?.id);
    // SKU uniqueness against other saved products and earlier rows in this file.
    const others = ctx.products.filter((x) => x.id !== g.existing?.id);
    const taken = new Set([...others.flatMap((x) => [x.sku, ...x.variations.map((v) => v.sku)]), ...writes.flatMap((w) => [w.input.sku, ...w.input.variations.map((v) => v.sku)])].map(lowerSku).filter(Boolean));
    if (input.sku && taken.has(lowerSku(input.sku))) errors.sku = "Another product already uses this SKU.";
    input.variations.forEach((v, i) => { if (v.sku && taken.has(lowerSku(v.sku))) errors[`variations.${i}.sku`] = "Another product already uses this SKU."; });

    if (Object.keys(errors).length) {
      for (const [key, msg] of Object.entries(errors)) {
        const m = key.match(/^variations\.(\d+)\./);
        const line = m ? (variationLine.get(Number(m[1])) ?? g.head?.line ?? lines[0]) : (g.head?.line ?? lines[0]);
        byLine.get(line)?.errors.push(`${fieldName(key)}: ${msg}`);
      }
      fail();
      continue;
    }
    if (g.head && !g.head.v.weight && isNew) g.head.warnings.push("No package weight yet: needed before publishing (shipping uses it).");
    writes.push({ id: g.existing?.id, input, lines });
    for (const line of lines) actions.set(line, isNew ? "create" : "update");
  }

  const results = parsed.map((p) => ({
    line: p.line,
    sku: p.sku,
    name: p.name || ctx.products.find((x) => lowerSku(x.sku) === lowerSku(p.sku))?.name || (p.type === "variation" ? `Option of ${p.parentSku}` : ""),
    action: p.errors.length ? ("skip" as const) : (actions.get(p.line) ?? "skip"),
    errors: p.errors,
    warnings: p.warnings,
  }));
  return { results, writes };
}
