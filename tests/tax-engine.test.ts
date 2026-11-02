/** Tax matching, calculation and validation. Run with `npm test`. Rates here are fictional. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrderTaxSnapshot, TaxRate } from "../src/lib/types/index.ts";
import { buildTaxSnapshot, calculateTax, matchTaxRate, taxOn, validateTaxRate, validateTaxSettings, type TaxLineInput } from "../src/lib/tax/engine.ts";

const T0 = "2026-01-01T00:00:00+09:00";
const rate = (id: string, over: Partial<TaxRate>): TaxRate => ({ id, name: id, percent: 10, taxClass: "standard", location: { type: "country", country: "JP" }, enabled: true, createdAt: T0, updatedAt: T0, ...over });

const rates: TaxRate[] = [
  rate("jp-std", { percent: 10 }),
  rate("jp-red", { percent: 4, taxClass: "reduced" }),
  rate("osaka-std", { percent: 9.5, location: { type: "prefecture", prefecture: "Osaka" } }),
  rate("hachioji-std", { percent: 8, location: { type: "city", prefecture: "Tokyo", city: "Hachioji-shi" } }),
  rate("shinjuku-std", { percent: 7.5, location: { type: "postcode", postalCode: "160-0022" } }),
  rate("off", { percent: 50, location: { type: "prefecture", prefecture: "Tokyo" }, enabled: false }),
];
const classes = ["standard", "reduced", "exempt"] as const;

describe("rate matching", () => {
  it("prefers postcode, then city, then prefecture, then the country fallback", () => {
    assert.equal(matchTaxRate(rates, "standard", { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "160-0022" }).rate?.id, "shinjuku-std");
    assert.equal(matchTaxRate(rates, "standard", { prefecture: "Tokyo", city: "hachioji-shi" }).rate?.id, "hachioji-std");
    assert.equal(matchTaxRate(rates, "standard", { prefecture: "Osaka", city: "Sakai-shi" }).rate?.id, "osaka-std");
    const m = matchTaxRate(rates, "standard", { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "100-0001" });
    assert.equal(m.rate?.id, "jp-std"); // disabled Tokyo-prefecture rate ignored
    assert.equal(m.level, "country");
  });

  it("matches per class; exempt is never taxed; no fallback → untaxed", () => {
    assert.equal(matchTaxRate(rates, "reduced", { prefecture: "Tokyo", city: "Hachioji-shi" }).rate?.id, "jp-red");
    assert.equal(matchTaxRate(rates, "exempt", { prefecture: "Tokyo", city: "Hachioji-shi" }).rate, undefined);
    assert.equal(matchTaxRate(rates.filter((r) => r.id !== "jp-red"), "reduced", { prefecture: "Okinawa", city: "Naha-shi" }).rate, undefined);
  });
});

const snap = (over: Partial<OrderTaxSnapshot> = {}): OrderTaxSnapshot => ({
  ...buildTaxSnapshot({ enabled: true, pricesIncludeTax: false, shippingTaxable: false, shippingTaxClass: "standard" }, rates, { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "100-0001" }, [...classes], T0),
  ...over,
});
const line = (over: Partial<TaxLineInput>): TaxLineInput => ({ key: "l", label: "l", taxClass: "standard", taxable: true, subtotal: 1000, discount: 0, ...over });

describe("calculation", () => {
  it("adds tax on top when prices exclude tax, after discounts", () => {
    const r = calculateTax(snap(), [line({ subtotal: 1000, discount: 100 })], 0);
    assert.equal(r.itemsTotal, 900);
    assert.equal(r.groups[0].taxableAmount, 900);
    assert.equal(r.taxTotal, 90);
    assert.equal(r.total, 990);
    assert.equal(r.netTotal, 900);
  });

  it("extracts tax when prices include tax (total unchanged)", () => {
    const r = calculateTax(snap({ pricesIncludeTax: true }), [line({ subtotal: 1100 })], 0);
    assert.equal(r.taxTotal, 100); // 1100 × 10/110
    assert.equal(r.groups[0].taxableAmount, 1000);
    assert.equal(r.total, 1100);
    assert.equal(r.netTotal, 1000);
  });

  it("uses the variation's class when it overrides the product (caller passes the effective class)", () => {
    const r = calculateTax(snap(), [line({ key: "a", subtotal: 1000, taxClass: "standard" }), line({ key: "b", subtotal: 1000, taxClass: "reduced" })], 0);
    assert.deepEqual(r.groups.map((g) => [g.rate.rateId, g.taxAmount]), [["jp-std", 100], ["jp-red", 40]]);
    assert.equal(r.taxTotal, 140);
  });

  it("groups lines per rate and rounds half-up once per rate", () => {
    // 3 lines of ¥5 at 10 % → ¥0.5 each (¥3 if rounded per line); once per rate: ¥15 × 10 % = ¥1.5 → ¥2
    const r = calculateTax(snap(), [line({ key: "a", subtotal: 5 }), line({ key: "b", subtotal: 5 }), line({ key: "c", subtotal: 5 })], 0);
    assert.equal(r.taxTotal, 2);
    assert.equal(taxOn(5, 10, false), 1); // ¥0.5 → ¥1 (half-up)
    assert.equal(taxOn(4, 10, false), 0);
  });

  it("handles fractional rates exactly", () => {
    const s = buildTaxSnapshot({ enabled: true, pricesIncludeTax: false, shippingTaxable: false, shippingTaxClass: "standard" }, rates, { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "160-0022" }, [...classes], T0);
    assert.equal(calculateTax(s, [line({ subtotal: 999 })], 0).taxTotal, 75); // 7.5 % of 999 = 74.925 → ¥75
  });

  it("taxes shipping only when configured, at the shipping class rate", () => {
    assert.equal(calculateTax(snap(), [line({ subtotal: 1000 })], 200).taxTotal, 100); // not taxable
    const s = buildTaxSnapshot({ enabled: true, pricesIncludeTax: false, shippingTaxable: true, shippingTaxClass: "reduced" }, rates, { prefecture: "Tokyo", city: "Shinjuku-ku" }, [...classes], T0);
    const r = calculateTax(s, [line({ subtotal: 1000 })], 200);
    assert.equal(r.shipping.rate?.rateId, "jp-red");
    assert.equal(r.taxTotal, 108); // 100 on items + 8 on shipping
    assert.equal(r.total, 1308);
  });

  it("taxes inclusive shipping consistently with inclusive prices", () => {
    const s = buildTaxSnapshot({ enabled: true, pricesIncludeTax: true, shippingTaxable: true, shippingTaxClass: "standard" }, rates, { prefecture: "Tokyo", city: "Shinjuku-ku" }, [...classes], T0);
    const r = calculateTax(s, [line({ subtotal: 1100 })], 110);
    assert.equal(r.taxTotal, 110); // (1100 + 110) × 10/110
    assert.equal(r.total, 1210);
  });

  it("skips non-taxable products, exempt lines and everything when tax is off", () => {
    const r = calculateTax(snap(), [line({ key: "a", taxable: false }), line({ key: "b", taxClass: "exempt" }), line({ key: "c" })], 0);
    assert.equal(r.taxTotal, 100);
    assert.match(r.lines[0].note, /not taxable/);
    const off = calculateTax(snap({ enabled: false }), [line({})], 50);
    assert.equal(off.taxTotal, 0);
    assert.equal(off.total, 1050);
  });

  it("never lets a discount exceed the line", () => {
    assert.equal(calculateTax(snap(), [line({ subtotal: 100, discount: 150 })], 0).total, 0);
  });
});

describe("validation", () => {
  const base = { name: "Rate", percent: 10, taxClass: "standard" as const, location: { type: "prefecture" as const, prefecture: "Tokyo" }, enabled: true };
  it("checks ranges, classes and locations", () => {
    assert.ok(validateTaxRate({ ...base, percent: 101 }, [], [...classes]).percent);
    assert.ok(validateTaxRate({ ...base, percent: -1 }, [], [...classes]).percent);
    assert.ok(validateTaxRate({ ...base, percent: 7.555 }, [], [...classes]).percent);
    assert.ok(validateTaxRate({ ...base, taxClass: "exempt" }, [], [...classes]).taxClass);
    assert.ok(validateTaxRate({ ...base, location: { type: "postcode", postalCode: "12" } }, [], [...classes]).location);
    assert.ok(validateTaxRate({ ...base, location: { type: "prefecture", prefecture: "Atlantis" } }, [], [...classes]).location);
    assert.deepEqual(validateTaxRate({ ...base, percent: 0 }, [], [...classes]), {}); // zero-rated is allowed
  });

  it("rejects a second enabled rate for the same class and location, but allows a disabled one or another class", () => {
    const others = [rate("tokyo", { location: { type: "prefecture", prefecture: "Tokyo" } })];
    assert.match(validateTaxRate({ ...base, location: { type: "prefecture", prefecture: " tokyo " } }, others, [...classes]).location, /already covers/);
    assert.deepEqual(validateTaxRate({ ...base, enabled: false }, others, [...classes]), {});
    assert.deepEqual(validateTaxRate({ ...base, taxClass: "reduced" }, others, [...classes]), {});
  });

  it("requires a non-exempt shipping class when shipping is taxable", () => {
    assert.ok(validateTaxSettings({ enabled: true, pricesIncludeTax: false, shippingTaxable: true, shippingTaxClass: "exempt" }, [...classes]).shippingTaxClass);
    assert.deepEqual(validateTaxSettings({ enabled: true, pricesIncludeTax: false, shippingTaxable: false, shippingTaxClass: "exempt" }, [...classes]), {});
  });
});
