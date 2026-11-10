import "server-only";

import { company } from "@/config/runtime";
import { evaluateCoupon, normalizeCode, validateCoupon, type CouponCartLine, type CouponResult } from "@/lib/coupons/engine";
import type { Coupon, CouponInput, CouponUsage, Customer, FieldErrors } from "@/lib/types";
import { mockCategories, mockProducts } from "./mock/catalog";
import { clone, invalid, now } from "./mock-store-helpers";
import { matches, paginate, sortBy } from "./mock-utils";
import type { CouponRepository } from "./repositories";

const AT = "2026-01-01T00:00:00+09:00";
const base = { description: undefined, productIds: [], categorySlugs: [], excludedProductIds: [], customerIds: [], groupIds: [], usedCount: 0, enabled: true, createdAt: AT, updatedAt: AT };

/* DEMO STORE: sample coupons in server memory. */
const store = globalThis as typeof globalThis & { __mockCoupons?: { coupons: Coupon[]; usage: CouponUsage[] } };
store.__mockCoupons ??= {
  coupons: [
    { ...base, id: "cpn-welcome", code: "WELCOME10", description: "Sample: 10% off a first order over ¥5,000.", type: "percent", amount: 10, minSpend: 5000, usageLimitPerCustomer: 1 },
    { ...base, id: "cpn-500", code: "SAVE500", description: "Sample: ¥500 off the cart.", type: "fixed_cart", amount: 500 },
    { ...base, id: "cpn-spices", code: "SPICE100", description: "Sample: ¥100 off each spice product.", type: "fixed_product", amount: 100, categorySlugs: ["masala-spices"] },
    { ...base, id: "cpn-old", code: "SUMMER2025", description: "Sample of an expired coupon.", type: "percent", amount: 15, expiresOn: "2025-09-30" },
  ],
  usage: [],
};
const db = store.__mockCoupons;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: company().locale.timeZone }).format(new Date());

const cleanInput = (i: CouponInput): CouponInput => ({ ...i, code: normalizeCode(i.code), description: i.description?.trim() || undefined });

/** The product's categories with their parents, for coupon category rules. */
function categorySlugsOf(productId: string) {
  const product = mockProducts.find((p) => p.id === productId);
  const slugs = new Set<string>();
  for (const id of product?.categoryIds ?? []) {
    for (let c = mockCategories.find((x) => x.id === id); c; c = c.parentId ? mockCategories.find((x) => x.id === c!.parentId) : undefined) slugs.add(c.slug);
  }
  return [...slugs];
}

export function couponLine(l: { id: string; productId: string; quantity: number; lineTotal: number }): CouponCartLine {
  return { ...l, categorySlugs: categorySlugsOf(l.productId) };
}

/** Checks a code against a cart. An unknown code gets the same reply as any other refusal. */
export function evaluateCode(code: string, customer: Customer, lines: CouponCartLine[]): CouponResult {
  const c = db.coupons.find((x) => x.code === normalizeCode(code));
  if (!c) return { ok: false, error: "That coupon code isn't valid." };
  return evaluateCoupon(c, { today: today(), customerId: customer.id, groupId: customer.groupId, lines, usedByCustomer: db.usage.filter((u) => u.couponId === c.id && u.customerId === customer.id).length });
}

export function recordCouponUse(code: string, use: Omit<CouponUsage, "id" | "couponId" | "at">) {
  const c = db.coupons.find((x) => x.code === normalizeCode(code));
  if (!c) return;
  c.usedCount += 1;
  db.usage.unshift({ ...use, id: `cu-${crypto.randomUUID().slice(0, 8)}`, couponId: c.id, at: now() });
}

export const mockCouponRepository: CouponRepository = {
  async list({ search, status, page, perPage } = {}) {
    const t = today();
    const rows = db.coupons.filter((c) => {
      const expired = Boolean(c.expiresOn && c.expiresOn < t);
      const s = !c.enabled ? "disabled" : expired ? "expired" : "active";
      return (!status || s === status) && matches(search, c.code, c.description);
    });
    return clone(paginate(sortBy(rows, (c) => c.code), page, perPage));
  },
  async getById(id) {
    const c = db.coupons.find((x) => x.id === id);
    return c ? clone(c) : null;
  },
  async usage(id, { page, perPage } = {}) {
    return clone(paginate(db.usage.filter((u) => u.couponId === id), page, perPage));
  },
  async save(id, input) {
    const errors = validateCoupon(input, (code) => db.coupons.some((c) => c.code === code && c.id !== id));
    if (Object.keys(errors).length) return invalid(errors);
    const at = now();
    const existing = id ? db.coupons.find((c) => c.id === id) : undefined;
    if (id && !existing) return { ok: false, errors: {} as FieldErrors, message: "That coupon no longer exists." };
    const next: Coupon = { ...(existing ?? { id: `cpn-${crypto.randomUUID().slice(0, 8)}`, usedCount: 0, createdAt: at }), ...cleanInput(input), updatedAt: at };
    if (existing) Object.assign(existing, next);
    else db.coupons.unshift(next);
    return { ok: true, value: clone(next) };
  },
  async setEnabled(id, enabled) {
    const c = db.coupons.find((x) => x.id === id);
    if (c) {
      c.enabled = enabled;
      c.updatedAt = now();
    }
  },
  async remove(id) {
    // Orders keep their own record of the code and amount, so past orders are unaffected.
    const i = db.coupons.findIndex((c) => c.id === id);
    if (i >= 0) db.coupons.splice(i, 1);
  },
};
