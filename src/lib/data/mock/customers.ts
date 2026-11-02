import type { AccountStatusEvent, Actor, Address, Customer, CustomerGroup, CustomerNotification } from "@/lib/types";
import { createRandom } from "./random";

const seedGroups: CustomerGroup[] = [
  { id: "grp-restaurant", name: "Restaurants", description: "Restaurants, hotels and commercial kitchens." },
  { id: "grp-retail", name: "Retail grocers", description: "Grocery and convenience stores." },
  { id: "grp-distributor", name: "Distributors", description: "Regional wholesale distributors." },
  { id: "grp-catering", name: "Caterers", description: "Event and institutional catering." },
];

/** Sample locations (prefecture → city/ward → street). Postcodes are illustrative only. */
export const mockLocations = [
  { prefecture: "Tokyo", city: "Shinjuku-ku", street: "1-2-3 Nishi-Shinjuku", postalCode: "160-0023", routeId: "route-tokyo" },
  { prefecture: "Tokyo", city: "Shibuya-ku", street: "2-4-1 Dogenzaka", postalCode: "150-0043", routeId: "route-tokyo" },
  { prefecture: "Tokyo", city: "Taito-ku", street: "3-5-8 Ueno", postalCode: "110-0005", routeId: "route-tokyo" },
  { prefecture: "Tokyo", city: "Minato-ku", street: "4-1-7 Shiba", postalCode: "108-0014", routeId: "route-tokyo" },
  { prefecture: "Saitama", city: "Kawaguchi-shi", street: "1-6-2 Honcho", postalCode: "332-0012", routeId: "route-tokyo" },
  { prefecture: "Kanagawa", city: "Yokohama-shi Naka-ku", street: "2-8-5 Yamashitacho", postalCode: "231-0023", routeId: "route-tokyo" },
  { prefecture: "Osaka", city: "Osaka-shi Kita-ku", street: "1-3-9 Umeda", postalCode: "530-0001", routeId: "route-kansai" },
  { prefecture: "Osaka", city: "Osaka-shi Chuo-ku", street: "2-7-4 Namba", postalCode: "542-0076", routeId: "route-kansai" },
  { prefecture: "Kyoto", city: "Kyoto-shi Shimogyo-ku", street: "5-2-1 Shiokojicho", postalCode: "600-8216", routeId: "route-kansai" },
  { prefecture: "Hyogo", city: "Kobe-shi Chuo-ku", street: "3-1-6 Sannomiyacho", postalCode: "650-0021", routeId: "route-kansai" },
  { prefecture: "Aichi", city: "Nagoya-shi Naka-ku", street: "3-4-2 Sakae", postalCode: "460-0008", routeId: "route-courier" },
  { prefecture: "Fukuoka", city: "Fukuoka-shi Hakata-ku", street: "2-1-8 Hakataekimae", postalCode: "812-0011", routeId: "route-courier" },
  { prefecture: "Hokkaido", city: "Sapporo-shi Chuo-ku", street: "4-2-3 Kita 3-jo Nishi", postalCode: "060-0003", routeId: "route-courier" },
  { prefecture: "Miyagi", city: "Sendai-shi Aoba-ku", street: "1-9-2 Chuo", postalCode: "980-0021", routeId: "route-courier" },
  { prefecture: "Hiroshima", city: "Hiroshima-shi Naka-ku", street: "2-5-6 Hondori", postalCode: "730-0035", routeId: "route-courier" },
  { prefecture: "Shizuoka", city: "Shizuoka-shi Aoi-ku", street: "1-4-3 Gofukucho", postalCode: "420-0031", routeId: "route-courier" },
  { prefecture: "Niigata", city: "Niigata-shi Chuo-ku", street: "3-2-7 Bandai", postalCode: "950-0088", routeId: "route-courier" },
  { prefecture: "Okayama", city: "Okayama-shi Kita-ku", street: "1-8-1 Omotecho", postalCode: "700-0822", routeId: "route-courier" },
] as const;

type Location = (typeof mockLocations)[number];

/** Fictional Japanese mobile numbers (090-0000-0001 …). */
const phone = (n: number) => `090-0000-${String(n).padStart(4, "0")}`;

function address(id: string, loc: Location, fields: Pick<Address, "label" | "recipientName" | "companyName" | "phone"> & Partial<Address>): Address {
  return {
    id,
    type: "shipping",
    isDefault: true,
    country: "JP",
    prefecture: loc.prefecture,
    city: loc.city,
    postalCode: loc.postalCode,
    addressLine1: `${loc.street} (sample)`,
    ...fields,
  };
}

const [shinjuku, , , , kawaguchi, , umeda, , , , nagoya, fukuoka] = mockLocations;

const DEMO_ADMIN: Actor = { id: "admin-1", name: "Demo admin", role: "admin" };
const applicant = (c: { id: string; companyName: string }): Actor => ({ id: c.id, name: c.companyName, role: "customer" });

/** Registration → decisions, as an audit trail. */
function statusTrail(c: Pick<Customer, "id" | "companyName" | "createdAt">, steps: [AccountStatusEvent["to"], string, string?][]): AccountStatusEvent[] {
  const events: AccountStatusEvent[] = [{ id: `${c.id}-s1`, to: "pending", at: c.createdAt, by: applicant(c), reason: "Applied for a trade account" }];
  for (const [to, at, reason] of steps) {
    events.push({ id: `${c.id}-s${events.length + 1}`, from: events[events.length - 1].to, to, at, by: DEMO_ADMIN, reason });
  }
  return events;
}

type Seed = Omit<Customer, "statusHistory">;
const handWrittenSeeds: Seed[] = [
  {
    id: "cus-001",
    companyName: "Sample Kitchen Shinjuku",
    contactName: "Taro Yamada",
    email: "orders@kitchen.example.com",
    phone: phone(1),
    businessType: "Restaurant",
    status: "approved",
    groupId: "grp-restaurant",
    deliveryRouteId: "route-tokyo",
    addresses: [
      address("addr-001", shinjuku, { label: "Restaurant", recipientName: "Taro Yamada", companyName: "Sample Kitchen Shinjuku", phone: phone(1) }),
      address("addr-002", kawaguchi, { label: "Central kitchen", recipientName: "Kitchen manager", companyName: "Sample Kitchen Shinjuku", phone: phone(2), isDefault: false }),
      address("addr-003", shinjuku, { type: "billing", label: "Head office", recipientName: "Accounts", companyName: "Sample Kitchen Shinjuku", phone: phone(3), addressLine2: "Sample Building 3F" }),
    ],
    createdAt: "2025-01-10T10:00:00+09:00",
    approvedAt: "2025-01-12T15:00:00+09:00",
  },
  {
    id: "cus-002",
    companyName: "Example Mart Umeda",
    contactName: "Hanako Suzuki",
    email: "buying@mart.example.com",
    phone: phone(4),
    businessType: "Grocery store",
    status: "approved",
    groupId: "grp-retail",
    deliveryRouteId: "route-kansai",
    addresses: [address("addr-004", umeda, { label: "Store", recipientName: "Hanako Suzuki", companyName: "Example Mart Umeda", phone: phone(4) })],
    createdAt: "2025-02-02T10:00:00+09:00",
    approvedAt: "2025-02-05T11:00:00+09:00",
  },
  {
    id: "cus-003",
    companyName: "Demo Kebab Corner",
    contactName: "Kenji Sato",
    email: "hello@kebab.example.com",
    phone: phone(5),
    businessType: "Restaurant",
    status: "pending",
    addresses: [address("addr-005", nagoya, { label: "Shop", recipientName: "Kenji Sato", companyName: "Demo Kebab Corner", phone: phone(5) })],
    createdAt: "2026-09-28T18:30:00+09:00",
  },
  {
    id: "cus-004",
    companyName: "Placeholder Catering Co.",
    contactName: "Yumi Takahashi",
    email: "events@catering.example.com",
    phone: phone(6),
    businessType: "Caterer",
    status: "suspended",
    groupId: "grp-catering",
    deliveryRouteId: "route-courier",
    addresses: [address("addr-006", fukuoka, { label: "Kitchen", recipientName: "Yumi Takahashi", companyName: "Placeholder Catering Co.", phone: phone(6) })],
    createdAt: "2025-03-20T10:00:00+09:00",
    approvedAt: "2025-03-22T10:00:00+09:00",
  },
];

const handWritten: Customer[] = handWrittenSeeds.map((c) => ({
  ...c,
  statusHistory:
    c.id === "cus-004"
      ? statusTrail(c, [["approved", c.approvedAt!], ["suspended", "2026-08-14T10:00:00+09:00", "Three overdue invoices — suspended until settled (sample)"]])
      : c.status === "approved"
        ? statusTrail(c, [["approved", c.approvedAt!, "Business registration checked (sample)"]])
        : statusTrail(c, []),
}));

const kinds = [
  { suffix: "Demo Restaurant", businessType: "Restaurant", groupId: "grp-restaurant" },
  { suffix: "Sample Mart", businessType: "Grocery store", groupId: "grp-retail" },
  { suffix: "Example Store", businessType: "Grocery store", groupId: "grp-retail" },
  { suffix: "Demo Distributors", businessType: "Distributor", groupId: "grp-distributor" },
  { suffix: "Sample Caterers", businessType: "Caterer", groupId: "grp-catering" },
  { suffix: "Example Hotel", businessType: "Hotel", groupId: "grp-restaurant" },
] as const;

/** Generated placeholder customers spread across prefectures (clearly fictional names). */
function generateCustomers(count: number): Customer[] {
  const rnd = createRandom(7);
  return Array.from({ length: count }, (_, i) => {
    const loc = mockLocations[i % mockLocations.length];
    const kind = kinds[(i + Math.floor(i / mockLocations.length)) % kinds.length];
    const id = `cus-${String(i + 101).padStart(3, "0")}`;
    const companyName = `${loc.city.split(/[- ]/)[0]} ${kind.suffix}`;
    const pending = i % 15 === 14;
    const rejected = i === 21;
    const created = new Date(Date.UTC(2025, rnd.int(0, 5), rnd.int(1, 28)));
    const createdAt = pending ? `2026-09-${String(20 + (i % 9)).padStart(2, "0")}T12:00:00+09:00` : `${created.toISOString().slice(0, 10)}T10:00:00+09:00`;
    const status = rejected ? "rejected" : pending ? "pending" : "approved";
    const base = {
      id,
      ...(createdAt < "2026-01-01" ? { legacyWooId: 5000 + i } : {}),
      companyName,
      contactName: `Contact ${i + 1}`,
      email: `buyer${i + 1}@customer.example.com`,
      phone: phone(100 + i),
      businessType: kind.businessType,
      status,
      groupId: status === "approved" ? kind.groupId : undefined,
      deliveryRouteId: status === "approved" ? loc.routeId : undefined,
      addresses: [address(`addr-${id}`, loc, { label: "Main", recipientName: `Contact ${i + 1}`, companyName, phone: phone(100 + i) })],
      createdAt,
      approvedAt: status === "approved" ? createdAt : undefined,
    } satisfies Seed;
    return {
      ...base,
      statusHistory:
        status === "approved"
          ? statusTrail(base, [["approved", createdAt]])
          : status === "rejected"
            ? statusTrail(base, [["rejected", createdAt, "Could not verify the business address (sample)"]])
            : statusTrail(base, []),
    } satisfies Customer;
  });
}

/*
 * DEMO STORE: customers and groups live in memory on globalThis (like the catalog
 * and orders), so admin edits survive page refreshes but not a server restart.
 * Orders reference customers by id, so ids are never reused or deleted.
 */
const store = globalThis as typeof globalThis & { __mockCustomersV3?: { customers: Customer[]; groups: CustomerGroup[] } };
store.__mockCustomersV3 ??= { customers: [...handWritten, ...generateCustomers(44)], groups: seedGroups };

export const mockCustomers = store.__mockCustomersV3.customers;
export const mockCustomerGroups = store.__mockCustomersV3.groups;

export const mockNotifications: CustomerNotification[] = [
  {
    id: "ntf-001",
    customerId: "cus-001",
    kind: "delivery",
    title: "Your order is out for delivery",
    body: "Your latest order is on the Tokyo metro route and will arrive today.",
    createdAt: "2026-09-29T16:00:00+09:00",
  },
  {
    id: "ntf-002",
    customerId: "cus-001",
    kind: "order",
    title: "Weight adjustment on ORD-10042",
    body: "Packed weight for chicken thigh differed from the ordered weight. The order total has been updated.",
    createdAt: "2026-09-29T11:20:00+09:00",
    readAt: "2026-09-29T12:00:00+09:00",
  },
  {
    id: "ntf-003",
    customerId: "cus-001",
    kind: "reminder",
    title: "Order cutoff today at 16:00",
    body: "Place your order before 16:00 for next-day delivery.",
    createdAt: "2026-09-28T09:00:00+09:00",
    readAt: "2026-09-28T09:30:00+09:00",
  },
];
