"use server";

/* Coupon management. DEMO: server memory. TODO(auth): mocked permission; the backend must authorize every call. */
import { revalidatePath } from "next/cache";
import { actorWith } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { CouponInput, FieldErrors } from "@/lib/types";

export type CouponActionResult<T = { id: string }> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const denied = { ok: false as const, errors: {}, message: "You don't have permission to manage coupons (mock permission)." };
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : []);
const optNum = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) ? str(v, 10) : undefined);

export async function saveCouponAction(id: string | null, raw: unknown): Promise<CouponActionResult> {
  const by = await actorWith(id ? "coupons.edit" : "coupons.create");
  if (!by) return denied;
  const v = obj(raw);
  const input: CouponInput = {
    code: str(v.code, 40),
    description: str(v.description, 400),
    type: v.type === "fixed_cart" || v.type === "fixed_product" ? v.type : "percent",
    amount: Number(v.amount),
    minSpend: optNum(v.minSpend),
    maxSpend: optNum(v.maxSpend),
    productIds: list(v.productIds),
    categorySlugs: list(v.categorySlugs),
    excludedProductIds: list(v.excludedProductIds),
    customerIds: list(v.customerIds),
    groupIds: list(v.groupIds),
    startsOn: date(v.startsOn),
    expiresOn: date(v.expiresOn),
    usageLimit: optNum(v.usageLimit),
    usageLimitPerCustomer: optNum(v.usageLimitPerCustomer),
    enabled: v.enabled !== false,
  };
  const r = await repositories.coupons.save(id, input, by);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  revalidatePath("/admin/coupons");
  return { ok: true, value: { id: r.value.id } };
}

export async function setCouponEnabledAction(id: string, enabled: boolean): Promise<CouponActionResult> {
  const by = await actorWith("coupons.edit");
  if (!by) return denied;
  await repositories.coupons.setEnabled(String(id), enabled === true, by);
  revalidatePath("/admin/coupons");
  return { ok: true, value: { id: String(id) } };
}

export async function deleteCouponAction(id: string): Promise<CouponActionResult> {
  const by = await actorWith("coupons.delete");
  if (!by) return denied;
  await repositories.coupons.remove(String(id), by);
  revalidatePath("/admin/coupons");
  return { ok: true, value: { id: String(id) } };
}

export async function couponTargetSearchAction(kind: "product" | "customer", term: string): Promise<{ id: string; label: string }[]> {
  if (!(await actorWith("coupons.view"))) return [];
  const t = str(term, 100);
  if (kind === "product") return (await repositories.products.search(t, { limit: 10 })).map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` }));
  return (await repositories.customers.search(t, { limit: 10 })).filter((c) => c.status === "approved").map((c) => ({ id: c.id, label: c.companyName }));
}
