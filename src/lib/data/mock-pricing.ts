import "server-only";

import { publicProducts } from "./mock-catalog";
import { pricingCustomerById } from "./mock/standard-customer";
import {
  checkQuantity,
  findPriceConflicts,
  findQuantityConflicts,
  negativePriceErrors,
  TARGET_LEVEL,
  AUDIENCE_LEVEL,
  validatePriceRule,
  validateQuantityRule,
} from "@/lib/pricing/engine";
import type { PriceRule, PriceRuleInput, Product, QuantityLimitRule, QuantityLimitRuleInput, RuleTarget } from "@/lib/types";
import { mockCategories, mockProducts } from "./mock/catalog";
import { mockCustomerGroups, mockCustomers } from "./mock/customers";
import { mockPriceRules, mockQuantityRules } from "./mock/price-rules";
import { basePriceOf, quantityLimitsFor, quotePrice, ruleItem } from "./mock/pricing-rules";
import { matches, paginate, sortBy, type SortKey } from "./mock-utils";
import type { PriceRuleListItem, PricingRepository, QuantityRuleListItem, QuantityRuleRepository, RuleConflictItem, SaveResult } from "./repositories";

/*
 * DEMO STORE: rules live in memory (globalThis) — edits survive page refreshes but
 * not a server restart. Prices are DEMO calculations from the shared engine; the
 * backend must apply the same precedence and enforce it at cart and checkout.
 */

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const invalid = (errors: Record<string, string>) => ({ ok: false as const, errors, message: "Some fields need attention." });

const variationLabel = (attributes: Record<string, string>) => Object.values(attributes).join(" / ");

export function targetName(target: RuleTarget) {
  switch (target.type) {
    case "all":
      return "All products";
    case "categories":
      return `Categories: ${target.categoryIds.map((id) => mockCategories.find((c) => c.id === id)?.name ?? id).join(", ")}`;
    case "products": {
      const names = target.productIds.map((id) => mockProducts.find((p) => p.id === id)?.name ?? id);
      return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more` : names.join(", ");
    }
    case "variations": {
      const p = mockProducts.find((x) => x.id === target.productId);
      const vs = target.variationIds.map((id) => {
        const v = p?.variations.find((x) => x.id === id);
        return v ? variationLabel(v.attributes) : id;
      });
      return `${p?.name ?? target.productId} — ${vs.join(", ")}`;
    }
  }
}

function audienceName(a: PriceRule["audience"]) {
  if (a.type === "all") return "All approved customers";
  if (a.type === "group") return mockCustomerGroups.find((g) => g.id === a.groupId)?.name ?? a.groupId;
  return mockCustomers.find((c) => c.id === a.customerId)?.companyName ?? a.customerId;
}

/** Products (and variation option prices) a target covers, for the negative-price check. */
function targetBasePrices(target: RuleTarget) {
  const out: { label: string; price: number }[] = [];
  const add = (p: Product, variationId?: string) => {
    const price = basePriceOf(p, variationId);
    const v = p.variations.find((x) => x.id === variationId);
    if (price !== undefined) out.push({ label: v ? `${p.name} (${variationLabel(v.attributes)})` : p.name, price });
  };
  for (const p of mockProducts) {
    if (p.status === "archived") continue;
    if (target.type === "variations") {
      if (p.id === target.productId) target.variationIds.forEach((id) => add(p, id));
      continue;
    }
    const item = ruleItem(p);
    const hit =
      target.type === "all" ||
      (target.type === "products" && target.productIds.includes(p.id)) ||
      (target.type === "categories" && target.categoryIds.some((id) => item.categoryIds.includes(id)));
    if (!hit) continue;
    if (p.type === "variable") p.variations.forEach((v) => add(p, v.id));
    else add(p);
  }
  return out.sort((a, b) => a.price - b.price);
}

/** References must exist (ids from the catalog and customers store). */
function referenceErrors(input: { target: RuleTarget; audience?: PriceRule["audience"] }) {
  const errors: Record<string, string> = {};
  const t = input.target;
  if (t.type === "categories" && t.categoryIds.some((id) => !mockCategories.some((c) => c.id === id))) errors.target = "Unknown category.";
  if (t.type === "products" && t.productIds.some((id) => !mockProducts.some((p) => p.id === id))) errors.target = "Unknown product.";
  if (t.type === "variations") {
    const p = mockProducts.find((x) => x.id === t.productId);
    if (!p || t.variationIds.some((id) => !p.variations.some((v) => v.id === id))) errors.target = "Unknown product or variation.";
  }
  const a = input.audience;
  if (a?.type === "group" && a.groupId && !mockCustomerGroups.some((g) => g.id === a.groupId)) errors.audience = "Unknown group.";
  if (a?.type === "customer" && a.customerId && !mockCustomers.some((c) => c.id === a.customerId)) errors.audience = "Unknown customer.";
  return errors;
}

const normalizeTarget = (t: RuleTarget): RuleTarget =>
  t.type === "categories" ? { type: t.type, categoryIds: [...new Set(t.categoryIds)] }
  : t.type === "products" ? { type: t.type, productIds: [...new Set(t.productIds)] }
  : t.type === "variations" ? { type: t.type, productId: t.productId, variationIds: [...new Set(t.variationIds)] }
  : { type: "all" };

function conflictItems<T extends { id: string; name: string }>(id: string, conflicts: { ruleId: string; otherId: string; kind: "conflict" | "overlap" }[], rules: T[]): RuleConflictItem[] {
  return conflicts.filter((c) => c.ruleId === id).map((c) => ({ ...c, otherName: rules.find((r) => r.id === c.otherId)?.name ?? c.otherId }));
}

function priceListItems(): PriceRuleListItem[] {
  const conflicts = findPriceConflicts(mockPriceRules);
  return mockPriceRules.map((r) => ({ ...clone(r), audienceName: audienceName(r.audience), targetName: targetName(r.target), conflicts: conflictItems(r.id, conflicts, mockPriceRules) }));
}

function savePriceRule(input: PriceRuleInput, existing?: PriceRule): SaveResult<PriceRule> {
  const errors = { ...validatePriceRule(input), ...referenceErrors(input) };
  if (!errors.target && !Object.keys(errors).some((k) => k.startsWith("tiers"))) Object.assign(errors, negativePriceErrors(input.tiers, targetBasePrices(input.target)));
  if (Object.keys(errors).length) return invalid(errors);
  const at = now();
  const rule: PriceRule = {
    ...existing,
    id: existing?.id ?? newId("rule"),
    name: input.name.trim(),
    status: input.status,
    audience: input.audience,
    target: normalizeTarget(input.target),
    tiers: input.tiers.map((t) => ({ minQuantity: t.minQuantity, maxQuantity: t.maxQuantity, adjustment: t.adjustment })),
    priority: input.priority,
    validFrom: input.validFrom || undefined,
    validTo: input.validTo || undefined,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };
  const i = mockPriceRules.findIndex((r) => r.id === rule.id);
  if (i >= 0) mockPriceRules[i] = rule;
  else mockPriceRules.push(rule);
  return { ok: true, value: clone(rule) };
}

export const mockPricingRepository: PricingRepository = {
  async getCustomerPrices(customerId, productIds) {
    const customer = pricingCustomerById(customerId);
    if (!customer || customer.status !== "approved") return [];
    return mockProducts
      .filter((p) => productIds.includes(p.id) && p.basePrice !== undefined)
      .map((p) => {
        const r = quotePrice(p, customer, undefined, 1)!;
        return { productId: p.id, basePrice: r.basePrice, salePrice: r.salePrice, unitPrice: r.unitPrice, priceSource: r.priceSource, appliedRuleId: r.rule?.id, appliedRuleName: r.rule?.name, appliedTier: r.tier && { minQuantity: r.tier.minQuantity, maxQuantity: r.tier.maxQuantity } };
      });
  },

  async productIdsInPriceRange(customerId, { min, max }) {
    const customer = pricingCustomerById(customerId);
    if (!customer || customer.status !== "approved") return [];
    const inRange = (price: number | undefined) => price !== undefined && (min === undefined || price >= min) && (max === undefined || price <= max);
    return mockProducts
      .filter((p) =>
        p.type === "variable"
          ? p.variations.some((v) => v.status === "active" && inRange(quotePrice(p, customer, v.id, 1)?.unitPrice))
          : inRange(quotePrice(p, customer, undefined, 1)?.unitPrice),
      )
      .map((p) => p.id);
  },

  async priceBounds(customerId) {
    const customer = pricingCustomerById(customerId);
    if (!customer || customer.status !== "approved") return null;
    // Only what the shop lists, so the slider's ends match the products a customer can find.
    const prices = publicProducts(false)
      .flatMap((p) =>
        p.type === "variable"
          ? p.variations.filter((v) => v.status === "active").map((v) => quotePrice(p, customer, v.id, 1)?.unitPrice)
          : [quotePrice(p, customer, undefined, 1)?.unitPrice],
      )
      .filter((x): x is number => x !== undefined);
    return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
  },

  async listRules({ search, audienceType, targetType, status, withConflicts, sort = "audience", dir, page, perPage } = {}) {
    const filtered = priceListItems().filter(
      (r) =>
        (!audienceType || r.audience.type === audienceType) &&
        (!targetType || r.target.type === targetType) &&
        (!status || r.status === status) &&
        (!withConflicts || r.conflicts.length > 0) &&
        matches(search, r.name, r.audienceName, r.targetName, r.id),
    );
    // Default order mirrors precedence: strongest audience and target first, then priority.
    const key = (r: PriceRuleListItem): SortKey => {
      switch (sort) {
        case "name": return r.name;
        case "target": return TARGET_LEVEL[r.target.type] * 1e6 + r.priority;
        case "priority": return r.priority;
        case "updated": return r.updatedAt;
        default: return AUDIENCE_LEVEL[r.audience.type] * 1e9 + TARGET_LEVEL[r.target.type] * 1e6 + r.priority;
      }
    };
    return paginate(sortBy(filtered, key, dir ?? (sort === "name" ? "asc" : "desc")), page, perPage);
  },

  async getRule(id) {
    return priceListItems().find((r) => r.id === id) ?? null;
  },

  async createRule(input) {
    return savePriceRule(input);
  },

  async updateRule(id, input) {
    const existing = mockPriceRules.find((r) => r.id === id);
    if (!existing) return { ok: false, errors: {}, message: "Rule not found." };
    return savePriceRule(input, existing);
  },

  async setRuleStatus(id, status) {
    const rule = mockPriceRules.find((r) => r.id === id);
    if (!rule) return { ok: false, errors: {}, message: "Rule not found." };
    Object.assign(rule, { status, updatedAt: now() });
    return { ok: true, value: clone(rule) };
  },

  async productOption(productId) {
    const p = mockProducts.find((x) => x.id === productId);
    if (!p) return null;
    return {
      productId: p.id,
      name: p.name,
      unitLabel: p.unitLabel,
      basePrice: p.basePrice,
      variations: p.variations.map((v) => ({ id: v.id, label: variationLabel(v.attributes), sku: v.sku, basePrice: v.basePrice, status: v.status })),
    };
  },

  async testRules({ customerId, productId, variationId, quantity }) {
    const product = mockProducts.find((p) => p.id === productId);
    if (!product) return null;
    if (product.type === "variable" && !product.variations.some((v) => v.id === variationId)) return null;
    const qty = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1;
    const limits = quantityLimitsFor(product, variationId);
    const customer = customerId ? mockCustomers.find((c) => c.id === customerId) : undefined;
    const variation = product.variations.find((v) => v.id === variationId);
    return clone({
      customer: customer && {
        id: customer.id,
        companyName: customer.companyName,
        status: customer.status,
        groupName: mockCustomerGroups.find((g) => g.id === customer.groupId)?.name,
      },
      product: { id: product.id, name: product.name, unitLabel: product.unitLabel, variationLabel: variation && variationLabel(variation.attributes) },
      price: customer ? (quotePrice(product, customer, variationId, qty) ?? undefined) : undefined,
      limits,
      quantityError: checkQuantity(limits, qty),
    });
  },
};

// --- Quantity rules -------------------------------------------------------------------

function quantityListItems(): QuantityRuleListItem[] {
  const conflicts = findQuantityConflicts(mockQuantityRules);
  return mockQuantityRules.map((r) => ({ ...clone(r), targetName: targetName(r.target), conflicts: conflictItems(r.id, conflicts, mockQuantityRules) }));
}

function saveQuantityRule(input: QuantityLimitRuleInput, existing?: QuantityLimitRule): SaveResult<QuantityLimitRule> {
  const errors = { ...validateQuantityRule(input), ...referenceErrors(input) };
  if (Object.keys(errors).length) return invalid(errors);
  const at = now();
  const rule: QuantityLimitRule = {
    ...existing,
    id: existing?.id ?? newId("qty"),
    name: input.name.trim(),
    status: input.status,
    target: normalizeTarget(input.target),
    minQuantity: input.minQuantity,
    maxQuantity: input.maxQuantity,
    priority: input.priority,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };
  const i = mockQuantityRules.findIndex((r) => r.id === rule.id);
  if (i >= 0) mockQuantityRules[i] = rule;
  else mockQuantityRules.push(rule);
  return { ok: true, value: clone(rule) };
}

export const mockQuantityRuleRepository: QuantityRuleRepository = {
  async list({ search, targetType, status, sort = "target", dir, page, perPage } = {}) {
    const filtered = quantityListItems().filter(
      (r) => (!targetType || r.target.type === targetType) && (!status || r.status === status) && matches(search, r.name, r.targetName, r.id),
    );
    const key = (r: QuantityRuleListItem): SortKey =>
      sort === "name" ? r.name : sort === "priority" ? r.priority : sort === "updated" ? r.updatedAt : TARGET_LEVEL[r.target.type] * 1e6 + r.priority;
    return paginate(sortBy(filtered, key, dir ?? (sort === "name" ? "asc" : "desc")), page, perPage);
  },
  async get(id) {
    return quantityListItems().find((r) => r.id === id) ?? null;
  },
  async create(input) {
    return saveQuantityRule(input);
  },
  async update(id, input) {
    const existing = mockQuantityRules.find((r) => r.id === id);
    if (!existing) return { ok: false, errors: {}, message: "Rule not found." };
    return saveQuantityRule(input, existing);
  },
  async setStatus(id, status) {
    const rule = mockQuantityRules.find((r) => r.id === id);
    if (!rule) return { ok: false, errors: {}, message: "Rule not found." };
    Object.assign(rule, { status, updatedAt: now() });
    return { ok: true, value: clone(rule) };
  },
  async effectiveFor(productId, variationId) {
    const product = mockProducts.find((p) => p.id === productId);
    return product ? clone(quantityLimitsFor(product, variationId)) : null;
  },
};
