import "server-only";

import { company } from "@/config/runtime";
import { matchRoute, nextDeliveryDates } from "@/lib/delivery/schedule";
import { amountRule, isValidAmount } from "@/lib/orders/calc";
import { isOpenOrder } from "@/lib/orders/status";
import { inArea } from "@/lib/reminders/segment";
import type { DeliveryRoute, FieldErrors, Money, OrderStatus, Quotation, QuotationItem, QuotationStatus, SavedList, SavedListDetail, SavedListLine, SavedListLineInput } from "@/lib/types";
import { mockCustomers } from "./mock/customers";
import { mockOrders } from "./mock/orders";
import { mockDeliveryRoutes } from "./mock/pricing-delivery";
import { mockCartRepository } from "./mock-cart";
import { mockOrderRepository } from "./mock-orders";
import { clone, now } from "./mock-store-helpers";
import { matches, paginate, sortBy } from "./mock-utils";
import { mockReminderRepository } from "./mock-notify";
import type { DeliveryRouteInput, QuotationRepository, SaveResult, SavedListRepository } from "./repositories";

/* DEMO STORE: saved lists and quotations live in server memory. */
const store = globalThis as typeof globalThis & { __mockPortal?: { lists: SavedList[]; quotations: Quotation[]; counter: number } };
store.__mockPortal ??= { lists: [], quotations: [], counter: 1000 };
const db = store.__mockPortal;
const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const fail = (message: string, errors: FieldErrors = {}) => ({ ok: false as const, errors, message });

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: company().locale.timeZone }).format(new Date());
const nowTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: company().locale.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

/** Product name, option and this customer's price, read live. */
async function describe(customerId: string, item: SavedListLineInput): Promise<Omit<SavedListLine, "id" | "productId" | "variationId" | "quantity"> | null> {
  const product = await mockOrderRepository.orderableProduct(item.productId, customerId);
  if (!product) return null;
  const option = item.variationId ? product.options.find((o) => o.variationId === item.variationId) : product.options[0];
  if (!option) return { name: product.name, sku: "", unitLabel: product.unitLabel, unavailable: "This option is no longer sold." };
  return {
    name: product.name,
    sku: option.sku,
    optionLabel: option.label || undefined,
    unitLabel: product.unitLabel,
    unitPrice: option.customerPrice,
    unavailable: option.available === false ? "Not available right now." : undefined,
  };
}

const owned = (customerId: string, id: string) => db.lists.find((l) => l.id === id && l.customerId === customerId);
const touch = (l: SavedList) => { l.updatedAt = now(); };

function nameError(name: string) {
  const n = name.trim();
  return n.length < 2 ? "Enter a list name." : n.length > 60 ? "Keep it under 60 characters." : undefined;
}

function mergeLines(list: SavedList, lines: SavedListLineInput[]) {
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) continue;
    const same = list.items.find((i) => i.productId === line.productId && i.variationId === line.variationId);
    if (same) same.quantity += line.quantity;
    else list.items.push({ id: newId("sli"), ...line });
  }
}

export const mockSavedListRepository: SavedListRepository = {
  async list(customerId) {
    return clone(sortBy(db.lists.filter((l) => l.customerId === customerId), (l) => l.updatedAt, "desc"));
  },
  async get(customerId, id) {
    const list = owned(customerId, id);
    if (!list) return null;
    const lines = await Promise.all(
      list.items.map(async (item): Promise<SavedListLine> => {
        const info = await describe(customerId, item);
        return { ...item, ...(info ?? { name: "Product no longer sold", sku: "", unitLabel: "", unavailable: "This product is no longer sold." }) };
      }),
    );
    return { id: list.id, customerId: list.customerId, name: list.name, createdAt: list.createdAt, updatedAt: list.updatedAt, lines } satisfies SavedListDetail;
  },
  async create(customerId, name, lines = []) {
    const error = nameError(name);
    if (error) return fail(error, { name: error });
    const at = now();
    const list: SavedList = { id: newId("list"), customerId, name: name.trim(), items: [], createdAt: at, updatedAt: at };
    mergeLines(list, lines);
    db.lists.unshift(list);
    return { ok: true, value: clone(list) };
  },
  async createFromOrder(customerId, orderId, name) {
    const order = await mockOrderRepository.getById(orderId, customerId);
    if (!order) return fail("That order wasn't found.");
    return mockSavedListRepository.create(customerId, name || `From order ${order.number}`, order.items.filter((i) => i.productId).map((i) => ({ productId: i.productId as string, variationId: i.variationId, quantity: i.quantity })));
  },
  async rename(customerId, id, name) {
    const list = owned(customerId, id);
    if (!list) return fail("That list wasn't found.");
    const error = nameError(name);
    if (error) return fail(error, { name: error });
    list.name = name.trim();
    touch(list);
    return { ok: true, value: clone(list) };
  },
  async remove(customerId, id) {
    const i = db.lists.findIndex((l) => l.id === id && l.customerId === customerId);
    if (i >= 0) db.lists.splice(i, 1);
  },
  async addItem(customerId, id, line) {
    const list = owned(customerId, id);
    if (!list) return fail("That list wasn't found.");
    if (!Number.isInteger(line.quantity) || line.quantity < 1) return fail("Enter a quantity of at least 1.", { quantity: "Enter a quantity of at least 1." });
    if (!(await describe(customerId, line))) return fail("That product can't be added.");
    mergeLines(list, [line]);
    touch(list);
    return { ok: true, value: clone(list) };
  },
  async setQuantity(customerId, id, itemId, quantity) {
    const list = owned(customerId, id);
    const item = list?.items.find((i) => i.id === itemId);
    if (!list || !item) return fail("That line wasn't found.");
    if (!Number.isInteger(quantity) || quantity < 1) return fail("Enter a quantity of at least 1.");
    item.quantity = quantity;
    touch(list);
    return { ok: true, value: clone(list) };
  },
  async removeItem(customerId, id, itemId) {
    const list = owned(customerId, id);
    if (!list) return fail("That list wasn't found.");
    list.items = list.items.filter((i) => i.id !== itemId);
    touch(list);
    return { ok: true, value: clone(list) };
  },
  async addToCart(customerId, id) {
    const list = owned(customerId, id);
    if (!list) return fail("That list wasn't found.");
    if (!list.items.length) return fail("This list is empty.");
    const r = await mockCartRepository.add(customerId, list.items.map((i) => ({ productId: i.productId, variationId: i.variationId, quantity: i.quantity })));
    if (!r.ok) return r;
    return { ok: true, value: { added: r.value.added, skipped: r.value.skipped } };
  },
};

function event(q: Quotation, status: QuotationStatus, byName: string, note?: string) {
  q.status = status;
  q.updatedAt = now();
  q.history.push({ id: newId("qe"), status, at: q.updatedAt, byName, note });
}

/** A quote past its date reads as expired, and can no longer be accepted. */
function expireIfDue(q: Quotation) {
  if (q.status === "quoted" && q.validUntil && q.validUntil < today()) event(q, "expired", "System");
  return q;
}

const quoteTotal = (q: Quotation): Money => q.items.reduce((sum, i) => sum + (i.quotedUnitPrice ?? 0) * i.quantity, 0);

export const mockQuotationRepository: QuotationRepository = {
  async list({ customerId, status, search, page, perPage } = {}) {
    db.quotations.forEach(expireIfDue);
    const rows = db.quotations.filter((q) => (!customerId || q.customerId === customerId) && (!status || q.status === status) && matches(search, q.number, q.customerName));
    return clone(paginate(sortBy(rows, (q) => q.createdAt, "desc"), page, perPage));
  },
  async counts() {
    db.quotations.forEach(expireIfDue);
    return { requested: db.quotations.filter((q) => q.status === "requested").length };
  },
  async getById(id, customerId) {
    const q = db.quotations.find((x) => x.id === id && (!customerId || x.customerId === customerId));
    return q ? clone(expireIfDue(q)) : null;
  },
  async request(customerId, input) {
    const customer = mockCustomers.find((c) => c.id === customerId && c.status === "approved");
    if (!customer) return fail("Only approved accounts can request a quotation.");
    const lines = input.items.filter((l) => Number.isInteger(l.quantity) && l.quantity > 0);
    if (!lines.length) return fail("Add at least one product.", { items: "Add at least one product." });
    if ((input.customerNote ?? "").length > 1000) return fail("Keep your note under 1,000 characters.", { customerNote: "Keep your note under 1,000 characters." });
    const items: QuotationItem[] = [];
    for (const line of lines) {
      const info = await describe(customerId, line);
      if (!info) return fail("One of those products can't be quoted.");
      items.push({ id: newId("qi"), productId: line.productId, variationId: line.variationId, name: info.name, sku: info.sku, optionLabel: info.optionLabel, quantity: line.quantity });
    }
    const at = now();
    db.counter += 1;
    const q: Quotation = { id: newId("quo"), number: `QUO-${db.counter}`, customerId, customerName: customer.companyName, status: "requested", items, customerNote: input.customerNote?.trim() || undefined, history: [], createdAt: at, updatedAt: at };
    event(q, "requested", customer.contactName ?? customer.companyName);
    db.quotations.unshift(q);
    return { ok: true, value: clone(q) };
  },
  async sendQuote(id, input, actor) {
    const q = db.quotations.find((x) => x.id === id);
    if (!q) return fail("That quotation wasn't found.");
    if (q.status !== "requested" && q.status !== "quoted") return fail("This quotation can no longer be changed.");
    const errors: FieldErrors = {};
    for (const item of q.items) {
      const price = input.prices[item.id];
      if (!isValidAmount(price)) errors[`price.${item.id}`] = `Enter a price with ${amountRule()}.`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validUntil) || input.validUntil < today()) errors.validUntil = "Choose today or a later date.";
    if (Object.keys(errors).length) return fail("Some fields need attention.", errors);
    for (const item of q.items) item.quotedUnitPrice = input.prices[item.id];
    q.validUntil = input.validUntil;
    q.staffNote = input.staffNote?.trim() || undefined;
    event(q, "quoted", actor.name, `Quoted total ${quoteTotal(q)}`);
    return { ok: true, value: clone(q) };
  },
  async decline(id, reason, actor) {
    const q = db.quotations.find((x) => x.id === id);
    if (!q) return fail("That quotation wasn't found.");
    if (q.status !== "requested" && q.status !== "quoted") return fail("This quotation can no longer be changed.");
    if (reason.trim().length < 3) return fail("Give a reason.", { reason: "Give a reason." });
    event(q, "declined", actor.name, reason.trim());
    return { ok: true, value: clone(q) };
  },
  async respond(customerId, id, answer, actor) {
    const q = db.quotations.find((x) => x.id === id && x.customerId === customerId);
    if (!q) return fail("That quotation wasn't found.");
    expireIfDue(q);
    if (q.status === "expired") return fail("This quote has expired. Please ask for a new one.");
    if (q.status !== "quoted") return fail("This quotation is not waiting for your answer.");
    if (answer === "reject") {
      event(q, "rejected", actor.name);
      return { ok: true, value: clone(q) };
    }
    const customer = mockCustomers.find((c) => c.id === customerId);
    const shipping = customer?.addresses.find((a) => a.type === "shipping" && a.isDefault) ?? customer?.addresses.find((a) => a.type === "shipping");
    const billing = customer?.addresses.find((a) => a.type === "billing" && a.isDefault) ?? shipping;
    if (!shipping || !billing) return fail("Add a delivery address to your account first.");
    const order = await mockOrderRepository.create(
      {
        customerId,
        billingAddress: billing,
        shippingAddress: shipping,
        items: q.items.map((i) => ({ productId: i.productId, variationId: i.variationId, quantity: i.quantity, unitPrice: i.quotedUnitPrice ?? 0, discount: 0 })),
        shipping: { label: "To be confirmed", amount: 0, mode: "manual", reason: `From quotation ${q.number}` },
        paymentMethod: "bank_transfer",
        customerNote: q.customerNote,
        adminNote: `Created from quotation ${q.number}. Delivery charge to be confirmed.`,
      },
      actor,
    );
    if (!order.ok) return fail(Object.values(order.errors)[0] ?? order.message ?? "The order couldn't be created.");
    q.orderId = order.value.id;
    q.orderNumber = order.value.number;
    event(q, "accepted", actor.name, `Order ${order.value.number}`);
    return { ok: true, value: clone(q) };
  },
};

const ORDER_STATUSES: OrderStatus[] = ["received", "preparing", "on_the_way", "delivered", "cancelled"];

export async function accountSummary(customerId: string) {
  const orders = mockOrders.filter((o) => o.customerId === customerId);
  const month = today().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const last = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const spend = (prefix: string) => orders.filter((o) => o.status !== "cancelled" && o.placedAt.slice(0, 7) === prefix).reduce((sum, o) => sum + o.totals.netTotal, 0);
  return {
    totalOrders: orders.length,
    openOrders: orders.filter(isOpenOrder).length,
    monthSpend: spend(month),
    lastMonthSpend: spend(last),
    byStatus: ORDER_STATUSES.map((status) => ({ status, count: orders.filter((o) => o.status === status).length })),
  };
}

export function invoiceList({ customerId, search, page, perPage }: { customerId: string; search?: string; page?: number; perPage?: number }) {
  const rows = mockOrders
    .filter((o) => o.customerId === customerId)
    .flatMap((o) => (o.invoices ?? []).map((inv) => ({ id: inv.id, number: inv.number, kind: inv.kind, replaces: inv.replaces, orderId: o.id, orderNumber: o.number, issuedAt: inv.issuedAt, total: inv.snapshot.totals.total })))
    .filter((r) => matches(search, r.number, r.orderNumber));
  return paginate(sortBy(rows, (r) => r.issuedAt, "desc"), page, perPage);
}

export function deliveryLocations(customerId: string) {
  const customer = mockCustomers.find((c) => c.id === customerId);
  return (customer?.addresses ?? [])
    .filter((a) => a.type === "shipping")
    .map((address) => {
      const route = matchRoute(mockDeliveryRoutes, address);
      return {
        address: clone(address),
        route: route && { id: route.id, name: route.name, deliveryDays: route.deliveryDays, cutoffTime: route.cutoffTime },
        upcoming: route ? nextDeliveryDates(route, today(), nowTime(), 4) : [],
      };
    });
}

export function routeDetail(id: string) {
  const route = mockDeliveryRoutes.find((r) => r.id === id);
  if (!route) return null;
  const inRoute = (a?: { prefecture: string; city: string }) => Boolean(a && inArea(route.areas, a));
  return {
    upcoming: nextDeliveryDates(route, today(), nowTime(), 6),
    customers: mockCustomers.filter((c) => c.status === "approved" && c.addresses.some((a) => a.type === "shipping" && inRoute(a))).map((c) => ({ id: c.id, name: c.companyName })),
    orders: mockOrders.filter((o) => isOpenOrder(o) && inRoute(o.shippingAddress)).slice(0, 50).map((o) => ({ id: o.id, number: o.number, customerName: o.customerName, status: o.status, requestedDeliveryDate: o.requestedDeliveryDate })),
  };
}

export function saveRoute(id: string | null, input: DeliveryRouteInput): SaveResult<DeliveryRoute> {
  const errors: FieldErrors = {};
  if (input.name.trim().length < 2) errors.name = "Enter a name.";
  if (!input.areas.length) errors.areas = "Add at least one area.";
  if (!input.deliveryDays.length && !input.extraDates?.length) errors.deliveryDays = "Choose a delivery day or add an extra date.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.cutoffTime)) errors.cutoffTime = "Use a time like 16:00.";
  const dates = /^\d{4}-\d{2}-\d{2}$/;
  if ([...(input.excludedDates ?? []), ...(input.extraDates ?? [])].some((d) => !dates.test(d))) errors.deliveryDays = "Dates must look like 2026-12-31.";
  if (Object.keys(errors).length) return fail("Some fields need attention.", errors);
  const existing = id ? mockDeliveryRoutes.find((r) => r.id === id) : undefined;
  if (id && !existing) return fail("That schedule no longer exists.");
  const next: DeliveryRoute = { ...(existing ?? { id: newId("route"), shippingFee: 0 }), ...input, name: input.name.trim() };
  if (existing) Object.assign(existing, next);
  else mockDeliveryRoutes.push(next);
  return { ok: true, value: clone(next) };
}

export async function deleteRoute(id: string): Promise<SaveResult<{ id: string }>> {
  const { items } = await mockReminderRepository.list({ perPage: 1000 });
  const used = items.filter((c) => c.deliveryRouteId === id);
  if (used.length) return fail(`${used.length} reminder campaign${used.length === 1 ? " uses" : "s use"} this schedule. Change ${used.length === 1 ? "it" : "them"} first.`);
  const i = mockDeliveryRoutes.findIndex((r) => r.id === id);
  if (i >= 0) mockDeliveryRoutes.splice(i, 1);
  return { ok: true, value: { id } };
}
