/**
 * Order calculation tests. Run with `npm test` (Node's built-in test runner,
 * TypeScript via --experimental-strip-types; no extra packages).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineAmounts, orderTotals, previewAdjustment, sumMoney, toMinor, type LineInput, type TaxRates } from "../src/lib/orders/calc.ts";

const rates: TaxRates = { standard: 15, reduced: 5, exempt: 0 };
const kg = (value: number) => ({ value, unit: "kg" as const });
const line = (over: Partial<LineInput> = {}): LineInput => ({
  quantity: 1,
  unitPrice: 100,
  discount: 0,
  pricedByWeight: false,
  orderedWeight: kg(1),
  ...over,
});

describe("money", () => {
  // JPY: the minor unit is 1 yen (STORE_CURRENCY.minorDigits = 0).
  it("converts amounts to whole yen, rounding stray decimals half-up", () => {
    assert.equal(toMinor(1150), 1150);
    assert.equal(toMinor(1150.5), 1151);
    assert.equal(toMinor(0.1 + 0.2), 0);
    assert.equal(toMinor(-19.99), -20);
  });
  it("sums amounts exactly", () => {
    assert.equal(sumMoney([1200, 1300, 999]), 3499);
    assert.equal(sumMoney([]), 0);
  });
});

describe("line amounts", () => {
  it("multiplies quantity by unit price", () => {
    assert.deepEqual(lineAmounts(line({ quantity: 3, unitPrice: 1150 })), { subtotal: 3450, discount: 0, total: 3450 });
  });
  it("handles quantity changes, including zero", () => {
    assert.equal(lineAmounts(line({ quantity: 7, unitPrice: 1999 })).total, 13993);
    assert.equal(lineAmounts(line({ quantity: 0, unitPrice: 1999 })).total, 0);
  });
  it("rejects fractional quantities", () => {
    assert.throws(() => lineAmounts(line({ quantity: 1.5 })));
  });
  it("applies a line discount but never goes below zero", () => {
    assert.equal(lineAmounts(line({ quantity: 2, unitPrice: 500, discount: 120 })).total, 880);
    assert.equal(lineAmounts(line({ unitPrice: 50, discount: 80 })).total, 0);
  });
  it("scales weight-priced lines by fulfilled / ordered weight", () => {
    // 5 packs × ¥1,120, ordered 10 kg, packed 10.4 kg → 5600 × 1.04
    const l = line({ quantity: 5, unitPrice: 1120, pricedByWeight: true, orderedWeight: kg(10), fulfilledWeight: kg(10.4) });
    assert.equal(lineAmounts(l).total, 5824);
  });
  it("mixes units (g vs kg) correctly", () => {
    const l = line({ unitPrice: 1000, pricedByWeight: true, orderedWeight: kg(2), fulfilledWeight: { value: 1850, unit: "g" } });
    assert.equal(lineAmounts(l).total, 925);
  });
  it("ignores fulfilled weight for lines not priced by weight", () => {
    const l = line({ quantity: 2, unitPrice: 2300, orderedWeight: kg(3.2), fulfilledWeight: kg(3.4) });
    assert.equal(lineAmounts(l).total, 4600);
  });
  it("rounds half-up to the yen exactly once", () => {
    // ¥1 × 1500 g / 1000 g = 1.5 → ¥2
    assert.equal(lineAmounts(line({ unitPrice: 1, pricedByWeight: true, orderedWeight: kg(1), fulfilledWeight: kg(1.5) })).total, 2);
    // 100 × 1/3 = 33.333… → 33
    assert.equal(lineAmounts(line({ unitPrice: 100, pricedByWeight: true, orderedWeight: kg(3), fulfilledWeight: kg(1) })).total, 33);
    // 100 × 2/3 = 66.666… → 67
    assert.equal(lineAmounts(line({ unitPrice: 100, pricedByWeight: true, orderedWeight: kg(3), fulfilledWeight: kg(2) })).total, 67);
    // Delivered-weight example: ordered 5 kg at ¥1,000/kg (¥5,000); delivered 4 kg → ¥4,000, 6 kg → ¥6,000
    assert.equal(lineAmounts(line({ quantity: 5, unitPrice: 1000, pricedByWeight: true, orderedWeight: kg(5), fulfilledWeight: kg(4) })).total, 4000);
    assert.equal(lineAmounts(line({ quantity: 5, unitPrice: 1000, pricedByWeight: true, orderedWeight: kg(5), fulfilledWeight: kg(6) })).total, 6000);
  });
});

describe("order totals", () => {
  it("adds items, shipping and VAT per class (incl. shipping in its class)", () => {
    const totals = orderTotals(
      {
        lines: [
          { ...line({ quantity: 2, unitPrice: 4200 }), taxClass: "reduced" },
          { ...line({ quantity: 1, unitPrice: 2100 }), taxClass: "standard" },
          { ...line({ quantity: 4, unitPrice: 620 }), taxClass: "exempt" },
        ],
        shipping: { amount: 350, taxClass: "standard" },
      },
      rates,
    );
    assert.equal(totals.itemsTotal, 12980);
    assert.deepEqual(
      totals.taxes.map((t) => [t.taxClass, t.taxableAmount, t.taxAmount]),
      // 15 % of 2450 = 367.5 → ¥368 (half-up, once per class)
      [["reduced", 8400, 420], ["standard", 2450, 368]],
    );
    assert.equal(totals.taxTotal, 788);
    assert.equal(totals.total, 14118);
  });
  it("supports decimal VAT rates and rounds tax half-up", () => {
    // 7.5 % of 333 = 24.975 → 25
    const totals = orderTotals({ lines: [{ ...line({ unitPrice: 333 }), taxClass: "standard" }], shipping: { amount: 0, taxClass: "standard" } }, { ...rates, standard: 7.5 });
    assert.equal(totals.taxTotal, 25);
  });
  it("reports discounts and refunds separately", () => {
    const totals = orderTotals(
      { lines: [{ ...line({ quantity: 2, unitPrice: 1000, discount: 100 }), taxClass: "exempt" }], shipping: { amount: 0, taxClass: "standard" }, refunds: [500, 250] },
      rates,
    );
    assert.equal(totals.itemsSubtotal, 2000);
    assert.equal(totals.discountTotal, 100);
    assert.equal(totals.total, 1900);
    assert.equal(totals.refundedTotal, 750);
    assert.equal(totals.netTotal, 1150);
  });
});

describe("adjustment preview", () => {
  const input = {
    lines: [
      { ...line({ quantity: 5, unitPrice: 1120, pricedByWeight: true, orderedWeight: kg(10) }), taxClass: "reduced" as const },
      { ...line({ quantity: 2, unitPrice: 780 }), taxClass: "reduced" as const },
    ],
    shipping: { amount: 0, taxClass: "standard" as const },
  };
  it("recalculates the line and order after a weight change", () => {
    const p = previewAdjustment(input, 0, { fulfilledWeight: kg(10.4) }, rates);
    assert.equal(p.lineBefore.total, 5600);
    assert.equal(p.lineAfter.total, 5824);
    // Tax 5 %: before (5600 + 1560) + 358 = 7518; after 7384 + 369.2 → 369 = 7753
    assert.equal(p.totalBefore, 7518);
    assert.equal(p.totalAfter, 7753);
    assert.equal(p.difference, 235);
  });
  it("recalculates after an agreed unit-price change", () => {
    const p = previewAdjustment(input, 1, { unitPrice: 750 }, rates);
    assert.equal(p.lineAfter.total, 1500);
    assert.equal(p.difference, -63);
  });
  it("combines price and weight changes on a weight-priced line", () => {
    const p = previewAdjustment(input, 0, { unitPrice: 1100, fulfilledWeight: kg(9.5) }, rates);
    assert.equal(p.lineAfter.total, 5225);
  });
});
