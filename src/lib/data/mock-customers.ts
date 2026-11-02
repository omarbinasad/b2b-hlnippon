import "server-only";

import { normalizePostcode } from "@/lib/customers/contact";
import { accountStatusLabels } from "@/lib/customers/status";
import { sumMoney } from "@/lib/orders/calc";
import type { AccountStatus, Address, Customer, CustomerDocument, CustomerGroup, CustomerListItem } from "@/lib/types";
import { detectDocumentType, safeFileName } from "@/lib/validation/documents";
import { validateRegistration } from "@/lib/validation/registration";
import { validateAddress, validateCustomerDetails, validateGroup, validateQuickCustomer, validateStatusChange } from "@/lib/validation/customer";
import { mockCustomerGroups, mockCustomers, mockNotifications } from "./mock/customers";
import { mockOrders } from "./mock/orders";
import { samplePostcodes } from "./mock/postcodes";
import { matches, paginate, sortBy, withinDates, type SortKey } from "./mock-utils";
import type { CustomerRepository, LocationRepository, SaveResult } from "./repositories";

/*
 * DEMO STORE: customers and groups live in memory (globalThis) — edits survive
 * page refreshes but not a server restart. The same records back Admin Orders
 * (customer search, addresses, price lookups), so there is one customer source.
 * Customers are never deleted because orders reference them by id.
 */

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const opt = (v?: string) => v?.trim() || undefined;
const notFound = { ok: false as const, errors: {}, message: "Customer not found." };
const invalid = (errors: Record<string, string>) => ({ ok: false as const, errors, message: "Some fields need attention." });

/**
 * DEMO: uploaded document bytes, in memory only (lost on restart, never written to disk or public URLs).
 * The backend must keep them in private storage (not the public media host), encrypted, with retention rules.
 */
const g = globalThis as typeof globalThis & { __mockCustomerFiles?: Map<string, Uint8Array> };
const documentFiles = (g.__mockCustomerFiles ??= new Map());

const groupName = (id?: string) => mockCustomerGroups.find((g) => g.id === id)?.name;

/** Order aggregates per customer (non-cancelled orders; spend after refunds). */
function orderStats() {
  const stats = new Map<string, { orderCount: number; spend: number[]; lastOrderAt?: string }>();
  for (const o of mockOrders) {
    // Walk-in orders have no account to count them against.
    if (o.status === "cancelled" || !o.customerId) continue;
    const s = stats.get(o.customerId) ?? { orderCount: 0, spend: [] };
    s.orderCount += 1;
    s.spend.push(o.totals.netTotal);
    if (!s.lastOrderAt || o.placedAt > s.lastOrderAt) s.lastOrderAt = o.placedAt;
    stats.set(o.customerId, s);
  }
  return stats;
}

function toItem(c: Customer, stats: ReturnType<typeof orderStats>): CustomerListItem {
  const s = stats.get(c.id);
  return { ...clone(c), groupName: groupName(c.groupId), orderCount: s?.orderCount ?? 0, totalSpend: s ? sumMoney(s.spend) : 0, lastOrderAt: s?.lastOrderAt };
}

function save(c: Customer): SaveResult<Customer> {
  const i = mockCustomers.findIndex((x) => x.id === c.id);
  if (i >= 0) mockCustomers[i] = c;
  else mockCustomers.unshift(c);
  return { ok: true, value: clone(c) };
}

/** Same email or phone digits on another customer. */
function duplicateOf(selfId: string | undefined, email?: string, phone?: string) {
  const digits = (p?: string) => (p ?? "").replace(/\D/g, "").replace(/^81/, "0");
  return mockCustomers.find(
    (c) =>
      c.id !== selfId &&
      ((email && c.email?.toLowerCase() === email.toLowerCase()) || (phone && digits(c.phone) === digits(phone))),
  );
}

export const mockCustomerRepository: CustomerRepository = {
  async list({ status, groupId, prefecture, hasOrders, search, from, to, sort = "company", dir, page, perPage } = {}) {
    const stats = orderStats();
    const filtered = mockCustomers.filter(
      (c) =>
        (!status || c.status === status) &&
        (!groupId || c.groupId === groupId) &&
        (!prefecture || c.addresses.some((a) => a.prefecture === prefecture)) &&
        (hasOrders === undefined || (stats.get(c.id)?.orderCount ?? 0) > 0 === hasOrders) &&
        withinDates(c.createdAt, { from, to }) &&
        matches(search, c.companyName, c.contactName, c.email, c.phone, c.legacyWooId ? String(c.legacyWooId) : undefined),
    );
    const items = filtered.map((c) => toItem(c, stats));
    const key = (c: CustomerListItem): SortKey => {
      switch (sort) {
        case "registered": return c.createdAt;
        case "status": return accountStatusLabels[c.status];
        case "group": return c.groupName ?? "";
        case "orders": return c.orderCount;
        case "spend": return c.totalSpend;
        default: return c.companyName;
      }
    };
    const defaultDir = sort === "registered" || sort === "orders" || sort === "spend" ? "desc" : "asc";
    return paginate(sortBy(items, key, dir ?? defaultDir), page, perPage);
  },

  async getById(id) {
    const c = mockCustomers.find((x) => x.id === id);
    return c ? clone(c) : null;
  },

  async getListItem(id) {
    const c = mockCustomers.find((x) => x.id === id);
    return c ? toItem(c, orderStats()) : null;
  },

  async statusCounts() {
    const counts: Record<AccountStatus, number> = { pending: 0, approved: 0, rejected: 0, suspended: 0 };
    for (const c of mockCustomers) counts[c.status] += 1;
    return counts;
  },

  async search(term, { excludeGroupId, limit = 10 } = {}) {
    if (!term.trim()) return [];
    return mockCustomers
      .filter((c) => (!excludeGroupId || c.groupId !== excludeGroupId) && matches(term, c.companyName, c.contactName, c.email, c.phone))
      .slice(0, Math.min(limit, 25))
      .map((c) => ({ id: c.id, companyName: c.companyName, contactName: c.contactName, status: c.status, groupId: c.groupId }));
  },

  async getDocument(customerId, documentId) {
    const doc = mockCustomers.find((c) => c.id === customerId)?.documents?.find((d) => d.id === documentId);
    const bytes = doc && documentFiles.get(`${customerId}/${doc.id}`);
    return doc && bytes ? { document: clone(doc), bytes: bytes.slice() } : null;
  },
  async register(input) {
    const errors = validateRegistration(input);
    const dup = duplicateOf(undefined, opt(input.email), opt(input.phone));
    // Same message for email and phone, so the form doesn't reveal which accounts exist.
    if (!errors.email && !errors.phone && dup) errors.email = "An account or application with this email or phone already exists. Contact us if you need help.";
    if (Object.keys(errors).length) return invalid(errors);

    const at = now();
    const id = newId("cus");
    const actor = { id, name: input.contactName.trim(), role: "customer" as const };
    const documents = (input.documents ?? []).map((d): CustomerDocument => {
      const doc = { id: newId("doc"), kind: d.kind, fileName: safeFileName(d.fileName), contentType: detectDocumentType(d.bytes)!, size: d.bytes.length, uploadedAt: at };
      documentFiles.set(`${id}/${doc.id}`, d.bytes.slice());
      return doc;
    });
    const address = (type: Address["type"]): Address => ({
      id: newId("addr"),
      type,
      label: "Business address",
      isDefault: true,
      recipientName: input.contactName.trim(),
      companyName: input.companyName.trim(),
      country: "JP",
      prefecture: input.address.prefecture.trim(),
      city: input.address.city.trim(),
      area: opt(input.address.area),
      postalCode: normalizePostcode(input.address.postalCode),
      addressLine1: input.address.addressLine1.trim(),
      phone: input.phone.trim(),
    });
    return save({
      id,
      companyName: input.companyName.trim(),
      contactName: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      businessType: input.businessType,
      tradeLicenseNumber: opt(input.tradeLicenseNumber),
      status: "pending",
      statusHistory: [{ id: `${id}-s1`, to: "pending", at, by: actor, reason: "Applied online" }],
      addresses: [address("shipping"), address("billing")],
      internalNote: opt(input.message) && `Applicant's message: ${opt(input.message)}`,
      documents: documents.length ? documents : undefined,
      createdAt: at,
      updatedAt: at,
    });
  },

  async create(input, actor) {
    const errors = validateQuickCustomer(input);
    if (input.groupId && !groupName(input.groupId)) errors.groupId = "Group not found.";
    const dup = duplicateOf(undefined, opt(input.email), opt(input.phone));
    if (!errors.phone && !errors.email && dup) errors[dup.email?.toLowerCase() === input.email?.trim().toLowerCase() ? "email" : "phone"] = `Already used by ${dup.companyName}.`;
    if (Object.keys(errors).length) return invalid(errors);

    const at = now();
    const id = newId("cus");
    const history: Customer["statusHistory"] = [{ id: `${id}-s1`, to: "pending", at, by: actor, reason: "Added by admin" }];
    if (input.status === "approved") history.push({ id: `${id}-s2`, from: "pending", to: "approved", at, by: actor, reason: "Approved when added" });
    return save({
      id,
      companyName: input.companyName.trim(),
      contactName: opt(input.contactName),
      phone: opt(input.phone),
      email: opt(input.email),
      status: input.status,
      statusHistory: history,
      groupId: input.groupId || undefined,
      addresses: [],
      createdAt: at,
      approvedAt: input.status === "approved" ? at : undefined,
      updatedAt: at,
    });
  },

  async update(id, input) {
    const c = mockCustomers.find((x) => x.id === id);
    if (!c) return notFound;
    const errors = validateCustomerDetails(input);
    if (input.groupId && !groupName(input.groupId)) errors.groupId = "Group not found.";
    const dup = duplicateOf(id, opt(input.email), opt(input.phone));
    if (!errors.phone && !errors.email && dup) errors[dup.email?.toLowerCase() === input.email?.trim().toLowerCase() ? "email" : "phone"] = `Already used by ${dup.companyName}.`;
    if (Object.keys(errors).length) return invalid(errors);
    // Past orders keep their own snapshot of the name and contact details.
    return save({
      ...c,
      companyName: input.companyName.trim(),
      contactName: opt(input.contactName),
      phone: opt(input.phone),
      email: opt(input.email),
      businessType: opt(input.businessType),
      tradeLicenseNumber: opt(input.tradeLicenseNumber),
      vatRegistrationNumber: opt(input.vatRegistrationNumber),
      groupId: input.groupId || undefined,
      deliveryRouteId: input.deliveryRouteId || undefined,
      internalNote: opt(input.internalNote),
      updatedAt: now(),
    });
  },

  async setStatus(id, status, reason, actor) {
    const c = mockCustomers.find((x) => x.id === id);
    if (!c) return notFound;
    const errors = validateStatusChange(c.status, status, reason);
    if (Object.keys(errors).length) return { ok: false, errors, message: Object.values(errors)[0] };
    const at = now();
    return save({
      ...c,
      status,
      statusHistory: [...c.statusHistory, { id: newId("st"), from: c.status, to: status, reason: opt(reason), at, by: actor }],
      approvedAt: status === "approved" ? (c.approvedAt ?? at) : c.approvedAt,
      updatedAt: at,
    });
  },

  async saveAddress(id, input) {
    const c = mockCustomers.find((x) => x.id === id);
    if (!c) return notFound;
    if (input.id && !c.addresses.some((a) => a.id === input.id)) return { ok: false, errors: {}, message: "Address not found." };
    const errors = validateAddress(input);
    if (Object.keys(errors).length) return invalid(errors);
    const existing = c.addresses.find((a) => a.id === input.id);
    const address: Address = {
      ...existing,
      id: input.id ?? newId("addr"),
      type: input.type,
      label: input.label.trim(),
      recipientName: input.recipientName.trim(),
      companyName: opt(input.companyName),
      country: "JP",
      prefecture: input.prefecture,
      city: input.city.trim(),
      area: opt(input.area),
      postalCode: input.postalCode.trim(),
      addressLine1: input.addressLine1.trim(),
      addressLine2: opt(input.addressLine2),
      phone: input.phone.trim(),
      // The first address of a type is always the default for that type.
      isDefault: input.isDefault || !c.addresses.some((a) => a.type === input.type && a.id !== input.id),
    };
    let addresses = existing ? c.addresses.map((a) => (a.id === address.id ? address : a)) : [...c.addresses, address];
    if (address.isDefault) addresses = addresses.map((a) => (a.type === address.type && a.id !== address.id ? { ...a, isDefault: false } : a));
    // Keep one default per type when the default moved to another type.
    for (const type of ["shipping", "billing"] as const) {
      const ofType = addresses.filter((a) => a.type === type);
      if (ofType.length && !ofType.some((a) => a.isDefault)) addresses = addresses.map((a) => (a.id === ofType[0].id ? { ...a, isDefault: true } : a));
    }
    return save({ ...c, addresses, updatedAt: now() });
  },

  async deleteAddress(id, addressId) {
    const c = mockCustomers.find((x) => x.id === id);
    if (!c) return notFound;
    const removed = c.addresses.find((a) => a.id === addressId);
    if (!removed) return { ok: false, errors: {}, message: "Address not found." };
    // Orders keep their own address snapshot, so deleting here never changes past orders.
    let addresses = c.addresses.filter((a) => a.id !== addressId);
    const next = addresses.find((a) => a.type === removed.type);
    if (removed.isDefault && next) addresses = addresses.map((a) => (a.id === next.id ? { ...a, isDefault: true } : a));
    return save({ ...c, addresses, updatedAt: now() });
  },

  async listGroups() {
    return clone(mockCustomerGroups);
  },

  async listGroupSummaries({ search, sort = "name", dir, page, perPage } = {}) {
    const items = mockCustomerGroups
      .filter((g) => matches(search, g.name, g.description, g.id))
      .map((g) => ({ ...clone(g), customerCount: mockCustomers.filter((c) => c.groupId === g.id).length }));
    return paginate(sortBy(items, (g) => (sort === "customers" ? g.customerCount : g.name), dir ?? (sort === "customers" ? "desc" : "asc")), page, perPage);
  },

  async getGroup(id) {
    const g = mockCustomerGroups.find((x) => x.id === id);
    return g ? { ...clone(g), customerCount: mockCustomers.filter((c) => c.groupId === id).length } : null;
  },

  async createGroup(input) {
    const errors = validateGroup(input);
    if (!errors.name && mockCustomerGroups.some((g) => g.name.toLowerCase() === input.name.trim().toLowerCase())) errors.name = "A group with this name already exists.";
    if (Object.keys(errors).length) return invalid(errors);
    const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "group";
    const id = mockCustomerGroups.some((g) => g.id === `grp-${slug}`) ? newId("grp") : `grp-${slug}`;
    const group: CustomerGroup = { id, name: input.name.trim(), description: opt(input.description) };
    mockCustomerGroups.push(group);
    return { ok: true, value: clone(group) };
  },

  async updateGroup(id, input) {
    const index = mockCustomerGroups.findIndex((g) => g.id === id);
    if (index < 0) return { ok: false, errors: {}, message: "Group not found." };
    const errors = validateGroup(input);
    if (!errors.name && mockCustomerGroups.some((g) => g.id !== id && g.name.toLowerCase() === input.name.trim().toLowerCase())) errors.name = "A group with this name already exists.";
    if (Object.keys(errors).length) return invalid(errors);
    mockCustomerGroups[index] = { ...mockCustomerGroups[index], name: input.name.trim(), description: opt(input.description) };
    return { ok: true, value: clone(mockCustomerGroups[index]) };
  },

  async assignGroupMembers(id, { add, remove }) {
    if (!mockCustomerGroups.some((g) => g.id === id)) return { ok: false, errors: {}, message: "Group not found." };
    const at = now();
    for (const c of mockCustomers) {
      if (add.includes(c.id) && c.groupId !== id) Object.assign(c, { groupId: id, updatedAt: at });
      else if (remove.includes(c.id) && c.groupId === id) Object.assign(c, { groupId: undefined, updatedAt: at });
    }
    return { ok: true, value: (await this.getGroup(id))! };
  },

  async listNotifications(customerId, { kind, unreadOnly, search, dir = "desc", page, perPage } = {}) {
    const filtered = mockNotifications.filter(
      (n) => n.customerId === customerId && (!kind || n.kind === kind) && (!unreadOnly || !n.readAt) && matches(search, n.title, n.body),
    );
    return paginate(sortBy(filtered, (n) => n.createdAt, dir), page, perPage);
  },
};

export const mockLocationRepository: LocationRepository = {
  async lookupPostcode(postalCode) {
    // "1600023" and "160-0023" are the same postcode; the sample data stores "NNN-NNNN".
    const digits = postalCode.replace(/\D/g, "");
    const code = digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : postalCode.trim();
    const matches = samplePostcodes
      .filter((p) => p.postalCode === code)
      .map(({ prefecture, city, area, postOffice }) => ({ prefecture, city, area, postOffice }));
    return matches.length ? { status: "found", postalCode: code, matches } : { status: "not_found", postalCode: code, datasetSize: samplePostcodes.length };
  },
};

