import "server-only";

import { getMockDashboard } from "./mock-analytics";
import { mockCustomerRepository, mockLocationRepository } from "./mock-customers";
import { mockDeliveryRoutes, mockReminders } from "./mock/pricing-delivery";
import { mockPricingRepository, mockQuantityRuleRepository } from "./mock-pricing";
import { mockSettingsRepository, mockShippingRepository } from "./mock-shipping";
import { mockTaxRepository } from "./mock-tax";
import { mockPaymentSettingsRepository } from "./mock-payments";
import { mockOrderRepository } from "./mock-orders";
import { mockCartRepository } from "./mock-cart";
import { mockCatalogSettingsRepository, mockCategoryRepository, mockProductRepository } from "./mock-catalog";
import { matches, paginate, sortBy, type SortKey } from "./mock-utils";
import type { Repositories } from "./repositories";

export const mockRepositories: Repositories = {
  products: mockProductRepository,
  categories: mockCategoryRepository,
  catalogSettings: mockCatalogSettingsRepository,

  pricing: mockPricingRepository,
  quantityRules: mockQuantityRuleRepository,

  customers: mockCustomerRepository,

  orders: mockOrderRepository,
  cart: mockCartRepository,

  delivery: {
    async listRoutes({ search, active, sort = "name", dir = "asc", page, perPage } = {}) {
      const filtered = mockDeliveryRoutes.filter(
        (r) => (active === undefined || r.active === active) && matches(search, r.name, ...r.areas),
      );
      const key = (r: (typeof mockDeliveryRoutes)[number]): SortKey =>
        sort === "fee" ? r.shippingFee : sort === "cutoff" ? r.cutoffTime : r.name;
      return paginate(sortBy(filtered, key, dir), page, perPage);
    },
    async listReminders({ search, type, channel, active, sort = "type", dir, page, perPage } = {}) {
      const filtered = mockReminders.filter(
        (r) =>
          (!type || r.type === type) &&
          (!channel || r.channel === channel) &&
          (active === undefined || r.active === active) &&
          matches(search, r.message, r.schedule),
      );
      const key = (r: (typeof mockReminders)[number]) => (sort === "lastSent" ? r.lastSentAt : r.type);
      return paginate(sortBy(filtered, key, dir ?? (sort === "lastSent" ? "desc" : "asc")), page, perPage);
    },
  },

  locations: mockLocationRepository,
  settings: mockSettingsRepository,
  shipping: mockShippingRepository,
  tax: mockTaxRepository,
  payments: mockPaymentSettingsRepository,

  analytics: {
    getDashboard: getMockDashboard,
  },
};
