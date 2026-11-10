import "server-only";
import { applyShippingRules, validateRule, type RuleContext, type ShippingGeneralSettings, type ShippingRule } from "@/lib/shipping/rules";
import type { ShippingQuote } from "@/lib/shipping/engine";

import { formatMoney } from "@/lib/format";
import { amountRule, isValidAmount, toGrams } from "@/lib/orders/calc";
import { cartMetrics, locationLabel, quoteShipping, validateZone } from "@/lib/shipping/engine";
import type { FieldErrors, PickupLocation, ShippingZone, ShippingZoneInput } from "@/lib/types";
import { storeView } from "./mock-company";
import { mockCategories, mockProducts, mockShippingClasses } from "./mock/catalog";
import { mockCustomers } from "./mock/customers";
import { basePriceOf, quotePrice, salePriceOf } from "./mock/pricing-rules";
import { mockShipping } from "./mock/shipping";
import { matches, paginate, sortBy } from "./mock-utils";
import type { SettingsRepository, ShippingQuoteLine, ShippingRepository, ShippingZoneListItem } from "./repositories";

/*
 * DEMO STORE: settings and zones live in memory (globalThis) — edits survive page
 * refreshes but not a server restart. Rates are SAMPLE values; the backend must repeat
 * the same matching and calculation at cart, checkout and order creation.
 */

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const invalid = (errors: Record<string, string>) => ({ ok: false as const, errors, message: "Some fields need attention." });
const zones = () => mockShipping.zones;
const classIds = () => mockShippingClasses.map((c) => c.id);
const className = (id: string) => mockShippingClasses.find((c) => c.id === id)?.name ?? id;

/** Matching order for display: most specific first, fallback last. */
function matchRank(z: ShippingZone) {
  if (z.isFallback) return 9;
  const levels = z.locations.map((l) => (l.type === "postcode" ? 0 : l.type === "city" ? 1 : 2));
  return Math.min(...levels, 3);
}

function listItem(z: ShippingZone): ShippingZoneListItem {
  const summary = z.isFallback ? "Every address no other zone matches" : z.locations.map(locationLabel).join(" · ");
  return { ...clone(z), locationSummary: summary };
}

/** Methods with fresh ids where missing; tiers sorted as entered (validation enforces order). */
function normalizeInput(input: ShippingZoneInput): ShippingZoneInput {
  return {
    name: input.name.trim(),
    locations: input.locations.map((l) =>
      l.type === "postcode" ? { type: l.type, postalCode: l.postalCode.trim() } : l.type === "city" ? { type: l.type, prefecture: l.prefecture, city: l.city.trim() } : { type: l.type, prefecture: l.prefecture },
    ),
    methods: input.methods.map((m) => ({ ...m, id: m.id || newId("m"), name: m.name.trim() })),
  };
}

export const mockSettingsRepository: SettingsRepository = {
  async getStore() {
    return storeView();
  },
};

/* DEMO STORE: rules, pickup points and general settings, in server memory. */
const extraStore = globalThis as typeof globalThis & { __mockShippingExtra?: { rules: ShippingRule[]; pickups: PickupLocation[]; general: ShippingGeneralSettings } };
extraStore.__mockShippingExtra ??= {
  rules: [
    { id: "rule-sample-coupon", name: "Sample: FREESHIP coupon", enabled: true, priority: 5, match: "all", conditions: [{ field: "coupon", op: "in", value: ["FREESHIP"] }], action: { type: "free" }, zoneIds: [] },
    { id: "rule-sample-heavy", name: "Sample: heavy cart surcharge", enabled: false, priority: 20, match: "all", conditions: [{ field: "weight", op: "gt", value: 50 }], action: { type: "surcharge", amount: 500, label: "Heavy cart" }, zoneIds: [] },
  ],
  pickups: [{ id: "pickup-main", name: "Main warehouse (sample)", address: "1-1-1 Sample-cho, Chiyoda-ku, Tokyo", hours: "Mon–Fri 9:00–17:00", instructions: "Bring your order number.", fee: 0, enabled: true }],
  general: { hidePaidWhenFree: false, unavailableMessage: "We don’t deliver to this address with these items yet. Contact us to arrange delivery." },
};
const extra = extraStore.__mockShippingExtra;

/** The product's categories with their parents, for rule conditions. */
function categorySlugsOf(productId: string) {
  const product = mockProducts.find((p) => p.id === productId);
  const slugs = new Set<string>();
  for (const id of product?.categoryIds ?? []) {
    for (let c = mockCategories.find((x) => x.id === id); c; c = c.parentId ? mockCategories.find((x) => x.id === c!.parentId) : undefined) slugs.add(c.slug);
  }
  return [...slugs];
}

const withRules = (quote: ShippingQuote, ctx: RuleContext) => applyShippingRules(quote, extra.rules, extra.general, mockShippingClasses, ctx, formatMoney);

export const shippingGeneral = () => extra.general;
export const pickupDetail = (id?: string) => {
  const p = extra.pickups.find((x) => x.id === id);
  return p && [p.name, p.address, p.hours].filter(Boolean).join(" · ");
};

export const mockShippingRepository: ShippingRepository = {
  async listZones({ search, sort = "match", dir, page, perPage } = {}) {
    const items = zones()
      .map(listItem)
      .filter((z) => matches(search, z.name, z.locationSummary, ...z.methods.map((m) => m.name)));
    const sorted =
      sort === "name"
        ? [...items].sort((a, b) => a.name.localeCompare(b.name) * (dir === "desc" ? -1 : 1))
        : [...items].sort((a, b) => (matchRank(a) - matchRank(b) || a.name.localeCompare(b.name)) * (dir === "desc" ? -1 : 1));
    return paginate(sorted, page, perPage);
  },

  async getZone(id) {
    const z = zones().find((x) => x.id === id);
    return z ? listItem(z) : null;
  },

  async createZone(input) {
    const clean = normalizeInput(input);
    const errors = validateZone(clean, { isFallback: false, others: zones(), classIds: classIds() });
    if (Object.keys(errors).length) return invalid(errors);
    const at = now();
    const zone: ShippingZone = { id: newId("zone"), ...clean, isFallback: false, createdAt: at, updatedAt: at };
    zones().push(zone);
    return { ok: true, value: clone(zone) };
  },

  async updateZone(id, input) {
    const i = zones().findIndex((z) => z.id === id);
    if (i < 0) return { ok: false, errors: {}, message: "Zone not found." };
    const existing = zones()[i];
    const clean = normalizeInput(input);
    const errors = validateZone(clean, { isFallback: existing.isFallback, others: zones().filter((z) => z.id !== id), classIds: classIds() });
    if (Object.keys(errors).length) return invalid(errors);
    zones()[i] = { ...existing, ...clean, updatedAt: now() };
    return { ok: true, value: clone(zones()[i]) };
  },

  async deleteZone(id) {
    const i = zones().findIndex((z) => z.id === id);
    if (i < 0) return { ok: false, errors: {}, message: "Zone not found." };
    if (zones()[i].isFallback) return { ok: false, errors: {}, message: "The fallback zone can't be deleted — every address needs a zone." };
    zones().splice(i, 1);
    return { ok: true, value: { id } };
  },

  async listRules() {
    return clone(sortBy(extra.rules, (r) => r.priority));
  },
  async getRule(id) {
    const r = extra.rules.find((x) => x.id === id);
    return r ? clone(r) : null;
  },
  async saveRule(id, input) {
    const errors = validateRule(input);
    if (Object.keys(errors).length) return invalid(errors);
    const existing = id ? extra.rules.find((r) => r.id === id) : undefined;
    if (id && !existing) return { ok: false, errors: {} as FieldErrors, message: "That rule no longer exists." };
    const next: ShippingRule = { ...input, name: input.name.trim(), id: existing?.id ?? `rule-${crypto.randomUUID().slice(0, 8)}` };
    if (existing) Object.assign(existing, next);
    else extra.rules.push(next);
    return { ok: true, value: clone(next) };
  },
  async deleteRule(id) {
    extra.rules = extra.rules.filter((r) => r.id !== id);
  },
  async listClasses() {
    return mockShippingClasses.map((c) => ({ ...c, products: mockProducts.filter((p) => p.shippingClassId === c.id || p.variations.some((v) => v.shippingClassId === c.id)).length }));
  },
  async saveClass(id, input) {
    const name = input.name.trim();
    const errors: FieldErrors = {};
    if (name.length < 2) errors.name = "Enter a class name.";
    else if (mockShippingClasses.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) errors.name = "That name is already in use.";
    if (input.surcharge !== undefined && !isValidAmount(input.surcharge)) errors.surcharge = "Enter zero or more.";
    if (Object.keys(errors).length) return invalid(errors);
    const existing = id ? mockShippingClasses.find((c) => c.id === id) : undefined;
    const next = { ...input, name, id: existing?.id ?? `class-${crypto.randomUUID().slice(0, 8)}` };
    if (existing) Object.assign(existing, next);
    else mockShippingClasses.push(next);
    return { ok: true, value: { ...next, products: 0 } };
  },
  async deleteClass(id) {
    const used = mockProducts.filter((p) => p.shippingClassId === id || p.variations.some((v) => v.shippingClassId === id)).length;
    if (used) return { ok: false, errors: {}, message: `${used} product${used === 1 ? " uses" : "s use"} this class. Change ${used === 1 ? "it" : "them"} first.` };
    const i = mockShippingClasses.findIndex((c) => c.id === id);
    if (i >= 0) mockShippingClasses.splice(i, 1);
    return { ok: true, value: { id } };
  },
  async listPickups() {
    return clone(extra.pickups);
  },
  async savePickup(id, input) {
    const errors: FieldErrors = {};
    if (input.name.trim().length < 2) errors.name = "Enter a name.";
    if (input.address.trim().length < 5) errors.address = "Enter the address.";
    if (!isValidAmount(input.fee)) errors.fee = `Enter zero or more, with ${amountRule()}.`;
    if (Object.keys(errors).length) return invalid(errors);
    const existing = id ? extra.pickups.find((p) => p.id === id) : undefined;
    const next: PickupLocation = { ...input, name: input.name.trim(), id: existing?.id ?? `pickup-${crypto.randomUUID().slice(0, 8)}` };
    if (existing) Object.assign(existing, next);
    else extra.pickups.push(next);
    return { ok: true, value: clone(next) };
  },
  async deletePickup(id) {
    extra.pickups = extra.pickups.filter((p) => p.id !== id);
  },
  async getGeneral() {
    return clone(extra.general);
  },
  async updateGeneral(input) {
    extra.general = clone(input);
  },
  async setMethodEnabled(zoneId, methodId, enabled) {
    const method = zones().find((z) => z.id === zoneId)?.methods.find((m) => m.id === methodId);
    if (!method) return { ok: false, errors: {}, message: "That method no longer exists." };
    method.enabled = enabled;
    return { ok: true, value: { id: methodId } };
  },
  async testDraftZone(zone, { address, grams, subtotal }) {
    const draft: ShippingZone = { ...zone, id: "draft", isFallback: false, createdAt: "", updatedAt: "" };
    // One pretend line, so the numbers entered are what the methods see.
    const item = { productId: "test", name: "Test cart", quantity: 1, unitPrice: subtotal, unitGrams: grams };
    return clone(withRules(quoteShipping([draft], address, [item], { money: formatMoney, className }), { address, items: [{ productId: "test", categorySlugs: [], quantity: 1 }] }));
  },
  async quote({ address, items, customerId, couponCode, customerGroupId, grams, subtotal }) {
    const customer = customerId ? mockCustomers.find((c) => c.id === customerId) : undefined;
    const lines: ShippingQuoteLine[] = [];
    const skipped: string[] = [];
    for (const line of items.slice(0, 100)) {
      const product = mockProducts.find((p) => p.id === line.productId);
      const variation = product?.variations.find((v) => v.id === line.variationId);
      if (!product || (product.type === "variable" && !variation) || !Number.isInteger(line.quantity) || line.quantity < 1) {
        skipped.push(product ? `${product.name}: choose an option and a whole quantity` : `Unknown product ${line.productId}`);
        continue;
      }
      let unitPrice = line.unitPrice;
      let priceSource: ShippingQuoteLine["priceSource"] = "given";
      if (unitPrice === undefined) {
        const quoted = customer && quotePrice(product, customer, variation?.id, line.quantity);
        const sale = salePriceOf(product, variation?.id);
        unitPrice = quoted ? quoted.unitPrice : (sale ?? basePriceOf(product, variation?.id));
        priceSource = quoted ? quoted.priceSource : sale !== undefined ? "sale" : "regular";
      }
      if (unitPrice === undefined) {
        skipped.push(`${product.name}: no price`);
        continue;
      }
      // A variation's own weight and shipping class override the product's.
      const weight = variation?.weight ?? product.weight;
      lines.push({
        productId: product.id,
        variationId: variation?.id,
        name: product.name,
        sku: variation?.sku ?? product.sku,
        variationLabel: variation ? Object.values(variation.attributes).join(" / ") : undefined,
        quantity: line.quantity,
        unitPrice,
        discount: line.discount,
        unitGrams: toGrams(weight),
        weightFrom: variation?.weight ? "variation" : "product",
        shippingClassId: variation?.shippingClassId ?? product.shippingClassId,
        priceSource,
      });
    }
    // Tester numbers replace the cart's: one pretend line with those totals, so every method sees them.
    const overridden = grams !== undefined || subtotal !== undefined;
    const real = cartMetrics(lines);
    const effective = overridden ? [{ productId: "test", name: "Test cart", quantity: 1, unitPrice: subtotal ?? real.subtotal, unitGrams: grams ?? real.totalGrams }] : lines;
    const quote = withRules(quoteShipping(zones(), address, effective, { money: formatMoney, className }), {
      address,
      items: lines.map((l) => ({ productId: l.productId, categorySlugs: categorySlugsOf(l.productId), shippingClassId: l.shippingClassId, quantity: l.quantity })),
      customerGroupId: customerGroupId ?? customer?.groupId,
      couponCode,
      grams,
      subtotal,
    });
    return clone({ quote, lines, skipped });
  },
};
