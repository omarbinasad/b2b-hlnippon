"use server";

/* Shipping rules, classes, pickup points and settings. DEMO: server memory. TODO(auth): mocked permission. */
import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { ConditionField, ConditionOp, RuleAction, RuleCondition, ShippingGeneralSettings, ShippingRuleInput } from "@/lib/shipping/rules";
import type { FieldErrors, PickupLocationInput, ShippingZoneInput } from "@/lib/types";

export type ShippingActionResult<T = { id: string }> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const denied = { ok: false as const, errors: {}, message: "You don't have permission to manage shipping (mock permission)." };
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const arr = (v: unknown, max = 50): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

async function actor() {
  const a = await getAdminActor();
  return a.permissions.includes("shipping.manage") ? { id: a.id, name: a.name, role: a.role } : null;
}
const refresh = () => revalidatePath("/admin/shipping", "layout");

function done<T extends { id: string }>(r: { ok: true; value: T } | { ok: false; errors: FieldErrors; message?: string }): ShippingActionResult {
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  refresh();
  return { ok: true, value: { id: r.value.id } };
}

const FIELDS: ConditionField[] = ["subtotal", "weight", "quantity", "region", "city", "postcode", "category", "shipping_class", "product", "customer_group", "coupon"];
const OPS: ConditionOp[] = ["lt", "lte", "gt", "gte", "in", "not_in"];

function condition(raw: unknown): RuleCondition {
  const c = obj(raw);
  const field = FIELDS.find((f) => f === c.field) ?? "subtotal";
  const op = OPS.find((o) => o === c.op) ?? "in";
  return { field, op, value: Array.isArray(c.value) ? c.value.filter((x): x is string => typeof x === "string").slice(0, 100).map((x) => x.slice(0, 100)) : Number(c.value) };
}

function action(raw: unknown): RuleAction {
  const a = obj(raw);
  switch (a.type) {
    case "free": return { type: "free" };
    case "surcharge": return { type: "surcharge", amount: Number(a.amount), label: str(a.label, 80) || undefined };
    case "tiers": return { type: "tiers", basis: a.basis === "subtotal" ? "subtotal" : "weight", tiers: arr(a.tiers, 20).map((t) => ({ from: Number(obj(t).from), cost: Number(obj(t).cost) })) };
    case "hide_method": return { type: "hide_method", methodType: a.methodType === "free_shipping" || a.methodType === "local_pickup" || a.methodType === "weight_tiers" || a.methodType === "subtotal_tiers" ? a.methodType : "flat_rate" };
    default: return { type: "set_charge", amount: Number(a.amount) };
  }
}

export async function saveRuleAction(id: string | null, raw: unknown): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  const v = obj(raw);
  const input: ShippingRuleInput = {
    name: str(v.name, 100),
    enabled: v.enabled !== false,
    priority: Number(v.priority),
    match: v.match === "any" ? "any" : "all",
    conditions: arr(v.conditions, 20).map(condition),
    action: action(v.action),
    zoneIds: arr(v.zoneIds, 200).filter((x): x is string => typeof x === "string"),
  };
  return done(await repositories.shipping.saveRule(id, input, by));
}

export async function deleteRuleAction(id: string): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  await repositories.shipping.deleteRule(String(id), by);
  refresh();
  return { ok: true, value: { id: String(id) } };
}

export async function saveClassAction(id: string | null, raw: unknown): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  const v = obj(raw);
  const surcharge = v.surcharge === "" || v.surcharge === undefined ? undefined : Number(v.surcharge);
  return done(await repositories.shipping.saveClass(id, { name: str(v.name, 60), description: str(v.description, 200) || undefined, surcharge, surchargePer: v.surchargePer === "unit" ? "unit" : "order" }, by));
}

export async function deleteClassAction(id: string): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  return done(await repositories.shipping.deleteClass(String(id), by));
}

export async function savePickupAction(id: string | null, raw: unknown): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  const v = obj(raw);
  const input: PickupLocationInput = { name: str(v.name, 100), address: str(v.address, 300), hours: str(v.hours, 120) || undefined, instructions: str(v.instructions, 300) || undefined, fee: Number(v.fee ?? 0), enabled: v.enabled !== false };
  return done(await repositories.shipping.savePickup(id, input, by));
}

export async function deletePickupAction(id: string): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  await repositories.shipping.deletePickup(String(id), by);
  refresh();
  return { ok: true, value: { id: String(id) } };
}

export async function saveGeneralAction(raw: unknown): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  const v = obj(raw);
  const input: ShippingGeneralSettings = { hidePaidWhenFree: v.hidePaidWhenFree === true, unavailableMessage: str(v.unavailableMessage, 300) };
  await repositories.shipping.updateGeneral(input, by);
  refresh();
  return { ok: true, value: { id: "general" } };
}

export async function setMethodEnabledAction(zoneId: string, methodId: string, enabled: boolean): Promise<ShippingActionResult> {
  const by = await actor();
  if (!by) return denied;
  return done(await repositories.shipping.setMethodEnabled(String(zoneId), String(methodId), enabled === true, by));
}

/** Tests a zone that hasn't been saved yet, for the guided setup. */
export async function testDraftZoneAction(zone: ShippingZoneInput, raw: unknown) {
  if (!(await actor())) return null;
  const v = obj(raw);
  const a = obj(v.address);
  return repositories.shipping.testDraftZone(zone, { address: { prefecture: str(a.prefecture, 60), city: str(a.city, 100), postalCode: str(a.postalCode, 12) || undefined }, grams: Number(v.grams) || 0, subtotal: Number(v.subtotal) || 0 });
}
