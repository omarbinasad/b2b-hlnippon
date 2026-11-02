/** Shipping zone matching, rate calculation and validation. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShippingMethod, ShippingZone } from "../src/lib/types/index.ts";
import { cartMetrics, matchZone, quoteMethod, quoteShipping, validateMethod, validateZone, type ShippingItem } from "../src/lib/shipping/engine.ts";

const T0 = "2026-01-01T00:00:00+09:00";
const zone = (id: string, over: Partial<ShippingZone>): ShippingZone => ({ id, name: id, locations: [], isFallback: false, methods: [], createdAt: T0, updatedAt: T0, ...over });

const flat = (id: string, cost: number, over: Partial<Extract<ShippingMethod, { type: "flat_rate" }>> = {}): ShippingMethod => ({ id, name: id, enabled: true, type: "flat_rate", cost, classAdjustments: [], ...over });

const zones: ShippingZone[] = [
  zone("tokyo-shinjuku", { locations: [{ type: "city", prefecture: "Tokyo", city: "Shinjuku-ku" }], methods: [flat("dc", 100)] }),
  zone("tokyo-pref", { locations: [{ type: "prefecture", prefecture: "Tokyo" }], methods: [flat("dd", 250)] }),
  zone("airport", { locations: [{ type: "postcode", postalCode: "160-0023" }], methods: [flat("ap", 50)] }),
  zone("rest", { isFallback: true, methods: [flat("rb", 600)] }),
];

const item = (over: Partial<ShippingItem>): ShippingItem => ({ productId: "p", name: "p", quantity: 1, unitPrice: 100, unitGrams: 1000, ...over });

describe("zone matching", () => {
  it("prefers exact postcode, then city, then prefecture, then fallback", () => {
    assert.equal(matchZone(zones, { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "160-0023" }).zone?.id, "airport");
    assert.equal(matchZone(zones, { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "100-0001" }).zone?.id, "tokyo-shinjuku");
    assert.equal(matchZone(zones, { prefecture: "Tokyo", city: "Hachioji-shi", postalCode: "192-0001" }).zone?.id, "tokyo-pref");
    const m = matchZone(zones, { prefecture: "Okinawa", city: "Naha-shi", postalCode: "900-0001" });
    assert.equal(m.zone?.id, "rest");
    assert.equal(m.level, "fallback");
  });

  it("ignores case and extra spaces; requires the city's prefecture to match", () => {
    assert.equal(matchZone(zones, { prefecture: " tokyo ", city: "SHINJUKU-KU" }).zone?.id, "tokyo-shinjuku");
    // a Shinjuku-ku in another prefecture is not Tokyo's Shinjuku-ku
    assert.equal(matchZone(zones, { prefecture: "Osaka", city: "Shinjuku-ku" }).zone?.id, "rest");
  });

  it("works without a postcode (manual address entry)", () => {
    assert.equal(matchZone(zones, { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "" }).level, "city");
  });

  it("reports when nothing matches and there is no fallback", () => {
    assert.equal(matchZone(zones.filter((z) => !z.isFallback), { prefecture: "Hokkaido", city: "Sapporo-shi" }).zone, undefined);
  });
});

describe("cart metrics", () => {
  it("sums weight in grams and the subtotal in minor units", () => {
    const m = cartMetrics([
      item({ quantity: 3, unitGrams: 20_000, unitPrice: 4200 }),
      item({ quantity: 2, unitGrams: 250, unitPrice: 1, shippingClassId: "frozen" }),
    ]);
    assert.equal(m.totalGrams, 60_500);
    assert.equal(m.subtotal, 12602); // 3 × 4200 + 2 × 1
    assert.equal(m.units, 5);
    assert.deepEqual(m.classUnits, { frozen: 2 });
  });

  it("uses the subtotal after line discounts", () => {
    assert.equal(cartMetrics([item({ quantity: 2, unitPrice: 1000, discount: 150 })]).subtotal, 1850);
  });
});

describe("method rates", () => {
  const metrics = (items: ShippingItem[]) => cartMetrics(items);
  const weight: ShippingMethod = {
    id: "w", name: "By weight", enabled: true, type: "weight_tiers", classAdjustments: [],
    tiers: [{ from: 0, cost: 150 }, { from: 10_000, cost: 300 }, { from: 50_000, cost: 700 }],
  };
  const subtotal: ShippingMethod = {
    id: "s", name: "By subtotal", enabled: true, type: "subtotal_tiers", classAdjustments: [],
    tiers: [{ from: 0, cost: 400 }, { from: 5000, cost: 200 }, { from: 20000, cost: 0 }],
  };

  it("chooses the weight tier by its lower boundary (inclusive)", () => {
    assert.equal(quoteMethod(weight, metrics([item({ unitGrams: 9_999 })])).cost, 150);
    assert.equal(quoteMethod(weight, metrics([item({ unitGrams: 10_000 })])).cost, 300);
    assert.equal(quoteMethod(weight, metrics([item({ unitGrams: 25_000, quantity: 2 })])).cost, 700);
  });

  it("chooses the subtotal tier", () => {
    assert.equal(quoteMethod(subtotal, metrics([item({ unitPrice: 4999 })])).cost, 400);
    assert.equal(quoteMethod(subtotal, metrics([item({ unitPrice: 5000 })])).cost, 200);
    assert.equal(quoteMethod(subtotal, metrics([item({ unitPrice: 10_000, quantity: 2 })])).cost, 0);
  });

  it("adds shipping-class adjustments per order or per unit", () => {
    const m = metrics([item({ quantity: 3, shippingClassId: "frozen" }), item({ quantity: 2, shippingClassId: "heavy" })]);
    const method = flat("f", 100, {
      classAdjustments: [
        { shippingClassId: "frozen", amount: 150, per: "order" },
        { shippingClassId: "heavy", amount: 40, per: "unit" },
        { shippingClassId: "fragile", amount: 99, per: "order" },
      ],
    });
    const q = quoteMethod(method, m);
    assert.equal(q.cost, 330); // 100 + 150 + 2 × 40; fragile not in cart
    assert.equal(q.breakdown.length, 3);
  });

  it("offers free shipping only at or above its minimum subtotal", () => {
    const free: ShippingMethod = { id: "free", name: "Free", enabled: true, type: "free_shipping", minSubtotal: 25000 };
    assert.equal(quoteMethod(free, metrics([item({ unitPrice: 24999 })])).available, false);
    assert.equal(quoteMethod(free, metrics([item({ unitPrice: 25000 })])).cost, 0);
  });

  it("skips disabled methods and empty carts", () => {
    assert.equal(quoteMethod(flat("x", 10, { enabled: false }), metrics([item({})])).available, false);
    assert.equal(quoteMethod(flat("x", 10), metrics([])).available, false);
  });
});

describe("full quote", () => {
  const z: ShippingZone[] = [
    zone("dhaka", {
      locations: [{ type: "prefecture", prefecture: "Tokyo" }],
      methods: [
        flat("standard", 300),
        { id: "free", name: "Free over 20k", enabled: true, type: "free_shipping", minSubtotal: 20000 },
        { id: "pickup", name: "Pickup", enabled: true, type: "local_pickup", cost: 0 },
        flat("express", 300),
      ],
    }),
    zone("fallback", { isFallback: true }),
  ];
  const addr = { prefecture: "Tokyo", city: "Hachioji-shi" };

  it("suggests the cheapest available delivery method and never auto-picks pickup", () => {
    const q = quoteShipping(z, addr, [item({ unitPrice: 1000 })]);
    assert.equal(q.selected?.method.id, "standard"); // tie with express → listed first; pickup (0) not chosen
    assert.equal(q.options.find((o) => o.method.id === "pickup")?.available, true);
    const big = quoteShipping(z, addr, [item({ unitPrice: 20000 })]);
    assert.equal(big.selected?.method.id, "free");
    assert.equal(big.selected?.cost, 0);
  });

  it("returns no suggestion when the matched zone has no available delivery method", () => {
    const q = quoteShipping(z, { prefecture: "Okinawa", city: "Naha-shi" }, [item({})]);
    assert.equal(q.match.zone?.id, "fallback");
    assert.equal(q.selected, undefined);
    assert.match(q.explanation, /No delivery method/);
  });
});

describe("validation", () => {
  const classIds = ["ship-frozen", "ship-heavy"];

  it("rejects tiers that do not start at 0 or are not strictly increasing", () => {
    const bad: ShippingMethod = { id: "w", name: "W", enabled: true, type: "weight_tiers", classAdjustments: [], tiers: [{ from: 1000, cost: 1 }, { from: 1000, cost: 2 }, { from: 500, cost: 3 }] };
    const e = validateMethod(bad, 0, classIds);
    assert.match(e["methods.0.tiers.0.from"], /start at 0/);
    assert.match(e["methods.0.tiers.1.from"], /above the previous/);
    assert.match(e["methods.0.tiers.2.from"], /above the previous/);
    assert.ok(validateMethod({ ...bad, tiers: [] }, 0, classIds)["methods.0.tiers"]);
    assert.ok(validateMethod({ ...bad, tiers: [{ from: 0, cost: -1 }] }, 0, classIds)["methods.0.tiers.0.cost"]);
  });

  it("rejects unknown, duplicate or zero class adjustments", () => {
    const m = flat("f", 10, {
      classAdjustments: [
        { shippingClassId: "ship-frozen", amount: 50, per: "order" },
        { shippingClassId: "ship-frozen", amount: 60, per: "unit" },
        { shippingClassId: "nope", amount: 1, per: "order" },
        { shippingClassId: "ship-heavy", amount: 0, per: "order" },
      ],
    });
    const e = validateMethod(m, 2, classIds);
    assert.ok(e["methods.2.classAdjustments.1"] && e["methods.2.classAdjustments.2"] && e["methods.2.classAdjustments.3"]);
    assert.equal(e["methods.2.classAdjustments.0"], undefined);
  });

  it("allows a location in one zone only, and a broader location alongside a narrower one", () => {
    const others = [zone("a", { name: "Shinjuku Ward", locations: [{ type: "city", prefecture: "Tokyo", city: "Shinjuku-ku" }] })];
    const dup = validateZone({ name: "Zone B", locations: [{ type: "city", prefecture: "tokyo", city: " Shinjuku-ku " }], methods: [] }, { isFallback: false, others, classIds });
    assert.match(dup["locations.0"], /already in “Shinjuku Ward”/);
    const broader = validateZone({ name: "Zone B", locations: [{ type: "prefecture", prefecture: "Tokyo" }], methods: [] }, { isFallback: false, others, classIds });
    assert.deepEqual(broader, {});
    const twice = validateZone({ name: "Zone C", locations: [{ type: "postcode", postalCode: "100-0001" }, { type: "postcode", postalCode: "100-0001" }], methods: [] }, { isFallback: false, others: [], classIds });
    assert.match(twice["locations.1"], /listed twice/);
  });

  it("enforces the fallback rules and location formats", () => {
    assert.ok(validateZone({ name: "Rest", locations: [{ type: "prefecture", prefecture: "Tokyo" }], methods: [] }, { isFallback: true, others: [], classIds }).locations);
    assert.ok(validateZone({ name: "Empty", locations: [], methods: [] }, { isFallback: false, others: [], classIds }).locations);
    const e = validateZone({ name: "Zone X", locations: [{ type: "postcode", postalCode: "12" }, { type: "prefecture", prefecture: "Atlantis" }], methods: [] }, { isFallback: false, others: [], classIds });
    assert.ok(e["locations.0"] && e["locations.1"]);
  });

  it("allows only one free-shipping and one pickup method per zone", () => {
    const free: ShippingMethod = { id: "f", name: "F", enabled: true, type: "free_shipping", minSubtotal: 1 };
    assert.ok(validateZone({ name: "Zone X", locations: [{ type: "prefecture", prefecture: "Tokyo" }], methods: [free, { ...free, id: "g" }] }, { isFallback: false, others: [], classIds }).methods);
  });
});
