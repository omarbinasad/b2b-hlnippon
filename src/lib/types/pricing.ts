import type { LegacyRef } from "./catalog";
import type { ID, ISODateString, Money } from "./common";

/*
 * B2B pricing and quantity rules. Selection and calculation live in the pure
 * engine (src/lib/pricing/engine.ts); the backend must implement the same
 * precedence and enforce it at cart and checkout (docs/backend-api.md).
 */

/** What a rule applies to. Category rules include subcategories. */
export type RuleTarget =
  | { type: "all" }
  | { type: "categories"; categoryIds: ID[] }
  | { type: "products"; productIds: ID[] }
  | { type: "variations"; productId: ID; variationIds: ID[] };

/** Who a price rule applies to. Only approved customers ever get rule prices. */
export type PriceRuleAudience =
  | { type: "all" }
  | { type: "group"; groupId: ID }
  | { type: "customer"; customerId: ID };

export type PriceAdjustment =
  /** Final unit price. */
  | { type: "fixed_price"; amount: Money }
  /** Amount off the base unit price. */
  | { type: "amount_off"; amount: Money }
  /** Percentage off the base unit price (0 < percent ≤ 100, up to 2 decimals). */
  | { type: "percent_off"; percent: number };

/**
 * Quantity band of a rule. Tiers are sorted, non-overlapping and contiguous is not
 * required; `maxQuantity` undefined = "and above" (only allowed on the last tier).
 * A one-tier rule starting at 1 is a plain (non-bulk) price.
 */
export interface PriceTier {
  minQuantity: number;
  maxQuantity?: number;
  adjustment: PriceAdjustment;
}

export type RuleStatus = "active" | "disabled";

export interface PriceRule extends LegacyRef {
  id: ID;
  name: string;
  status: RuleStatus;
  audience: PriceRuleAudience;
  target: RuleTarget;
  tiers: PriceTier[];
  /** Tie-breaker within the same audience and target level; higher wins. */
  priority: number;
  validFrom?: ISODateString;
  validTo?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type PriceRuleInput = Pick<PriceRule, "name" | "status" | "audience" | "target" | "tiers" | "priority" | "validFrom" | "validTo">;

/** Per-line minimum/maximum quantity. Category rules apply to each matching line, not the category total. */
export interface QuantityLimitRule extends LegacyRef {
  id: ID;
  name: string;
  status: RuleStatus;
  target: RuleTarget;
  minQuantity?: number;
  maxQuantity?: number;
  /** Tie-breaker within the same target level; higher wins. */
  priority: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type QuantityLimitRuleInput = Pick<QuantityLimitRule, "name" | "status" | "target" | "minQuantity" | "maxQuantity" | "priority">;

/** Price for one customer / product option / quantity, with the rule that produced it. */
export interface ResolvedPrice {
  productId: ID;
  variationId?: ID;
  /** Regular price. */
  basePrice: Money;
  /** Active sale price, if any (used only when no rule applies). */
  salePrice?: Money;
  unitPrice: Money;
  priceSource: "rule" | "sale" | "regular";
  appliedRuleId?: ID;
  appliedRuleName?: string;
  appliedTier?: Pick<PriceTier, "minQuantity" | "maxQuantity">;
}
