/**
 * B2B price and quantity rule engine — pure functions, no I/O, only type imports
 * (plus the shared money helpers), so it runs in the browser, the mock repository
 * and `npm test`. The backend must implement the same rules and enforce them at
 * cart and checkout; this module is the reference behaviour for the demo.
 *
 * PRICE PRECEDENCE (exactly one rule applies — discounts never stack):
 *   A rule is eligible when it is active, within its dates, its audience matches an
 *   APPROVED customer, its target matches the item, a tier covers the quantity and
 *   the resulting price is not negative. Among eligible rules the winner is the first by:
 *     1. audience     customer  >  group  >  all approved customers
 *     2. target       variation >  product >  category  >  all products
 *     3. priority     higher number first
 *     4. age          older rule (createdAt) first, then rule id — flagged as a conflict
 *   No eligible rule → the active sale price when there is one, otherwise the regular price.
 *
 * BASE PRICE (decided): percentage and amount-off rules are calculated from the product's
 *   REGULAR price, never from a sale price; a fixed-price rule uses its entered amount.
 * EFFECTIVE PRICE (decided): the customer pays the LOWER of the winning rule price and the
 *   active sale price (if any). The two are compared, never combined: a B2B discount is never
 *   applied to the sale price. Equal prices → the rule price is reported as the source.
 *
 * QUANTITY LIMITS: the most specific active rule wins as a whole (variation > product >
 *   category > all, then priority, then age). Limits apply to each order line; a
 *   category rule never sums quantities across products. No rule → min 1, no max.
 */
import type { AccountStatus, FieldErrors, ID, PriceAdjustment, PriceRule, PriceRuleInput, PriceTier, QuantityLimitRule, QuantityLimitRuleInput, RuleTarget } from "@/lib/types";
import { fromMinor, isValidAmount, toMinor } from "../orders/calc.ts";

// --- Matching -------------------------------------------------------------------------

/** The thing being priced. `categoryIds` must include ancestors so parent-category rules match. */
export interface RuleItem {
  productId: ID;
  variationId?: ID;
  categoryIds: ID[];
}

export interface RuleCustomer {
  id: ID;
  groupId?: ID;
  status: AccountStatus;
}

export const TARGET_LEVEL: Record<RuleTarget["type"], number> = { all: 0, categories: 1, products: 2, variations: 3 };
export const AUDIENCE_LEVEL: Record<PriceRule["audience"]["type"], number> = { all: 0, group: 1, customer: 2 };

export const targetLevelLabel: Record<RuleTarget["type"], string> = { all: "all products", categories: "category", products: "product", variations: "variation" };
export const audienceLabel: Record<PriceRule["audience"]["type"], string> = { all: "all approved customers", group: "customer group", customer: "customer-specific" };

export function targetMatches(target: RuleTarget, item: RuleItem): boolean {
  switch (target.type) {
    case "all":
      return true;
    case "categories":
      return target.categoryIds.some((id) => item.categoryIds.includes(id));
    case "products":
      return target.productIds.includes(item.productId);
    case "variations":
      return target.productId === item.productId && !!item.variationId && target.variationIds.includes(item.variationId);
  }
}

export function audienceMatches(audience: PriceRule["audience"], customer: RuleCustomer): boolean {
  if (customer.status !== "approved") return false;
  if (audience.type === "all") return true;
  if (audience.type === "group") return !!customer.groupId && audience.groupId === customer.groupId;
  return audience.customerId === customer.id;
}

export function isWithinDates(rule: Pick<PriceRule, "validFrom" | "validTo">, now: Date) {
  if (rule.validFrom && new Date(rule.validFrom) > now) return false;
  if (rule.validTo && new Date(rule.validTo) < now) return false;
  return true;
}

export const tierFor = (tiers: PriceTier[], quantity: number) =>
  tiers.find((t) => quantity >= t.minQuantity && (t.maxQuantity === undefined || quantity <= t.maxQuantity));

export const tierLabel = (t: Pick<PriceTier, "minQuantity" | "maxQuantity">) =>
  t.maxQuantity === undefined ? `${t.minQuantity}+` : t.minQuantity === t.maxQuantity ? `${t.minQuantity}` : `${t.minQuantity}–${t.maxQuantity}`;

// --- Money ------------------------------------------------------------------------------

function divRoundHalfUp(numerator: bigint, denominator: bigint) {
  const two = BigInt(2);
  return (numerator * two + denominator) / (denominator * two);
}

/** Unit price after an adjustment, in the store currency; null when it would be negative. Half-up to the minor unit. */
export function adjustedPrice(base: number, adjustment: PriceAdjustment): number | null {
  const baseMinor = toMinor(base);
  let minor: number;
  if (adjustment.type === "fixed_price") minor = toMinor(adjustment.amount);
  else if (adjustment.type === "amount_off") minor = baseMinor - toMinor(adjustment.amount);
  else {
    const bp = BigInt(Math.round(adjustment.percent * 100)); // basis points keep 12.5 % exact
    minor = Number(divRoundHalfUp(BigInt(baseMinor) * (BigInt(10000) - bp), BigInt(10000)));
  }
  return minor < 0 ? null : fromMinor(minor);
}

export const lineTotal = (unitPrice: number, quantity: number) => fromMinor(toMinor(unitPrice) * quantity);

export function adjustmentLabel(a: PriceAdjustment, format: (n: number) => string) {
  if (a.type === "fixed_price") return `Fixed ${format(a.amount)}`;
  if (a.type === "amount_off") return `${format(a.amount)} off`;
  return `${a.percent}% off`;
}

// --- Sale price ---------------------------------------------------------------------------

/**
 * The sale price if it is valid and active on `today` ("YYYY-MM-DD", store time zone; dates
 * inclusive), else undefined. A "sale" at or above the regular price is ignored.
 */
export function activeSalePrice(regular: number, sale: { price?: number; from?: string; to?: string }, today: string): number | undefined {
  if (sale.price === undefined || !isValidAmount(sale.price) || toMinor(sale.price) >= toMinor(regular)) return undefined;
  if (sale.from && today < sale.from.slice(0, 10)) return undefined;
  if (sale.to && today > sale.to.slice(0, 10)) return undefined;
  return sale.price;
}

// --- Price resolution -----------------------------------------------------------------------

/** Winner first. */
export function comparePriceRules(a: PriceRule, b: PriceRule) {
  return (
    AUDIENCE_LEVEL[b.audience.type] - AUDIENCE_LEVEL[a.audience.type] ||
    TARGET_LEVEL[b.target.type] - TARGET_LEVEL[a.target.type] ||
    b.priority - a.priority ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

/** Why `loser` lost to `winner` (both eligible). */
function lossReason(loser: PriceRule, winner: PriceRule) {
  if (loser.audience.type !== winner.audience.type)
    return `“${winner.name}” is ${audienceLabel[winner.audience.type]}, which beats ${audienceLabel[loser.audience.type]} rules.`;
  if (loser.target.type !== winner.target.type)
    return `Same audience; “${winner.name}” targets a ${targetLevelLabel[winner.target.type]}, which is more specific than ${targetLevelLabel[loser.target.type]}.`;
  if (loser.priority !== winner.priority) return `Same audience and target level; lower priority (${loser.priority} < ${winner.priority}).`;
  return `Conflict: same audience, target level and priority — the older rule “${winner.name}” wins. Change a priority to make the intent explicit.`;
}

export type CandidateOutcome = "winner" | "outranked" | "skipped";

export interface PriceCandidate {
  rule: PriceRule;
  outcome: CandidateOutcome;
  reason: string;
  tier?: PriceTier;
  unitPrice?: number;
}

/** Where the unit price came from. */
export type PriceSource = "rule" | "sale" | "regular";

export interface PriceResolution {
  /** Regular catalog price — the base for percentage and amount-off rules. */
  basePrice: number;
  /** Active sale price, when the product has one today. */
  salePrice?: number;
  /** Price the winning rule produced (before comparing with the sale price). */
  rulePrice?: number;
  /** Which price the customer pays: the rule price, the sale price (no rule, or lower than the rule) or the regular price. */
  priceSource: PriceSource;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  rule?: PriceRule;
  tier?: PriceTier;
  /** Rules whose audience and target match this customer and item, winner first. */
  candidates: PriceCandidate[];
  explanation: string;
}

export function resolvePrice(input: {
  rules: PriceRule[];
  customer: RuleCustomer;
  item: RuleItem;
  /** Regular price. */
  basePrice: number;
  /** Already-active sale price (see activeSalePrice); used only when no rule applies. */
  salePrice?: number;
  quantity: number;
  now?: Date;
}): PriceResolution {
  const { rules, customer, item, basePrice, salePrice, quantity, now = new Date() } = input;
  // Without a winning rule: sale price if active, else regular. Never both a sale and a rule.
  const fallbackPrice = salePrice ?? basePrice;
  const fallbackNote = salePrice !== undefined ? `the active sale price (${salePrice}) applies instead of the regular price (${basePrice}).` : "the regular price applies.";
  const base = {
    basePrice,
    salePrice,
    priceSource: (salePrice !== undefined ? "sale" : "regular") as PriceSource,
    quantity,
    unitPrice: fallbackPrice,
    lineTotal: lineTotal(fallbackPrice, quantity),
  };
  if (customer.status !== "approved") {
    return { ...base, candidates: [], explanation: `No rules apply: rule prices are only for approved customers, so ${fallbackNote}` };
  }

  const relevant = rules.filter((r) => audienceMatches(r.audience, customer) && targetMatches(r.target, item));
  const eligible: PriceCandidate[] = [];
  const skipped: PriceCandidate[] = [];
  for (const rule of relevant) {
    if (rule.status !== "active") skipped.push({ rule, outcome: "skipped", reason: "Disabled." });
    else if (!isWithinDates(rule, now)) skipped.push({ rule, outcome: "skipped", reason: "Outside its valid dates." });
    else {
      const tier = tierFor(rule.tiers, quantity);
      if (!tier) skipped.push({ rule, outcome: "skipped", reason: `No tier for quantity ${quantity} (tiers: ${rule.tiers.map(tierLabel).join(", ")}).` });
      else {
        const price = adjustedPrice(basePrice, tier.adjustment);
        if (price === null) skipped.push({ rule, outcome: "skipped", tier, reason: "Would make the price negative — ignored." });
        else eligible.push({ rule, outcome: "outranked", reason: "", tier, unitPrice: price });
      }
    }
  }

  eligible.sort((a, b) => comparePriceRules(a.rule, b.rule));
  const winner = eligible[0];
  if (!winner) {
    return {
      ...base,
      candidates: skipped,
      explanation: relevant.length ? `Matching rules exist but none is eligible for this quantity and date, so ${fallbackNote}` : `No rule targets this customer and item, so ${fallbackNote}`,
    };
  }
  winner.outcome = "winner";
  winner.reason = eligible.length === 1 ? "The only eligible rule." : "Highest precedence among eligible rules.";
  for (const c of eligible.slice(1)) c.reason = lossReason(c.rule, winner.rule);

  const rulePrice = winner.unitPrice!;
  const fixed = winner.tier!.adjustment.type === "fixed_price";
  // Lower of rule price and active sale price — compared, never combined.
  const saleWins = salePrice !== undefined && toMinor(salePrice) < toMinor(rulePrice);
  const unitPrice = saleWins ? salePrice! : rulePrice;
  return {
    basePrice,
    salePrice,
    rulePrice,
    priceSource: saleWins ? "sale" : "rule",
    quantity,
    unitPrice,
    lineTotal: lineTotal(unitPrice, quantity),
    rule: winner.rule,
    tier: winner.tier,
    candidates: [...eligible, ...skipped],
    explanation:
      `“${winner.rule.name}” (${audienceLabel[winner.rule.audience.type]}, ${targetLevelLabel[winner.rule.target.type]} level, priority ${winner.rule.priority}) ` +
      `applies tier ${tierLabel(winner.tier!)}${fixed ? " (a fixed price)" : ", calculated from the regular price"}. ` +
      `${salePrice === undefined ? "" : saleWins ? `The active sale price (${salePrice}) is lower than the rule price (${rulePrice}), so the sale price applies — the B2B discount is not added on top. ` : `The rule price (${rulePrice}) is not above the active sale price (${salePrice}), so the rule price applies — the sale is not added on top. `}` +
      `${eligible.length > 1 ? `It outranks ${eligible.length - 1} other eligible rule${eligible.length > 2 ? "s" : ""}; discounts are not combined.` : ""}`.trim(),
  };
}

// --- Overlaps and conflicts ---------------------------------------------------------------------

export interface RuleConflict {
  ruleId: ID;
  otherId: ID;
  /** conflict = same priority (decided by age); overlap = decided by priority. */
  kind: "conflict" | "overlap";
}

const sameAudience = (a: PriceRule["audience"], b: PriceRule["audience"]) =>
  a.type === b.type && (a.type === "all" || (a.type === "group" && b.type === "group" && a.groupId === b.groupId) || (a.type === "customer" && b.type === "customer" && a.customerId === b.customerId));

/** Same level and at least one shared id. (Two different categories sharing a product are not detected here.) */
export function targetsIntersect(a: RuleTarget, b: RuleTarget) {
  if (a.type !== b.type) return false;
  if (a.type === "all") return true;
  if (a.type === "categories" && b.type === "categories") return a.categoryIds.some((id) => b.categoryIds.includes(id));
  if (a.type === "products" && b.type === "products") return a.productIds.some((id) => b.productIds.includes(id));
  if (a.type === "variations" && b.type === "variations") return a.productId === b.productId && a.variationIds.some((id) => b.variationIds.includes(id));
  return false;
}

const datesOverlap = (a: PriceRule, b: PriceRule) =>
  (!a.validTo || !b.validFrom || a.validTo >= b.validFrom) && (!b.validTo || !a.validFrom || b.validTo >= a.validFrom);

const tiersOverlap = (a: PriceTier[], b: PriceTier[]) =>
  a.some((x) => b.some((y) => x.minQuantity <= (y.maxQuantity ?? Infinity) && y.minQuantity <= (x.maxQuantity ?? Infinity)));

/** Pairs of active rules that can both apply to the same customer, item and quantity at the same level. */
export function findPriceConflicts(rules: PriceRule[]): RuleConflict[] {
  const active = rules.filter((r) => r.status === "active");
  const out: RuleConflict[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (!sameAudience(a.audience, b.audience) || !targetsIntersect(a.target, b.target) || !datesOverlap(a, b) || !tiersOverlap(a.tiers, b.tiers)) continue;
      const kind = a.priority === b.priority ? "conflict" : "overlap";
      out.push({ ruleId: a.id, otherId: b.id, kind }, { ruleId: b.id, otherId: a.id, kind });
    }
  }
  return out;
}

// --- Quantity limits ---------------------------------------------------------------------------

export const DEFAULT_MIN_QUANTITY = 1;

export function compareQuantityRules(a: QuantityLimitRule, b: QuantityLimitRule) {
  return TARGET_LEVEL[b.target.type] - TARGET_LEVEL[a.target.type] || b.priority - a.priority || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export interface QuantityLimits {
  min: number;
  max?: number;
  /** Order in multiples of this (the product's own setting; rules don't change it). */
  step?: number;
  rule?: QuantityLimitRule;
  candidates: { rule: QuantityLimitRule; outcome: CandidateOutcome; reason: string }[];
  explanation: string;
}

/**
 * `base` is the product's own setting. A matching rule overrides it; whatever the rule leaves empty comes from `base`.
 * "Sold individually" caps the maximum at 1.
 */
export function resolveQuantityLimits(rules: QuantityLimitRule[], item: RuleItem, base?: { min?: number; max?: number; step?: number; soldIndividually?: boolean }): QuantityLimits {
  const result = resolveRuleLimits(rules, item, base);
  const step = Math.max(1, base?.step ?? 1);
  if (base?.soldIndividually) return { ...result, min: 1, max: 1, step: 1, explanation: `${result.explanation} The product is sold individually, so the maximum is 1.` };
  return { ...result, step };
}

function resolveRuleLimits(rules: QuantityLimitRule[], item: RuleItem, base?: { min?: number; max?: number }): QuantityLimits {
  const baseMin = Math.max(DEFAULT_MIN_QUANTITY, base?.min ?? DEFAULT_MIN_QUANTITY);
  const baseMax = base?.max;
  const relevant = rules.filter((r) => targetMatches(r.target, item));
  const active = relevant.filter((r) => r.status === "active").sort(compareQuantityRules);
  const skipped = relevant.filter((r) => r.status !== "active").map((rule) => ({ rule, outcome: "skipped" as const, reason: "Disabled." }));
  const winner = active[0];
  if (!winner) {
    if (base && (base.min !== undefined || base.max !== undefined)) return { min: baseMin, max: baseMax, candidates: skipped, explanation: `No active quantity rule matches, so the product's own limits apply: at least ${baseMin}${baseMax !== undefined ? `, at most ${baseMax}` : ", no maximum"}.` };
    return { min: DEFAULT_MIN_QUANTITY, candidates: skipped, explanation: `No active quantity rule matches, so the default applies: at least ${DEFAULT_MIN_QUANTITY}, no maximum.` };
  }
  const others = active.slice(1).map((rule) => ({
    rule,
    outcome: "outranked" as const,
    reason:
      rule.target.type !== winner.target.type
        ? `“${winner.name}” targets a ${targetLevelLabel[winner.target.type]}, which overrides this ${targetLevelLabel[rule.target.type]} rule.`
        : rule.priority !== winner.priority
          ? `Same target level; lower priority (${rule.priority} < ${winner.priority}).`
          : `Conflict: same target level and priority — the older rule “${winner.name}” wins.`,
  }));
  const candidates = [{ rule: winner, outcome: "winner" as const, reason: others.length ? "Most specific active rule." : "The only active rule." }, ...others, ...skipped];
  // A product's own limits (a minimum above 1, or any maximum) are more specific than a category or store-wide rule,
  // so they win over those; a rule for the product or one of its variations overrides them.
  const broad = winner.target.type === "categories" || winner.target.type === "all";
  const ownMin = base?.min !== undefined && base.min > DEFAULT_MIN_QUANTITY ? baseMin : undefined;
  if (broad && (ownMin !== undefined || baseMax !== undefined)) {
    const min = ownMin ?? winner.minQuantity ?? baseMin;
    const max = baseMax ?? winner.maxQuantity;
    return {
      min,
      max,
      rule: winner,
      candidates,
      explanation: `The product's own limits apply first: at least ${min}${max !== undefined ? `, at most ${max}` : ", no maximum"}. “${winner.name}” (${targetLevelLabel[winner.target.type]} level) only fills in what the product leaves empty.`,
    };
  }
  const min = winner.minQuantity ?? baseMin;
  return {
    min,
    max: winner.maxQuantity ?? baseMax,
    rule: winner,
    candidates,
    explanation:
      `“${winner.name}” (${targetLevelLabel[winner.target.type]} level) sets min ${min}${winner.maxQuantity !== undefined ? `, max ${winner.maxQuantity}` : ", no maximum"} per order line.` +
      (winner.minQuantity === undefined ? ` It sets no minimum, so ${base?.min !== undefined ? "the product's own" : "the default of"} ${baseMin} applies.` : ""),
  };
}

/** Error message when a line quantity breaks the limits. */
export function checkQuantity(limits: Pick<QuantityLimits, "min" | "max" | "step">, quantity: number) {
  if (quantity < limits.min) return `Minimum ${limits.min} per order line.`;
  if (limits.max !== undefined && quantity > limits.max) return `Maximum ${limits.max} per order line.`;
  if (limits.step && limits.step > 1 && quantity % limits.step !== 0) return `Order in multiples of ${limits.step}.`;
  return undefined;
}

export function findQuantityConflicts(rules: QuantityLimitRule[]): RuleConflict[] {
  const active = rules.filter((r) => r.status === "active");
  const out: RuleConflict[] = [];
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const [a, b] = [active[i], active[j]];
      if (!targetsIntersect(a.target, b.target)) continue;
      const kind = a.priority === b.priority ? "conflict" : "overlap";
      out.push({ ruleId: a.id, otherId: b.id, kind }, { ruleId: b.id, otherId: a.id, kind });
    }
  return out;
}

// --- Validation ------------------------------------------------------------------------------

export const RULE_LIMITS = { name: 120, tiers: 10, maxQuantity: 100_000, priority: 1000 } as const;

const isQty = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= RULE_LIMITS.maxQuantity;

function validateTarget(target: RuleTarget, errors: FieldErrors) {
  if (target.type === "categories" && !target.categoryIds.length) errors.target = "Choose at least one category.";
  if (target.type === "products" && !target.productIds.length) errors.target = "Choose at least one product.";
  if (target.type === "variations" && (!target.productId || !target.variationIds.length)) errors.target = "Choose a product and at least one variation.";
}

/** Sorted, non-overlapping tiers with valid quantities and adjustments. */
export function validateTiers(tiers: PriceTier[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!tiers.length) errors.tiers = "Add at least one tier.";
  if (tiers.length > RULE_LIMITS.tiers) errors.tiers = `At most ${RULE_LIMITS.tiers} tiers.`;
  tiers.forEach((t, i) => {
    const p = `tiers.${i}.`;
    if (!isQty(t.minQuantity)) errors[`${p}minQuantity`] = "Whole number of at least 1.";
    if (t.maxQuantity !== undefined) {
      if (!isQty(t.maxQuantity)) errors[`${p}maxQuantity`] = "Whole number of at least 1, or empty for “and above”.";
      else if (isQty(t.minQuantity) && t.maxQuantity < t.minQuantity) errors[`${p}maxQuantity`] = "Must be at least the minimum.";
    } else if (i < tiers.length - 1) errors[`${p}maxQuantity`] = "Only the last tier can be open-ended.";
    const a = t.adjustment;
    if (a.type === "percent_off") {
      if (!(Number.isFinite(a.percent) && a.percent > 0 && a.percent <= 100 && Math.abs(Math.round(a.percent * 100) - a.percent * 100) < 1e-9))
        errors[`${p}value`] = "Percent above 0 and up to 100 (max 2 decimals).";
    } else if (!isValidAmount(a.amount) || (a.type === "amount_off" && a.amount === 0)) {
      errors[`${p}value`] = a.type === "amount_off" ? "Enter an amount above 0 (max 2 decimals)." : "Enter a price of 0 or more (max 2 decimals).";
    }
    const prev = tiers[i - 1];
    if (prev && isQty(t.minQuantity) && isQty(prev.minQuantity)) {
      if (t.minQuantity <= prev.minQuantity) errors[`${p}minQuantity`] = "Tiers must be in increasing order.";
      else if (prev.maxQuantity !== undefined && t.minQuantity <= prev.maxQuantity) errors[`${p}minQuantity`] = `Overlaps the previous tier (ends at ${prev.maxQuantity}).`;
    }
  });
  return errors;
}

export function validatePriceRule(input: PriceRuleInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 3) errors.name = "Give the rule a name (at least 3 characters).";
  else if (name.length > RULE_LIMITS.name) errors.name = `Keep it under ${RULE_LIMITS.name} characters.`;
  if (input.audience.type === "group" && !input.audience.groupId) errors.audience = "Choose a customer group.";
  if (input.audience.type === "customer" && !input.audience.customerId) errors.audience = "Choose a customer.";
  validateTarget(input.target, errors);
  if (!Number.isInteger(input.priority) || Math.abs(input.priority) > RULE_LIMITS.priority) errors.priority = `Whole number from −${RULE_LIMITS.priority} to ${RULE_LIMITS.priority}.`;
  if (input.validFrom && input.validTo && input.validTo < input.validFrom) errors.validTo = "Must be on or after the start date.";
  return { ...errors, ...validateTiers(input.tiers) };
}

/** Errors for tiers that would make any of the given base prices negative. */
export function negativePriceErrors(tiers: PriceTier[], basePrices: { label: string; price: number }[]): FieldErrors {
  const errors: FieldErrors = {};
  tiers.forEach((t, i) => {
    const bad = basePrices.find((b) => adjustedPrice(b.price, t.adjustment) === null);
    if (bad) errors[`tiers.${i}.value`] = `Would make ${bad.label} negative (base ${bad.price}). Lower the discount or narrow the target.`;
  });
  return errors;
}

export function validateQuantityRule(input: QuantityLimitRuleInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 3) errors.name = "Give the rule a name (at least 3 characters).";
  else if (name.length > RULE_LIMITS.name) errors.name = `Keep it under ${RULE_LIMITS.name} characters.`;
  validateTarget(input.target, errors);
  if (input.minQuantity === undefined && input.maxQuantity === undefined) errors.minQuantity = "Set a minimum, a maximum, or both.";
  if (input.minQuantity !== undefined && !isQty(input.minQuantity)) errors.minQuantity = "Whole number of at least 1.";
  if (input.maxQuantity !== undefined && !isQty(input.maxQuantity)) errors.maxQuantity = "Whole number of at least 1.";
  if (isQty(input.minQuantity) && isQty(input.maxQuantity) && input.minQuantity > input.maxQuantity) errors.maxQuantity = "Maximum must be at least the minimum.";
  if (!Number.isInteger(input.priority) || Math.abs(input.priority) > RULE_LIMITS.priority) errors.priority = `Whole number from −${RULE_LIMITS.priority} to ${RULE_LIMITS.priority}.`;
  return errors;
}
