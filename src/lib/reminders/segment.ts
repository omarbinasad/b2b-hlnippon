/**
 * Who gets a delivery reminder. Pure and tested. The backend must apply the same rules in its scheduled job, and must also
 * prevent duplicates and honour consent at the moment of sending.
 *
 * Group A: customers in the route's area with a qualifying order for that delivery date.
 * Group B: customers in the same area without one. Everyone else gets nothing.
 */
import { isOpenOrder } from "../orders/status.ts";
import type { OrderStatus, PaymentStatus } from "../types/order.ts";

interface SegmentCustomer {
  id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  status: string;
  remindersOptOut?: boolean;
  addresses: { type: string; prefecture: string; city: string }[];
}

interface SegmentOrder {
  id: string;
  number: string;
  customerId?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  requestedDeliveryDate?: string;
  shippingAddress?: { prefecture: string; city: string };
}

export interface SegmentRecipient {
  customerId: string;
  name: string;
  email: string;
  orderNumbers: string[];
}

export interface SegmentExclusion {
  customerId: string;
  name: string;
  reason: string;
}

export interface Segments {
  withOrder: SegmentRecipient[];
  withoutOrder: SegmentRecipient[];
  excluded: SegmentExclusion[];
}

const norm = (s: string) => s.trim().toLowerCase();

export const inArea = (areas: string[], a: { prefecture: string; city: string }) => areas.some((x) => norm(x) === norm(a.prefecture) || norm(x) === norm(a.city));

/** An open order going to this area, for this date. An order with no date yet counts as well, so nobody gets "you have no order" by mistake. */
function qualifies(o: SegmentOrder, areas: string[], date: string) {
  if (!isOpenOrder(o) || !o.shippingAddress || !inArea(areas, o.shippingAddress)) return false;
  return !o.requestedDeliveryDate || o.requestedDeliveryDate.slice(0, 10) === date;
}

export function segmentRecipients(customers: SegmentCustomer[], orders: SegmentOrder[], areas: string[], date: string): Segments {
  const out: Segments = { withOrder: [], withoutOrder: [], excluded: [] };
  for (const c of customers) {
    if (c.status !== "approved") continue;
    // One reminder per customer, however many addresses they have in the area.
    if (!c.addresses.some((a) => a.type === "shipping" && inArea(areas, a))) continue;
    const name = c.companyName;
    if (c.remindersOptOut) {
      out.excluded.push({ customerId: c.id, name, reason: "Turned off reminders" });
      continue;
    }
    if (!c.email) {
      out.excluded.push({ customerId: c.id, name, reason: "No email address" });
      continue;
    }
    const mine = orders.filter((o) => o.customerId === c.id && qualifies(o, areas, date));
    (mine.length ? out.withOrder : out.withoutOrder).push({ customerId: c.id, name, email: c.email, orderNumbers: mine.map((o) => o.number) });
  }
  return out;
}
