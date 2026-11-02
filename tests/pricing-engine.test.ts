/** B2B price/quantity rule engine tests. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PriceRule, QuantityLimitRule } from "../src/lib/types/index.ts";
import {
  activeSalePrice,
  adjustedPrice,
  checkQuantity,
  findPriceConflicts,
  type RuleItem,
  findQuantityConflicts,
  negativePriceErrors,
  resolvePrice,
  resolveQuantityLimits,
  validatePriceRule,
  validateQuantityRule,
  validateTiers,
} from "../src/lib/pricing/engine.ts";

const T0 = "2026-01-01T00:00:00+09:00";
const NOW = new Date("2026-10-01T12:00:00+09:00");

const rule = (id: string, over: Partial<PriceRule>): PriceRule => ({
  id,
  name: id,
  status: "active",
  audience: { type: "all" },
  target: { type: "all" },
  tiers: [{ minQuantity: 1, adjustment: { type: "percent_off", percent: 5 } }],
  priority: 0,
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

const restaurant = { id: "cus-1", groupId: "grp-restaurant", status: "approved" as const };
const rice5 = { productId: "p-001", variationId: "p-001-5", categoryIds: ["cat-rice"] };
const rice20 = { productId: "p-001", variationId: "p-001-20", categoryIds: ["cat-rice"] };
const price = (rules: PriceRule[], item: RuleItem = rice5, quantity = 1, basePrice = 1000, customer: { id: string; groupId?: string; status: "approved" | "pending" } = restaurant) =>
  resolvePrice({ rules, customer, item, basePrice, quantity, now: NOW });

describe("adjustments and money", () => {
  it("applies fixed, amount-off and percent-off in minor units with half-up rounding", () => {
    assert.equal(adjustedPrice(1000, { type: "fixed_price", amount: 875 }), 875);
    assert.equal(adjustedPrice(1000, { type: "amount_off", amount: 120 }), 880);
    assert.equal(adjustedPrice(999, { type: "percent_off", percent: 12.5 }), 874); // 874.125 → ¥874
    assert.equal(adjustedPrice(5, { type: "percent_off", percent: 50 }), 3); // ¥2.5 → ¥3 (half-up)
    assert.equal(adjustedPrice(1001, { type: "percent_off", percent: 12.5 }), 876); // 875.875 → ¥876
  });

  it("never returns a negative price", () => {
    assert.equal(adjustedPrice(100, { type: "amount_off", amount: 101 }), null);
    assert.equal(adjustedPrice(100, { type: "amount_off", amount: 100 }), 0);
    assert.equal(adjustedPrice(100, { type: "percent_off", percent: 100 }), 0);
  });

  it("calculates the line total exactly", () => {
    const r = price([rule("r", { tiers: [{ minQuantity: 1, adjustment: { type: "fixed_price", amount: 333 } }] })], rice5, 3);
    assert.equal(r.lineTotal, 999);
  });
});

describe("price precedence", () => {
  const groupCategory = rule("group-cat", { audience: { type: "group", groupId: "grp-restaurant" }, target: { type: "categories", categoryIds: ["cat-rice"] }, tiers: [{ minQuantity: 1, adjustment: { type: "percent_off", percent: 5 } }] });
  const groupProduct = rule("group-prod", { audience: { type: "group", groupId: "grp-restaurant" }, target: { type: "products", productIds: ["p-001"] }, tiers: [{ minQuantity: 1, adjustment: { type: "amount_off", amount: 50 } }] });
  const customerCategory = rule("cust-cat", { audience: { type: "customer", customerId: "cus-1" }, target: { type: "categories", categoryIds: ["cat-rice"] }, tiers: [{ minQuantity: 1, adjustment: { type: "percent_off", percent: 1 } }] });
  const allVariation = rule("all-var", { target: { type: "variations", productId: "p-001", variationIds: ["p-001-5"] }, tiers: [{ minQuantity: 1, adjustment: { type: "fixed_price", amount: 500 } }] });

  it("customer-specific beats group even when the group rule is more specific and cheaper", () => {
    const r = price([groupProduct, customerCategory, allVariation]);
    assert.equal(r.rule?.id, "cust-cat");
    assert.equal(r.unitPrice, 990);
    assert.equal(r.candidates.find((c) => c.rule.id === "group-prod")?.outcome, "outranked");
    assert.match(r.candidates.find((c) => c.rule.id === "group-prod")!.reason, /customer-specific/);
  });

  it("within the same audience, a more specific target wins: variation > product > category > all", () => {
    assert.equal(price([groupCategory, groupProduct]).rule?.id, "group-prod");
    const groupVariation = rule("group-var", { audience: { type: "group", groupId: "grp-restaurant" }, target: { type: "variations", productId: "p-001", variationIds: ["p-001-5"] } });
    assert.equal(price([groupCategory, groupProduct, groupVariation]).rule?.id, "group-var");
    // the variation rule does not match the other variation
    assert.equal(price([groupCategory, groupProduct, groupVariation], rice20).rule?.id, "group-prod");
  });

  it("group beats all-customers", () => {
    assert.equal(price([allVariation, groupCategory]).rule?.id, "group-cat");
  });

  it("uses priority, then age, then id as tie-breakers — deterministically", () => {
    const a = rule("a", { createdAt: "2026-02-01T00:00:00+09:00" });
    const b = rule("b", { createdAt: "2026-01-15T00:00:00+09:00" });
    assert.equal(price([a, b]).rule?.id, "b"); // older wins
    assert.equal(price([b, a]).rule?.id, "b"); // order of input does not matter
    assert.equal(price([a, { ...b, priority: -1 }]).rule?.id, "a"); // priority before age
    const c = rule("c", {});
    const d = rule("d", {});
    assert.equal(price([d, c]).rule?.id, "c");
    assert.match(price([a, b]).candidates[1].reason, /Conflict/);
  });

  it("does not stack discounts", () => {
    const r = price([groupCategory, groupProduct, customerCategory]);
    assert.equal(r.unitPrice, 990); // only the 1 % customer rule, not 1 % + 5 % + ¥50
    assert.equal(r.candidates.filter((c) => c.outcome === "winner").length, 1);
  });

  it("skips disabled, expired and not-yet-started rules", () => {
    const r = price([
      { ...customerCategory, status: "disabled" },
      { ...groupProduct, validTo: "2026-09-01T00:00:00+09:00" },
      { ...groupCategory, validFrom: "2026-11-01T00:00:00+09:00" },
    ]);
    assert.equal(r.rule, undefined);
    assert.equal(r.unitPrice, 1000);
    assert.deepEqual(r.candidates.map((c) => c.outcome), ["skipped", "skipped", "skipped"]);
  });

  it("gives no rule prices to customers who are not approved", () => {
    const r = price([groupCategory], rice5, 1, 1000, { ...restaurant, status: "pending" });
    assert.equal(r.rule, undefined);
    assert.equal(r.unitPrice, 1000);
  });

  it("ignores a rule that would make the price negative and falls back to the next one", () => {
    const tooBig = rule("too-big", { audience: { type: "customer", customerId: "cus-1" }, tiers: [{ minQuantity: 1, adjustment: { type: "amount_off", amount: 2000 } }] });
    const r = price([tooBig, groupCategory]);
    assert.equal(r.rule?.id, "group-cat");
    assert.match(r.candidates.find((c) => c.rule.id === "too-big")!.reason, /negative/);
  });

  it("matches parent categories through the item's ancestor list", () => {
    const drinks = rule("drinks", { target: { type: "categories", categoryIds: ["cat-drinks"] } });
    assert.equal(price([drinks], { productId: "p-017", categoryIds: ["cat-tea", "cat-drinks", "cat-japanese"] }).rule?.id, "drinks");
    assert.equal(price([drinks], { productId: "p-016", categoryIds: ["cat-japanese"] }).rule, undefined);
  });
});

describe("bulk tiers", () => {
  const bulk = rule("bulk", {
    audience: { type: "group", groupId: "grp-restaurant" },
    tiers: [
      { minQuantity: 5, maxQuantity: 9, adjustment: { type: "amount_off", amount: 50 } },
      { minQuantity: 10, maxQuantity: 49, adjustment: { type: "amount_off", amount: 120 } },
      { minQuantity: 50, adjustment: { type: "percent_off", percent: 15 } },
    ],
  });

  it("picks the tier covering the quantity", () => {
    assert.equal(price([bulk], rice5, 4).rule, undefined); // below the first tier → base price
    assert.equal(price([bulk], rice5, 5).unitPrice, 950);
    assert.equal(price([bulk], rice5, 9).unitPrice, 950);
    assert.equal(price([bulk], rice5, 10).unitPrice, 880);
    assert.equal(price([bulk], rice5, 50).unitPrice, 850);
    assert.equal(price([bulk], rice5, 5000).tier?.minQuantity, 50);
  });

  it("lets a lower-precedence rule apply when the stronger rule has no tier for the quantity", () => {
    const customerBulk = rule("cust-bulk", { audience: { type: "customer", customerId: "cus-1" }, tiers: [{ minQuantity: 20, adjustment: { type: "fixed_price", amount: 800 } }] });
    assert.equal(price([customerBulk, bulk], rice5, 10).rule?.id, "bulk");
    assert.equal(price([customerBulk, bulk], rice5, 20).rule?.id, "cust-bulk");
  });

  it("rejects overlapping, unsorted or open-ended middle tiers", () => {
    const ok = validateTiers(bulk.tiers);
    assert.deepEqual(ok, {});
    const overlap = validateTiers([
      { minQuantity: 1, maxQuantity: 10, adjustment: { type: "percent_off", percent: 5 } },
      { minQuantity: 10, adjustment: { type: "percent_off", percent: 8 } },
    ]);
    assert.match(overlap["tiers.1.minQuantity"], /Overlaps/);
    const openMiddle = validateTiers([
      { minQuantity: 1, adjustment: { type: "percent_off", percent: 5 } },
      { minQuantity: 10, adjustment: { type: "percent_off", percent: 8 } },
    ]);
    assert.ok(openMiddle["tiers.0.maxQuantity"]);
    const unsorted = validateTiers([
      { minQuantity: 10, adjustment: { type: "percent_off", percent: 5 } },
      { minQuantity: 2, maxQuantity: 5, adjustment: { type: "percent_off", percent: 8 } },
    ]);
    assert.ok(unsorted["tiers.1.minQuantity"]);
    assert.ok(validateTiers([{ minQuantity: 0, adjustment: { type: "percent_off", percent: 101 } }])["tiers.0.value"]);
    assert.ok(validateTiers([])["tiers"]);
  });

  it("validates discounts against base prices so no price goes negative", () => {
    const errors = negativePriceErrors([{ minQuantity: 1, adjustment: { type: "amount_off", amount: 1200 } }], [{ label: "Rice 5 kg", price: 1150 }, { label: "Rice 20 kg", price: 4400 }]);
    assert.match(errors["tiers.0.value"], /Rice 5 kg/);
  });
});

describe("conflict detection", () => {
  it("flags same-audience, same-level overlapping rules; same priority = conflict", () => {
    const a = rule("a", { target: { type: "categories", categoryIds: ["cat-rice", "cat-oils"] } });
    const b = rule("b", { target: { type: "categories", categoryIds: ["cat-oils"] }, tiers: [{ minQuantity: 5, adjustment: { type: "percent_off", percent: 9 } }] });
    const c = rule("c", { target: { type: "categories", categoryIds: ["cat-oils"] }, priority: 3 });
    const kinds = findPriceConflicts([a, b, c]).filter((x) => x.ruleId === "a");
    assert.deepEqual(kinds.map((k) => `${k.otherId}:${k.kind}`).sort(), ["b:conflict", "c:overlap"]);
  });

  it("does not flag rules separated by tiers, dates, audience, level or status", () => {
    const a = rule("a", { tiers: [{ minQuantity: 1, maxQuantity: 9, adjustment: { type: "percent_off", percent: 5 } }] });
    const tiers = rule("tiers", { tiers: [{ minQuantity: 10, adjustment: { type: "percent_off", percent: 9 } }] });
    const dates = rule("dates", { validFrom: "2027-01-01T00:00:00+09:00" });
    const later = { ...a, id: "a2", validTo: "2026-12-31T23:59:59+09:00" };
    const group = rule("group", { audience: { type: "group", groupId: "g" } });
    const level = rule("level", { target: { type: "products", productIds: ["p-001"] } });
    const off = rule("off", { status: "disabled" });
    assert.deepEqual(findPriceConflicts([a, tiers, group, level, off]), []);
    assert.deepEqual(findPriceConflicts([dates, later]), []);
  });
});

describe("quantity limits", () => {
  const q = (id: string, over: Partial<QuantityLimitRule>): QuantityLimitRule => ({ id, name: id, status: "active", target: { type: "all" }, priority: 0, createdAt: T0, updatedAt: T0, ...over });
  const all = q("all", { maxQuantity: 500 });
  const category = q("rice", { target: { type: "categories", categoryIds: ["cat-rice"] }, minQuantity: 2, maxQuantity: 100 });
  const variation = q("rice20", { target: { type: "variations", productId: "p-001", variationIds: ["p-001-20"] }, maxQuantity: 20 });

  it("uses the most specific rule as a whole", () => {
    assert.deepEqual(pick(resolveQuantityLimits([all, category, variation], rice5)), { rule: "rice", min: 2, max: 100 });
    assert.deepEqual(pick(resolveQuantityLimits([all, category, variation], rice20)), { rule: "rice20", min: 1, max: 20 }); // no min set → default 1
    assert.deepEqual(pick(resolveQuantityLimits([all, category], { productId: "p-005", categoryIds: ["cat-meat"] })), { rule: "all", min: 1, max: 500 });
    assert.deepEqual(pick(resolveQuantityLimits([], rice5)), { rule: undefined, min: 1, max: undefined });
  });

  it("ignores disabled rules and breaks ties by priority", () => {
    assert.equal(resolveQuantityLimits([{ ...variation, status: "disabled" }, category], rice20).rule?.id, "rice");
    const strict = q("strict", { target: { type: "categories", categoryIds: ["cat-rice"] }, minQuantity: 5, priority: 1 });
    assert.equal(resolveQuantityLimits([category, strict], rice5).rule?.id, "strict");
    assert.deepEqual(findQuantityConflicts([category, strict]).map((c) => c.kind), ["overlap", "overlap"]);
  });

  it("applies limits per line", () => {
    const limits = resolveQuantityLimits([category], rice5);
    assert.match(checkQuantity(limits, 1)!, /Minimum 2/);
    assert.equal(checkQuantity(limits, 2), undefined);
    assert.equal(checkQuantity(limits, 100), undefined);
    assert.match(checkQuantity(limits, 101)!, /Maximum 100/);
  });

  it("validates min ≤ max and requires at least one limit", () => {
    const base = { name: "Rule", status: "active" as const, target: { type: "all" as const }, priority: 0 };
    assert.ok(validateQuantityRule({ ...base, minQuantity: 10, maxQuantity: 5 }).maxQuantity);
    assert.ok(validateQuantityRule({ ...base }).minQuantity);
    assert.deepEqual(validateQuantityRule({ ...base, minQuantity: 5, maxQuantity: 5 }), {});
    assert.ok(validateQuantityRule({ ...base, target: { type: "categories", categoryIds: [] }, minQuantity: 1 }).target);
  });
});

describe("rule validation", () => {
  it("requires an audience id and a non-empty target", () => {
    const errors = validatePriceRule({ name: "x", status: "active", audience: { type: "group", groupId: "" }, target: { type: "products", productIds: [] }, tiers: [{ minQuantity: 1, adjustment: { type: "percent_off", percent: 5 } }], priority: 0.5 });
    assert.ok(errors.name && errors.audience && errors.target && errors.priority);
  });
});

function pick(l: ReturnType<typeof resolveQuantityLimits>) {
  return { rule: l.rule?.id, min: l.min, max: l.max };
}

describe("regular price, sale price and rules (no stacking)", () => {
  const groupPercent = rule("group-pct", { audience: { type: "group", groupId: "grp-restaurant" }, tiers: [{ minQuantity: 1, adjustment: { type: "percent_off", percent: 5 } }] });
  const groupAmount = rule("group-amt", { audience: { type: "group", groupId: "grp-restaurant" }, target: { type: "products", productIds: ["p-001"] }, tiers: [{ minQuantity: 1, adjustment: { type: "amount_off", amount: 100 } }] });
  const customerFixed = rule("cust-fixed", { audience: { type: "customer", customerId: "cus-1" }, tiers: [{ minQuantity: 1, adjustment: { type: "fixed_price", amount: 960 } }] });
  const quote = (rules: PriceRule[], salePrice?: number, customer: { id: string; groupId?: string; status: "approved" | "pending" } = restaurant) =>
    resolvePrice({ rules, customer, item: rice5, basePrice: 1000, salePrice, quantity: 2, now: NOW });

  it("uses the active sale price when no rule applies", () => {
    const r = quote([], 900);
    assert.equal(r.priceSource, "sale");
    assert.equal(r.unitPrice, 900);
    assert.equal(r.lineTotal, 1800);
    assert.match(r.explanation, /sale price/);
  });

  it("uses the regular price when there is neither a rule nor a sale", () => {
    const r = quote([]);
    assert.equal(r.priceSource, "regular");
    assert.equal(r.unitPrice, 1000);
  });

  it("calculates percentage and amount-off rules from the regular price, ignoring the sale", () => {
    const pct = quote([groupPercent], 990);
    assert.equal(pct.priceSource, "rule");
    assert.equal(pct.rulePrice, 950); // 5 % of the regular 1000 — not of the sale 990 (940.50)
    assert.equal(pct.unitPrice, 950);
    assert.equal(quote([groupAmount], 990).rulePrice, 900); // 1000 − 100, not 990 − 100
  });

  it("gives the sale price when it is lower than the rule price — compared, not stacked", () => {
    const r = quote([groupPercent], 800);
    assert.equal(r.rulePrice, 950); // 5 % of the regular 1000
    assert.equal(r.unitPrice, 800); // sale is lower → sale wins
    assert.equal(r.priceSource, "sale");
    assert.equal(r.rule?.id, "group-pct"); // the rule still won among rules (shown in the tester)
    assert.notEqual(r.unitPrice, 760); // never 5 % off the sale price
    assert.equal(r.lineTotal, 1600);
    assert.match(r.explanation, /lower than the rule price/);
  });

  it("keeps the rule price when it is lower than or equal to the sale price", () => {
    const lower = quote([groupPercent], 980);
    assert.equal(lower.unitPrice, 950);
    assert.equal(lower.priceSource, "rule");
    const equal = quote([groupPercent], 950);
    assert.equal(equal.priceSource, "rule");
  });

  it("compares a fixed-price rule with the sale price too", () => {
    assert.equal(quote([customerFixed], 900).unitPrice, 900); // sale 900 < fixed 960
    assert.equal(quote([customerFixed], 990).unitPrice, 960);
  });

  it("uses a fixed rule's entered amount regardless of regular or sale price", () => {
    const r = quote([customerFixed, groupPercent], 999);
    assert.equal(r.rule?.id, "cust-fixed");
    assert.equal(r.unitPrice, 960);
  });

  it("gives unapproved customers no rule, but the public sale price still applies", () => {
    const r = quote([groupPercent], 900, { ...restaurant, status: "pending" });
    assert.equal(r.priceSource, "sale");
    assert.equal(r.unitPrice, 900);
  });

  it("treats a sale as active only inside its dates and below the regular price", () => {
    assert.equal(activeSalePrice(1000, { price: 900 }, "2026-10-01"), 900);
    assert.equal(activeSalePrice(1000, { price: 900, from: "2026-10-01", to: "2026-10-31" }, "2026-10-01"), 900); // inclusive
    assert.equal(activeSalePrice(1000, { price: 900, from: "2026-10-01", to: "2026-10-31" }, "2026-10-31"), 900);
    assert.equal(activeSalePrice(1000, { price: 900, from: "2026-10-02" }, "2026-10-01"), undefined);
    assert.equal(activeSalePrice(1000, { price: 900, to: "2026-09-30" }, "2026-10-01"), undefined);
    assert.equal(activeSalePrice(1000, { price: 1000 }, "2026-10-01"), undefined);
    assert.equal(activeSalePrice(1000, {}, "2026-10-01"), undefined);
  });
});
