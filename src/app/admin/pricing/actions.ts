"use server";

/*
 * Pricing and quantity rule mutations. DEMO: rules live in server memory only and
 * prices are demo calculations. TODO(auth): permission is mocked;
 * the backend must authorize every call and enforce the rules at cart and checkout.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorWith } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { RuleProductOption } from "@/lib/data/repositories";
import type { FieldErrors, PriceAdjustment, PriceRuleAudience, PriceRuleInput, PriceTier, QuantityLimitRuleInput, RuleStatus, RuleTarget } from "@/lib/types";
import { siteConfig } from "@/config/site";

export type RuleActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number.NaN);
const optNum = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : num(v));
const ids = (v: unknown) => (Array.isArray(v) ? v.slice(0, 200).map((x) => str(x, 100)).filter(Boolean) : []);
const date = (v: unknown, end = false) => {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T${end ? "23:59:59" : "00:00:00"}${siteConfig.utcOffset}` : undefined;
};
const status = (v: unknown): RuleStatus => (v === "disabled" ? "disabled" : "active");

function target(v: unknown): RuleTarget {
  const t = obj(v);
  if (t.type === "categories") return { type: "categories", categoryIds: ids(t.categoryIds) };
  if (t.type === "products") return { type: "products", productIds: ids(t.productIds) };
  if (t.type === "variations") return { type: "variations", productId: str(t.productId, 100), variationIds: ids(t.variationIds) };
  return { type: "all" };
}

function audience(v: unknown): PriceRuleAudience {
  const a = obj(v);
  if (a.type === "group") return { type: "group", groupId: str(a.groupId, 100) };
  if (a.type === "customer") return { type: "customer", customerId: str(a.customerId, 100) };
  return { type: "all" };
}

function adjustment(v: unknown): PriceAdjustment {
  const a = obj(v);
  if (a.type === "fixed_price") return { type: "fixed_price", amount: num(a.amount) };
  if (a.type === "amount_off") return { type: "amount_off", amount: num(a.amount) };
  return { type: "percent_off", percent: num(a.percent) };
}

const tiers = (v: unknown): PriceTier[] =>
  (Array.isArray(v) ? v.slice(0, 20) : []).map((x) => {
    const t = obj(x);
    return { minQuantity: num(t.minQuantity), maxQuantity: optNum(t.maxQuantity), adjustment: adjustment(t.adjustment) };
  });

const denied: RuleActionResult = { ok: false, errors: {}, message: "You don't have permission to manage rules (mock permissions)." };
const failed = (r: { errors: FieldErrors; message?: string }): RuleActionResult => ({ ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." });

function refresh() {
  revalidatePath("/admin/pricing", "layout");
  revalidatePath("/shop", "layout");
}

// --- Price rules ---------------------------------------------------------------------------

export async function savePriceRuleAction(id: string | null, raw: unknown): Promise<RuleActionResult> {
  const by = await actorWith(id ? "pricing.edit" : "pricing.create");
  if (!by) return denied;
  const v = obj(raw);
  const input: PriceRuleInput = {
    name: str(v.name, 200),
    status: status(v.status),
    audience: audience(v.audience),
    target: target(v.target),
    tiers: tiers(v.tiers),
    priority: num(v.priority),
    validFrom: date(v.validFrom),
    validTo: date(v.validTo, true),
  };
  const result = id ? await repositories.pricing.updateRule(str(id, 100), input, by) : await repositories.pricing.createRule(input, by);
  if (!result.ok) return failed(result);
  refresh();
  redirect(`/admin/pricing?notice=${id ? "saved" : "created"}` as Route);
}

/** List toggle (form action). */
export async function togglePriceRuleAction(formData: FormData) {
  const by = await actorWith("pricing.edit");
  const returnTo = String(formData.get("returnTo") ?? "");
  const back = returnTo.startsWith("/admin/pricing") && !returnTo.startsWith("//") ? returnTo : "/admin/pricing";
  const ok = by && (await repositories.pricing.setRuleStatus(String(formData.get("id") ?? ""), status(formData.get("status")), by)).ok;
  refresh();
  redirect(`${back}${back.includes("?") ? "&" : "?"}notice=${ok ? "saved" : "error"}` as Route);
}

export async function productOptionAction(productId: string): Promise<RuleProductOption | null> {
  return repositories.pricing.productOption(str(productId, 100));
}

// --- Quantity rules --------------------------------------------------------------------------

export async function saveQuantityRuleAction(id: string | null, raw: unknown): Promise<RuleActionResult> {
  const by = await actorWith(id ? "pricing.edit" : "pricing.create");
  if (!by) return denied;
  const v = obj(raw);
  const input: QuantityLimitRuleInput = {
    name: str(v.name, 200),
    status: status(v.status),
    target: target(v.target),
    minQuantity: optNum(v.minQuantity),
    maxQuantity: optNum(v.maxQuantity),
    priority: num(v.priority),
  };
  const result = id ? await repositories.quantityRules.update(str(id, 100), input, by) : await repositories.quantityRules.create(input, by);
  if (!result.ok) return failed(result);
  refresh();
  redirect(`/admin/pricing/quantity?notice=${id ? "saved" : "created"}` as Route);
}

export async function toggleQuantityRuleAction(formData: FormData) {
  const by = await actorWith("pricing.edit");
  const returnTo = String(formData.get("returnTo") ?? "");
  const back = returnTo.startsWith("/admin/pricing/quantity") && !returnTo.startsWith("//") ? returnTo : "/admin/pricing/quantity";
  const ok = by && (await repositories.quantityRules.setStatus(String(formData.get("id") ?? ""), status(formData.get("status")), by)).ok;
  refresh();
  redirect(`${back}${back.includes("?") ? "&" : "?"}notice=${ok ? "saved" : "error"}` as Route);
}

/** Any customer (all statuses), for the test panel — shows why unapproved customers get no rule prices. */
export async function searchRuleCustomersAction(term: string) {
  return repositories.customers.search(str(term, 100), { limit: 10 });
}
