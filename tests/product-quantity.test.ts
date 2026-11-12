import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkQuantity, resolveQuantityLimits } from "../src/lib/pricing/engine.ts";
import { checkOrderQuantity, publishProblems, validateProduct } from "../src/lib/validation/product.ts";
import type { Product, ProductInput, QuantityLimitRule } from "../src/lib/types/index.ts";

const item = { productId: "p-1", categoryIds: ["cat-rice"] };
const rule = (over: Partial<QuantityLimitRule>): QuantityLimitRule =>
  ({ id: "q1", name: "Rule", status: "active", target: { type: "products", productIds: ["p-1"] }, priority: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01", ...over }) as QuantityLimitRule;

describe("order limits in packages", () => {
  it("uses the product's own limits when no rule matches", () => {
    const l = resolveQuantityLimits([], item, { min: 2, max: 10, step: 1 });
    assert.equal(l.min, 2);
    assert.equal(l.max, 10);
    assert.match(l.explanation, /product's own limits/);
  });
  it("a matching rule overrides the product; what it leaves empty comes from the product", () => {
    const l = resolveQuantityLimits([rule({ minQuantity: 5 })], item, { min: 2, max: 10, step: 1 });
    assert.equal(l.min, 5);
    assert.equal(l.max, 10);
  });
  it("the product's own limits beat category and store-wide rules, which fill in the rest", () => {
    const all = rule({ id: "all", target: { type: "all" }, maxQuantity: 500 });
    const cat = rule({ id: "cat", target: { type: "categories", categoryIds: ["cat-rice"] }, minQuantity: 3, maxQuantity: 50 });
    assert.deepEqual([resolveQuantityLimits([all], item, { min: 2, max: 20, step: 2 })].map((l) => [l.min, l.max, l.step])[0], [2, 20, 2]);
    // Min 1 counts as "not set": the category minimum applies; the product's maximum still wins.
    assert.deepEqual([resolveQuantityLimits([cat], item, { min: 1, max: 20, step: 1 })].map((l) => [l.min, l.max])[0], [3, 20]);
    // Nothing set on the product: the rule decides.
    assert.deepEqual([resolveQuantityLimits([all, cat], item, { min: 1, step: 1 })].map((l) => [l.min, l.max])[0], [3, 50]);
  });
  it("defaults to at least 1, no maximum, any number", () => {
    const l = resolveQuantityLimits([], item);
    assert.deepEqual([l.min, l.max, l.step], [1, undefined, 1]);
  });
  it("an increment is checked; 1 means any whole number", () => {
    assert.equal(checkQuantity({ min: 2, step: 2 }, 3), "Order in multiples of 2.");
    assert.equal(checkQuantity({ min: 2, step: 2 }, 4), undefined);
    assert.equal(checkQuantity({ min: 1, step: 1 }, 7), undefined);
  });
  it("sold individually caps the line at 1", () => {
    const l = resolveQuantityLimits([], item, { min: 1, step: 1, soldIndividually: true });
    assert.deepEqual([l.min, l.max], [1, 1]);
    assert.equal(checkQuantity(l, 2), "Maximum 1 per order line.");
  });
  it("quantity is packages: three 5 kg bags is 3, and the limits never mention weight", () => {
    const l = resolveQuantityLimits([], item, { min: 1, max: 3, step: 1 });
    assert.equal(checkQuantity(l, 3), undefined);
    assert.equal(checkQuantity(l, 15), "Maximum 3 per order line.");
  });
});

describe("validating the order limits", () => {
  const errs = (q: Parameters<typeof checkOrderQuantity>[1]) => {
    const e: Record<string, string> = {};
    checkOrderQuantity(e, q);
    return e;
  };
  it("accepts the normal case and an empty maximum", () => {
    assert.deepEqual(errs({ minQuantity: 1, quantityStep: 1 }), {});
    assert.deepEqual(errs({ minQuantity: 2, maxQuantity: 20, quantityStep: 2 }), {});
  });
  it("refuses fractions, zero, and a maximum below the minimum", () => {
    assert.ok(errs({ minQuantity: 0, quantityStep: 1 }).minQuantity);
    assert.ok(errs({ minQuantity: 1.5, quantityStep: 1 }).minQuantity);
    assert.ok(errs({ minQuantity: 5, maxQuantity: 2, quantityStep: 1 }).maxQuantity);
    assert.ok(errs({ minQuantity: 1, quantityStep: 0 }).quantityStep);
  });
  it("the minimum and maximum must fit the increment", () => {
    assert.match(errs({ minQuantity: 3, quantityStep: 2 }).minQuantity, /multiple of 2/);
    assert.match(errs({ minQuantity: 2, maxQuantity: 9, quantityStep: 2 }).maxQuantity, /multiple of 2/);
  });
  it("sold individually conflicts with limits above 1", () => {
    assert.ok(errs({ minQuantity: 2, quantityStep: 1, soldIndividually: true }).soldIndividually);
    assert.deepEqual(errs({ minQuantity: 1, quantityStep: 1, soldIndividually: true }), {});
  });
});

const input = (over: Partial<ProductInput> = {}): ProductInput =>
  ({
    type: "simple", name: "Rice 5 kg", slug: "rice-5kg", sku: "", gtin: undefined, shortDescription: "", description: "", status: "draft", visibility: "visible",
    featured: false, categoryIds: [], tags: [], brandIds: [], images: [], unitLabel: "bag", basePrice: undefined, taxStatus: "taxable", taxClass: "standard",
    manageStock: false, stockStatus: "in_stock", backorders: "no", soldIndividually: false, weight: { value: 0, unit: "kg" }, isVariableWeight: false,
    attributes: [], defaultAttributes: {}, variations: [], upsellIds: [], crossSellIds: [], menuOrder: 0, reviewsEnabled: false,
    minQuantity: 1, quantityStep: 1, ...over,
  }) as unknown as ProductInput;

describe("drafts and publishing", () => {
  it("an incomplete product can be saved as a draft", () => {
    assert.deepEqual(validateProduct(input()), {});
    // No selling unit and tracked stock left at 0 (the editor sends 0 for an empty field on a draft).
    assert.deepEqual(validateProduct(input({ unitLabel: "", manageStock: true, stockQuantity: 0 })), {});
  });
  it("publishing needs the selling unit", () => {
    assert.ok(validateProduct(input({ status: "published", unitLabel: "" })).unitLabel);
  });
  it("publishing needs a SKU, price, category and package weight", () => {
    const e = validateProduct(input({ status: "published" }));
    assert.ok(e.sku && e.basePrice && e.categoryIds && e.weight, JSON.stringify(e));
  });
  it("a complete product publishes", () => {
    assert.deepEqual(validateProduct(input({ status: "published", sku: "RICE-5", basePrice: 1200, categoryIds: ["c1"], weight: { value: 5, unit: "kg" } })), {});
  });
  it("a variable product needs at least one variation turned on to publish", () => {
    const e = validateProduct(input({ status: "published", type: "variable", sku: "R", categoryIds: ["c"], weight: { value: 5, unit: "kg" }, attributes: [{ name: "Size", values: ["5 kg"], visible: true, variation: true }], variations: [{ attributes: { Size: "5 kg" }, sku: "R-5", status: "disabled", basePrice: 100, stockMode: "parent" } as never] }));
    assert.match(e.variations, /at least one variation/);
  });
  it("publishing a saved product without the editor lists what's missing", () => {
    const p = { name: "Rice", sku: "", type: "simple", basePrice: undefined, categoryIds: [], weight: { value: 0, unit: "kg" }, quantityRule: { min: 1, step: 1 }, soldIndividually: false, variations: [] } as unknown as Product;
    assert.deepEqual(publishProblems(p), ["It has no SKU.", "It has no category.", "It has no package weight.", "It has no price."]);
    assert.deepEqual(publishProblems({ ...p, sku: "R", categoryIds: ["c"], weight: { value: 5, unit: "kg" }, basePrice: 1200 } as Product), []);
  });
});

describe("variable product stock", () => {
  const variable = (stockMode: "track" | "parent") =>
    input({ status: "published", type: "variable", sku: "OIL", unitLabel: "can", categoryIds: ["c"], weight: { value: 5, unit: "kg" }, manageStock: true, stockQuantity: undefined,
      attributes: [{ name: "Size", values: ["5 L"], visible: true, variation: true }],
      variations: [{ attributes: { Size: "5 L" }, sku: "OIL-5", status: "active", basePrice: 1500, stockMode, stockQuantity: 20, weight: undefined } as never] });
  it("needs no product-level quantity when every option tracks its own", () => {
    assert.equal(validateProduct(variable("track")).stockQuantity, undefined);
  });
  it("needs it when an option shares the product's stock", () => {
    assert.ok(validateProduct(variable("parent")).stockQuantity);
  });
});
