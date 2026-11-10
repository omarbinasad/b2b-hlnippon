"use server";

/*
 * Admin order mutations and lookups. DEMO: the mock repository keeps changes in
 * server memory only; nothing is charged, refunded or sent to the customer.
 * TODO(auth): the actor and permissions come from the mock session today — the
 * backend must authenticate the admin and check permissions on every call.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorWith, getAdminActor, getCapabilities } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { orderStatuses } from "@/lib/enums";
import type { StockChange } from "@/lib/orders/stock";
import type {
  AdjustItemInput,
  CreateOrderInput,
  FieldErrors,
  OrderableProduct,
  OrderEdit,
  OrderEditPreview,
  OrderLineQuote,
  OrderAddressInput,
  OrderCustomerContext,
  OrderNoteType,
  PaymentMethod,
  RefundInput,
  Weight,
} from "@/lib/types";
import { ORDER_LIMITS } from "@/lib/validation/order";
import { storeCountry } from "@/lib/locations";

export type OrderActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

// --- Coercion of untrusted action arguments ---------------------------------------

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const optStr = (v: unknown, max = 2000) => str(v, max).trim() || undefined;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number.NaN);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

const PAYMENT_METHODS = ["cash_on_delivery", "bank_transfer", "mobile_wallet", "invoice"] as const satisfies readonly PaymentMethod[];

function address(v: unknown): OrderAddressInput {
  const a = obj(v);
  return {
    recipientName: str(a.recipientName, 200),
    companyName: optStr(a.companyName, 200),
    country: storeCountry(),
    prefecture: str(a.prefecture, 100),
    city: str(a.city, 100),
    area: optStr(a.area, 100),
    postalCode: str(a.postalCode, 10),
    addressLine1: str(a.addressLine1, 300),
    addressLine2: optStr(a.addressLine2, 300),
    phone: str(a.phone, 40),
  };
}

function walkInInput(v: unknown): CreateOrderInput["walkIn"] {
  if (!v || typeof v !== "object") return undefined;
  const w = obj(v);
  return { name: str(w.name, 200), companyName: optStr(w.companyName, 200), email: optStr(w.email, 200), phone: optStr(w.phone, 40) };
}

function weight(v: unknown): Weight | undefined {
  if (v === undefined || v === null) return undefined;
  const w = obj(v);
  return { value: num(w.value), unit: oneOf(w.unit, ["g", "kg"] as const, "kg") };
}

const denied = (message = "You don't have permission to do this."): OrderActionResult => ({ ok: false, errors: {}, message });

const failed = (r: { errors: FieldErrors; message?: string }, fallback: string): OrderActionResult => ({
  ok: false,
  errors: r.errors,
  message: r.message ?? Object.values(r.errors)[0] ?? fallback,
});

/**
 * Which capability a change needs, field by field: staff such as warehouse can weigh items without being able to change
 * prices. A change touching several fields needs all of them. DEMO check; the backend must enforce the same.
 */
async function actorForEdit(orderId: string, edit: OrderEdit) {
  const actor = await getAdminActor();
  const caps = new Set(await getCapabilities());
  const who = { id: actor.id, name: actor.name, role: actor.role };
  if (edit.kind === "discount") return caps.has("order_discounts.edit") ? who : null;
  if (edit.kind === "add" || edit.kind === "remove") return caps.has("order_items.edit") ? who : null;
  if (edit.kind === "address") return caps.has("order_addresses.edit") ? who : null;
  if (edit.kind !== "adjust") return caps.has("orders_edit.edit") ? who : null;
  const order = await repositories.orders.getById(orderId);
  const item = order?.items.find((i) => i.id === edit.itemId);
  const needed: string[] = [];
  if (edit.unitPrice !== undefined && edit.unitPrice !== item?.unitPrice) needed.push("order_prices.edit");
  if (edit.quantity !== undefined && edit.quantity !== item?.quantity) needed.push("order_quantities.edit");
  if (edit.fulfilledWeight !== undefined && JSON.stringify(edit.fulfilledWeight) !== JSON.stringify(item?.fulfilledWeight)) needed.push("delivered_weight.edit");
  const allowed = needed.length ? needed.every((c) => caps.has(c)) : ["order_prices.edit", "order_quantities.edit", "delivered_weight.edit"].some((c) => caps.has(c));
  return allowed ? who : null;
}

function refresh(orderId: string) {
  revalidatePath("/admin", "layout"); // Sidebar badges and the notification bell.
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/account/orders", "layout");
  revalidatePath("/admin");
}

// --- Lookups for the create-order form ---------------------------------------------

export async function searchOrderCustomersAction(term: string) {
  return repositories.orders.searchCustomers(str(term, 100), 10);
}

export async function getOrderCustomerAction(customerId: string): Promise<OrderCustomerContext | null> {
  return repositories.orders.customerContext(str(customerId, 100));
}

/** Empty customer id = walk-in order (catalog prices). */
export async function getOrderableProductAction(productId: string, customerId?: string): Promise<OrderableProduct | null> {
  return repositories.orders.orderableProduct(str(productId, 100), optStr(customerId, 100));
}

// --- Mutations ------------------------------------------------------------------------

export async function createOrderAction(raw: unknown): Promise<OrderActionResult> {
  const actor = await actorWith("orders_create.create");
  if (!actor) return denied();
  const v = obj(raw);
  const shipping = obj(v.shipping);
  const input: CreateOrderInput = {
    customerId: optStr(v.customerId, 100),
    walkIn: walkInInput(v.walkIn),
    fulfilment: v.fulfilment === "pickup" ? "pickup" : "delivery",
    billingAddress: v.billingAddress ? address(v.billingAddress) : undefined,
    shippingAddress: v.shippingAddress ? address(v.shippingAddress) : undefined,
    items: (Array.isArray(v.items) ? v.items.slice(0, 101) : []).map((x) => {
      const i = obj(x);
      return {
        productId: str(i.productId, 100),
        variationId: optStr(i.variationId, 100),
        quantity: num(i.quantity),
        unitPrice: num(i.unitPrice),
        discount: num(i.discount),
      };
    }),
    shipping: { label: str(shipping.label, 120), amount: num(shipping.amount), mode: shipping.mode === "manual" ? "manual" : "suggested", reason: optStr(shipping.reason, 300) },
    paymentMethod: oneOf(v.paymentMethod, PAYMENT_METHODS, "cash_on_delivery"),
    customerNote: optStr(v.customerNote),
    adminNote: optStr(v.adminNote),
    requestedDeliveryDate: optStr(v.requestedDeliveryDate, 10),
  };
  // Creating an order doesn't by itself allow setting your own price or discount.
  const caps = new Set(await getCapabilities());
  if (!caps.has("order_discounts.edit") && input.items.some((i) => i.discount > 0)) return denied("Your role can't add discounts to an order.");
  if (!caps.has("order_prices.edit")) {
    for (const i of input.items) {
      const quote = await repositories.orders.quoteLine(input.customerId, i.productId, i.variationId, i.quantity);
      if (quote && quote.unitPrice !== i.unitPrice) return denied("Your role can't change prices. Use the suggested price.");
    }
  }
  const result = await repositories.orders.create(input, actor);
  if (!result.ok) return failed(result, "Some fields need attention.");
  refresh(result.value.id);
  redirect(`/admin/orders/${result.value.id}?notice=order-created` as Route);
}

export async function updateOrderStatusAction(orderId: string, status: string, note?: string): Promise<OrderActionResult> {
  const actor = await actorWith("order_status.edit");
  if (!actor) return denied();
  if (!orderStatuses.includes(status as (typeof orderStatuses)[number])) return denied("Unknown status.");
  const id = str(orderId, 100);
  const result = await repositories.orders.updateStatus(id, status as (typeof orderStatuses)[number], actor, optStr(note, 300));
  if (!result.ok) return failed(result, "The status could not be changed.");
  refresh(id);
  return { ok: true };
}

export async function addOrderNoteAction(orderId: string, type: string, body: string): Promise<OrderActionResult> {
  const actor = await actorWith("orders_edit.edit");
  if (!actor) return denied();
  const id = str(orderId, 100);
  const noteType = oneOf<OrderNoteType>(type, ["admin", "customer"], "admin");
  const result = await repositories.orders.addNote(id, { type: noteType, body: str(body, 1000) }, actor);
  if (!result.ok) return failed(result, "The note could not be added.");
  refresh(id);
  return { ok: true };
}

function adjustInput(v: Record<string, unknown>): AdjustItemInput {
  return {
    itemId: str(v.itemId, 100),
    quantity: v.quantity === undefined ? undefined : num(v.quantity),
    unitPrice: v.unitPrice === undefined ? undefined : num(v.unitPrice),
    fulfilledWeight: weight(v.fulfilledWeight),
    reason: str(v.reason, 300),
  };
}

export async function adjustOrderItemAction(orderId: string, raw: unknown): Promise<OrderActionResult> {
  const id = str(orderId, 100);
  const input = adjustInput(obj(raw));
  const actor = await actorForEdit(id, { kind: "adjust", ...input });
  if (!actor) return denied("You don't have permission to make this change.");
  const result = await repositories.orders.adjustItem(id, input, actor);
  if (!result.ok) return failed(result, "The adjustment could not be saved.");
  refresh(id);
  return { ok: true };
}

/** Untrusted edit payload → OrderEdit (unknown kinds become an invalid edit the repository rejects). */
function orderEdit(raw: unknown): OrderEdit | null {
  const v = obj(raw);
  switch (v.kind) {
    case "adjust":
      return { kind: "adjust", ...adjustInput(v) };
    case "add":
      return {
        kind: "add",
        productId: str(v.productId, 100),
        variationId: optStr(v.variationId, 100),
        quantity: num(v.quantity),
        unitPrice: num(v.unitPrice),
        discount: num(v.discount),
        reason: str(v.reason, 300),
        replaceItemId: optStr(v.replaceItemId, 100),
      };
    case "remove":
      return { kind: "remove", itemId: str(v.itemId, 100), reason: str(v.reason, 300) };
    case "discount": {
      const d = v.discount === null || v.discount === undefined ? null : obj(v.discount);
      return {
        kind: "discount",
        discount: d ? { type: oneOf(d.type, ["fixed", "percent"] as const, "fixed"), value: num(d.value) } : null,
        reason: str(v.reason, 300),
      };
    }
    case "delivery_date":
      return { kind: "delivery_date", date: v.date === null ? null : str(v.date, 10), reason: optStr(v.reason, 300) };
    case "address":
      return { kind: "address", which: oneOf(v.which, ["billing", "shipping"] as const, "shipping"), address: address(v.address), reason: str(v.reason, 300) };
    case "shipping":
      return { kind: "shipping", label: str(v.label, 200), amount: num(v.amount), reason: str(v.reason, 300) };
    default:
      return null;
  }
}

/** Edits an existing order: items (add / remove / replace / quantity / price / weight), order discount, delivery date. */
export async function editOrderAction(orderId: string, raw: unknown): Promise<OrderActionResult> {
  const edit = orderEdit(raw);
  if (!edit) return denied("Unknown change.");
  const id = str(orderId, 100);
  const actor = await actorForEdit(id, edit);
  if (!actor) return denied("You don't have permission to make this change.");
  const result = await repositories.orders.edit(id, edit, actor);
  if (!result.ok) return failed(result, "The change could not be saved.");
  refresh(id);
  return { ok: true };
}

export type OrderEditPreviewResult = { ok: true; preview: OrderEditPreview } | { ok: false; errors: FieldErrors; message: string };

/** Before/after totals for an edit, without saving (same validation and calculation as saving). */
export async function previewOrderEditAction(orderId: string, raw: unknown): Promise<OrderEditPreviewResult> {
  const edit = orderEdit(raw);
  if (!edit) return { ok: false, errors: {}, message: "Unknown change." };
  const actor = await actorForEdit(str(orderId, 100), edit);
  if (!actor) return { ok: false, errors: {}, message: "You don't have permission to make this change." };
  // The reason is checked when saving; an empty one shouldn't block the preview.
  const forPreview = (edit.kind !== "delivery_date" && !(edit.reason ?? "").trim() ? { ...edit, reason: "Preview only" } : edit) as OrderEdit;
  const result = await repositories.orders.previewEdit(str(orderId, 100), forPreview);
  return result.ok ? { ok: true, preview: result.value } : { ok: false, errors: result.errors, message: result.message ?? Object.values(result.errors)[0] ?? "Check the fields." };
}

/**
 * Global stock change for an order line's product/variation, from the order page. Updates the catalog
 * (shown everywhere on the site); the order itself and its amounts are not changed.
 */
export async function setLineStockAction(orderId: string, productId: string, variationId: string | undefined, raw: unknown): Promise<OrderActionResult> {
  const actor = await actorWith("order_stock.edit");
  if (!actor) return denied("You don't have permission to change stock.");
  const v = obj(raw);
  const change: StockChange =
    v.quantity !== undefined ? { quantity: num(v.quantity) } : { status: oneOf(v.status, ["in_stock", "out_of_stock"] as const, "out_of_stock") };
  const order = await repositories.orders.getById(str(orderId, 100));
  const result = await repositories.products.setStock(str(productId, 100), variationId ? str(variationId, 100) : undefined, change, {
    source: "order_page",
    byName: actor.name,
    orderId: order?.id,
    orderNumber: order?.number,
  });
  if (!result.ok) return failed(result, "The stock could not be changed.");
  revalidatePath("/", "layout");
  refresh(str(orderId, 100));
  return { ok: true };
}

/** Records a refund (DEMO: noted on the order only — no money is moved). Optionally restocks refunded units. */
export async function refundOrderAction(orderId: string, raw: unknown): Promise<OrderActionResult> {
  const actor = await actorWith("refunds.refund");
  if (!actor) return denied("You don't have permission to record refunds.");
  const v = obj(raw);
  const input: RefundInput = {
    kind: oneOf(v.kind, ["order", "overpayment"] as const, "order"),
    lines: (Array.isArray(v.lines) ? v.lines.slice(0, ORDER_LIMITS.lines) : []).map((x) => {
      const l = obj(x);
      return { orderItemId: str(l.orderItemId, 100), quantity: num(l.quantity), amount: num(l.amount) };
    }),
    shipping: num(v.shipping),
    other: num(v.other),
    reason: str(v.reason, 300),
    restock: v.restock === true,
  };
  const id = str(orderId, 100);
  const result = await repositories.orders.refund(id, input, actor);
  if (!result.ok) return failed(result, "The refund could not be recorded.");
  if (input.restock) revalidatePath("/", "layout");
  refresh(id);
  return { ok: true };
}

/** Records payment received outside the site (DEMO bookkeeping — never charges anyone). */
export async function recordPaymentAction(orderId: string, reference?: string): Promise<OrderActionResult> {
  const actor = await actorWith("orders_edit.edit");
  if (!actor) return denied();
  const id = str(orderId, 100);
  const result = await repositories.orders.recordPayment(id, { reference: optStr(reference, 200) }, actor);
  if (!result.ok) return failed(result, "The payment could not be recorded.");
  refresh(id);
  return { ok: true };
}

/** Permanently deletes a cancelled order with no payment, refund or invoice (the repository checks). DEMO: server memory. */
export async function deleteOrderAction(orderId: string): Promise<OrderActionResult> {
  const actor = await actorWith("orders.delete");
  if (!actor) return denied("You don't have permission to delete orders.");
  const id = str(orderId, 100);
  const result = await repositories.orders.remove(id, actor);
  if (!result.ok) return failed(result, "The order could not be deleted.");
  refresh(id);
  redirect("/admin/orders?notice=deleted" as Route);
}

/** Form action for the list's one-step "Mark as …" button; reports back via `?notice=`. */
export async function advanceOrderStatusAction(formData: FormData) {
  const raw = String(formData.get("returnTo") ?? "");
  const returnTo = raw.startsWith("/admin/orders") && !raw.startsWith("//") ? raw : "/admin/orders";
  const result = await updateOrderStatusAction(String(formData.get("id") ?? ""), String(formData.get("status") ?? ""));
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}notice=${result.ok ? "status" : "error"}` as Route);
}

/** Rule price and quantity limits for one line (bulk tiers change the price with the quantity). DEMO calculation. */
export async function quoteOrderLineAction(customerId: string | undefined, productId: string, variationId: string | undefined, quantity: number): Promise<OrderLineQuote | null> {
  const q = typeof quantity === "number" && Number.isInteger(quantity) ? quantity : 0;
  return repositories.orders.quoteLine(optStr(customerId, 100), str(productId, 100), variationId ? str(variationId, 100) : undefined, q);
}

export interface OrderShippingSuggestion {
  amount?: number;
  label?: string;
  zoneName?: string;
  methodName?: string;
  totalKg: number;
  subtotal: number;
  explanation: string;
}

/** Suggested shipping for the delivery address and lines (DEMO rates; the server re-checks on save). */
export async function quoteOrderShippingAction(raw: unknown): Promise<OrderShippingSuggestion> {
  const v = obj(raw);
  const a = obj(v.address);
  const items = (Array.isArray(v.items) ? v.items.slice(0, 100) : []).map((x) => {
    const i = obj(x);
    const price = num(i.unitPrice);
    const discount = num(i.discount);
    return {
      productId: str(i.productId, 100),
      variationId: optStr(i.variationId, 100),
      quantity: num(i.quantity),
      unitPrice: Number.isFinite(price) ? price : undefined,
      discount: Number.isFinite(discount) ? discount : undefined,
    };
  });
  const { quote } = await repositories.shipping.quote({
    address: { prefecture: str(a.prefecture, 50), city: str(a.city, 100), postalCode: optStr(a.postalCode, 10) },
    items,
  });
  const selected = quote.selected;
  return {
    amount: selected?.cost,
    label: selected ? `${selected.method.name} — ${quote.match.zone?.name}` : undefined,
    zoneName: quote.match.zone?.name,
    methodName: selected?.method.name,
    totalKg: quote.metrics.totalGrams / 1000,
    subtotal: quote.metrics.subtotal,
    explanation: quote.explanation,
  };
}

/** Issues the order's next invoice document: first invoice, revision after changes, or credit note for a cancelled order. */
export async function issueInvoiceAction(orderId: string, kind: string, reason?: string): Promise<OrderActionResult> {
  const actor = await actorWith("invoices.create");
  if (!actor) return denied();
  const id = str(orderId, 100);
  const result = await repositories.orders.issueInvoice(id, { kind: oneOf(kind, ["invoice", "revision", "credit_note"] as const, "invoice"), reason: optStr(reason, 300) }, actor);
  if (!result.ok) return failed(result, "The invoice could not be issued.");
  refresh(id);
  revalidatePath(`/admin/orders/${id}/invoice`);
  return { ok: true };
}
