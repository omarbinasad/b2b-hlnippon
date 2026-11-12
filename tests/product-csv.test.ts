import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoMapHeaders, parseCsv, toCsvText, unguard } from "../src/lib/catalog/csv.ts";
import { planProductImport } from "../src/lib/catalog/csv-import.ts";
import { productToInput } from "../src/lib/catalog/product-input.ts";
import type { Product, ProductImportRow } from "../src/lib/types/index.ts";

const saved = (over: Partial<Product> = {}): Product =>
  ({
    id: "p1", type: "simple", name: "Rice 5 kg", slug: "rice-5kg", sku: "RICE-5", status: "published", visibility: "visible", featured: false,
    shortDescription: "", description: "", categoryIds: ["c1"], tagIds: [], brandIds: [], images: [], unitLabel: "bag", basePrice: 1000,
    taxStatus: "taxable", taxClass: "standard", manageStock: true, stock: { status: "in_stock", quantity: 10 }, backorders: "no",
    soldIndividually: false, weight: { value: 5, unit: "kg" }, isVariableWeight: false, attributes: [], defaultAttributes: {}, variations: [],
    upsellIds: [], crossSellIds: [], menuOrder: 0, reviewsEnabled: false, quantityRule: { min: 1, step: 1 }, ...over,
  }) as Product;
const ctx = (products: Product[] = [saved()]) => ({ products, categories: [{ id: "c1", name: "Rice", slug: "rice" }, { id: "c2", name: "Oil & ghee", slug: "oil" }] });
const row = (line: number, values: ProductImportRow["values"]): ProductImportRow => ({ line, values });

describe("CSV reading", () => {
  it("handles quotes, doubled quotes, commas and line breaks inside quotes, CRLF and a BOM", () => {
    assert.deepEqual(parseCsv('﻿Name,Description\r\n"Rice, 5 kg","Say ""hi""\nsecond line"\r\n\r\nOil,plain'), [["Name", "Description"], ["Rice, 5 kg", 'Say "hi"\nsecond line'], ["Oil", "plain"]]);
  });
  it("matches headers by label, key or common name, each field once", () => {
    assert.deepEqual(autoMapHeaders(["SKU", "Product name", "Price", "Qty", "Mystery", "sku"]), ["sku", "name", "regularPrice", "stock", null, null]);
  });
  it("guards formulas on export and reads them back", () => {
    const text = toCsvText([["Name"], ["=SUM(A1)"]]);
    assert.equal(text, "Name\r\n'=SUM(A1)");
    assert.equal(unguard(parseCsv(text)[1][0]), "=SUM(A1)");
  });
});

describe("CSV import plan", () => {
  it("creates a new product as a draft, with sensible defaults", () => {
    const { results, writes } = planProductImport([row(2, { name: "Chicken 10 kg case", sku: "CHK-10", regularPrice: "8,500", categories: "rice", weight: "10", unitLabel: "case" })], ctx());
    assert.equal(results[0].action, "create", results[0].errors.join());
    assert.equal(writes[0].input.status, "draft");
    assert.equal(writes[0].input.basePrice, 8500);
    assert.deepEqual([writes[0].input.minQuantity, writes[0].input.quantityStep], [1, 1]);
    assert.equal(writes[0].input.slug, "chicken-10-kg-case");
  });
  it("updates by SKU, changing only filled-in cells", () => {
    const { results, writes } = planProductImport([row(2, { sku: "rice-5", regularPrice: "1100" })], ctx());
    assert.equal(results[0].action, "update");
    assert.equal(writes[0].id, "p1");
    assert.equal(writes[0].input.basePrice, 1100);
    assert.equal(writes[0].input.name, "Rice 5 kg");
    assert.deepEqual(writes[0].input.categoryIds, ["c1"]);
  });
  it("updates by ID, and refuses an unknown ID", () => {
    assert.equal(planProductImport([row(2, { id: "p1", name: "Rice 5 kg bag" })], ctx()).writes[0].input.name, "Rice 5 kg bag");
    assert.match(planProductImport([row(2, { id: "nope", name: "X" })], ctx()).results[0].errors[0], /No product has the ID/);
  });
  it("sets order limits in packages; 0 removes the maximum", () => {
    const w = planProductImport([row(2, { sku: "RICE-5", minQuantity: "2", maxQuantity: "20", quantityStep: "2" })], ctx()).writes[0].input;
    assert.deepEqual([w.minQuantity, w.maxQuantity, w.quantityStep], [2, 20, 2]);
    const cleared = planProductImport([row(2, { sku: "RICE-5", maxQuantity: "0" })], ctx([saved({ quantityRule: { min: 1, max: 5, step: 1 } })])).writes[0].input;
    assert.equal(cleared.maxQuantity, undefined);
  });
  it("reports bad values and skips only that row", () => {
    const { results, writes } = planProductImport([row(2, { name: "A", sku: "A1", regularPrice: "abc" }), row(3, { name: "B", sku: "B1" })], ctx());
    assert.equal(results[0].action, "skip");
    assert.match(results[0].errors[0], /Regular price/);
    assert.equal(results[1].action, "create");
    assert.equal(writes.length, 1);
  });
  it("skips the later row when a SKU appears twice in the file", () => {
    const { results } = planProductImport([row(2, { name: "A", sku: "DUP" }), row(3, { name: "B", sku: "dup" })], ctx());
    assert.deepEqual(results.map((r) => r.action), ["create", "skip"]);
    assert.match(results[1].errors[0], /already on line 2/);
  });
  it("refuses unknown categories rather than creating them", () => {
    assert.match(planProductImport([row(2, { name: "A", sku: "A", categories: "Rice, Spices" })], ctx()).results[0].errors.join(), /Categories not found: Spices/);
  });
  it("checks publishing like the editor", () => {
    const r = planProductImport([row(2, { name: "A", sku: "A", status: "published" })], ctx()).results[0];
    assert.equal(r.action, "skip");
    assert.ok(r.errors.some((e) => /Regular price/.test(e)) && r.errors.some((e) => /Categories/.test(e)), r.errors.join(" | "));
  });
  it("imports a variable product with its options from the file", () => {
    const { results, writes } = planProductImport([
      row(2, { type: "variable", name: "Basmati", sku: "BAS", attributeName: "Size", attributeValues: "5 kg|10 kg", categories: "Rice", weight: "5" }),
      row(3, { type: "variation", parentSku: "BAS", sku: "BAS-5", attributeValues: "5 kg", regularPrice: "1200" }),
      row(4, { parentSku: "BAS", sku: "BAS-10", attributeValues: "10 kg", regularPrice: "2200", weight: "10" }),
    ], ctx());
    assert.deepEqual(results.map((r) => r.action), ["create", "create", "create"], JSON.stringify(results.map((r) => r.errors)));
    assert.deepEqual(writes[0].input.variations.map((v) => [v.sku, v.attributes.Size, v.basePrice]), [["BAS-5", "5 kg", 1200], ["BAS-10", "10 kg", 2200]]);
  });
  it("updates an option of a saved variable product by its SKU", () => {
    const variable = saved({ id: "p2", type: "variable", sku: "OIL", name: "Oil", basePrice: undefined, attributes: [{ name: "Size", values: ["5 L"], visible: true, variation: true }], variations: [{ id: "v1", sku: "OIL-5", attributes: { Size: "5 L" }, status: "active", basePrice: 900, gallery: [], stockMode: "parent", stock: { status: "in_stock" } }] as never });
    const { results, writes } = planProductImport([row(2, { parentSku: "OIL", sku: "OIL-5", regularPrice: "950" })], ctx([saved(), variable]));
    assert.equal(results[0].action, "update", results[0].errors.join());
    assert.equal(writes[0].id, "p2");
    assert.equal(writes[0].input.variations[0].basePrice, 950);
  });
  it("a variation row needs its parent", () => {
    assert.match(planProductImport([row(2, { parentSku: "NOPE", sku: "X" })], ctx()).results[0].errors[0], /No variable product with SKU NOPE/);
  });
  it("a saved product turns back into the same editable input", () => {
    const input = productToInput(saved());
    assert.deepEqual([input.sku, input.basePrice, input.stockQuantity, input.minQuantity], ["RICE-5", 1000, 10, 1]);
  });
});
