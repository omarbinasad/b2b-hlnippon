"use server";

/*
 * Shipping zone mutations and the rate preview. DEMO: kept in server memory with
 * sample rates. TODO(auth): "shipping.manage" is mocked — the backend must authorize
 * every call and repeat the shipping calculation at cart, checkout and order creation.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { ShippingQuoteResult } from "@/lib/data/repositories";
import type { ClassAdjustment, FieldErrors, RateTier, ShippingMethod, ShippingZoneInput, ZoneLocation } from "@/lib/types";

export type ZoneActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number.NaN);

function location(v: unknown): ZoneLocation {
  const l = obj(v);
  if (l.type === "postcode") return { type: "postcode", postalCode: str(l.postalCode, 10) };
  if (l.type === "city") return { type: "city", prefecture: str(l.prefecture, 50), city: str(l.city, 100) };
  return { type: "prefecture", prefecture: str(l.prefecture, 50) };
}

const tiers = (v: unknown): RateTier[] => arr(v, 30).map((x) => ({ from: num(obj(x).from), cost: num(obj(x).cost) }));
const adjustments = (v: unknown): ClassAdjustment[] =>
  arr(v, 20).map((x) => {
    const a = obj(x);
    return { shippingClassId: str(a.shippingClassId, 100), amount: num(a.amount), per: a.per === "unit" ? "unit" : "order" };
  });

function method(v: unknown): ShippingMethod {
  const m = obj(v);
  const base = { id: str(m.id, 100), name: str(m.name, 100), enabled: m.enabled !== false };
  switch (m.type) {
    case "weight_tiers":
      return { ...base, type: "weight_tiers", tiers: tiers(m.tiers), classAdjustments: adjustments(m.classAdjustments) };
    case "subtotal_tiers":
      return { ...base, type: "subtotal_tiers", tiers: tiers(m.tiers), classAdjustments: adjustments(m.classAdjustments) };
    case "free_shipping":
      return { ...base, type: "free_shipping", minSubtotal: num(m.minSubtotal) };
    case "local_pickup":
      return { ...base, type: "local_pickup", cost: num(m.cost), instructions: str(m.instructions, 300).trim() || undefined };
    default:
      return { ...base, type: "flat_rate", cost: num(m.cost), classAdjustments: adjustments(m.classAdjustments) };
  }
}

async function actor() {
  const a = await getAdminActor();
  return a.permissions.includes("shipping.manage") ? { id: a.id, name: a.name, role: a.role } : null;
}

function refresh() {
  revalidatePath("/admin/shipping", "layout");
  revalidatePath("/admin/orders/new");
}

export async function saveZoneAction(id: string | null, raw: unknown): Promise<ZoneActionResult> {
  const by = await actor();
  if (!by) return { ok: false, errors: {}, message: "You don't have permission to manage shipping (mock permissions)." };
  const v = obj(raw);
  const input: ShippingZoneInput = { name: str(v.name, 100), locations: arr(v.locations, 250).map(location), methods: arr(v.methods, 20).map(method) };
  const result = id ? await repositories.shipping.updateZone(str(id, 100), input, by) : await repositories.shipping.createZone(input, by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  refresh();
  redirect(`/admin/shipping?notice=${id ? "saved" : "created"}` as Route);
}

export async function deleteZoneAction(formData: FormData) {
  const by = await actor();
  const ok = by && (await repositories.shipping.deleteZone(String(formData.get("id") ?? ""), by)).ok;
  refresh();
  redirect(`/admin/shipping?notice=${ok ? "deleted" : "error"}` as Route);
}

/** Rate preview (DEMO calculation with sample rates). */
export async function previewShippingAction(raw: unknown): Promise<ShippingQuoteResult> {
  const v = obj(raw);
  const a = obj(v.address);
  return repositories.shipping.quote({
    address: { prefecture: str(a.prefecture, 50), city: str(a.city, 100), postalCode: str(a.postalCode, 10).trim() || undefined },
    customerId: str(v.customerId, 100) || undefined,
    couponCode: str(v.couponCode, 40) || undefined,
    customerGroupId: str(v.customerGroupId, 100) || undefined,
    grams: typeof v.grams === "number" && Number.isFinite(v.grams) ? v.grams : undefined,
    subtotal: typeof v.subtotal === "number" && Number.isFinite(v.subtotal) ? v.subtotal : undefined,
    items: arr(v.items, 100).map((x) => {
      const i = obj(x);
      return { productId: str(i.productId, 100), variationId: str(i.variationId, 100) || undefined, quantity: num(i.quantity) };
    }),
  });
}
