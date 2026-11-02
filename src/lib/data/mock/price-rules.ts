import type { PriceRule, QuantityLimitRule } from "@/lib/types";

/*
 * Sample B2B pricing and quantity rules (demo data). They are chosen to show:
 *  - group pricing (Restaurants: rice category 5 % off; basmati bulk tiers),
 *  - a customer-specific override (Sample Kitchen Shinjuku: fixed prices),
 *  - bulk tiers (Retail drinks), an all-customers rule, a disabled rule,
 *  - a deliberate same-priority conflict (two Retail drinks rules) for the conflict view.
 * Stored on globalThis like the catalog, orders and customers: edits survive page
 * refreshes but not a server restart.
 */
const at = (date: string) => `${date}T09:00:00+09:00`;

const seedPriceRules: PriceRule[] = [
  {
    id: "rule-001",
    name: "Restaurants — rice & grains 5% off",
    status: "active",
    audience: { type: "group", groupId: "grp-restaurant" },
    target: { type: "categories", categoryIds: ["cat-rice"] },
    tiers: [{ minQuantity: 1, adjustment: { type: "percent_off", percent: 5 } }],
    priority: 0,
    createdAt: at("2025-01-05"),
    updatedAt: at("2025-01-05"),
    legacyWooId: 801,
  },
  {
    id: "rule-002",
    name: "Retail — drinks bulk tiers",
    status: "active",
    audience: { type: "group", groupId: "grp-retail" },
    target: { type: "categories", categoryIds: ["cat-drinks"] },
    tiers: [
      { minQuantity: 5, maxQuantity: 19, adjustment: { type: "percent_off", percent: 8 } },
      { minQuantity: 20, adjustment: { type: "percent_off", percent: 12 } },
    ],
    priority: 0,
    createdAt: at("2025-01-08"),
    updatedAt: at("2025-03-01"),
    legacyWooId: 802,
  },
  {
    id: "rule-003",
    name: "Sample Kitchen — chicken thigh fixed price",
    status: "active",
    audience: { type: "customer", customerId: "cus-001" },
    target: { type: "products", productIds: ["p-005"] },
    tiers: [{ minQuantity: 1, adjustment: { type: "fixed_price", amount: 1400 } }],
    priority: 0,
    createdAt: at("2025-01-12"),
    updatedAt: at("2025-01-12"),
  },
  {
    id: "rule-004",
    name: "Sample Kitchen — basmati 20 kg contract price",
    status: "active",
    audience: { type: "customer", customerId: "cus-001" },
    target: { type: "variations", productId: "p-001", variationIds: ["p-001-20"] },
    tiers: [{ minQuantity: 1, adjustment: { type: "fixed_price", amount: 5250 } }],
    priority: 0,
    validTo: "2026-12-31T23:59:59+09:00",
    createdAt: at("2025-01-12"),
    updatedAt: at("2025-01-12"),
  },
  {
    id: "rule-005",
    name: "Distributors — flour & sugar 10+",
    status: "active",
    audience: { type: "group", groupId: "grp-distributor" },
    target: { type: "categories", categoryIds: ["cat-flour"] },
    tiers: [{ minQuantity: 10, adjustment: { type: "percent_off", percent: 4 } }],
    priority: 0,
    createdAt: at("2025-02-01"),
    updatedAt: at("2025-02-01"),
  },
  {
    id: "rule-006",
    name: "Restaurants — basmati bulk",
    status: "active",
    audience: { type: "group", groupId: "grp-restaurant" },
    target: { type: "products", productIds: ["p-001"] },
    tiers: [
      { minQuantity: 5, maxQuantity: 9, adjustment: { type: "amount_off", amount: 60 } },
      { minQuantity: 10, adjustment: { type: "amount_off", amount: 150 } },
    ],
    priority: 0,
    createdAt: at("2025-04-10"),
    updatedAt: at("2025-04-10"),
  },
  {
    id: "rule-007",
    name: "All customers — oils & ghee 20+",
    status: "active",
    audience: { type: "all" },
    target: { type: "categories", categoryIds: ["cat-oils"] },
    tiers: [{ minQuantity: 20, adjustment: { type: "percent_off", percent: 2 } }],
    priority: 0,
    createdAt: at("2025-05-01"),
    updatedAt: at("2025-05-01"),
  },
  {
    id: "rule-008",
    name: "Retail — drinks summer promo",
    status: "active",
    audience: { type: "group", groupId: "grp-retail" },
    target: { type: "categories", categoryIds: ["cat-drinks"] },
    tiers: [{ minQuantity: 10, adjustment: { type: "percent_off", percent: 10 } }],
    priority: 0,
    createdAt: at("2026-05-01"),
    updatedAt: at("2026-05-01"),
  },
  {
    id: "rule-009",
    name: "Caterers — spices (paused)",
    status: "disabled",
    audience: { type: "group", groupId: "grp-catering" },
    target: { type: "categories", categoryIds: ["cat-spices"] },
    tiers: [{ minQuantity: 1, adjustment: { type: "percent_off", percent: 6 } }],
    priority: 0,
    createdAt: at("2025-06-01"),
    updatedAt: at("2026-02-01"),
  },
];

/** Includes the min/max limits that used to be stored on individual products and variations. */
const seedQuantityRules: QuantityLimitRule[] = [
  {
    id: "qty-001",
    name: "Store-wide line maximum",
    status: "active",
    target: { type: "all" },
    maxQuantity: 500,
    priority: 0,
    createdAt: at("2025-01-01"),
    updatedAt: at("2025-01-01"),
  },
  {
    id: "qty-002",
    name: "Spices — minimum 2 per line",
    status: "active",
    target: { type: "categories", categoryIds: ["cat-spices"] },
    minQuantity: 2,
    priority: 0,
    createdAt: at("2025-01-01"),
    updatedAt: at("2025-01-01"),
  },
  {
    id: "qty-003",
    name: "Chicken thigh — max 30 packs",
    status: "active",
    target: { type: "products", productIds: ["p-005"] },
    minQuantity: 1,
    maxQuantity: 30,
    priority: 0,
    createdAt: at("2025-01-01"),
    updatedAt: at("2025-01-01"),
    legacyWooId: 905,
  },
  {
    id: "qty-004",
    name: "Basmati 20 kg — max 20 bags",
    status: "active",
    target: { type: "variations", productId: "p-001", variationIds: ["p-001-20"] },
    maxQuantity: 20,
    priority: 0,
    createdAt: at("2025-01-01"),
    updatedAt: at("2025-01-01"),
  },
  {
    id: "qty-005",
    name: "Frozen meat — minimum 2",
    status: "disabled",
    target: { type: "categories", categoryIds: ["cat-meat"] },
    minQuantity: 2,
    priority: 0,
    createdAt: at("2025-03-01"),
    updatedAt: at("2025-03-01"),
  },
];

const store = globalThis as typeof globalThis & { __mockRulesV2?: { price: PriceRule[]; quantity: QuantityLimitRule[] } };
store.__mockRulesV2 ??= { price: seedPriceRules, quantity: seedQuantityRules };

export const mockPriceRules = store.__mockRulesV2.price;
export const mockQuantityRules = store.__mockRulesV2.quantity;
