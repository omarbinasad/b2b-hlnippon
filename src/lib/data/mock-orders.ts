import "server-only";

import { siteConfig } from "@/config/site";
import { formatAddressLines, formatMoney } from "@/lib/format";
import { isPostcode, normalizePostcode } from "@/lib/customers/contact";
import { checkRefund, isCollected, isOrderRefund, paymentStatusAfterRefund, refundSummary } from "@/lib/orders/refund";
import { paymentBalance, recalculate } from "@/lib/orders/assemble";
import { AMOUNT_RULE, applyLineChange, fromMinor, isValidAmount, sumMoney, toMinor } from "@/lib/orders/calc";
import { followUpNumber, invoiceSnapshot, latestInvoice, nextInvoiceKind, nextInvoiceNumber } from "@/lib/orders/invoice";
import { canAdjust, canChangeDeliveryDate, canChangeDiscount, canEditItems, canTransition, orderStatusLabels, paymentMethodLabels } from "@/lib/orders/status";
import type { Actor, Address, CheckoutInput, CreateOrderInput, ID, FieldErrors, Invoice, Order, OrderAddressInput, OrderAdjustment, OrderChangeValues, OrderEdit, OrderItem, OrderStatus, Refund, RefundRestock } from "@/lib/types";
import { orderTypeResolver } from "@/lib/orders/order-type";
import { checkAddress, checkReason, isIsoDate, validateAddLine, validateAdjustment, validateCreateOrder, validateOrderDiscount, ORDER_LIMITS } from "@/lib/validation/order";
import { CART_LIMITS, checkDeliveryDate, orderPaymentMethod } from "@/lib/orders/cart";
import { cartLines, clearCart, priceCartLine } from "./mock-cart";
import { mockPaymentSettingsRepository } from "./mock-payments";
import { mockProductRepository } from "./mock-catalog";
import { mockProducts } from "./mock/catalog";
import { mockCustomers } from "./mock/customers";
import { mockOrders, pricingSnapshot, snapshotItem } from "./mock/orders";
import { mockSettingsRepository, mockShippingRepository } from "./mock-shipping";
import { mockTaxRepository } from "./mock-tax";
import { checkQuantity, tierLabel } from "@/lib/pricing/engine";
import { mockTaxRates, quantityLimitsFor, quotePrice } from "./mock/pricing-rules";
import { matches, paginate, sortBy, withinDates, type SortKey } from "./mock-utils";
import type { OrderRepository, SaveResult } from "./repositories";

/*
 * DEMO STORE: orders live in memory (globalThis) — changes survive page refreshes
 * but not a server restart. The real backend persists them, enforces permissions,
 * checks stock and applies real tax/shipping rules.
 */

const SHIPPING_TAX_CLASS = "standard" as const;
const statusRank: Record<OrderStatus, number> = { received: 0, preparing: 1, on_the_way: 2, delivered: 3, cancelled: 4 };

const now = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const toAddress = (a: OrderAddressInput, type: Address["type"], label: string): Address => ({
  id: id("addr"),
  type,
  label,
  isDefault: false,
  recipientName: a.recipientName.trim(),
  companyName: a.companyName?.trim() || undefined,
  country: a.country || "JP",
  prefecture: a.prefecture.trim(),
  city: a.city.trim(),
  area: a.area?.trim() || undefined,
  postalCode: a.postalCode.trim(),
  addressLine1: a.addressLine1.trim(),
  addressLine2: a.addressLine2?.trim() || undefined,
  phone: a.phone.trim(),
});

function nextNumber() {
  const max = Math.max(0, ...mockOrders.map((o) => Number(o.number.replace(/\D/g, "")) || 0));
  return max + 1;
}

/** Replaces the stored order and returns a copy. */
function store(order: Order): SaveResult<Order> {
  const index = mockOrders.findIndex((o) => o.id === order.id);
  if (index >= 0) mockOrders[index] = order;
  else mockOrders.unshift(order);
  return { ok: true, value: clone(order) };
}

const notFound = { ok: false as const, errors: {}, message: "Order not found." };

/**
 * Who prices a line: the approved customer, or — for walk-in orders (no customer id) — a buyer without an
 * account, who gets the catalog price (sale price when active): customer/group rules need an approved account.
 * null = a customer id that isn't an approved customer.
 */
const WALK_IN_BUYER = { id: "walk-in", status: "pending" as const };
function pricingCustomer(customerId?: string) {
  if (!customerId) return WALK_IN_BUYER;
  return mockCustomers.find((c) => c.id === customerId && c.status === "approved") ?? null;
}

/** Current year in the store's time zone (invoice numbers restart each year). */
const storeYear = () => Number(new Intl.DateTimeFormat("en", { timeZone: siteConfig.timeZone, year: "numeric" }).format(new Date()));

const PICKUP_SHIPPING = { label: "Collected in store", amount: 0, mode: "manual" as const, reason: "Walk-in order collected at the store" };

/** The store's own location (tax for store pickups is charged where the sale happens). */
async function storeLocation() {
  const { address } = await mockSettingsRepository.getStore();
  return { prefecture: address.prefecture, city: address.city, postalCode: address.postalCode };
}

/**
 * Validates and assembles a new order without saving it (admin orders, walk-ins and customer checkout).
 * `actor.role === "customer"` marks an online order placed by the customer.
 */
async function buildOrder(rawInput: CreateOrderInput, actor: Actor): Promise<SaveResult<Order>> {
  const online = actor.role === "customer";
  const pickup = rawInput.fulfilment === "pickup";
  // Store pickup has no delivery charge; the decision is recorded like an agreed charge.
  const input = pickup ? { ...rawInput, shipping: PICKUP_SHIPPING, billingAddress: undefined, shippingAddress: undefined } : rawInput;
  const errors = validateCreateOrder(input);
  const customer = input.walkIn ? undefined : mockCustomers.find((c) => c.id === input.customerId);
  if (!input.walkIn && input.customerId && !customer) errors.customerId = "Customer not found.";
  else if (customer && customer.status !== "approved") errors.customerId = "Orders can only be created for approved customers.";
  const buyer = customer ?? (input.walkIn ? WALK_IN_BUYER : undefined);

  input.items.forEach((line, i) => {
    const product = mockProducts.find((p) => p.id === line.productId);
    if (!product || product.status === "archived") {
      errors[`items.${i}.productId`] = "This product is not available.";
      return;
    }
    if (!errors[`items.${i}.quantity`]) {
      const limitError = checkQuantity(quantityLimitsFor(product, line.variationId), line.quantity);
      if (limitError) errors[`items.${i}.quantity`] = limitError;
    }
    if (product.type === "variable") {
      const variation = product.variations.find((v) => v.id === line.variationId);
      if (!variation) errors[`items.${i}.variationId`] = "Choose an option for this product.";
      else if (variation.status !== "active") errors[`items.${i}.variationId`] = "This option is disabled.";
    }
  });
  // Shipping: the server re-quotes from the delivery address and lines. "Suggested" must match it;
  // "manual" keeps the agreed amount with a reason. Either way the decision is stored with the order.
  const shippingQuote = Object.keys(errors).length || !input.shippingAddress
    ? undefined
    : (await mockShippingRepository.quote({
        address: input.shippingAddress,
        items: input.items.map((l) => ({ productId: l.productId, variationId: l.variationId, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
      })).quote;
  const suggested = shippingQuote?.selected;
  if (shippingQuote && input.shipping.mode === "suggested") {
    if (!suggested) errors["shipping.amount"] = "No shipping rule applies to this address and cart — enter an agreed charge.";
    else if (suggested.cost !== input.shipping.amount)
      errors["shipping.amount"] = `The suggested charge is now ${formatMoney(suggested.cost!)} (${suggested.method.name}). Review the shipping charge.`;
  }
  if (Object.keys(errors).length || !buyer) return { ok: false, errors, message: "Some fields need attention." };
  const decision = {
    mode: input.shipping.mode,
    suggestedAmount: suggested?.cost,
    zoneId: shippingQuote?.match.zone?.id,
    zoneName: shippingQuote?.match.zone?.name,
    methodId: suggested?.method.id,
    methodName: suggested?.method.name,
    reason: input.shipping.mode === "manual" ? input.shipping.reason?.trim() : undefined,
  };

  // Tax for the delivery address, or the store's location for store pickups.
  const taxSnapshot = await mockTaxRepository.snapshotFor(input.shippingAddress ?? (await storeLocation()));
  const walkIn = input.walkIn
    ? { name: input.walkIn.name.trim(), companyName: input.walkIn.companyName?.trim() || undefined }
    : undefined;
  const seq = nextNumber();
  const orderId = `ord-${seq}`;
  const at = now();
  const order = recalculate(
    {
      id: orderId,
      number: `ORD-${seq}`,
      customerId: customer?.id,
      walkIn,
      customerName: customer?.companyName ?? walkIn!.companyName ?? walkIn!.name,
      customerEmail: customer ? customer.email : input.walkIn?.email?.trim() || undefined,
      customerPhone: customer ? customer.phone : input.walkIn?.phone?.trim() || undefined,
      status: "received" as const,
      statusHistory: [{ id: "e1", status: "received" as const, at, by: actor, note: online ? "Placed online by the customer" : customer ? "Created by admin on behalf of the customer" : "Walk-in order created by admin (no customer account)" }],
      paymentStatus: input.paymentMethod === "invoice" ? ("invoiced" as const) : ("unpaid" as const),
      payment: { method: input.paymentMethod },
      // Snapshots: name, SKU, options, weight, tax class come from the catalog now; the price is the agreed one.
      items: input.items.map((line, i) => {
        const product = mockProducts.find((p) => p.id === line.productId)!;
        const quote = quotePrice(product, buyer, line.variationId, line.quantity);
        return {
          ...snapshotItem(`${orderId}-${i + 1}`, line.productId, line.variationId, line.quantity, line.unitPrice),
          discount: line.discount,
          // Which rule priced the line at order time; editing the rule later never changes this.
          pricing: quote ? pricingSnapshot(quote, line.unitPrice) : undefined,
        };
      }),
      billingAddress: input.billingAddress && toAddress(input.billingAddress, "billing", "Billing"),
      shippingAddress: input.shippingAddress && toAddress(input.shippingAddress, "shipping", "Delivery"),
      fulfilment: pickup ? ("pickup" as const) : undefined,
      shipping: { label: input.shipping.label.trim(), amount: input.shipping.amount, taxClass: SHIPPING_TAX_CLASS, deliveryRouteId: customer?.deliveryRouteId, decision },
      refunds: [],
      notes: input.adminNote?.trim() ? [{ id: "n1", type: "admin" as const, body: input.adminNote.trim(), at, by: actor }] : [],
      adjustments: [],
      customerNote: input.customerNote?.trim() || undefined,
      requestedDeliveryDate: input.requestedDeliveryDate ? `${input.requestedDeliveryDate}T00:00:00${siteConfig.utcOffset}` : undefined,
      // Tax settings + rates for the delivery address, frozen: later rate edits never change this order.
      taxSnapshot,
      createdVia: online ? ("storefront" as const) : ("admin" as const),
      createdBy: online ? undefined : actor,
      placedAt: at,
      updatedAt: at,
    },
    mockTaxRates,
  );
  return { ok: true, value: order };
}

/** Today in the store time zone (YYYY-MM-DD). */
const storeToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timeZone }).format(new Date());

/** Checkout idempotency keys → order id ("pending" while that checkout is running). DEMO: in memory. */
const checkoutState = globalThis as typeof globalThis & { __mockCheckoutKeys?: Map<string, ID | "pending"> };
checkoutState.__mockCheckoutKeys ??= new Map();
const checkoutKeys = checkoutState.__mockCheckoutKeys;

const toOrderAddress = (a: Address): OrderAddressInput => ({
  recipientName: a.recipientName,
  companyName: a.companyName,
  country: a.country,
  prefecture: a.prefecture,
  city: a.city,
  area: a.area,
  postalCode: a.postalCode,
  addressLine1: a.addressLine1,
  addressLine2: a.addressLine2,
  phone: a.phone,
});

type Prepared = { ok: true; value: CreateOrderInput; actor: Actor } | { ok: false; errors: FieldErrors; message: string };

/**
 * Customer checkout → a create-order input. Everything is re-read on the server: lines are re-priced for the customer
 * (never a browser price), quantity rules and stock re-checked, addresses taken from the customer's own address book,
 * shipping quoted for the delivery address, and only enabled offline payment methods accepted.
 */
async function prepareCheckout(customerId: ID, input: Omit<CheckoutInput, "idempotencyKey">): Promise<Prepared> {
  const customer = mockCustomers.find((c) => c.id === customerId && c.status === "approved");
  if (!customer) return { ok: false, errors: {}, message: "Only approved business customers can place orders." };
  const lines = cartLines(customerId).map((l) => priceCartLine(customer, l));
  if (!lines.length) return { ok: false, errors: {}, message: "Your cart is empty." };

  const errors: FieldErrors = {};
  const blocked = lines.find((l) => l.error);
  if (blocked) errors.cart = `${blocked.name}: ${blocked.error}`;
  const shipTo = customer.addresses.find((a) => a.id === input.shippingAddressId && a.type === "shipping");
  if (!shipTo) errors.shippingAddressId = "Choose a delivery address.";
  const billTo = input.billingAddressId
    ? customer.addresses.find((a) => a.id === input.billingAddressId && a.type === "billing")
    : (customer.addresses.find((a) => a.type === "billing" && a.isDefault) ?? shipTo);
  if (input.billingAddressId && !billTo) errors.billingAddressId = "Choose a billing address.";
  const methods = await mockPaymentSettingsRepository.checkoutMethods();
  const paymentMethod = methods.some((m) => m.id === input.paymentMethod) ? orderPaymentMethod[input.paymentMethod] : undefined;
  if (!paymentMethod) errors.paymentMethod = "Choose a payment method.";
  const dateError = checkDeliveryDate(input.requestedDeliveryDate || undefined, storeToday());
  if (dateError) errors.requestedDeliveryDate = dateError;
  if ((input.customerNote ?? "").length > CART_LIMITS.note) errors.customerNote = `Keep the note under ${CART_LIMITS.note} characters.`;
  if (Object.keys(errors).length || !shipTo || !billTo || !paymentMethod) return { ok: false, errors, message: errors.cart ?? "Some details need attention." };

  const items = lines.map((l) => ({ productId: l.productId, variationId: l.variationId, quantity: l.quantity, unitPrice: l.unitPrice!, discount: 0 }));
  const { quote } = await mockShippingRepository.quote({ address: shipTo, items });
  const selected = quote.selected;
  if (!selected || selected.cost === undefined) {
    const message = "We don’t deliver to this address with these items yet. Contact us to arrange delivery.";
    return { ok: false, errors: { shippingAddressId: message }, message };
  }
  return {
    ok: true,
    actor: { id: customer.id, name: customer.companyName, role: "customer" },
    value: {
      customerId,
      billingAddress: toOrderAddress(billTo),
      shippingAddress: toOrderAddress(shipTo),
      items,
      shipping: { label: selected.method.name, amount: selected.cost, mode: "suggested" },
      paymentMethod,
      customerNote: input.customerNote?.trim() || undefined,
      requestedDeliveryDate: input.requestedDeliveryDate || undefined,
    },
  };
}

export const mockOrderRepository: OrderRepository = {
  async list({ customerId, status, excludeCancelled, paymentStatus, deliveryRouteId, orderType, search, from, to, sort = "placed", dir, page, perPage } = {}) {
    const typeOf = orderTypeResolver(mockOrders);
    const filtered = mockOrders.filter(
      (o) =>
        (!orderType || typeOf(o) === orderType) &&
        (!excludeCancelled || o.status !== "cancelled") &&
        (!customerId || o.customerId === customerId) &&
        (!status || o.status === status) &&
        (!paymentStatus || o.paymentStatus === paymentStatus) &&
        (!deliveryRouteId || o.shipping.deliveryRouteId === deliveryRouteId) &&
        withinDates(o.placedAt, { from, to }) &&
        matches(search, o.number, o.customerName),
    );
    const key = (o: Order): SortKey => {
      switch (sort) {
        case "number": return Number(o.number.replace(/\D/g, ""));
        case "customer": return o.customerName;
        case "total": return o.totals.total;
        case "status": return statusRank[o.status];
        default: return o.placedAt;
      }
    };
    const defaultDir = sort === "placed" || sort === "total" ? "desc" : "asc";
    const result = paginate(sortBy(filtered, key, dir ?? defaultDir), page, perPage);
    return { ...result, items: result.items.map((o) => ({ ...o, orderType: typeOf(o) })) };
  },

  async getById(orderId, customerId) {
    const o = mockOrders.find((x) => x.id === orderId && (!customerId || x.customerId === customerId));
    return o ? clone(o) : null;
  },

  async calculationSettings() {
    return { taxRates: { ...mockTaxRates }, shippingTaxClass: SHIPPING_TAX_CLASS };
  },

  async searchCustomers(term, limit = 10) {
    return mockCustomers
      .filter((c) => c.status === "approved" && matches(term, c.companyName, c.contactName, c.email, c.phone))
      .slice(0, Math.min(limit, 25))
      .map((c) => ({ id: c.id, companyName: c.companyName, contactName: c.contactName, phone: c.phone, email: c.email }));
  },

  async customerContext(customerId) {
    const c = mockCustomers.find((x) => x.id === customerId && x.status === "approved");
    if (!c) return null;
    return {
      id: c.id,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      addresses: clone(c.addresses),
    };
  },

  async orderableProduct(productId, customerId) {
    const product = mockProducts.find((p) => p.id === productId && p.status !== "archived");
    const customer = pricingCustomer(customerId);
    if (!product || !customer) return null;
    // Default price at the line's minimum quantity; the form re-quotes when the quantity changes (bulk tiers).
    const option = (variationId?: string) => {
      const limits = quantityLimitsFor(product, variationId);
      return { customerPrice: quotePrice(product, customer, variationId, limits.min)!.unitPrice, minQuantity: limits.min, maxQuantity: limits.max };
    };
    const options =
      product.type === "variable"
        ? product.variations
            .filter((v) => v.basePrice !== undefined)
            .map((v) => ({
              variationId: v.id,
              label: Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(", "),
              sku: v.sku,
              available: v.status === "active",
              stock: { ...v.stock },
              taxClass: v.taxClass ?? product.taxClass,
              weight: { ...(v.weight ?? product.weight) },
              catalogPrice: v.basePrice!,
              ...option(v.id),
            }))
        : product.basePrice === undefined
          ? []
          : [
              {
                label: "",
                sku: product.sku,
                available: true,
                stock: { ...product.stock },
                taxClass: product.taxClass,
                weight: { ...product.weight },
                catalogPrice: product.basePrice,
                ...option(),
              },
            ];
    if (!options.length) return null;
    return {
      productId: product.id,
      name: product.name,
      type: product.type,
      unitLabel: product.unitLabel,
      pricedByWeight: product.isVariableWeight,
      options,
    };
  },

  async quoteLine(customerId, productId, variationId, quantity) {
    const product = mockProducts.find((p) => p.id === productId && p.status !== "archived");
    const customer = pricingCustomer(customerId);
    if (!product || !customer || !Number.isInteger(quantity) || quantity < 1) return null;
    const price = quotePrice(product, customer, variationId, quantity);
    if (!price) return null;
    const limits = quantityLimitsFor(product, variationId);
    return {
      unitPrice: price.unitPrice,
      basePrice: price.basePrice,
      salePrice: price.salePrice,
      rulePrice: price.rulePrice,
      priceSource: price.priceSource,
      ruleName: price.rule?.name,
      tierLabel: price.tier && tierLabel(price.tier),
      minQuantity: limits.min,
      maxQuantity: limits.max,
      quantityError: checkQuantity(limits, quantity),
    };
  },

  async create(rawInput, actor) {
    const built = await buildOrder(rawInput, actor);
    return built.ok ? store(built.value) : built;
  },

  async checkoutPreview(customerId, input) {
    const prepared = await prepareCheckout(customerId, input);
    if (!prepared.ok) return prepared;
    const built = await buildOrder(prepared.value, prepared.actor);
    if (!built.ok) return built;
    const { items, shipping, taxes, totals, paymentStatus } = built.value;
    return { ok: true, value: clone({ items, shipping, taxes, totals, paymentStatus }) };
  },

  async checkout(customerId, input) {
    const token = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim().slice(0, 100) : "";
    if (token.length < 8) return { ok: false, errors: {}, message: "Reload the checkout page and try again." };
    const key = `${customerId}:${token}`;
    const existing = checkoutKeys.get(key);
    if (existing === "pending") return { ok: false, errors: {}, message: "Your order is already being placed. Please wait a moment." };
    const placed = existing && mockOrders.find((o) => o.id === existing && o.customerId === customerId);
    if (placed) return { ok: true, value: clone(placed) };

    checkoutKeys.set(key, "pending");
    try {
      const prepared = await prepareCheckout(customerId, input);
      if (!prepared.ok) return prepared;
      const built = await buildOrder(prepared.value, prepared.actor);
      if (!built.ok) return built;
      checkoutKeys.set(key, built.value.id);
      clearCart(customerId);
      return store(built.value);
    } finally {
      if (checkoutKeys.get(key) === "pending") checkoutKeys.delete(key);
    }
  },

  async updateStatus(orderId, status, actor, note) {
    const order = mockOrders.find((o) => o.id === orderId);
    if (!order) return notFound;
    if (!canTransition(order.status, status)) {
      return { ok: false, errors: { status: `Can't move from “${orderStatusLabels[order.status]}” to “${orderStatusLabels[status]}”.` } };
    }
    const reason = note?.trim();
    if (status === "cancelled" && (!reason || reason.length < 5)) return { ok: false, errors: { note: "Give a reason for cancelling (at least 5 characters)." } };
    const at = now();
    return store({
      ...order,
      status,
      statusHistory: [...order.statusHistory, { id: id("evt"), status, at, by: actor, note: reason || undefined }],
      updatedAt: at,
    });
  },

  async addNote(orderId, note, actor) {
    const order = mockOrders.find((o) => o.id === orderId);
    if (!order) return notFound;
    const body = note.body.trim();
    if (!body) return { ok: false, errors: { body: "Write a note." } };
    if (body.length > ORDER_LIMITS.note) return { ok: false, errors: { body: `Keep notes under ${ORDER_LIMITS.note} characters.` } };
    const at = now();
    return store({ ...order, notes: [...order.notes, { id: id("note"), type: note.type, body, at, by: actor }], updatedAt: at });
  },

  async adjustItem(orderId, input, actor) {
    return mockOrderRepository.edit(orderId, { kind: "adjust", ...input }, actor);
  },

  async edit(orderId, edit, actor) {
    const order = mockOrders.find((o) => o.id === orderId);
    if (!order) return notFound;
    const result = applyEdit(order, edit, actor, now());
    return result.ok ? store(result.order) : result;
  },

  async issueInvoice(orderId, input, actor) {
    const order = mockOrders.find((o) => o.id === orderId);
    if (!order) return notFound;
    const expected = nextInvoiceKind(order);
    if (!expected || expected !== input.kind) {
      const why: Record<string, string> = {
        invoice: "This order already has an invoice.",
        revision: "The invoice is up to date — there is nothing to revise.",
        credit_note: "A credit note is only for cancelled orders with an invoice.",
      };
      return { ok: false, errors: {}, message: expected ? `Issue a ${expected.replace("_", " ")} instead.` : why[input.kind] ?? "Nothing to issue." };
    }
    const errors: FieldErrors = {};
    if (input.kind !== "invoice") checkReason(errors, input.reason);
    if (Object.keys(errors).length) return { ok: false, errors, message: "Some fields need attention." };
    const at = now();
    const previous = latestInvoice(order);
    const snapshot = invoiceSnapshot(order);
    const number =
      input.kind === "invoice"
        ? nextInvoiceNumber(mockOrders.flatMap((o) => (o.invoices ?? []).map((i) => i.number)), storeYear())
        : followUpNumber(order.invoices!, input.kind);
    const invoice: Invoice = {
      id: id("inv"),
      number,
      kind: input.kind,
      replaces: previous?.number,
      reason: input.kind === "invoice" ? undefined : input.reason?.trim(),
      issuedAt: at,
      issuedBy: actor,
      snapshot,
      difference: previous
        ? fromMinor((input.kind === "credit_note" ? 0 : toMinor(snapshot.totals.total)) - toMinor(previous.snapshot.totals.total))
        : undefined,
    };
    return store({ ...order, invoices: [...(order.invoices ?? []), invoice], updatedAt: at });
  },

  async refund(orderId, input, actor) {
    const order = mockOrders.find((o) => o.id === orderId);
    if (!order) return notFound;
    const check = checkRefund(order, input);
    if (check.message) return { ok: false, errors: check.errors, message: check.message };
    if (Object.keys(check.errors).length) return { ok: false, errors: check.errors, message: Object.values(check.errors)[0] };
    const at = now();
    const lines =
      input.kind === "order"
        ? input.lines
            .filter((l) => l.quantity > 0 || l.amount > 0)
            .map((l) => ({ orderItemId: l.orderItemId, name: order.items.find((i) => i.id === l.orderItemId)!.name, quantity: l.quantity, amount: l.amount }))
        : undefined;
    // Restock refunded units (counted stock only); skipped lines say why. Stock changes are in the movement history.
    const restock: RefundRestock[] = [];
    if (input.kind === "order" && input.restock)
      for (const l of lines ?? []) {
        if (l.quantity <= 0) continue;
        const item = order.items.find((i) => i.id === l.orderItemId)!;
        const r = await mockProductRepository.setStock(item.productId, item.variationId, { delta: l.quantity }, { source: "refund_restock", byName: actor.name, orderId: order.id, orderNumber: order.number, note: input.reason.trim() });
        restock.push({ orderItemId: l.orderItemId, quantity: l.quantity, result: r.ok ? "restocked" : "skipped", note: r.ok ? undefined : r.message });
      }
    const refund: Refund = {
      id: id("ref"),
      kind: input.kind,
      amount: check.amount,
      reason: input.reason.trim(),
      at,
      by: actor,
      status: "recorded",
      lines: lines?.length ? lines : undefined,
      shipping: input.kind === "order" && input.shipping > 0 ? input.shipping : undefined,
      restock: restock.length ? restock : undefined,
    };
    const keptAfter = fromMinor(toMinor(refundSummary(order).kept) - toMinor(check.amount));
    const refunds = [...order.refunds, refund];
    const payment = order.payment.amountPaid !== undefined ? { ...order.payment, amountPaid: keptAfter } : order.payment;
    const next = recalculate({ ...order, refunds, payment, updatedAt: at }, mockTaxRates);
    return store({ ...next, paymentStatus: paymentStatusAfterRefund(keptAfter, refunds.some(isOrderRefund)) });
  },

  async recordPayment(orderId, input, actor) {
    const order = mockOrders.find((o) => o.id === orderId);
    if (!order) return notFound;
    if (order.status === "cancelled") return { ok: false, errors: {}, message: "Cancelled orders can't take a payment." };
    if (isCollected(order.paymentStatus) || order.paymentStatus === "refunded") return { ok: false, errors: {}, message: "Payment is already recorded for this order." };
    const reference = input.reference?.trim() ?? "";
    if (reference.length > 100) return { ok: false, errors: { reference: "Keep the reference under 100 characters." }, message: "Check the reference." };
    const at = now();
    const body = `Payment of ${formatMoney(order.totals.netTotal)} recorded as received (${paymentMethodLabels[order.payment.method]}${reference ? `, ref. ${reference}` : ""}). Demo record — this site collected no money.`;
    return store({
      ...order,
      paymentStatus: "paid",
      payment: { ...order.payment, reference: reference || order.payment.reference, paidAt: at },
      notes: [...order.notes, { id: id("note"), type: "admin", body, at, by: actor }],
      updatedAt: at,
    });
  },

  async previewEdit(orderId, edit) {
    const order = mockOrders.find((o) => o.id === orderId);
    if (!order) return notFound;
    const result = applyEdit(clone(order), edit, { id: "preview", name: "Preview", role: "admin" }, now());
    if (!result.ok) return result;
    const after = result.order;
    return {
      ok: true,
      value: {
        totalBefore: order.totals.total,
        totalAfter: after.totals.total,
        difference: fromMinor(toMinor(after.totals.total) - toMinor(order.totals.total)),
        lineTotal: result.itemId ? after.items.find((i) => i.id === result.itemId)?.lineTotal : undefined,
        orderDiscount: after.totals.orderDiscount ?? 0,
        balanceAfter: paymentBalance(after),
      },
    };
  },
};

// --- Order editing ------------------------------------------------------------------

type Applied = { ok: true; order: Order; itemId?: string } | { ok: false; errors: FieldErrors; message: string };

const invalid = (errors: FieldErrors, message = "Some fields need attention."): Applied => ({ ok: false, errors, message });
const blocked = (message: string): Applied => ({ ok: false, errors: {}, message });
const dateOnly = (iso?: string) => (iso ? iso.slice(0, 10) : null);

/** Line values for the history: quantity only when it changed. */
const lineValues = (item: OrderItem, withQuantity: boolean): Omit<OrderChangeValues, "orderTotal"> => ({
  ...(withQuantity ? { quantity: item.quantity } : {}),
  unitPrice: item.unitPrice,
  fulfilledWeight: item.fulfilledWeight,
  lineTotal: item.lineTotal,
});

/** Product/option checks shared with order creation (availability, option, quantity rules). */
function checkProductLine(productId: string, variationId: string | undefined, quantity: number, errors: FieldErrors) {
  const product = mockProducts.find((p) => p.id === productId);
  if (!product || product.status === "archived") {
    errors.productId = "This product is not available.";
    return undefined;
  }
  if (product.type === "variable") {
    const variation = product.variations.find((v) => v.id === variationId);
    if (!variation) errors.variationId = "Choose an option for this product.";
    else if (variation.status !== "active") errors.variationId = "This option is disabled.";
  }
  if (!errors.quantity) {
    const limitError = checkQuantity(quantityLimitsFor(product, variationId), quantity);
    if (limitError) errors.quantity = limitError;
  }
  return product;
}

/**
 * Applies one admin edit to a copy of the order: checks the status rules, validates, recalculates with
 * the order's own tax basis and appends the audit entry. Payment already collected is captured once
 * (`payment.amountPaid`) so the balance due/overpaid shows after the change. Catalog data is never changed.
 */
function applyEdit(order: Order, edit: OrderEdit, actor: Actor, at: string): Applied {
  let items = order.items;
  let discount = order.discount;
  let requestedDeliveryDate = order.requestedDeliveryDate;
  let { billingAddress, shippingAddress, shipping } = order;
  let itemId: string | undefined;
  let entry: Omit<OrderAdjustment, "id" | "at" | "by" | "before" | "after"> & { before: Omit<OrderChangeValues, "orderTotal">; after: Omit<OrderChangeValues, "orderTotal"> };

  switch (edit.kind) {
    case "adjust": {
      if (!canAdjust(order.status)) return blocked("Cancelled orders can't be changed.");
      const index = items.findIndex((i) => i.id === edit.itemId);
      const item = items[index];
      if (!item) return blocked("Order item not found.");
      const errors = validateAdjustment(edit, item);
      const quantityChanged = edit.quantity !== undefined && edit.quantity !== item.quantity;
      if (quantityChanged && !canEditItems(order.status)) return blocked("Quantities can't change after delivery. Adjust the price or weight instead.");
      if (quantityChanged && !errors.quantity) {
        const product = mockProducts.find((p) => p.id === item.productId);
        const limitError = product && checkQuantity(quantityLimitsFor(product, item.variationId), edit.quantity!);
        if (limitError) errors.quantity = limitError;
      }
      if (Object.keys(errors).length) return invalid(errors);
      const updated = applyLineChange(item, { quantity: edit.quantity, unitPrice: edit.unitPrice, fulfilledWeight: edit.fulfilledWeight });
      items = items.map((it, i) => (i === index ? updated : it));
      itemId = item.id;
      entry = { kind: "adjust", orderItemId: item.id, itemName: item.name, reason: edit.reason.trim(), before: lineValues(item, quantityChanged), after: lineValues(updated, quantityChanged) };
      break;
    }

    case "add": {
      if (!canEditItems(order.status)) return blocked("Items can't be added after delivery or cancellation.");
      const errors = validateAddLine(edit);
      const replaced = edit.replaceItemId ? items.find((i) => i.id === edit.replaceItemId) : undefined;
      if (edit.replaceItemId && !replaced) return blocked("The item to replace is no longer in the order.");
      const product = edit.productId ? checkProductLine(edit.productId, edit.variationId, edit.quantity, errors) : undefined;
      if (product && items.some((i) => i !== replaced && i.productId === edit.productId && (i.variationId ?? "") === (product.type === "variable" ? edit.variationId ?? "" : "")))
        errors.productId = "This product is already in the order — change its quantity instead.";
      if (Object.keys(errors).length || !product) return invalid(errors);
      const buyer = pricingCustomer(order.customerId);
      const variationId = product.type === "variable" ? edit.variationId : undefined;
      const quote = buyer ? quotePrice(product, buyer, variationId, edit.quantity) : undefined;
      const added: OrderItem = {
        ...snapshotItem(id("oi"), product.id, variationId, edit.quantity, edit.unitPrice),
        discount: edit.discount,
        // Which rule priced the line now; later rule edits never change it.
        pricing: quote ? pricingSnapshot(quote, edit.unitPrice) : undefined,
      };
      itemId = added.id;
      if (replaced) {
        items = items.map((i) => (i === replaced ? added : i));
        entry = { kind: "replace", orderItemId: added.id, itemName: added.name, replacedItemName: replaced.name, reason: edit.reason.trim(), before: lineValues(replaced, true), after: {} };
      } else {
        items = [...items, added];
        entry = { kind: "add", orderItemId: added.id, itemName: added.name, reason: edit.reason.trim(), before: {}, after: {} };
      }
      break;
    }

    case "remove": {
      if (!canEditItems(order.status)) return blocked("Items can't be removed after delivery or cancellation.");
      const errors: FieldErrors = {};
      checkReason(errors, edit.reason);
      const item = items.find((i) => i.id === edit.itemId);
      if (!item) return blocked("Order item not found.");
      if (items.length === 1) return blocked("An order needs at least one item. Cancel the order instead.");
      if (Object.keys(errors).length) return invalid(errors);
      items = items.filter((i) => i !== item);
      entry = { kind: "remove", orderItemId: item.id, itemName: item.name, reason: edit.reason.trim(), before: lineValues(item, true), after: {} };
      break;
    }

    case "discount": {
      if (!canChangeDiscount(order.status)) return blocked("Cancelled orders can't be changed.");
      const errors = validateOrderDiscount(edit);
      const current = order.discount ? { type: order.discount.type, value: order.discount.value } : null;
      if (!edit.discount && !current) return blocked("This order has no discount to remove.");
      if (edit.discount && current && edit.discount.type === current.type && edit.discount.value === current.value) errors.value = "Change the discount amount or type.";
      const itemsAfterLines = sumMoney(items.map((i) => i.lineTotal));
      if (edit.discount?.type === "fixed" && !errors.value && edit.discount.value > itemsAfterLines)
        errors.value = `The discount can't exceed the items total (${formatMoney(itemsAfterLines)}).`;
      if (Object.keys(errors).length) return invalid(errors);
      discount = edit.discount ? { type: edit.discount.type, value: edit.discount.value, reason: edit.reason.trim(), at, by: actor } : undefined;
      entry = { kind: "discount", reason: edit.reason.trim(), before: { discount: current }, after: { discount: edit.discount ? { type: edit.discount.type, value: edit.discount.value } : null } };
      break;
    }

    case "delivery_date": {
      if (!canChangeDeliveryDate(order.status)) return blocked("The delivery date can't change after delivery or cancellation.");
      const errors: FieldErrors = {};
      if (edit.date !== null && !isIsoDate(edit.date)) errors.date = "Choose a valid date.";
      if ((edit.reason ?? "").trim().length > ORDER_LIMITS.reason) errors.reason = `Keep the reason under ${ORDER_LIMITS.reason} characters.`;
      if (!errors.date && edit.date === dateOnly(order.requestedDeliveryDate)) errors.date = "Choose a different date.";
      if (Object.keys(errors).length) return invalid(errors);
      requestedDeliveryDate = edit.date ? `${edit.date}T00:00:00${siteConfig.utcOffset}` : undefined;
      entry = { kind: "delivery_date", reason: edit.reason?.trim() ?? "", before: { deliveryDate: dateOnly(order.requestedDeliveryDate) }, after: { deliveryDate: edit.date } };
      break;
    }

    case "address": {
      if (order.fulfilment === "pickup") return blocked("Store pickup orders have no delivery or billing address.");
      if (edit.which !== "billing" && edit.which !== "shipping") return blocked("Choose the billing or delivery address.");
      if (edit.which === "shipping" ? !canEditItems(order.status) : !canAdjust(order.status))
        return blocked(edit.which === "shipping" ? "The delivery address can't change after delivery or cancellation." : "Cancelled orders can't be changed.");
      const errors: FieldErrors = {};
      checkAddress(errors, "address", edit.address, !order.walkIn);
      checkReason(errors, edit.reason);
      const current = edit.which === "billing" ? order.billingAddress : order.shippingAddress;
      const updated: Address = {
        ...toAddress({ ...edit.address, postalCode: isPostcode(edit.address.postalCode) ? normalizePostcode(edit.address.postalCode) : edit.address.postalCode }, edit.which, current?.label ?? (edit.which === "billing" ? "Billing" : "Delivery")),
        id: current?.id ?? id("addr"),
      };
      const oneLine = (a?: Address) => (a ? [a.recipientName, a.companyName, ...formatAddressLines(a), a.phone].filter(Boolean).join(", ") : "none");
      if (!Object.keys(errors).length && oneLine(updated) === oneLine(current)) errors["address.addressLine1"] = "Change at least one field.";
      if (Object.keys(errors).length) return invalid(errors);
      if (edit.which === "billing") billingAddress = updated;
      else shippingAddress = updated;
      entry = { kind: "address", addressType: edit.which, reason: edit.reason.trim(), before: { address: oneLine(current) }, after: { address: oneLine(updated) } };
      break;
    }

    case "shipping": {
      if (!canAdjust(order.status)) return blocked("Cancelled orders can't be changed.");
      const errors: FieldErrors = {};
      const label = edit.label.trim();
      if (!label) errors.label = "Describe the delivery (e.g. route name).";
      else if (label.length > 120) errors.label = "Keep the label under 120 characters.";
      if (!isValidAmount(edit.amount)) errors.amount = `Enter a valid amount (0 or more, ${AMOUNT_RULE}).`;
      checkReason(errors, edit.reason);
      if (!errors.amount && !errors.label && toMinor(edit.amount) === toMinor(order.shipping.amount) && label === order.shipping.label) errors.amount = "Change the charge or its label.";
      if (Object.keys(errors).length) return invalid(errors);
      const decision = order.shipping.decision;
      shipping = {
        ...order.shipping,
        label,
        amount: edit.amount,
        decision: { mode: "manual", reason: edit.reason.trim(), suggestedAmount: decision?.suggestedAmount, zoneId: decision?.zoneId, zoneName: decision?.zoneName, methodId: decision?.methodId, methodName: decision?.methodName },
      };
      entry = { kind: "shipping", reason: edit.reason.trim(), before: { shipping: order.shipping.amount, shippingLabel: order.shipping.label }, after: { shipping: edit.amount, shippingLabel: label } };
      break;
    }

    default:
      return blocked("Unknown change.");
  }

  // Payment collected before this change: remember it once so the balance (due or overpaid) shows afterwards.
  const collected = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";
  const payment = collected && order.payment.amountPaid === undefined ? { ...order.payment, amountPaid: order.totals.netTotal } : order.payment;
  const next = recalculate({ ...order, items, discount, requestedDeliveryDate, billingAddress, shippingAddress, shipping, payment, updatedAt: at }, mockTaxRates);
  if (next.totals.netTotal < 0) return blocked(`The new total can't be below the ${formatMoney(next.totals.refundedTotal)} already refunded.`);
  if (entry.kind === "adjust" || entry.kind === "add" || entry.kind === "replace") {
    const item = next.items.find((i) => i.id === itemId)!;
    entry.after = entry.kind === "adjust" ? lineValues(item, entry.before.quantity !== undefined) : lineValues(item, true);
  }
  const adjustment: OrderAdjustment = {
    ...entry,
    id: id("adj"),
    at,
    by: actor,
    before: { ...entry.before, orderTotal: order.totals.total },
    after: { ...entry.after, orderTotal: next.totals.total },
  };
  return { ok: true, order: { ...next, adjustments: [...order.adjustments, adjustment] }, itemId };
}
