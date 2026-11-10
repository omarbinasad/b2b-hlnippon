import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCoupon, normalizeCode, validateCoupon, type CouponContext } from "../src/lib/coupons/engine.ts";
import type { Coupon, CouponInput } from "../src/lib/types/coupon.ts";

const coupon = (p: Partial<Coupon> = {}): Coupon => ({ id: "c", code: "X", type: "percent", amount: 10, productIds: [], categorySlugs: [], excludedProductIds: [], customerIds: [], groupIds: [], usedCount: 0, enabled: true, createdAt: "", updatedAt: "", ...p });
const ctx = (p: Partial<CouponContext> = {}): CouponContext => ({
  today: "2026-06-15",
  customerId: "cus-1",
  groupId: "grp-1",
  usedByCustomer: 0,
  lines: [
    { id: "a", productId: "p1", categorySlugs: ["rice"], quantity: 2, lineTotal: 1000 },
    { id: "b", productId: "p2", categorySlugs: ["spice", "cooking"], quantity: 3, lineTotal: 600 },
  ],
  ...p,
});
const off = (c: Coupon, x = ctx()) => {
  const r = evaluateCoupon(c, x);
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r;
};
const refused = (c: Coupon, x = ctx()) => {
  const r = evaluateCoupon(c, x);
  assert.equal(r.ok, false);
  return r.ok ? "" : r.error;
};

describe("coupon discount", () => {
  it("percentage off the whole cart, shared across lines", () => {
    const r = off(coupon());
    assert.equal(r.discount, 160);
    assert.equal(r.allocations.a + r.allocations.b, 160);
  });
  it("rounds half-up once, in whole yen", () => {
    assert.equal(off(coupon({ amount: 12.5 }), ctx({ lines: [{ id: "a", productId: "p", categorySlugs: [], quantity: 1, lineTotal: 1004 }] })).discount, 126);
  });
  it("fixed cart discount never exceeds the cart", () => {
    assert.equal(off(coupon({ type: "fixed_cart", amount: 500 })).discount, 500);
    assert.equal(off(coupon({ type: "fixed_cart", amount: 99999 })).discount, 1600);
  });
  it("fixed product discount is per unit, capped per line", () => {
    assert.equal(off(coupon({ type: "fixed_product", amount: 100 })).discount, 500);
    assert.equal(off(coupon({ type: "fixed_product", amount: 300 })).allocations.b, 600);
  });
  it("applies only to chosen products or categories", () => {
    assert.deepEqual(off(coupon({ productIds: ["p1"] })).allocations, { a: 100 });
    assert.deepEqual(off(coupon({ categorySlugs: ["cooking"] })).allocations, { b: 60 });
    assert.deepEqual(off(coupon({ excludedProductIds: ["p1"] })).allocations, { b: 60 });
  });
  it("refuses a cart with nothing eligible", () => {
    assert.match(refused(coupon({ productIds: ["zzz"] })), /doesn't apply/);
  });
});

describe("coupon rules", () => {
  it("disabled, not started, expired", () => {
    assert.match(refused(coupon({ enabled: false })), /isn't active/);
    assert.match(refused(coupon({ startsOn: "2026-06-16" })), /isn't active yet/);
    assert.match(refused(coupon({ expiresOn: "2026-06-14" })), /expired/);
    off(coupon({ expiresOn: "2026-06-15" }));
  });
  it("spend limits use the whole cart", () => {
    assert.match(refused(coupon({ minSpend: 1601 })), /minimum/);
    off(coupon({ minSpend: 1600 }));
    assert.match(refused(coupon({ maxSpend: 1599 })), /maximum/);
  });
  it("usage limits", () => {
    assert.match(refused(coupon({ usageLimit: 3, usedCount: 3 })), /usage limit/);
    assert.match(refused(coupon({ usageLimitPerCustomer: 1 }), ctx({ usedByCustomer: 1 })), /already used/);
  });
  it("customer and group eligibility", () => {
    assert.match(refused(coupon({ customerIds: ["other"] })), /isn't available/);
    off(coupon({ customerIds: ["cus-1"] }));
    off(coupon({ groupIds: ["grp-1"] }));
    assert.match(refused(coupon({ groupIds: ["grp-2"] })), /isn't available/);
  });
});

describe("coupon form rules", () => {
  const input = (p: Partial<CouponInput> = {}) => ({ code: "SAVE10", type: "percent", amount: 10, productIds: [], categorySlugs: [], excludedProductIds: [], customerIds: [], groupIds: [], enabled: true, ...p }) as CouponInput;
  const none = () => false;
  it("normalises codes", () => assert.equal(normalizeCode(" save10 "), "SAVE10"));
  it("accepts a valid coupon", () => assert.deepEqual(validateCoupon(input(), none), {}));
  it("checks code, amount and limits", () => {
    assert.ok(validateCoupon(input({ code: "a b" }), none).code);
    assert.ok(validateCoupon(input(), () => true).code);
    assert.ok(validateCoupon(input({ amount: 0 }), none).amount);
    assert.ok(validateCoupon(input({ amount: 101 }), none).amount);
    assert.ok(validateCoupon(input({ minSpend: 100, maxSpend: 50 }), none).maxSpend);
    assert.ok(validateCoupon(input({ startsOn: "2026-02-01", expiresOn: "2026-01-01" }), none).expiresOn);
    assert.ok(validateCoupon(input({ usageLimit: 0 }), none).usageLimit);
  });
});
