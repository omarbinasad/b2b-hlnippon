/**
 * Shipping zone matching and rate calculation — pure functions with only type imports
 * (plus the shared money helpers), so they run in the browser, the mock repository and
 * `npm test`. The backend must repeat the same matching, validation and calculation at
 * cart, checkout and order creation. Demo rates are sample values.
 *
 * ZONE MATCHING (one zone per address, deterministic):
 *   1. a zone listing the address's exact postcode
 *   2. else a zone listing the address's city (prefecture + city)
 *   3. else a zone listing the address's prefecture
 *   4. else the single fallback zone
 *   Text compares ignore case and extra spaces. A postcode, city or prefecture may be in
 *   only one zone (validated on save), so each step finds at most one zone.
 *
 * RATES: weight = Σ unit weight × quantity, where a variation's weight overrides the
 *   product's; subtotal = Σ unit price × quantity (items after line discounts, before VAT
 *   and shipping). Tiers apply from their `from` value up to the next tier's `from`.
 *   Shipping-class adjustments add a fixed amount per order or per unit of that class.
 *   SUGGESTED METHOD: the cheapest available delivery method in the matched zone (ties →
 *   the method listed first). Local pickup is offered alongside, never chosen automatically.
 */
import type { ClassAdjustment, FieldErrors, ID, RateTier, ShippingAddress, ShippingMethod, ShippingZone, ShippingZoneInput, ZoneLocation } from "@/lib/types";
import { AMOUNT_RULE, fromMinor, isValidAmount, toMinor } from "../orders/calc.ts";

import { isPostcode, postcodeKey } from "../customers/contact.ts";
import { JP_PREFECTURES as PREFECTURE_NAMES } from "../locations.ts";
export { PREFECTURE_NAMES };

const norm = (s?: string) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

// --- Zone matching -------------------------------------------------------------------------

export type MatchLevel = "postcode" | "city" | "prefecture" | "fallback";

export const matchLevelLabel: Record<MatchLevel, string> = {
  postcode: "exact postcode",
  city: "city",
  prefecture: "prefecture",
  fallback: "fallback (no other zone matched)",
};

export interface ZoneMatch {
  zone?: ShippingZone;
  level?: MatchLevel;
  location?: ZoneLocation;
  explanation: string;
}

export function locationLabel(l: ZoneLocation) {
  if (l.type === "postcode") return `Postcode ${l.postalCode}`;
  if (l.type === "city") return `${l.city}, ${l.prefecture}`;
  return `${l.prefecture} prefecture`;
}

export function matchZone(zones: ShippingZone[], address: ShippingAddress): ZoneMatch {
  const postcode = postcodeKey(address.postalCode);
  const city = norm(address.city);
  const prefecture = norm(address.prefecture);
  const find = (test: (l: ZoneLocation) => boolean) => {
    for (const zone of zones) {
      if (zone.isFallback) continue;
      const location = zone.locations.find(test);
      if (location) return { zone, location };
    }
    return undefined;
  };
  const steps: [MatchLevel, (l: ZoneLocation) => boolean][] = [
    ["postcode", (l) => !!postcode && l.type === "postcode" && postcodeKey(l.postalCode) === postcode],
    ["city", (l) => !!city && l.type === "city" && norm(l.city) === city && norm(l.prefecture) === prefecture],
    ["prefecture", (l) => !!prefecture && l.type === "prefecture" && norm(l.prefecture) === prefecture],
  ];
  for (const [level, test] of steps) {
    const hit = find(test);
    if (hit) return { ...hit, level, explanation: `Matched “${hit.zone.name}” by ${matchLevelLabel[level]}: ${locationLabel(hit.location)}.` };
  }
  const fallback = zones.find((z) => z.isFallback);
  if (fallback) return { zone: fallback, level: "fallback", explanation: `No zone lists this postcode, city or prefecture, so the fallback zone “${fallback.name}” applies.` };
  return { explanation: "No zone matches and there is no fallback zone." };
}

// --- Cart metrics ---------------------------------------------------------------------------

/** One resolved cart line: weight and class already taken from the variation when it overrides the product. */
export interface ShippingItem {
  productId: ID;
  variationId?: ID;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Line discount in the store currency (subtracted from the subtotal). */
  discount?: number;
  unitGrams: number;
  shippingClassId?: ID;
}

export interface CartMetrics {
  units: number;
  totalGrams: number;
  subtotal: number;
  /** Units per shipping class id. */
  classUnits: Record<ID, number>;
}

export function cartMetrics(items: ShippingItem[]): CartMetrics {
  let units = 0;
  let grams = 0;
  let minor = 0;
  const classUnits: Record<ID, number> = {};
  for (const i of items) {
    units += i.quantity;
    grams += i.unitGrams * i.quantity;
    minor += toMinor(i.unitPrice) * i.quantity - toMinor(i.discount ?? 0);
    if (i.shippingClassId) classUnits[i.shippingClassId] = (classUnits[i.shippingClassId] ?? 0) + i.quantity;
  }
  return { units, totalGrams: grams, subtotal: fromMinor(minor), classUnits };
}

// --- Method costs -----------------------------------------------------------------------------

export const tierFor = (tiers: RateTier[], value: number) => [...tiers].reverse().find((t) => value >= t.from);

export const methodTypeLabel: Record<ShippingMethod["type"], string> = {
  flat_rate: "Flat rate",
  weight_tiers: "Weight-based",
  subtotal_tiers: "Subtotal-based",
  free_shipping: "Free shipping",
  local_pickup: "Local pickup",
};

export interface MethodQuote {
  method: ShippingMethod;
  available: boolean;
  /** Store currency; set when available. */
  cost?: number;
  /** Plain-language calculation steps. */
  breakdown: string[];
  reason?: string;
}

/** Display helpers injected by the caller (the engine has no runtime imports). */
export interface QuoteFormat {
  money: (n: number) => string;
  className: (id: ID) => string;
}
const plain: QuoteFormat = { money: (n) => String(n), className: (id) => id };

function classCharges(adjustments: ClassAdjustment[], metrics: CartMetrics, fmt: QuoteFormat) {
  let minor = 0;
  const lines: string[] = [];
  for (const a of adjustments) {
    const units = metrics.classUnits[a.shippingClassId] ?? 0;
    if (!units) continue;
    const add = a.per === "order" ? toMinor(a.amount) : toMinor(a.amount) * units;
    minor += add;
    lines.push(`${fmt.className(a.shippingClassId)}: +${fmt.money(fromMinor(add))}${a.per === "unit" ? ` (${fmt.money(a.amount)} × ${units} units)` : " (per order)"}`);
  }
  return { minor, lines };
}

export function quoteMethod(method: ShippingMethod, metrics: CartMetrics, fmt: QuoteFormat = plain): MethodQuote {
  if (!method.enabled) return { method, available: false, breakdown: [], reason: "Disabled." };
  if (metrics.units === 0) return { method, available: false, breakdown: [], reason: "The cart is empty." };
  switch (method.type) {
    case "local_pickup":
      return { method, available: true, cost: method.cost, breakdown: [`Pickup charge ${fmt.money(method.cost)}`] };
    case "free_shipping":
      return toMinor(metrics.subtotal) >= toMinor(method.minSubtotal)
        ? { method, available: true, cost: 0, breakdown: [`Subtotal ${fmt.money(metrics.subtotal)} ≥ ${fmt.money(method.minSubtotal)}: free`] }
        : { method, available: false, breakdown: [], reason: `Needs a subtotal of at least ${fmt.money(method.minSubtotal)} (now ${fmt.money(metrics.subtotal)}).` };
    default: {
      let base: number;
      const lines: string[] = [];
      if (method.type === "flat_rate") {
        base = toMinor(method.cost);
        lines.push(`Flat rate ${fmt.money(method.cost)}`);
      } else {
        const value = method.type === "weight_tiers" ? metrics.totalGrams : metrics.subtotal;
        const tier = tierFor(method.tiers, value);
        if (!tier) return { method, available: false, breakdown: [], reason: "No tier covers this cart." };
        base = toMinor(tier.cost);
        lines.push(
          method.type === "weight_tiers"
            ? `Weight ${value / 1000} kg → tier from ${tier.from / 1000} kg: ${fmt.money(tier.cost)}`
            : `Subtotal ${fmt.money(value)} → tier from ${fmt.money(tier.from)}: ${fmt.money(tier.cost)}`,
        );
      }
      const extra = classCharges(method.classAdjustments, metrics, fmt);
      return { method, available: true, cost: fromMinor(base + extra.minor), breakdown: [...lines, ...extra.lines] };
    }
  }
}

// --- Full quote --------------------------------------------------------------------------------

export interface ShippingQuote {
  match: ZoneMatch;
  metrics: CartMetrics;
  /** Every method of the matched zone, in listed order. */
  options: MethodQuote[];
  /** Suggested delivery method (cheapest available, not pickup). */
  selected?: MethodQuote;
  explanation: string;
}

export function quoteShipping(zones: ShippingZone[], address: ShippingAddress, items: ShippingItem[], fmt: QuoteFormat = plain): ShippingQuote {
  const match = matchZone(zones, address);
  const metrics = cartMetrics(items);
  const options = (match.zone?.methods ?? []).map((m) => quoteMethod(m, metrics, fmt));
  const delivery = options.filter((o) => o.available && o.method.type !== "local_pickup");
  const selected = delivery.reduce<MethodQuote | undefined>((best, o) => (!best || toMinor(o.cost!) < toMinor(best.cost!) ? o : best), undefined);
  const pickup = options.find((o) => o.available && o.method.type === "local_pickup");
  const explanation = !match.zone
    ? match.explanation
    : selected
      ? `${match.explanation} Suggested “${selected.method.name}” — the cheapest of ${delivery.length} available delivery method${delivery.length === 1 ? "" : "s"}.${pickup ? ` Local pickup is also offered.` : ""}`
      : `${match.explanation} No delivery method is available for this cart${pickup ? "; only local pickup" : ""}. Enter an agreed charge or adjust the zone.`;
  return { match, metrics, options, selected, explanation };
}

// --- Validation ----------------------------------------------------------------------------------

export const SHIPPING_LIMITS = { name: 80, locations: 200, methods: 10, tiers: 20, maxGrams: 10_000_000, maxSubtotal: 100_000_000 } as const;

const locationKey = (l: ZoneLocation) =>
  l.type === "postcode" ? `postcode:${postcodeKey(l.postalCode)}` : l.type === "city" ? `city:${norm(l.prefecture)}|${norm(l.city)}` : `prefecture:${norm(l.prefecture)}`;

function validateTiers(tiers: RateTier[], prefix: string, unit: "grams" | "currency", errors: FieldErrors) {
  if (!tiers.length) errors[`${prefix}.tiers`] = "Add at least one tier.";
  if (tiers.length > SHIPPING_LIMITS.tiers) errors[`${prefix}.tiers`] = `At most ${SHIPPING_LIMITS.tiers} tiers.`;
  tiers.forEach((t, i) => {
    const p = `${prefix}.tiers.${i}`;
    const fromOk = unit === "grams" ? Number.isInteger(t.from) && t.from >= 0 && t.from <= SHIPPING_LIMITS.maxGrams : isValidAmount(t.from) && t.from <= SHIPPING_LIMITS.maxSubtotal;
    if (!fromOk) errors[`${p}.from`] = unit === "grams" ? "Enter a weight of 0 or more (up to 3 decimals in kg)." : `Enter an amount of 0 or more (${AMOUNT_RULE}).`;
    else if (i === 0 && t.from !== 0) errors[`${p}.from`] = "The first tier must start at 0 so every cart is covered.";
    else if (i > 0 && t.from <= tiers[i - 1].from) errors[`${p}.from`] = "Each tier must start above the previous one (no overlaps).";
    if (!isValidAmount(t.cost)) errors[`${p}.cost`] = `Enter a charge of 0 or more (${AMOUNT_RULE}).`;
  });
}

export function validateMethod(m: ShippingMethod, index: number, classIds: ID[]): FieldErrors {
  const errors: FieldErrors = {};
  const p = `methods.${index}`;
  if (!m.name.trim()) errors[`${p}.name`] = "Name the method (shown to staff and on orders).";
  else if (m.name.length > SHIPPING_LIMITS.name) errors[`${p}.name`] = "Too long.";
  if ((m.type === "flat_rate" || m.type === "local_pickup") && !isValidAmount(m.cost)) errors[`${p}.cost`] = `Enter a charge of 0 or more (${AMOUNT_RULE}).`;
  if (m.type === "free_shipping" && !(isValidAmount(m.minSubtotal) && m.minSubtotal > 0)) errors[`${p}.minSubtotal`] = "Enter a minimum subtotal above 0.";
  if (m.type === "weight_tiers") validateTiers(m.tiers, p, "grams", errors);
  if (m.type === "subtotal_tiers") validateTiers(m.tiers, p, "currency", errors);
  if (m.type === "flat_rate" || m.type === "weight_tiers" || m.type === "subtotal_tiers") {
    const seen = new Set<string>();
    m.classAdjustments.forEach((a, i) => {
      const k = `${p}.classAdjustments.${i}`;
      if (!classIds.includes(a.shippingClassId)) errors[k] = "Choose a shipping class.";
      else if (seen.has(a.shippingClassId)) errors[k] = "This class already has an adjustment in this method.";
      else if (!(isValidAmount(a.amount) && a.amount > 0)) errors[k] = "Enter an amount above 0.";
      seen.add(a.shippingClassId);
    });
  }
  return errors;
}

/**
 * Validates a zone against the other zones. `isFallback` zones have no locations.
 * Every postcode, city and prefecture may belong to one zone only.
 */
export function validateZone(input: ShippingZoneInput, opts: { isFallback: boolean; others: ShippingZone[]; classIds: ID[] }): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "Name the zone (at least 2 characters).";
  else if (name.length > SHIPPING_LIMITS.name) errors.name = "Too long.";
  else if (opts.others.some((z) => norm(z.name) === norm(name))) errors.name = "Another zone has this name.";

  if (opts.isFallback && input.locations.length) errors.locations = "The fallback zone covers every unmatched address and has no locations.";
  if (!opts.isFallback && !input.locations.length) errors.locations = "Add at least one prefecture, city or postcode.";
  if (input.locations.length > SHIPPING_LIMITS.locations) errors.locations = `At most ${SHIPPING_LIMITS.locations} locations.`;

  const taken = new Map<string, string>();
  for (const z of opts.others) for (const l of z.locations) taken.set(locationKey(l), z.name);
  const own = new Set<string>();
  input.locations.forEach((l, i) => {
    const k = `locations.${i}`;
    if (l.type === "postcode") {
      if (!isPostcode(l.postalCode)) return void (errors[k] = "Use a 7-digit postcode, e.g. 160-0023.");
    } else {
      if (!PREFECTURE_NAMES.some((d) => norm(d) === norm(l.prefecture))) return void (errors[k] = "Choose a prefecture.");
      if (l.type === "city" && !l.city.trim()) return void (errors[k] = "Enter the city.");
    }
    const key = locationKey(l);
    if (own.has(key)) errors[k] = `${locationLabel(l)} is listed twice.`;
    else if (taken.has(key)) errors[k] = `${locationLabel(l)} is already in “${taken.get(key)}”. A location can belong to one zone only.`;
    own.add(key);
  });

  if (input.methods.length > SHIPPING_LIMITS.methods) errors.methods = `At most ${SHIPPING_LIMITS.methods} methods.`;
  const free = input.methods.filter((m) => m.type === "free_shipping").length;
  const pickup = input.methods.filter((m) => m.type === "local_pickup").length;
  if (free > 1) errors.methods = "Use one free-shipping method per zone.";
  if (pickup > 1) errors.methods = "Use one local-pickup method per zone.";
  input.methods.forEach((m, i) => Object.assign(errors, validateMethod(m, i, opts.classIds)));
  return errors;
}
