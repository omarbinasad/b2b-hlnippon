import "server-only";

import { formatMoney } from "@/lib/format";
import { toGrams } from "@/lib/orders/calc";
import { locationLabel, quoteShipping, validateZone } from "@/lib/shipping/engine";
import type { ShippingZone, ShippingZoneInput } from "@/lib/types";
import { validateStoreSettings } from "@/lib/validation/settings";
import { mockProducts, mockShippingClasses } from "./mock/catalog";
import { mockCustomers } from "./mock/customers";
import { basePriceOf, quotePrice, salePriceOf } from "./mock/pricing-rules";
import { mockShipping } from "./mock/shipping";
import { matches, paginate } from "./mock-utils";
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
    return clone(mockShipping.settings);
  },
  async updateStore(input) {
    const errors = validateStoreSettings(input);
    if (Object.keys(errors).length) return invalid(errors);
    mockShipping.settings = {
      ...mockShipping.settings,
      storeName: input.storeName.trim(),
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      address: {
        addressLine1: input.address.addressLine1.trim(),
        addressLine2: input.address.addressLine2?.trim() || undefined,
        area: input.address.area?.trim() || undefined,
        city: input.address.city.trim(),
        prefecture: input.address.prefecture,
        postalCode: input.address.postalCode.trim(),
        country: "JP",
      },
      weightUnit: input.weightUnit,
      dimensionUnit: input.dimensionUnit,
      updatedAt: now(),
    };
    return { ok: true, value: clone(mockShipping.settings) };
  },
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

  async quote({ address, items, customerId }) {
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
    const quote = quoteShipping(zones(), address, lines, { money: formatMoney, className });
    return clone({ quote, lines, skipped });
  },
};
