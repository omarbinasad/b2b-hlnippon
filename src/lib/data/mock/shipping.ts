import type { ShippingZone } from "@/lib/types";

/*
 * DEMO store settings and SAMPLE shipping zones/rates. The amounts are illustrative only —
 * not real courier prices. Stored on globalThis like the other demo stores: edits survive
 * page refreshes but are lost when the server restarts.
 */
const at = "2026-01-05T09:00:00+09:00";

/** Tokyo's special wards used by the sample "Tokyo 23 wards" zone (a subset is enough for the demo). */
const TOKYO_WARDS = ["Chiyoda-ku", "Chuo-ku", "Minato-ku", "Shinjuku-ku", "Shibuya-ku", "Taito-ku", "Sumida-ku", "Koto-ku", "Shinagawa-ku", "Toshima-ku"];

const seedZones: ShippingZone[] = [
  {
    id: "zone-shinjuku-hub",
    name: "Shinjuku hub (postcode zone)",
    locations: [{ type: "postcode", postalCode: "160-0023" }],
    isFallback: false,
    methods: [
      { id: "m-hub-flat", name: "Hub delivery", enabled: true, type: "flat_rate", cost: 130, classAdjustments: [{ shippingClassId: "ship-frozen", amount: 190, per: "order" }] },
      { id: "m-hub-pickup", name: "Collect from the Shinjuku hub", enabled: true, type: "local_pickup", cost: 0, instructions: "Sample hub address — collection Mon–Sat 10:00–17:00." },
    ],
    createdAt: at,
    updatedAt: at,
  },
  {
    id: "zone-tokyo-23",
    name: "Tokyo 23 wards",
    locations: TOKYO_WARDS.map((city) => ({ type: "city" as const, prefecture: "Tokyo", city })),
    isFallback: false,
    methods: [
      {
        id: "m-tokyo-flat",
        name: "Standard delivery",
        enabled: true,
        type: "flat_rate",
        cost: 190,
        classAdjustments: [
          { shippingClassId: "ship-frozen", amount: 250, per: "order" },
          { shippingClassId: "ship-heavy", amount: 30, per: "unit" },
        ],
      },
      { id: "m-tokyo-free", name: "Free delivery over ¥18,750", enabled: true, type: "free_shipping", minSubtotal: 18750 },
      { id: "m-tokyo-pickup", name: "Collect from the warehouse", enabled: true, type: "local_pickup", cost: 0, instructions: "Warehouse counter, Mon–Fri 9:00–18:00 (sample)." },
    ],
    createdAt: at,
    updatedAt: at,
    legacyWooId: 3,
  },
  {
    id: "zone-kanto",
    name: "Kanto (outside the 23 wards)",
    locations: ["Tokyo", "Saitama", "Kanagawa", "Chiba"].map((prefecture) => ({ type: "prefecture" as const, prefecture })),
    isFallback: false,
    methods: [
      {
        id: "m-kanto-weight",
        name: "Delivery by weight",
        enabled: true,
        type: "weight_tiers",
        tiers: [
          { from: 0, cost: 310 },
          { from: 50_000, cost: 560 },
          { from: 200_000, cost: 1000 },
        ],
        classAdjustments: [{ shippingClassId: "ship-frozen", amount: 380, per: "order" }],
      },
      { id: "m-kanto-free", name: "Free delivery over ¥31,250", enabled: true, type: "free_shipping", minSubtotal: 31250 },
    ],
    createdAt: at,
    updatedAt: at,
  },
  {
    id: "zone-kansai",
    name: "Kansai",
    locations: ["Osaka", "Kyoto", "Hyogo", "Nara"].map((prefecture) => ({ type: "prefecture" as const, prefecture })),
    isFallback: false,
    methods: [
      {
        id: "m-kansai-subtotal",
        name: "Delivery by order value",
        enabled: true,
        type: "subtotal_tiers",
        tiers: [
          { from: 0, cost: 750 },
          { from: 12500, cost: 440 },
          { from: 37500, cost: 0 },
        ],
        classAdjustments: [{ shippingClassId: "ship-frozen", amount: 500, per: "order" }],
      },
    ],
    createdAt: at,
    updatedAt: at,
    legacyWooId: 4,
  },
  {
    id: "zone-fallback",
    name: "Rest of Japan",
    locations: [],
    isFallback: true,
    methods: [
      {
        id: "m-rest-weight",
        name: "Courier by weight",
        enabled: true,
        type: "weight_tiers",
        tiers: [
          { from: 0, cost: 500 },
          { from: 20_000, cost: 880 },
          { from: 100_000, cost: 1880 },
        ],
        classAdjustments: [
          { shippingClassId: "ship-frozen", amount: 750, per: "order" },
          { shippingClassId: "ship-heavy", amount: 60, per: "unit" },
        ],
      },
    ],
    createdAt: at,
    updatedAt: at,
  },
];

const store = globalThis as typeof globalThis & { __mockShippingV2?: { zones: ShippingZone[] } };
store.__mockShippingV2 ??= { zones: seedZones };

export const mockShipping = store.__mockShippingV2;
