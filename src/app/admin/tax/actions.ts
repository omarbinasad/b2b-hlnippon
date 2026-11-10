"use server";

/*
 * Tax settings, rates and preview. DEMO: kept in server memory with FICTIONAL rates.
 * TODO(auth): "taxes.manage" is mocked — the backend must authorize every call and
 * perform the authoritative tax calculation.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { TaxPreviewResult } from "@/lib/data/repositories";
import type { FieldErrors, TaxClass, TaxLocation, TaxRateInput } from "@/lib/types";
import { storeCountry } from "@/lib/locations";

export type TaxActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number.NaN);
const cls = (v: unknown) => str(v, 40) as TaxClass;

async function actor() {
  const a = await getAdminActor();
  return a.permissions.includes("taxes.manage") ? { id: a.id, name: a.name, role: a.role } : null;
}
const denied: TaxActionResult = { ok: false, errors: {}, message: "You don't have permission to manage tax (mock permissions)." };

function refresh() {
  revalidatePath("/admin/tax", "layout");
  revalidatePath("/admin/orders/new");
}

export async function updateTaxSettingsAction(raw: unknown): Promise<TaxActionResult> {
  const by = await actor();
  if (!by) return denied;
  const v = obj(raw);
  const result = await repositories.tax.updateSettings(
    { enabled: v.enabled === true, pricesIncludeTax: v.pricesIncludeTax === true, shippingTaxable: v.shippingTaxable === true, shippingTaxClass: cls(v.shippingTaxClass) },
    by,
  );
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  refresh();
  return { ok: true };
}

function location(v: unknown): TaxLocation {
  const l = obj(v);
  if (l.type === "postcode") return { type: "postcode", postalCode: str(l.postalCode, 10) };
  if (l.type === "city") return { type: "city", prefecture: str(l.prefecture, 50), city: str(l.city, 100) };
  if (l.type === "prefecture") return { type: "prefecture", prefecture: str(l.prefecture, 50) };
  return { type: "country", country: storeCountry() };
}

export async function saveTaxRateAction(id: string | null, raw: unknown): Promise<TaxActionResult> {
  const by = await actor();
  if (!by) return denied;
  const v = obj(raw);
  const input: TaxRateInput = { name: str(v.name, 100), percent: num(v.percent), taxClass: cls(v.taxClass), location: location(v.location), enabled: v.enabled !== false };
  const result = id ? await repositories.tax.updateRate(str(id, 100), input, by) : await repositories.tax.createRate(input, by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  refresh();
  redirect(`/admin/tax?notice=${id ? "saved" : "created"}` as Route);
}

export async function deleteTaxRateAction(formData: FormData) {
  const by = await actor();
  const ok = by && (await repositories.tax.deleteRate(String(formData.get("id") ?? ""), by)).ok;
  refresh();
  redirect(`/admin/tax?notice=${ok ? "deleted" : "error"}` as Route);
}

/** Tax preview (DEMO calculation with fictional rates). */
export async function previewTaxAction(raw: unknown): Promise<TaxPreviewResult> {
  const v = obj(raw);
  const a = obj(v.address);
  const amount = num(v.shippingAmount);
  // Store pickup (walk-in orders): taxed at the store's own location.
  const store = v.pickup === true ? (await repositories.settings.getStore()).address : undefined;
  return repositories.tax.preview({
    address: store
      ? { prefecture: store.prefecture, city: store.city, postalCode: store.postalCode }
      : { prefecture: str(a.prefecture, 50), city: str(a.city, 100), postalCode: str(a.postalCode, 10).trim() || undefined },
    customerId: str(v.customerId, 100) || undefined,
    shippingMethodId: str(v.shippingMethodId, 100) || "auto",
    shippingAmount: Number.isFinite(amount) ? amount : undefined,
    lines: (Array.isArray(v.lines) ? v.lines.slice(0, 100) : []).map((x) => {
      const l = obj(x);
      const price = num(l.unitPrice);
      const discount = num(l.discount);
      return {
        productId: str(l.productId, 100),
        variationId: str(l.variationId, 100) || undefined,
        quantity: num(l.quantity),
        unitPrice: Number.isFinite(price) ? price : undefined,
        discount: Number.isFinite(discount) ? discount : undefined,
      };
    }),
  });
}
