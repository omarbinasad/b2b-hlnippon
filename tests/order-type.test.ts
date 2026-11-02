/** First / repeat / walk-in order classification (src/lib/orders/order-type.ts). Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orderTypeResolver } from "../src/lib/orders/order-type.ts";
import type { Order } from "../src/lib/types/index.ts";

type O = Pick<Order, "customerId" | "status" | "placedAt">;
const o = (customerId: string | undefined, placedAt: string, status: Order["status"] = "delivered"): O => ({ customerId, placedAt, status });

describe("order type", () => {
  it("marks a customer's earliest order first and later ones repeat; walk-ins separately", () => {
    const a1 = o("cus-a", "2026-01-01T10:00:00+09:00");
    const a2 = o("cus-a", "2026-02-01T10:00:00+09:00");
    const b1 = o("cus-b", "2026-01-15T10:00:00+09:00");
    const walkIn = o(undefined, "2026-01-20T10:00:00+09:00");
    const typeOf = orderTypeResolver([a2, b1, a1, walkIn]);
    assert.equal(typeOf(a1), "first");
    assert.equal(typeOf(a2), "repeat");
    assert.equal(typeOf(b1), "first");
    assert.equal(typeOf(walkIn), "walk_in");
  });

  it("ignores cancelled orders when finding the first order", () => {
    const cancelled = o("cus-a", "2026-01-01T10:00:00+09:00", "cancelled");
    const real = o("cus-a", "2026-01-05T10:00:00+09:00");
    const later = o("cus-a", "2026-01-09T10:00:00+09:00", "cancelled");
    const typeOf = orderTypeResolver([cancelled, real, later]);
    assert.equal(typeOf(cancelled), "first"); // nothing valid before it
    assert.equal(typeOf(real), "first");
    assert.equal(typeOf(later), "repeat");
  });
});
