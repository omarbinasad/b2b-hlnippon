import { siteConfig } from "@/config/site";
import { previewAdjustment, toGrams } from "@/lib/orders/calc";
import { recalculate, totalsInput } from "@/lib/orders/assemble";
import type {
  Actor,
  Address,
  Customer,
  Order,
  OrderAdjustment,
  OrderItem,
  OrderItemPricing,
  OrderNote,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Refund,
  StatusEvent,
  Weight,
} from "@/lib/types";
import { mockProducts } from "./catalog";
import { mockCustomers } from "./customers";
import { mockDeliveryRoutes } from "./pricing-delivery";
import { mockTaxRates, quotePrice } from "./pricing-rules";
import { createRandom } from "./random";

/*
 * Mock orders in the new shape. Generated deterministically, then kept on
 * globalThis so admin edits (create, status, notes, adjustments) survive page
 * refreshes until the server restarts.
 */

export const SYSTEM: Actor = { id: "system", name: "Store system", role: "system" };
export const DEMO_ADMIN: Actor = { id: "admin-1", name: "Demo admin", role: "admin" };
const WAREHOUSE: Actor = { id: "staff-2", name: "Warehouse (demo)", role: "admin" };

const HOUR = 3_600_000;
const DAY_MS = 86_400_000;
/** "YYYY-MM-DDTHH:mm:ss+09:00" for a UTC timestamp (store time zone is UTC+6). */
/** Store-local (Asia/Tokyo, UTC+9) ISO string. */
const tokyoIso = (ms: number) => `${new Date(ms + 9 * HOUR).toISOString().slice(0, 19)}+09:00`;

const productById = new Map(mockProducts.map((p) => [p.id, p]));
const customerById = new Map(mockCustomers.map((c) => [c.id, c]));
const customerActor = (c: Customer): Actor => ({ id: c.id, name: c.contactName ?? c.companyName, role: "customer" });
const billingOf = (c: Customer): Address => c.addresses.find((a) => a.type === "billing") ?? c.addresses[0];
const shippingOf = (c: Customer): Address => c.addresses.find((a) => a.type === "shipping" && a.isDefault) ?? c.addresses[0];
const scaleWeight = (w: Weight, factor: number): Weight => ({ value: Math.round(w.value * factor * 100) / 100, unit: w.unit });

/** Snapshot of a catalog product/variation as an order line. */
export function snapshotItem(id: string, productId: string, variationId: string | undefined, quantity: number, unitPrice: number): OrderItem {
  // Live catalog (not the startup map), so products created in the admin can be added to orders.
  const product = mockProducts.find((p) => p.id === productId)!;
  const variation = product.variations.find((v) => v.id === variationId);
  const weight = variation?.weight ?? product.weight;
  return {
    id,
    productId,
    variationId: variation?.id,
    name: product.name,
    sku: variation?.sku ?? product.sku,
    attributes: variation ? { ...variation.attributes } : undefined,
    unitLabel: product.unitLabel,
    taxClass: variation?.taxClass ?? product.taxClass,
    pricedByWeight: product.isVariableWeight,
    taxable: product.taxStatus === "taxable",
    quantity,
    catalogUnitPrice: variation?.basePrice ?? product.basePrice ?? unitPrice,
    unitPrice,
    discount: 0,
    orderedWeight: scaleWeight(weight, quantity),
    lineSubtotal: 0,
    lineTotal: 0,
  };
}

/** Order-item record of which rule priced the line (kept even if the rule changes later). */
export function pricingSnapshot(r: NonNullable<ReturnType<typeof quotePrice>>, agreedUnitPrice: number): OrderItemPricing {
  return {
    basePrice: r.basePrice,
    salePrice: r.salePrice,
    rulePrice: r.rulePrice,
    ruleUnitPrice: r.unitPrice,
    source: r.priceSource,
    ruleId: r.rule?.id,
    ruleName: r.rule?.name,
    tier: r.tier && { minQuantity: r.tier.minQuantity, maxQuantity: r.tier.maxQuantity },
    manualOverride: agreedUnitPrice !== r.unitPrice,
  };
}

function history(placedMs: number, status: OrderStatus, customer: Customer, cancelReason: string): StatusEvent[] {
  const events: StatusEvent[] = [{ id: "e1", status: "received", at: tokyoIso(placedMs), by: customerActor(customer) }];
  if (status === "cancelled") {
    events.push({ id: "e2", status: "cancelled", at: tokyoIso(placedMs + 3 * HOUR), by: DEMO_ADMIN, note: cancelReason });
    return events;
  }
  const steps: [OrderStatus, number, Actor][] = [
    ["preparing", 2 * HOUR, WAREHOUSE],
    ["on_the_way", DAY_MS, WAREHOUSE],
    ["delivered", 2 * DAY_MS, SYSTEM],
  ];
  for (const [s, offset, by] of steps) {
    events.push({ id: `e${events.length + 1}`, status: s, at: tokyoIso(placedMs + offset), by });
    if (s === status) break;
  }
  return events;
}

/** Hand-written order with a weight adjustment, referenced in docs/backend-api.md. */
function showcaseOrder(): Order {
  const customer = customerById.get("cus-001")!;
  const placed = Date.parse("2026-09-28T07:40:00Z");
  const chicken = { ...snapshotItem("oi-2", "p-005", undefined, 5, 1400), fulfilledWeight: { value: 10.4, unit: "kg" } as Weight };
  const items = [snapshotItem("oi-1", "p-001", "p-001-20", 2, 5250), chicken, snapshotItem("oi-3", "p-011", undefined, 2, 980)];
  const base = {
    id: "ord-10042",
    number: "ORD-10042",
    customerId: customer.id,
    customerName: customer.companyName,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    status: "on_the_way" as const,
    statusHistory: history(placed, "on_the_way", customer, ""),
    paymentStatus: "invoiced" as const,
    payment: { method: "invoice" as const },
    items,
    billingAddress: billingOf(customer),
    shippingAddress: shippingOf(customer),
    shipping: { label: "Tokyo metro route", amount: 0, taxClass: "standard" as const, deliveryRouteId: "route-tokyo" },
    refunds: [],
    notes: [
      { id: "n1", type: "customer" as const, body: "Your chicken order was packed at 10.4 kg (10 kg ordered); the total was adjusted.", at: tokyoIso(placed + 5 * HOUR), by: WAREHOUSE },
      { id: "n2", type: "admin" as const, body: "Regular Tuesday customer — deliver before lunch service.", at: tokyoIso(placed + HOUR), by: DEMO_ADMIN },
    ],
    customerNote: "Please use the back entrance.",
    requestedDeliveryDate: "2026-10-01T00:00:00+09:00",
    createdVia: "storefront" as const,
    placedAt: tokyoIso(placed),
    updatedAt: tokyoIso(placed + 5 * HOUR),
  };
  const preview = previewAdjustment(
    totalsInput({ ...base, items: items.map((i, idx) => (idx === 1 ? { ...i, fulfilledWeight: undefined } : i)) }),
    1,
    { fulfilledWeight: chicken.fulfilledWeight },
    mockTaxRates,
  );
  const adjustment: OrderAdjustment = {
    id: "adj-1",
    kind: "adjust",
    orderItemId: "oi-2",
    itemName: chicken.name,
    reason: "Packed weight 10.4 kg vs 10 kg ordered",
    at: tokyoIso(placed + 5 * HOUR),
    by: WAREHOUSE,
    before: { unitPrice: 1400, lineTotal: preview.lineBefore.total, orderTotal: preview.totalBefore },
    after: { unitPrice: 1400, fulfilledWeight: chicken.fulfilledWeight, lineTotal: preview.lineAfter.total, orderTotal: preview.totalAfter },
  };
  return recalculate({ ...base, adjustments: [adjustment] }, mockTaxRates);
}

// ---------------------------------------------------------------------------
// Generated history: deterministic orders from GENERATION_START up to today.
// ---------------------------------------------------------------------------

const GENERATION_START = "2025-01-01";
/** Orders before this date are treated as migrated from the old store (they get legacy IDs). */
const MIGRATION_CUTOFF = "2026-01-01";

const todayInStore = () => new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timeZone }).format(new Date());

/** Popularity weight per product id. */
const popularity: Record<string, number> = {
  "p-001": 9, "p-002": 10, "p-003": 9, "p-004": 6, "p-005": 7, "p-006": 1, "p-007": 4, "p-008": 8, "p-009": 7,
  "p-010": 5, "p-011": 4, "p-012": 4, "p-013": 5, "p-014": 6, "p-015": 3, "p-016": 3, "p-017": 2, "p-018": 3,
};
const productIds = Object.keys(popularity);
const productWeights = productIds.map((id) => popularity[id]);
const METHODS: PaymentMethod[] = ["invoice", "cash_on_delivery", "bank_transfer", "mobile_wallet"];
const CANCEL_REASONS = ["Customer changed the order", "Item out of stock", "Duplicate order", "Delivery address not reachable"];
const CUSTOMER_NOTES = ["Please call on arrival.", "Deliver before 11:00.", "Leave with the store manager."];

function statusFor(ageDays: number, roll: number): { status: OrderStatus; paymentStatus: PaymentStatus } {
  if (roll < 0.05) return { status: "cancelled", paymentStatus: ageDays > 3 && roll < 0.025 ? "refunded" : "unpaid" };
  if (ageDays > 6) return { status: "delivered", paymentStatus: ageDays > 20 || roll > 0.6 ? "paid" : "invoiced" };
  if (ageDays > 2) return { status: roll > 0.5 ? "delivered" : "on_the_way", paymentStatus: "invoiced" };
  if (ageDays > 0) return { status: roll > 0.5 ? "on_the_way" : "preparing", paymentStatus: "unpaid" };
  return { status: roll > 0.4 ? "received" : "preparing", paymentStatus: "unpaid" };
}

function generateOrders(): Order[] {
  const rnd = createRandom(2024);
  const today = todayInStore();
  const start = Date.parse(`${GENERATION_START}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  const totalDays = Math.round((end - start) / DAY_MS);
  const orders: Order[] = [];
  // Skewed per-customer activity: a few frequent buyers, many occasional ones.
  const activity = new Map(mockCustomers.map((c) => [c.id, c.id === "cus-001" || c.id === "cus-002" ? 4 : 0.15 + rnd.next() ** 2 * 3]));
  let seq = 20001;

  for (let d = 0; d <= totalDays; d++) {
    const dayMs = start + d * DAY_MS;
    const date = new Date(dayMs).toISOString().slice(0, 10);
    const weekday = new Date(dayMs).getUTCDay(); // 0 = Sunday, 6 = Saturday
    const ageDays = totalDays - d;

    const buyers: Customer[] = mockCustomers.filter(
      (c) => c.status === "approved" && c.createdAt.slice(0, 10) <= date && c.addresses.length > 0,
    );
    if (buyers.length === 0) continue;
    const buyerWeights = buyers.map((c) => activity.get(c.id) ?? 1);

    const growth = 1 + (d / Math.max(totalDays, 1)) * 0.45;
    const season = 1 + 0.18 * Math.sin((d / 30.4) * Math.PI * 2);
    // Fewer business orders at the weekend (Sunday quietest).
    const weekly = weekday === 0 ? 0.35 : weekday === 6 ? 0.85 : 1;
    const count = Math.max(0, Math.round(8 * growth * season * weekly + rnd.int(-1, 1)));

    // Sorted times keep order numbers in chronological order within a day.
    const times = Array.from({ length: count }, () => rnd.int(8 * 60, 20 * 60 + 59)).sort((a, b) => a - b);
    for (let n = 0; n < count; n++) {
      const customer = rnd.weighted(buyers, buyerWeights);
      const lineCount = rnd.weighted([1, 2, 3, 4], [3, 4, 2, 1]);
      const chosen = new Set<string>();
      while (chosen.size < lineCount) chosen.add(rnd.weighted(productIds, productWeights));
      // Local time → UTC (store is UTC+9).
      const placedMs = dayMs + times[n] * 60_000 - 9 * HOUR;
      if (placedMs > Date.now() - 3 * HOUR) break; // no orders later today than now (history steps need ~2 h)
      const id = `ord-${seq}`;

      const items = [...chosen].map((productId, i) => {
        const product = productById.get(productId)!;
        const variation = product.variations.length ? rnd.pick(product.variations) : undefined;
        const rule = variation?.quantityRule ?? product.quantityRule;
        const quantity = rule.min + rule.step * rnd.weighted([0, 1, 2, 3], [5, 3, 2, 1]);
        const price = quotePrice(product, customer, variation?.id, quantity, new Date(placedMs))!;
        const item = snapshotItem(`${id}-${i + 1}`, productId, variation?.id, quantity, price.unitPrice);
        item.pricing = pricingSnapshot(price, price.unitPrice);
        // Occasional negotiated line discount (whole yen).
        if (rnd.next() < 0.06) item.discount = Math.round(item.unitPrice * item.quantity * 0.03);
        return item;
      });

      const { status, paymentStatus } = statusFor(ageDays, rnd.next());
      const route = mockDeliveryRoutes.find((r) => r.id === customer.deliveryRouteId);
      const roughSubtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const shippingAmount = !route || (route.freeShippingThreshold && roughSubtotal >= route.freeShippingThreshold) ? 0 : route.shippingFee;
      const method = rnd.weighted(METHODS, [5, 3, 2, 2]);

      let order: Order = recalculate(
        {
          id,
          number: `ORD-${seq}`,
          legacyWooId: date < MIGRATION_CUTOFF ? 100_000 + seq : undefined,
          customerId: customer.id,
          customerName: customer.companyName,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          status,
          statusHistory: history(placedMs, status, customer, rnd.pick(CANCEL_REASONS)),
          paymentStatus,
          payment: {
            method,
            reference: paymentStatus === "paid" && method !== "cash_on_delivery" && method !== "invoice" ? `TRX-${seq}` : undefined,
            paidAt: paymentStatus === "paid" ? tokyoIso(placedMs + 3 * DAY_MS) : undefined,
          },
          items,
          billingAddress: billingOf(customer),
          shippingAddress: shippingOf(customer),
          shipping: { label: route ? `${route.name} route` : "Courier", amount: shippingAmount, taxClass: "standard", deliveryRouteId: route?.id },
          refunds: [],
          notes: [] as OrderNote[],
          adjustments: [],
          customerNote: rnd.next() < 0.1 ? rnd.pick(CUSTOMER_NOTES) : undefined,
          createdVia: "storefront",
          placedAt: tokyoIso(placedMs),
          updatedAt: tokyoIso(placedMs),
        },
        mockTaxRates,
      );

      // Packed weight for weight-priced lines once the order has been prepared.
      const idx = order.items.findIndex((i) => i.pricedByWeight);
      if (idx >= 0 && status !== "received" && status !== "cancelled" && rnd.next() < 0.7) {
        const item = order.items[idx];
        const fulfilledWeight = scaleWeight(item.orderedWeight, 0.97 + rnd.next() * 0.08);
        if (toGrams(fulfilledWeight) !== toGrams(item.orderedWeight)) {
          const p = previewAdjustment(totalsInput(order), idx, { fulfilledWeight }, mockTaxRates);
          const adjustment: OrderAdjustment = {
            id: `${id}-adj1`,
            kind: "adjust",
            orderItemId: item.id,
            itemName: item.name,
            reason: "Packed weight differs from ordered weight",
            at: tokyoIso(placedMs + 2 * HOUR),
            by: WAREHOUSE,
            before: { unitPrice: item.unitPrice, lineTotal: p.lineBefore.total, orderTotal: p.totalBefore },
            after: { unitPrice: item.unitPrice, fulfilledWeight, lineTotal: p.lineAfter.total, orderTotal: p.totalAfter },
          };
          order = recalculate({ ...order, items: order.items.map((it, j) => (j === idx ? { ...it, fulfilledWeight } : it)), adjustments: [adjustment] }, mockTaxRates);
        }
      }

      if (paymentStatus === "refunded") {
        const refund: Refund = { id: `${id}-r1`, amount: order.totals.total, reason: "Order cancelled after payment", at: tokyoIso(placedMs + 4 * HOUR), by: DEMO_ADMIN, status: "processed" };
        order = recalculate({ ...order, refunds: [refund] }, mockTaxRates);
      }
      orders.push(order);
      seq++;
    }
  }
  return orders;
}

const store = globalThis as typeof globalThis & { __mockOrdersV4?: Order[] };
store.__mockOrdersV4 ??= [showcaseOrder(), ...generateOrders()];

export const mockOrders = store.__mockOrdersV4;
