/**
 * Conditional shipping rules, applied after a zone's methods are quoted (src/lib/shipping/engine.ts). Pure and tested;
 * the backend must match this at cart, checkout and order creation.
 *
 * Order: rules run by priority (lowest number first). The first matching "set charge", "rate tiers" or "free" rule fixes
 * the base charge; later ones are skipped. Every matching surcharge adds on top, and class surcharges after that.
 * Free means free: surcharges don't apply to it. "Hide method" removes a method type. Local pickup keeps its own charge.
 */
import { amountRule, fromMinor, isValidAmount, toMinor } from "../orders/calc.ts";
import type { RateTier, ShippingMethod } from "../types/shipping.ts";
import type { MethodQuote, ShippingQuote } from "./engine.ts";

export type ConditionField = "subtotal" | "weight" | "quantity" | "region" | "city" | "postcode" | "category" | "shipping_class" | "product" | "customer_group" | "coupon";
export type ConditionOp = "lt" | "lte" | "gt" | "gte" | "in" | "not_in";

export interface RuleCondition {
  field: ConditionField;
  op: ConditionOp;
  /** Number fields: a number (weight in kg). List fields: the values to compare. */
  value: number | string[];
}

export type RuleAction =
  | { type: "set_charge"; amount: number }
  | { type: "free" }
  | { type: "surcharge"; amount: number; label?: string }
  | { type: "tiers"; basis: "weight" | "subtotal"; tiers: RateTier[] }
  | { type: "hide_method"; methodType: ShippingMethod["type"] };

export interface ShippingRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Lower runs first. */
  priority: number;
  /** "all" = AND, "any" = OR. */
  match: "all" | "any";
  conditions: RuleCondition[];
  action: RuleAction;
  /** Empty = every zone. */
  zoneIds: string[];
}

export type ShippingRuleInput = Omit<ShippingRule, "id">;

export interface ShippingGeneralSettings {
  /** When a delivery method is free, hide paid delivery methods. Pickup stays available. */
  hidePaidWhenFree: boolean;
  /** Shown at checkout when no method is available. */
  unavailableMessage: string;
}

export interface RuleContext {
  address: { prefecture: string; city: string; postalCode?: string };
  items: { productId: string; categorySlugs: string[]; shippingClassId?: string; quantity: number }[];
  customerGroupId?: string;
  couponCode?: string;
  /** Override the cart's numbers, in the tester only. */
  grams?: number;
  subtotal?: number;
}

export interface ClassFee {
  id: string;
  name: string;
  surcharge?: number;
  surchargePer?: "order" | "unit";
}

export interface ChargeBreakdown {
  /** The method's own charge, or the rule's. */
  base: number;
  surcharges: { label: string; amount: number }[];
  final: number;
  free: boolean;
}

export interface RuledQuote extends ShippingQuote {
  /** The selected method's charge in detail. */
  charge?: ChargeBreakdown;
  /** Rules that matched, in the order they ran. */
  rulesApplied: string[];
  /** One plain sentence per decision. */
  trace: string[];
}

const norm = (s: string) => s.trim().toLowerCase();
const digits = (s?: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();

const NUMBER_FIELDS: ConditionField[] = ["subtotal", "weight", "quantity"];
export const isNumberField = (f: ConditionField) => NUMBER_FIELDS.includes(f);

function compare(actual: number, op: ConditionOp, value: number) {
  switch (op) {
    case "lt": return actual < value;
    case "lte": return actual <= value;
    case "gt": return actual > value;
    case "gte": return actual >= value;
    default: return false;
  }
}

function listValues(c: RuleCondition, ctx: RuleContext): string[] {
  switch (c.field) {
    case "region": return [norm(ctx.address.prefecture)];
    case "city": return [norm(ctx.address.city)];
    case "postcode": return [digits(ctx.address.postalCode)];
    case "category": return ctx.items.flatMap((i) => i.categorySlugs).map(norm);
    case "shipping_class": return ctx.items.flatMap((i) => (i.shippingClassId ? [norm(i.shippingClassId)] : []));
    case "product": return ctx.items.map((i) => norm(i.productId));
    case "customer_group": return ctx.customerGroupId ? [norm(ctx.customerGroupId)] : [];
    case "coupon": return ctx.couponCode ? [norm(ctx.couponCode)] : [];
    default: return [];
  }
}

export function conditionMatches(c: RuleCondition, ctx: RuleContext, metrics: { totalGrams: number; subtotal: number; units: number }): boolean {
  if (isNumberField(c.field)) {
    const n = Number(c.value);
    if (c.field === "weight") return compare((ctx.grams ?? metrics.totalGrams) / 1000, c.op, n);
    if (c.field === "subtotal") return compare(ctx.subtotal ?? metrics.subtotal, c.op, n);
    return compare(metrics.units, c.op, n);
  }
  const wanted = (Array.isArray(c.value) ? c.value : [String(c.value)]).map((v) => (c.field === "postcode" ? digits(v) : norm(v)));
  const has = listValues(c, ctx).some((v) => wanted.includes(v));
  return c.op === "not_in" ? !has : has;
}

export function ruleMatches(rule: ShippingRule, ctx: RuleContext, metrics: { totalGrams: number; subtotal: number; units: number }) {
  if (!rule.conditions.length) return true;
  const results = rule.conditions.map((c) => conditionMatches(c, ctx, metrics));
  return rule.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

const tierFor = (tiers: RateTier[], value: number) => [...tiers].sort((a, b) => a.from - b.from).reverse().find((t) => value >= t.from);

/** Applies rules and visibility settings to a zone's quote, and chooses the cheapest delivery method. */
export function applyShippingRules(
  quote: ShippingQuote,
  rules: ShippingRule[],
  settings: ShippingGeneralSettings,
  classes: ClassFee[],
  ctx: RuleContext,
  money: (n: number) => string = String,
): RuledQuote {
  const metrics = { totalGrams: ctx.grams ?? quote.metrics.totalGrams, subtotal: ctx.subtotal ?? quote.metrics.subtotal, units: quote.metrics.units };
  const zoneId = quote.match.zone?.id;
  const matched = rules
    .filter((r) => r.enabled && (!r.zoneIds.length || (zoneId !== undefined && r.zoneIds.includes(zoneId))) && ruleMatches(r, ctx, metrics))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  const rulesApplied: string[] = [];
  const trace: string[] = [];
  let baseOverride: number | undefined;
  let free = false;
  let baseRule = "";
  const surcharges: { label: string; amount: number }[] = [];
  const hidden = new Set<string>();

  for (const r of matched) {
    const a = r.action;
    if (a.type === "hide_method") {
      hidden.add(a.methodType);
      rulesApplied.push(r.name);
      trace.push(`Rule “${r.name}” hides this method type.`);
    } else if (a.type === "surcharge") {
      surcharges.push({ label: a.label || r.name, amount: a.amount });
      rulesApplied.push(r.name);
      trace.push(`Rule “${r.name}” adds ${money(a.amount)}.`);
    } else if (baseOverride !== undefined || free) {
      trace.push(`Rule “${r.name}” matched but “${baseRule}” already set the charge (higher priority).`);
    } else if (a.type === "free") {
      free = true;
      baseRule = r.name;
      rulesApplied.push(r.name);
      trace.push(`Rule “${r.name}” makes delivery free.`);
    } else if (a.type === "set_charge") {
      baseOverride = a.amount;
      baseRule = r.name;
      rulesApplied.push(r.name);
      trace.push(`Rule “${r.name}” sets the charge to ${money(a.amount)}.`);
    } else {
      const value = a.basis === "weight" ? metrics.totalGrams : metrics.subtotal;
      const tier = tierFor(a.tiers, value);
      if (tier) {
        baseOverride = tier.cost;
        baseRule = r.name;
        rulesApplied.push(r.name);
        trace.push(`Rule “${r.name}” charges ${money(tier.cost)} from its ${a.basis} tiers.`);
      } else trace.push(`Rule “${r.name}” has no tier for this ${a.basis}.`);
    }
  }

  for (const c of classes) {
    if (!c.surcharge) continue;
    const units = ctx.items.filter((i) => i.shippingClassId === c.id).reduce((n, i) => n + i.quantity, 0);
    if (!units) continue;
    const amount = fromMinor(toMinor(c.surcharge) * (c.surchargePer === "unit" ? units : 1));
    surcharges.push({ label: `${c.name} class`, amount });
    trace.push(`${c.name} class adds ${money(amount)}.`);
  }

  const surchargeMinor = surcharges.reduce((n, s) => n + toMinor(s.amount), 0);
  const costOf = (o: MethodQuote): { base: number; final: number } => {
    const base = baseOverride ?? o.cost ?? 0;
    const isFree = free || (o.method.type === "free_shipping" && baseOverride === undefined);
    return { base, final: isFree ? 0 : fromMinor(toMinor(base) + surchargeMinor) };
  };

  let options: MethodQuote[] = quote.options.map((o) => {
    if (!o.available) return o;
    if (hidden.has(o.method.type)) return { ...o, available: false, cost: undefined, reason: "Hidden by a shipping rule." };
    if (o.method.type === "local_pickup") return o;
    const { final } = costOf(o);
    const changed = final !== o.cost;
    return { ...o, cost: final, breakdown: changed ? [...o.breakdown, `After rules: ${money(final)}`] : o.breakdown };
  });

  const delivery = () => options.filter((o) => o.available && o.method.type !== "local_pickup");
  if (settings.hidePaidWhenFree && delivery().some((o) => o.cost === 0)) {
    const before = delivery().length;
    options = options.map((o) => (o.available && o.method.type !== "local_pickup" && o.cost !== 0 ? { ...o, available: false, cost: undefined, reason: "Hidden because free delivery is available." } : o));
    if (delivery().length < before) trace.push("Paid delivery methods are hidden because free delivery is available.");
  }

  const selected = delivery().reduce<MethodQuote | undefined>((best, o) => (!best || toMinor(o.cost!) < toMinor(best.cost!) ? o : best), undefined);
  const original = selected && quote.options.find((o) => o.method.id === selected.method.id);
  const charge: ChargeBreakdown | undefined = selected && original
    ? { base: baseOverride ?? original.cost ?? 0, surcharges: selected.cost === 0 ? [] : surcharges, final: selected.cost!, free: selected.cost === 0 }
    : undefined;
  const explanation = trace.length ? `${quote.explanation} ${trace.join(" ")}` : quote.explanation;
  return { ...quote, options, selected, explanation, charge, rulesApplied, trace };
}

const OP_WORDS: Record<ConditionOp, string> = { lt: "is below", lte: "is up to", gt: "is above", gte: "is at least", in: "is", not_in: "is not" };
export const FIELD_WORDS: Record<ConditionField, string> = {
  subtotal: "Order subtotal",
  weight: "Cart weight (kg)",
  quantity: "Product quantity",
  region: "Region",
  city: "City",
  postcode: "Postcode",
  category: "Product category",
  shipping_class: "Shipping class",
  product: "Product",
  customer_group: "Customer group",
  coupon: "Coupon",
};

/** "WHEN Order subtotal is below ¥20,000 AND Cart weight (kg) is up to 5 THEN charge ¥500." */
export function describeRule(r: Pick<ShippingRule, "conditions" | "match" | "action">, money: (n: number) => string = String, names: (field: ConditionField, value: string) => string = (_, v) => v): string {
  const when = r.conditions
    .map((c) => {
      if (isNumberField(c.field)) return `${FIELD_WORDS[c.field]} ${OP_WORDS[c.op]} ${c.field === "subtotal" ? money(Number(c.value)) : c.value}`;
      const values = (Array.isArray(c.value) ? c.value : [String(c.value)]).map((v) => names(c.field, v));
      return `${FIELD_WORDS[c.field]} ${OP_WORDS[c.op]} ${values.join(" or ")}`;
    })
    .join(r.match === "any" ? " OR " : " AND ");
  const a = r.action;
  const then =
    a.type === "set_charge" ? `charge ${money(a.amount)}`
    : a.type === "free" ? "delivery is free"
    : a.type === "surcharge" ? `add ${money(a.amount)}`
    : a.type === "tiers" ? `use ${a.basis} tiers`
    : "hide this method";
  return r.conditions.length ? `WHEN ${when} THEN ${then}.` : `ALWAYS ${then}.`;
}

export function validateRule(input: ShippingRuleInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = "Enter a rule name.";
  if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 9999) errors.priority = "Enter a whole number from 0 to 9999.";
  input.conditions.forEach((c, i) => {
    if (isNumberField(c.field)) {
      if (!["lt", "lte", "gt", "gte"].includes(c.op)) errors[`conditions.${i}`] = "Choose a comparison.";
      else if (!Number.isFinite(Number(c.value)) || Number(c.value) < 0) errors[`conditions.${i}`] = "Enter a number.";
    } else {
      if (!["in", "not_in"].includes(c.op)) errors[`conditions.${i}`] = "Choose is or is not.";
      else if (!Array.isArray(c.value) || !c.value.length) errors[`conditions.${i}`] = "Choose or enter at least one value.";
    }
  });
  const a = input.action;
  if (a.type === "set_charge" || a.type === "surcharge") {
    if (!isValidAmount(a.amount)) errors["action.amount"] = `Enter an amount with ${amountRule()}.`;
  }
  if (a.type === "tiers") {
    const froms = a.tiers.map((t) => t.from);
    if (!a.tiers.length) errors["action.tiers"] = "Add at least one tier.";
    else if (froms[0] !== 0) errors["action.tiers"] = "The first tier must start at 0.";
    else if (froms.some((f, i) => i > 0 && f <= froms[i - 1])) errors["action.tiers"] = "Tiers must go up with no repeats.";
    else if (a.tiers.some((t) => !Number.isFinite(t.cost) || t.cost < 0)) errors["action.tiers"] = "Enter a charge for each tier.";
  }
  return errors;
}
