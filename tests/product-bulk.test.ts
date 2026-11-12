import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planBulkChange, type BulkOperation } from "../src/lib/catalog/bulk.ts";
import type { Product } from "../src/lib/types/index.ts";

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "p1", name: "Rice 5 kg", sku: "RICE-5", type: "simple", status: "draft", basePrice: 1000, salePrice: undefined, categoryIds: ["c1"],
    weight: { value: 5, unit: "kg" }, quantityRule: { min: 1, step: 1 }, soldIndividually: false, manageStock: false,
    stock: { status: "in_stock" }, variations: [], ...over,
  }) as Product;
const ctx = { categories: new Map([["c1", "Rice"], ["c2", "Pantry"]]), inUse: new Set(["used"]) };
const plan = (op: BulkOperation, ...ps: Product[]) => planBulkChange(ps.length ? ps : [product()], op, ctx);

describe("bulk product changes", () => {
  it("publishes a complete product and refuses an incomplete one, with the reason", () => {
    assert.equal(plan({ kind: "status", status: "published" })[0].problem, undefined);
    const [bad] = plan({ kind: "status", status: "published" }, product({ sku: "", basePrice: undefined }));
    assert.match(bad.problem!, /no SKU.*no price/);
  });
  it("skips a product already in that status", () => {
    assert.match(plan({ kind: "status", status: "draft" })[0].problem!, /already draft/);
  });
  it("raises and lowers prices by percent and amount, half-up", () => {
    assert.equal(plan({ kind: "regularPrice", mode: "increase_percent", value: 12.5 })[0].changes[0].after, 1125);
    assert.equal(plan({ kind: "regularPrice", mode: "decrease_percent", value: 33.33 }, product({ basePrice: 999 }))[0].changes[0].after, 666);
    assert.equal(plan({ kind: "regularPrice", mode: "increase_fixed", value: 50 })[0].changes[0].after, 1050);
    assert.equal(plan({ kind: "regularPrice", mode: "set", value: 1200 })[0].changes[0].after, 1200);
  });
  it("never goes below zero, and keeps the sale price below the regular price", () => {
    assert.match(plan({ kind: "regularPrice", mode: "decrease_fixed", value: 2000 })[0].problem!, /below zero/);
    assert.match(plan({ kind: "regularPrice", mode: "set", value: 800 }, product({ salePrice: 900 }))[0].problem!, /sale price/);
  });
  it("sets, discounts and clears sale prices", () => {
    assert.equal(plan({ kind: "salePrice", mode: "percent_off", value: 10 })[0].changes[0].after, 900);
    assert.match(plan({ kind: "salePrice", mode: "set", value: 1000 })[0].problem!, /below the regular price/);
    assert.equal(plan({ kind: "salePrice", mode: "clear" }, product({ salePrice: 900 }))[0].changes[0].after, null);
    assert.match(plan({ kind: "salePrice", mode: "clear" })[0].problem!, /no sale price/);
  });
  it("changes each turned-on option of a variable product", () => {
    const v = product({ type: "variable", basePrice: undefined, variations: [
      { id: "v1", attributes: { Size: "5 kg" }, status: "active", basePrice: 1000 },
      { id: "v2", attributes: { Size: "10 kg" }, status: "active", basePrice: 1800 },
      { id: "v3", attributes: { Size: "20 kg" }, status: "disabled", basePrice: 3000 },
    ] as never });
    const [row] = plan({ kind: "regularPrice", mode: "increase_percent", value: 10 }, v);
    assert.deepEqual(row.changes.map((c) => [c.label, c.after]), [["Price · 5 kg", 1100], ["Price · 10 kg", 1980]]);
  });
  it("adds, replaces and removes categories; a published product keeps at least one", () => {
    assert.equal(plan({ kind: "categories", mode: "add", categoryIds: ["c2"] })[0].changes[0].after, "Rice, Pantry");
    assert.equal(plan({ kind: "categories", mode: "replace", categoryIds: ["c2"] })[0].changes[0].after, "Pantry");
    assert.match(plan({ kind: "categories", mode: "remove", categoryIds: ["c1"] }, product({ status: "published" }))[0].problem!, /at least one category/);
    assert.match(plan({ kind: "categories", mode: "add", categoryIds: ["nope"] })[0].problem!, /exist/);
  });
  it("stock status only for products that don't track a quantity", () => {
    assert.equal(plan({ kind: "stock", status: "out_of_stock" })[0].problem, undefined);
    assert.match(plan({ kind: "stock", status: "out_of_stock" }, product({ manageStock: true }))[0].problem!, /Inventory/);
  });
  it("order limits are validated like the editor", () => {
    assert.equal(plan({ kind: "quantities", min: 2, max: 20 })[0].changes[0].after, "min 2, max 20");
    assert.match(plan({ kind: "quantities", min: 3, step: 2 })[0].problem!, /multiple of 2/);
    assert.equal(plan({ kind: "quantities", max: null }, product({ quantityRule: { min: 1, max: 5, step: 1 } }))[0].changes[0].after, "min 1, no max");
  });
  it("only deletes products nothing points to", () => {
    assert.equal(plan({ kind: "delete" })[0].problem, undefined);
    assert.match(plan({ kind: "delete" }, product({ id: "used" }))[0].problem!, /Archive it instead/);
  });
});
