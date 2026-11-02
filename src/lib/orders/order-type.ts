/**
 * First / repeat / walk-in classification of orders (pure; shared by the orders list and the dashboard).
 * "repeat" = the customer has an earlier non-cancelled order; otherwise "first". Orders without an account are
 * "walk_in". The backend must use the same rule.
 */
import type { Order, OrderType } from "@/lib/types";

type Classifiable = Pick<Order, "customerId" | "status" | "placedAt">;

/** Returns a classifier for orders, based on every order the store has (`all`). */
export function orderTypeResolver(all: readonly Classifiable[]): (order: Classifiable) => OrderType {
  const firstAt = new Map<string, number>();
  for (const o of all) {
    if (!o.customerId || o.status === "cancelled") continue;
    const t = Date.parse(o.placedAt);
    if (!firstAt.has(o.customerId) || t < firstAt.get(o.customerId)!) firstAt.set(o.customerId, t);
  }
  return (o) => (!o.customerId ? "walk_in" : (firstAt.get(o.customerId) ?? Infinity) < Date.parse(o.placedAt) ? "repeat" : "first");
}
