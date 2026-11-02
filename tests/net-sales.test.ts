/**
 * Regression: dashboard net sales must exclude tax for tax-inclusive orders, so the same
 * sale reports the same revenue whether prices included or excluded tax. Rates are fictional.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineNetSales, orderNetSales } from "../src/lib/orders/net-sales.ts";
import { allocate, calculateTax, type TaxLineInput } from "../src/lib/tax/engine.ts";
import type { OrderTaxSnapshot } from "../src/lib/types/index.ts";

const rate = (id: string, percent: number, taxClass: "standard" | "reduced" = "standard") => ({ rateId: id, name: id, percent, taxClass, matchedBy: "country" as const });
const snapshot = (pricesIncludeTax: boolean, shippingTaxable = true): OrderTaxSnapshot => ({
  enabled: true,
  pricesIncludeTax,
  shippingTaxable,
  ratesByClass: { standard: rate("std", 10), reduced: rate("red", 4, "reduced") },
  shippingRate: rate("std", 10),
  capturedAt: "2026-10-04T00:00:00+09:00",
});
const line = (over: Partial<TaxLineInput>): TaxLineInput => ({ key: "a", label: "a", taxClass: "standard", taxable: true, subtotal: 0, discount: 0, ...over });

/** What the order stores (see src/lib/orders/assemble.ts). */
const asOrder = (c: ReturnType<typeof calculateTax>) => ({ totals: { itemsTotal: c.itemsTotal, itemsNet: c.itemsNet } });

describe("net sales across tax modes", () => {
  it("reports the same net sales for the same sale with prices excluding or including tax", () => {
    const exclusive = calculateTax(snapshot(false), [line({ subtotal: 1000 })], 200);
    const inclusive = calculateTax(snapshot(true), [line({ subtotal: 1100 })], 220);
    assert.equal(orderNetSales(asOrder(exclusive)), 1000);
    assert.equal(orderNetSales(asOrder(inclusive)), 1000); // before the fix: 1100 (tax counted as sales)
    // shipping and shipping tax are never part of net sales
    assert.equal(inclusive.shippingTax, 20);
    assert.equal(inclusive.itemsTax, 100);
  });

  it("subtracts discounts before tax and keeps per-line net sales summing exactly to the order", () => {
    const c = calculateTax(
      snapshot(true),
      [line({ key: "a", subtotal: 333.33, discount: 10 }), line({ key: "b", subtotal: 333.33 }), line({ key: "c", subtotal: 333.34, taxClass: "reduced" })],
      0,
    );
    const lineSum = c.lines.reduce((s, l) => s + Math.round(l.net * 100), 0) / 100;
    assert.equal(lineSum, c.itemsNet);
    assert.equal(c.itemsNet, Math.round((c.itemsTotal - c.itemsTax) * 100) / 100);
    for (const l of c.lines) assert.equal(lineNetSales({ lineTotal: l.amount, lineNet: l.net }), l.net);
  });

  it("treats older orders without itemsNet as already net (they were always tax-exclusive)", () => {
    assert.equal(orderNetSales({ totals: { itemsTotal: 15784 } }), 15784);
    assert.equal(lineNetSales({ lineTotal: 8400 }), 8400);
  });

  it("leaves net sales equal to items when tax is off", () => {
    const off = calculateTax({ ...snapshot(true), enabled: false }, [line({ subtotal: 1100 })], 50);
    assert.equal(orderNetSales(asOrder(off)), 1100);
  });
});

describe("allocate (largest remainder)", () => {
  it("splits whole minor unit proportionally and always sums to the total", () => {
    assert.deepEqual(allocate(10, [1, 1, 1]), [4, 3, 3]);
    assert.deepEqual(allocate(100, [50, 50]), [50, 50]);
    assert.deepEqual(allocate(0, [5, 5]), [0, 0]);
    const parts = allocate(9091, [33333, 33333, 33334]);
    assert.equal(parts.reduce((s, p) => s + p, 0), 9091);
  });
});
