import "server-only";

import { getMockDashboard } from "./mock-analytics";
import { mockCompanyRepository } from "./mock-company";
import { mockReport } from "./mock-reports";
import { mockStaffRepository } from "./mock-staff";
import { logEmail, mockEmailRepository, mockReminderRepository } from "./mock-notify";
import { company } from "@/config/runtime";
import { formatMoney } from "@/lib/format";
import { mockCouponRepository } from "./mock-coupons";
import { accountSummary, deleteRoute, deliveryLocations, invoiceList, routeDetail, saveRoute, mockQuotationRepository, mockSavedListRepository } from "./mock-portal";
import { mockMediaRepository } from "./mock-media";
import { mockCustomerRepository, mockLocationRepository } from "./mock-customers";
import { mockDeliveryRoutes, mockReminders } from "./mock/pricing-delivery";
import { mockNavigationRepository, mockPageRepository, mockPostRepository, mockSiteContentRepository, mockContentBlockRepository, mockContentHistoryRepository } from "./mock-content";
import { mockAdminNotificationRepository } from "./mock-admin-notifications";
import { mockContactRepository } from "./mock-contact";
import { mockPricingRepository, mockQuantityRuleRepository } from "./mock-pricing";
import { mockSettingsRepository, mockShippingRepository } from "./mock-shipping";
import { mockTaxRepository } from "./mock-tax";
import { mockPaymentSettingsRepository } from "./mock-payments";
import { mockOrderRepository, orderVars } from "./mock-orders";
import { mockCartRepository } from "./mock-cart";
import { mockCatalogSettingsRepository, mockCategoryRepository, mockProductRepository } from "./mock-catalog";
import { matches, paginate, sortBy, type SortKey } from "./mock-utils";
import type { Repositories } from "./repositories";

export const mockRepositories: Repositories = {
  company: mockCompanyRepository,
  staff: mockStaffRepository,
  emails: mockEmailRepository,
  reminders: mockReminderRepository,
  coupons: mockCouponRepository,
  savedLists: mockSavedListRepository,
  quotations: mockQuotationRepository,
  media: mockMediaRepository,
  adminNotifications: mockAdminNotificationRepository,
  contact: mockContactRepository,

  posts: mockPostRepository,
  pages: mockPageRepository,
  navigation: mockNavigationRepository,
  siteContent: mockSiteContentRepository,
  contentHistory: mockContentHistoryRepository,
  blocks: mockContentBlockRepository,

  products: mockProductRepository,
  categories: mockCategoryRepository,
  catalogSettings: mockCatalogSettingsRepository,

  pricing: mockPricingRepository,
  quantityRules: mockQuantityRuleRepository,

  customers: {
    ...mockCustomerRepository,
    async register(input) {
      const r = await mockCustomerRepository.register(input);
      if (r.ok) logEmail("customer_registered", r.value.email, { customer_name: r.value.contactName ?? r.value.companyName, company_name: r.value.companyName });
      return r;
    },
    async setStatus(id, status, reason, actor) {
      const r = await mockCustomerRepository.setStatus(id, status, reason, actor);
      if (r.ok && status === "approved") logEmail("customer_approved", r.value.email, { customer_name: r.value.contactName ?? r.value.companyName, company_name: r.value.companyName });
      return r;
    },
  },

  orders: {
    ...mockOrderRepository,
    accountSummary: async (id) => accountSummary(id),
    listInvoices: async (q) => invoiceList(q),
    // What would be emailed: each records a log row and sends nothing.
    async updateStatus(id, status, actor, note) {
      const r = await mockOrderRepository.updateStatus(id, status, actor, note);
      if (r.ok) logEmail(status === "preparing" ? "order_processing" : status === "delivered" ? "delivery_notification" : "order_status", r.value.customerEmail, orderVars(r.value));
      return r;
    },
    async refund(id, input, actor) {
      const r = await mockOrderRepository.refund(id, input, actor);
      if (r.ok) logEmail("refund", r.value.customerEmail, { ...orderVars(r.value), refund_amount: formatMoney(r.value.refunds.at(-1)?.amount ?? 0) });
      return r;
    },
    async issueInvoice(id, input, actor) {
      const r = await mockOrderRepository.issueInvoice(id, input, actor);
      if (r.ok && company().documents.emailInvoiceOnIssue) logEmail("invoice", r.value.customerEmail, { ...orderVars(r.value), invoice_number: r.value.invoices?.at(-1)?.number ?? "" });
      return r;
    },
  },
  cart: mockCartRepository,

  delivery: {
    forCustomer: async (id) => deliveryLocations(id),
    getRoute: async (id) => mockDeliveryRoutes.find((r) => r.id === id) ?? null,
    routeDetail: async (id) => routeDetail(id),
    saveRoute: async (id, input) => saveRoute(id, input),
    deleteRoute: async (id) => deleteRoute(id),
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
    report: async (range) => mockReport(range),
  },
};
