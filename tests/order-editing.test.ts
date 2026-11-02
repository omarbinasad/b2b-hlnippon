/** Order editing: order discounts, quantity changes, edit validation, line stock and payment balance. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Order, OrderItem, Product, ProductVariation, TaxClass, TaxRate } from "../src/lib/types/index.ts";
import { paymentBalance, recalculate } from "../src/lib/orders/assemble.ts";
import { allocateMoney, applyLineChange, orderDiscountAmount, orderTotals, previewAdjustment, scaleOrderedWeight, type LineInput, type TaxRates } from "../src/lib/orders/calc.ts";
import { lineStock } from "../src/lib/orders/stock.ts";
import { buildTaxSnapshot } from "../src/lib/tax/engine.ts";
import { isIsoDate, validateAddLine, validateAdjustment, validateOrderDiscount } from "../src/lib/validation/order.ts";

const rates: TaxRates = { standard: 15, reduced: 5, exempt: 0 };
const kg = (value: number) => ({ value, unit: "kg" as const });
type Line = LineInput & { taxClass: TaxClass };
const line = (over: Partial<Line> = {}): Line => ({
  quantity: 2,
  unitPrice: 500,
  discount: 0,
  pricedByWeight: false,
  orderedWeight: kg(2),
  taxClass: "standard" as const,
  ...over,
});

describe("order discount", () => {
  it("caps a fixed discount at the items total and rounds percentages half-up", () => {
    assert.equal(orderDiscountAmount(1000, { type: "fixed", value: 250 }), 250);
    assert.equal(orderDiscountAmount(1000, { type: "fixed", value: 5000 }), 1000);
    assert.equal(orderDiscountAmount(333, { type: "percent", value: 10 }), 33); // 33.3 → ¥33
    assert.equal(orderDiscountAmount(5, { type: "percent", value: 10 }), 1); // ¥0.5 → ¥1 (half-up)
    assert.equal(orderDiscountAmount(1000, null), 0);
    assert.equal(orderDiscountAmount(1000, { type: "percent", value: 0 }), 0);
  });

  it("splits the discount over lines exactly, never more than a line", () => {
    const shares = allocateMoney(100, [200, 100, 1]);
    assert.equal(shares.reduce((s, x) => s + x, 0), 100);
    assert.deepEqual(shares, [67, 33, 0]); // largest remainder: 66.45 / 33.22 / 0.33 yen
    assert.deepEqual(allocateMoney(50, [10, 20]), [10, 20]); // capped at the lines' sum
  });

  it("reduces the taxable amount: tax is charged on what the customer pays", () => {
    const t = orderTotals({ lines: [line(), line({ unitPrice: 250, taxClass: "reduced" })], shipping: { amount: 100, taxClass: "standard" }, orderDiscount: { type: "percent", value: 10 } }, rates);
    // items 1000 (standard) + 500 (reduced) = 1500; 10 % = 150 split 100 / 50
    assert.equal(t.orderDiscount, 150);
    assert.equal(t.discountTotal, 150);
    assert.equal(t.itemsTotal, 1350);
    // standard: (900 + 100 shipping) × 15 % = 150; reduced: 450 × 5 % = 22.5 → ¥23
    assert.equal(t.taxTotal, 173);
    assert.equal(t.total, 1350 + 100 + 173);
  });

  it("applies after line discounts", () => {
    const t = orderTotals({ lines: [line({ discount: 200 })], shipping: { amount: 0, taxClass: "standard" }, orderDiscount: { type: "fixed", value: 100 } }, { standard: 0, reduced: 0, exempt: 0 });
    assert.equal(t.itemsSubtotal, 1000);
    assert.equal(t.discountTotal, 300);
    assert.equal(t.orderDiscount, 100);
    assert.equal(t.total, 700);
  });
});

describe("quantity changes", () => {
  it("scales the ordered weight to the gram", () => {
    assert.deepEqual(scaleOrderedWeight(kg(5), 5, 6), kg(6));
    assert.deepEqual(scaleOrderedWeight({ value: 750, unit: "g" }, 3, 2), { value: 500, unit: "g" });
    assert.deepEqual(scaleOrderedWeight(kg(1), 3, 1), kg(0.333));
  });

  it("keeps the per-kg price for weight-priced lines when the quantity changes", () => {
    // 5 × 1 kg at 1000 per unit, packed 5.2 kg → 5200; quantity 6 (6 kg ordered), still packed 5.2 kg → 5200
    const base = { ...line({ quantity: 5, unitPrice: 1000, pricedByWeight: true }), orderedWeight: kg(5), fulfilledWeight: kg(5.2) };
    const p = previewAdjustment({ lines: [base], shipping: { amount: 0, taxClass: "standard" } }, 0, { quantity: 6 }, { standard: 0, reduced: 0, exempt: 0 });
    assert.equal(p.lineBefore.total, 5200);
    assert.equal(p.lineAfter.total, 5200);
    assert.deepEqual(applyLineChange(base, { quantity: 6 }).orderedWeight, kg(6));
  });

  it("delivered weight example: 5 kg ordered at ¥1,000/kg → 4 kg = ¥4,000, 6 kg = ¥6,000", () => {
    const chicken = { ...line({ quantity: 5, unitPrice: 1000, pricedByWeight: true }), orderedWeight: kg(5) };
    const input = { lines: [chicken], shipping: { amount: 0, taxClass: "standard" as const } };
    const zero = { standard: 0, reduced: 0, exempt: 0 };
    assert.equal(previewAdjustment(input, 0, { fulfilledWeight: kg(4) }, zero).difference, -1000);
    assert.equal(previewAdjustment(input, 0, { fulfilledWeight: kg(6) }, zero).difference, 1000);
  });
});

describe("edit validation", () => {
  const item = { quantity: 2, unitPrice: 500, discount: 0, orderedWeight: kg(2), pricedByWeight: false };
  it("requires a reason and an actual change", () => {
    assert.ok(validateAdjustment({ itemId: "x", quantity: 3, reason: "" }, item).reason);
    assert.ok(validateAdjustment({ itemId: "x", quantity: 2, reason: "No change here" }, item).unitPrice);
    assert.deepEqual(validateAdjustment({ itemId: "x", quantity: 3, reason: "Customer wants one more" }, item), {});
  });
  it("rejects bad quantities and a line discount above the new amount", () => {
    assert.ok(validateAdjustment({ itemId: "x", quantity: 0, reason: "Too few units" }, item).quantity);
    assert.ok(validateAdjustment({ itemId: "x", quantity: 1.5, reason: "Half a unit" }, item).quantity);
    assert.ok(validateAdjustment({ itemId: "x", quantity: 1, reason: "Fewer units" }, { ...item, discount: 600 }).quantity);
  });
  it("validates order discounts", () => {
    assert.deepEqual(validateOrderDiscount({ kind: "discount", discount: { type: "percent", value: 12.5 }, reason: "Loyalty discount" }), {});
    assert.ok(validateOrderDiscount({ kind: "discount", discount: { type: "percent", value: 120 }, reason: "Too much" }).value);
    assert.ok(validateOrderDiscount({ kind: "discount", discount: { type: "fixed", value: 0 }, reason: "Nothing" }).value);
    assert.ok(validateOrderDiscount({ kind: "discount", discount: { type: "fixed", value: 10.5 }, reason: "Fraction of a yen" }).value);
    assert.ok(validateOrderDiscount({ kind: "discount", discount: { type: "percent", value: 12.555 }, reason: "Too precise" }).value);
    assert.deepEqual(validateOrderDiscount({ kind: "discount", discount: null, reason: "Removed by mistake" }), {});
  });
  it("validates new lines", () => {
    const add = { kind: "add" as const, productId: "p-1", quantity: 2, unitPrice: 100, discount: 0, reason: "Added by phone" };
    assert.deepEqual(validateAddLine(add), {});
    assert.ok(validateAddLine({ ...add, discount: 300 }).discount);
    assert.ok(validateAddLine({ ...add, productId: "" }).productId);
  });
  it("accepts only real calendar dates", () => {
    assert.ok(isIsoDate("2026-11-05"));
    assert.ok(!isIsoDate("2026-02-30"));
    assert.ok(!isIsoDate("05/11/2026"));
  });
});

describe("line stock", () => {
  const T = "2026-01-01T00:00:00+09:00";
  const variation = (id: string, over: Partial<ProductVariation>): ProductVariation =>
    ({ id, sku: id, attributes: { Size: id }, status: "active", stockMode: "status", stock: { status: "in_stock" }, gallery: [], ...over }) as ProductVariation;
  const product = (over: Partial<Product>): Product =>
    ({ id: "p", type: "simple", status: "published", manageStock: false, stock: { status: "in_stock" }, variations: [], updatedAt: T, ...over }) as Product;

  it("reads simple products by counted quantity or status", () => {
    assert.deepEqual(lineStock(product({ manageStock: true, stock: { status: "low_stock", quantity: 3 } })), { stock: { status: "low_stock", quantity: 3 }, mode: "quantity", shared: false, unavailable: undefined });
    assert.equal(lineStock(product({}))?.mode, "status");
    assert.equal(lineStock(null), null);
  });
  it("handles own, status and shared variation stock, and unavailable options", () => {
    const p = product({
      type: "variable",
      manageStock: true,
      variations: [
        variation("a", { stockMode: "track", stock: { status: "out_of_stock", quantity: 0 } }),
        variation("b", { stockMode: "parent", stock: { status: "in_stock", quantity: 40 } }),
        variation("c", { status: "disabled" }),
      ],
    });
    assert.equal(lineStock(p, "a")?.mode, "quantity");
    assert.deepEqual([lineStock(p, "b")?.mode, lineStock(p, "b")?.shared], ["quantity", true]);
    assert.equal(lineStock(p, "c")?.unavailable, "This option is disabled.");
    assert.equal(lineStock(p, "zzz")?.unavailable, "This option no longer exists.");
    assert.equal(lineStock({ ...p, status: "archived" }, "a")?.unavailable, "The product is archived.");
  });
});

describe("recalculating an edited order", () => {
  const item = (id: string, unitPrice: number, quantity = 1): OrderItem =>
    ({ id, productId: id, name: id, sku: id, unitLabel: "item", taxClass: "standard", pricedByWeight: false, quantity, catalogUnitPrice: unitPrice, unitPrice, discount: 0, orderedWeight: kg(quantity), lineSubtotal: 0, lineTotal: 0 }) as OrderItem;
  const order = (over: Partial<Order> = {}) =>
    ({ items: [item("a", 600), item("b", 400)], shipping: { label: "Route", amount: 0, taxClass: "standard" }, refunds: [], payment: { method: "bank_transfer" }, ...over }) as Pick<Order, "items" | "shipping" | "refunds" | "payment" | "discount" | "taxSnapshot">;
  const rate: TaxRate = { id: "std", name: "Fictional VAT", percent: 10, taxClass: "standard", location: { type: "country", country: "JP" }, enabled: true, createdAt: "", updatedAt: "" };

  it("applies the order discount with a tax snapshot (line totals stay before the order discount)", () => {
    const taxSnapshot = buildTaxSnapshot({ enabled: true, pricesIncludeTax: false, shippingTaxable: false, shippingTaxClass: "standard" }, [rate], { prefecture: "Tokyo", city: "Shinjuku-ku" }, ["standard"], "2026-01-01T00:00:00+09:00");
    const r = recalculate(order({ taxSnapshot, discount: { type: "percent", value: 10, reason: "x", at: "", by: { id: "a", name: "a", role: "admin" } } }), rates);
    assert.deepEqual(r.items.map((i) => i.lineTotal), [600, 400]);
    assert.equal(r.totals.orderDiscount, 100);
    assert.equal(r.totals.itemsTotal, 900);
    assert.equal(r.totals.taxTotal, 90);
    assert.equal(r.totals.total, 990);
  });

  it("shows the balance against payment already collected", () => {
    const r = recalculate(order({ payment: { method: "bank_transfer", amountPaid: 1150 } }), rates);
    assert.equal(r.totals.total, 1150);
    assert.equal(paymentBalance(r), 0);
    const removed = recalculate(order({ items: [item("a", 600)], payment: { method: "bank_transfer", amountPaid: 1150 } }), rates);
    assert.equal(paymentBalance(removed), -460); // 690 now vs 1,150 paid → overpaid
    assert.equal(paymentBalance(recalculate(order(), rates)), undefined); // nothing collected
  });
});
