/**
 * Mock adapters between the catalog and the pure rule engine (src/lib/pricing/engine.ts).
 * DEMO calculations: the backend must apply the same precedence and enforce it at
 * cart and checkout. UI components never import this file.
 */
import { siteConfig } from "@/config/site";
import { activeSalePrice, resolvePrice, resolveQuantityLimits, type RuleItem } from "@/lib/pricing/engine";
import type { Customer, Product, TaxClass } from "@/lib/types";
import { mockCategories } from "./catalog";
import { mockPriceRules, mockQuantityRules } from "./price-rules";

/** Placeholder tax rates (%) for older mock orders without a tax snapshot — the same FICTIONAL demo rates as the tax module, not official rates. Real rates come from backend tax settings. */
export const mockTaxRates: Record<TaxClass, number> = { standard: 9, reduced: 6, exempt: 0 };

/** Category ids of a product including all ancestors, so parent-category rules match. */
function withAncestors(categoryIds: string[]) {
  const out = new Set<string>();
  for (let id of categoryIds) {
    for (let guard = 0; id && !out.has(id) && guard < 20; guard++) {
      out.add(id);
      id = mockCategories.find((c) => c.id === id)?.parentId ?? "";
    }
  }
  return [...out];
}

export const ruleItem = (product: Pick<Product, "id" | "categoryIds">, variationId?: string): RuleItem => ({
  productId: product.id,
  variationId,
  categoryIds: withAncestors(product.categoryIds),
});

/** Regular catalog price of the product or variation — the base for percentage and amount-off rules. */
export function basePriceOf(product: Product, variationId?: string) {
  const variation = product.variations.find((v) => v.id === variationId);
  return variation?.basePrice ?? product.basePrice;
}

const storeDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timeZone }).format(d);

/** Sale price active on that date for the product or variation (variations carry their own sale fields). */
export function salePriceOf(product: Product, variationId: string | undefined, now = new Date()) {
  const regular = basePriceOf(product, variationId);
  if (regular === undefined) return undefined;
  const v = product.variations.find((x) => x.id === variationId);
  const sale = v ? { price: v.salePrice, from: v.saleFrom, to: v.saleTo } : { price: product.salePrice, from: product.saleFrom, to: product.saleTo };
  return activeSalePrice(regular, sale, storeDate(now));
}

/**
 * Customer's unit price for a product option and quantity, with the rule that produced it.
 * Rules use the regular price; the active sale price is used only when no rule applies.
 */
export function quotePrice(product: Product, customer: Pick<Customer, "id" | "groupId" | "status">, variationId: string | undefined, quantity: number, now = new Date()) {
  const basePrice = basePriceOf(product, variationId);
  if (basePrice === undefined) return null;
  const salePrice = salePriceOf(product, variationId, now);
  return resolvePrice({ rules: mockPriceRules, customer, item: ruleItem(product, variationId), basePrice, salePrice, quantity, now });
}

export const quantityLimitsFor = (product: Pick<Product, "id" | "categoryIds">, variationId?: string) =>
  resolveQuantityLimits(mockQuantityRules, ruleItem(product, variationId));
