import "server-only";

import { lineAmounts } from "@/lib/orders/calc";
import { buildTaxSnapshot, calculateTax, locationLevelLabel, matchTaxRate, taxLocationLabel, validateTaxRate, validateTaxSettings } from "@/lib/tax/engine";
import type { TaxClass, TaxLocation, TaxRate, TaxRateInput } from "@/lib/types";
import { mockProducts, mockTaxClasses } from "./mock/catalog";
import { mockCustomers } from "./mock/customers";
import { basePriceOf, quotePrice, salePriceOf } from "./mock/pricing-rules";
import { mockTax } from "./mock/tax";
import { matches, paginate } from "./mock-utils";
import { mockShippingRepository } from "./mock-shipping";
import type { TaxPreviewLine, TaxRateListItem, TaxRepository } from "./repositories";
import { storeCountry } from "@/lib/locations";

/*
 * DEMO STORE: tax settings and FICTIONAL rates live in memory (globalThis). The backend
 * performs the authoritative calculation; this mirrors the documented rules for previews.
 */

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);
const newId = () => `tax-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const invalid = (errors: Record<string, string>) => ({ ok: false as const, errors, message: "Some fields need attention." });
const classIds = () => mockTaxClasses.map((c) => c.id);
const levelRank: Record<TaxLocation["type"], number> = { postcode: 0, city: 1, prefecture: 2, country: 3 };

const listItem = (r: TaxRate): TaxRateListItem => ({ ...clone(r), locationLabel: taxLocationLabel(r.location) });

function normalize(input: TaxRateInput): TaxRateInput {
  const l = input.location;
  return {
    name: input.name.trim(),
    percent: input.percent,
    taxClass: input.taxClass,
    enabled: input.enabled,
    location:
      l.type === "postcode" ? { type: l.type, postalCode: l.postalCode.trim() }
      : l.type === "city" ? { type: l.type, prefecture: l.prefecture, city: l.city.trim() }
      : l.type === "prefecture" ? { type: l.type, prefecture: l.prefecture }
      : { type: "country", country: storeCountry() },
  };
}

export const mockTaxRepository: TaxRepository = {
  async getSettings() {
    return clone(mockTax.settings);
  },

  async updateSettings(input) {
    const errors = validateTaxSettings(input, classIds());
    if (Object.keys(errors).length) return invalid(errors);
    mockTax.settings = { ...input, updatedAt: now() };
    return { ok: true, value: clone(mockTax.settings) };
  },

  async classes() {
    return mockTaxClasses.map((c) => ({
      ...c,
      products: mockProducts.filter((p) => p.status !== "archived" && p.taxClass === c.id).length,
      variationOverrides: mockProducts.reduce((n, p) => n + p.variations.filter((v) => v.taxClass && v.taxClass === c.id && v.taxClass !== p.taxClass).length, 0),
      hasFallback: mockTax.rates.some((r) => r.enabled && r.taxClass === c.id && r.location.type === "country"),
    }));
  },

  async listRates({ search, taxClass, enabled, sort = "match", dir, page, perPage } = {}) {
    const items = mockTax.rates
      .filter((r) => (!taxClass || r.taxClass === taxClass) && (enabled === undefined || r.enabled === enabled))
      .map(listItem)
      .filter((r) => matches(search, r.name, r.locationLabel, r.taxClass));
    const m = dir === "desc" ? -1 : 1;
    items.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) * m
      : sort === "percent" ? (a.percent - b.percent) * m
      : (a.taxClass.localeCompare(b.taxClass) || levelRank[a.location.type] - levelRank[b.location.type] || a.name.localeCompare(b.name)) * m,
    );
    return paginate(items, page, perPage);
  },

  async getRate(id) {
    const r = mockTax.rates.find((x) => x.id === id);
    return r ? listItem(r) : null;
  },

  async createRate(input) {
    const clean = normalize(input);
    const errors = validateTaxRate(clean, mockTax.rates, classIds());
    if (Object.keys(errors).length) return invalid(errors);
    const at = now();
    const rate: TaxRate = { id: newId(), ...clean, createdAt: at, updatedAt: at };
    mockTax.rates.push(rate);
    return { ok: true, value: clone(rate) };
  },

  async updateRate(id, input) {
    const i = mockTax.rates.findIndex((r) => r.id === id);
    if (i < 0) return { ok: false, errors: {}, message: "Rate not found." };
    const clean = normalize(input);
    const errors = validateTaxRate(clean, mockTax.rates.filter((r) => r.id !== id), classIds());
    if (Object.keys(errors).length) return invalid(errors);
    // Existing orders keep their own rate snapshot, so editing never changes them.
    mockTax.rates[i] = { ...mockTax.rates[i], ...clean, updatedAt: now() };
    return { ok: true, value: clone(mockTax.rates[i]) };
  },

  async deleteRate(id) {
    const i = mockTax.rates.findIndex((r) => r.id === id);
    if (i < 0) return { ok: false, errors: {}, message: "Rate not found." };
    mockTax.rates.splice(i, 1);
    return { ok: true, value: { id } };
  },

  async snapshotFor(address) {
    return buildTaxSnapshot(mockTax.settings, mockTax.rates, address, classIds(), now());
  },

  async preview({ address, customerId, lines: input, shippingMethodId = "auto", shippingAmount }) {
    const customer = customerId ? mockCustomers.find((c) => c.id === customerId) : undefined;
    const lines: (TaxPreviewLine & { discount: number })[] = [];
    const skipped: string[] = [];
    for (const l of input.slice(0, 100)) {
      const product = mockProducts.find((p) => p.id === l.productId);
      const variation = product?.variations.find((v) => v.id === l.variationId);
      if (!product || (product.type === "variable" && !variation) || !Number.isInteger(l.quantity) || l.quantity < 1) {
        skipped.push(product ? `${product.name}: choose an option and a whole quantity` : `Unknown product ${l.productId}`);
        continue;
      }
      let unitPrice = l.unitPrice;
      let priceSource: TaxPreviewLine["priceSource"] = "given";
      if (unitPrice === undefined || !Number.isFinite(unitPrice)) {
        const quoted = customer && quotePrice(product, customer, variation?.id, l.quantity);
        const sale = salePriceOf(product, variation?.id);
        unitPrice = quoted ? quoted.unitPrice : (sale ?? basePriceOf(product, variation?.id));
        priceSource = quoted ? quoted.priceSource : sale !== undefined ? "sale" : "regular";
      }
      if (unitPrice === undefined) {
        skipped.push(`${product.name}: no price`);
        continue;
      }
      lines.push({
        productId: product.id,
        variationId: variation?.id,
        name: product.name,
        variationLabel: variation ? Object.values(variation.attributes).join(" / ") : undefined,
        sku: variation?.sku ?? product.sku,
        quantity: l.quantity,
        unitPrice,
        priceSource,
        // A variation's own tax class overrides the product's.
        taxClass: variation?.taxClass ?? product.taxClass,
        classFrom: variation?.taxClass ? "variation" : "product",
        taxable: product.taxStatus === "taxable",
        discount: l.discount && Number.isFinite(l.discount) ? l.discount : 0,
      });
    }

    // Shipping: suggested method, a chosen method of the matched zone, none, or an override amount.
    const ship = await mockShippingRepository.quote({
      address,
      items: lines.map((l) => ({ productId: l.productId, variationId: l.variationId, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
    });
    const options = ship.quote.options.map((o) => ({ id: o.method.id, name: o.method.name, cost: o.cost, available: o.available }));
    const chosen = shippingMethodId === "auto" ? ship.quote.selected : ship.quote.options.find((o) => o.method.id === shippingMethodId && o.available);
    const amount = shippingAmount !== undefined && Number.isFinite(shippingAmount) ? shippingAmount : shippingMethodId === "none" ? 0 : (chosen?.cost ?? 0);

    const snapshot = buildTaxSnapshot(mockTax.settings, mockTax.rates, address, classIds(), now());
    const calc = calculateTax(
      snapshot,
      lines.map((l, i) => {
        const a = lineAmounts({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, pricedByWeight: false, orderedWeight: { value: 0, unit: "kg" } });
        return { key: `line-${i}`, label: l.name, taxClass: l.taxClass, taxable: l.taxable, subtotal: a.subtotal, discount: a.discount };
      }),
      amount,
    );
    const classes: TaxClass[] = classIds();
    return clone({
      calc,
      lines: lines.map((l) => ({ ...l, discount: undefined })) as TaxPreviewLine[],
      shipping: { zoneName: ship.quote.match.zone?.name, options, selectedId: shippingMethodId === "none" ? undefined : chosen?.method.id, amount },
      snapshot,
      matches: classes.map((c) => {
        const m = matchTaxRate(mockTax.rates, c, address);
        return { taxClass: c, explanation: m.rate ? `${m.rate.name} — ${m.rate.percent}% (${locationLevelLabel[m.level!]})` : m.explanation };
      }),
      skipped: [...skipped, ...ship.skipped],
    });
  },
};
