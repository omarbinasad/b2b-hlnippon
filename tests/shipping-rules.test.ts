import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteShipping, type ShippingItem } from "../src/lib/shipping/engine.ts";
import { applyShippingRules, conditionMatches, describeRule, ruleMatches, validateRule, type RuleContext, type ShippingGeneralSettings, type ShippingRule } from "../src/lib/shipping/rules.ts";
import type { ShippingZone } from "../src/lib/types/shipping.ts";

const zone: ShippingZone = {
  id: "z1", name: "Tokyo", isFallback: false, createdAt: "", updatedAt: "",
  locations: [{ type: "prefecture", prefecture: "Tokyo" }],
  methods: [
    { id: "flat", name: "Standard", enabled: true, type: "flat_rate", cost: 800, classAdjustments: [] },
    { id: "free", name: "Free over 20000", enabled: true, type: "free_shipping", minSubtotal: 20000 },
    { id: "pick", name: "Pickup", enabled: true, type: "local_pickup", cost: 0 },
  ],
};
const item = (p: Partial<ShippingItem> = {}): ShippingItem => ({ productId: "p1", name: "A", quantity: 2, unitPrice: 5000, unitGrams: 2000, ...p });
const addr = { prefecture: "Tokyo", city: "Minato-ku", postalCode: "105-0001" };
const ctx = (p: Partial<RuleContext> = {}): RuleContext => ({ address: addr, items: [{ productId: "p1", categorySlugs: ["rice"], quantity: 2 }], ...p });
const settings: ShippingGeneralSettings = { hidePaidWhenFree: false, unavailableMessage: "" };
const rule = (p: Partial<ShippingRule>): ShippingRule => ({ id: "r", name: "R", enabled: true, priority: 10, match: "all", conditions: [], action: { type: "free" }, zoneIds: [], ...p });
const q = (items = [item()]) => quoteShipping([zone], addr, items);
const metrics = { totalGrams: 4000, subtotal: 10000, units: 2 };

describe("rule conditions", () => {
  it("compares subtotal, weight in kg and quantity", () => {
    assert.ok(conditionMatches({ field: "subtotal", op: "lt", value: 20000 }, ctx(), metrics));
    assert.ok(!conditionMatches({ field: "subtotal", op: "gte", value: 20000 }, ctx(), metrics));
    assert.ok(conditionMatches({ field: "weight", op: "lte", value: 4 }, ctx(), metrics));
    assert.ok(!conditionMatches({ field: "weight", op: "lt", value: 4 }, ctx(), metrics));
    assert.ok(conditionMatches({ field: "quantity", op: "gt", value: 1 }, ctx(), metrics));
  });
  it("matches lists, ignoring case and postcode punctuation", () => {
    assert.ok(conditionMatches({ field: "region", op: "in", value: ["tokyo"] }, ctx(), metrics));
    assert.ok(!conditionMatches({ field: "region", op: "not_in", value: ["Tokyo"] }, ctx(), metrics));
    assert.ok(conditionMatches({ field: "postcode", op: "in", value: ["1050001"] }, ctx(), metrics));
    assert.ok(conditionMatches({ field: "category", op: "in", value: ["rice"] }, ctx(), metrics));
    assert.ok(conditionMatches({ field: "coupon", op: "in", value: ["FREESHIP"] }, ctx({ couponCode: "freeship" }), metrics));
    assert.ok(!conditionMatches({ field: "customer_group", op: "in", value: ["g"] }, ctx(), metrics));
  });
  it("AND needs all, OR needs one, no conditions always match", () => {
    const conds = [{ field: "subtotal", op: "lt", value: 1 }, { field: "region", op: "in", value: ["Tokyo"] }] as ShippingRule["conditions"];
    assert.equal(ruleMatches(rule({ conditions: conds }), ctx(), metrics), false);
    assert.equal(ruleMatches(rule({ conditions: conds, match: "any" }), ctx(), metrics), true);
    assert.equal(ruleMatches(rule({}), ctx(), metrics), true);
  });
});

describe("applying rules", () => {
  it("without rules, the cheapest delivery method stands", () => {
    const r = applyShippingRules(q(), [], settings, [], ctx());
    assert.equal(r.selected?.method.id, "flat");
    assert.equal(r.charge?.final, 800);
  });
  it("the first base rule by priority wins, and the trace says so", () => {
    const r = applyShippingRules(q(), [rule({ id: "b", name: "Second", priority: 20, action: { type: "set_charge", amount: 300 } }), rule({ id: "a", name: "First", priority: 5, action: { type: "set_charge", amount: 500 } })], settings, [], ctx());
    assert.equal(r.charge?.final, 500);
    assert.deepEqual(r.rulesApplied, ["First"]);
    assert.ok(r.trace.some((t) => /Second.*already set/.test(t)));
  });
  it("surcharges add to the base; free ignores them", () => {
    const sur = rule({ id: "s", name: "Remote", action: { type: "surcharge", amount: 200 } });
    assert.equal(applyShippingRules(q(), [sur], settings, [], ctx()).charge?.final, 1000);
    assert.equal(applyShippingRules(q(), [sur, rule({ id: "f", name: "Free", priority: 1 })], settings, [], ctx()).charge?.final, 0);
  });
  it("disabled and out-of-zone rules are skipped", () => {
    const r = applyShippingRules(q(), [rule({ enabled: false }), rule({ id: "z", zoneIds: ["other"] })], settings, [], ctx());
    assert.equal(r.charge?.final, 800);
    assert.deepEqual(r.rulesApplied, []);
  });
  it("hide method removes it", () => {
    const r = applyShippingRules(q(), [rule({ action: { type: "hide_method", methodType: "flat_rate" } })], settings, [], ctx());
    assert.equal(r.options.find((o) => o.method.id === "flat")?.available, false);
    assert.equal(r.selected, undefined);
  });
  it("rate tiers choose by weight or subtotal", () => {
    const tiers = [{ from: 0, cost: 500 }, { from: 5000, cost: 800 }, { from: 10000, cost: 1200 }];
    assert.equal(applyShippingRules(q(), [rule({ action: { type: "tiers", basis: "weight", tiers } })], settings, [], ctx()).charge?.final, 500);
    assert.equal(applyShippingRules(q(), [rule({ action: { type: "tiers", basis: "weight", tiers } })], settings, [], ctx({ grams: 5000 })).charge?.final, 800);
  });
  it("class surcharges apply per order or per unit", () => {
    const items = [{ productId: "p1", categorySlugs: [], quantity: 3, shippingClassId: "frozen" }];
    assert.equal(applyShippingRules(q(), [], settings, [{ id: "frozen", name: "Frozen", surcharge: 100, surchargePer: "order" }], ctx({ items })).charge?.final, 900);
    assert.equal(applyShippingRules(q(), [], settings, [{ id: "frozen", name: "Frozen", surcharge: 100, surchargePer: "unit" }], ctx({ items })).charge?.final, 1100);
  });
  it("hide paid methods when free is available, keeping pickup", () => {
    const big = q([item({ quantity: 5 })]);
    const r = applyShippingRules(big, [], { ...settings, hidePaidWhenFree: true }, [], ctx());
    assert.equal(r.options.find((o) => o.method.id === "flat")?.available, false);
    assert.equal(r.options.find((o) => o.method.id === "pick")?.available, true);
    assert.equal(r.selected?.method.id, "free");
    assert.equal(applyShippingRules(big, [], settings, [], ctx()).options.find((o) => o.method.id === "flat")?.available, true);
  });
  it("the tester can override cart numbers", () => {
    const r = applyShippingRules(q(), [rule({ conditions: [{ field: "subtotal", op: "gte", value: 50000 }] })], settings, [], ctx({ subtotal: 60000 }));
    assert.equal(r.charge?.final, 0);
  });
});

describe("rule wording and validation", () => {
  it("reads as a sentence", () => {
    const text = describeRule({ match: "all", conditions: [{ field: "subtotal", op: "lt", value: 20000 }, { field: "weight", op: "lte", value: 5 }], action: { type: "set_charge", amount: 500 } }, (n) => `¥${n}`);
    assert.equal(text, "WHEN Order subtotal is below ¥20000 AND Cart weight (kg) is up to 5 THEN charge ¥500.");
  });
  it("checks names, conditions, amounts and tiers", () => {
    const base = { name: "OK", enabled: true, priority: 1, match: "all" as const, conditions: [], action: { type: "free" as const }, zoneIds: [] };
    assert.deepEqual(validateRule(base), {});
    assert.ok(validateRule({ ...base, name: "" }).name);
    assert.ok(validateRule({ ...base, conditions: [{ field: "region", op: "in", value: [] }] })["conditions.0"]);
    assert.ok(validateRule({ ...base, conditions: [{ field: "subtotal", op: "in", value: 1 }] })["conditions.0"]);
    assert.ok(validateRule({ ...base, action: { type: "set_charge", amount: -1 } })["action.amount"]);
    assert.ok(validateRule({ ...base, action: { type: "tiers", basis: "weight", tiers: [{ from: 5, cost: 1 }] } })["action.tiers"]);
    assert.ok(validateRule({ ...base, action: { type: "tiers", basis: "weight", tiers: [{ from: 0, cost: 1 }, { from: 0, cost: 2 }] } })["action.tiers"]);
  });
});
