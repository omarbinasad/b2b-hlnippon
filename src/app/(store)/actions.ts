"use server";

/*
 * Storefront mutations and lookups. DEMO: carts and orders live in the mock repositories' memory; no payment is
 * processed. TODO(auth): the shopper comes from the mock session — the backend must authenticate every call.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPricingCustomerId, getShoppingCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { Cart, CartLineInput, CheckoutInput, CheckoutPreview, ContactTopic, FieldErrors, PaymentMethodId, QuickOrderPage } from "@/lib/types";

/** Quick order sheet: search / category filter / next page (server-side). Prices for approved customers and staff. */
export async function quickOrderSheetAction(input: { q?: unknown; category?: unknown; page?: unknown }): Promise<QuickOrderPage> {
  return repositories.cart.quickOrder(await getPricingCustomerId(), {
    search: typeof input.q === "string" ? input.q.slice(0, 100) : undefined,
    categorySlug: typeof input.category === "string" ? input.category.slice(0, 100) : undefined,
    page: typeof input.page === "number" && Number.isInteger(input.page) && input.page > 0 ? input.page : 1,
  });
}

export type ContactActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

/** Contact form. DEMO: stored in server memory, no email is sent. The backend must add rate limiting and bot protection. */
export async function sendContactMessageAction(raw: unknown): Promise<ContactActionResult> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Spam trap: people never fill this hidden field. Looks like success, stores nothing.
  if (str(o.website, 200)) return { ok: true };
  const result = await repositories.contact.submit({
    name: str(o.name, 300),
    company: str(o.company, 300) || undefined,
    email: str(o.email, 300),
    phone: str(o.phone, 100) || undefined,
    topic: str(o.topic, 30) as ContactTopic,
    message: str(o.message, 3000),
  });
  return result.ok ? { ok: true } : { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
}

export type CartActionResult = { ok: true; cart: Cart; message?: string } | { ok: false; message: string };
export type CheckoutActionResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 100) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : Number.NaN);
const notShopper = "Ordering is available to approved business customers. Log in or apply for a wholesale account.";

function lineInputs(raw: unknown): CartLineInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).map((l) => {
    const o = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    return { productId: str(o.productId), variationId: str(o.variationId) || undefined, quantity: int(o.quantity) };
  });
}

/** The cart count in the header is on every page, so every cart change refreshes them all. */
const refreshCart = () => revalidatePath("/", "layout");

export async function addToCartAction(rawLines: unknown): Promise<CartActionResult> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, message: notShopper };
  const result = await repositories.cart.add(customerId, lineInputs(rawLines));
  if (!result.ok) return { ok: false, message: result.message ?? "Couldn't add to the cart." };
  refreshCart();
  const { cart, added, skipped } = result.value;
  const message = `${added} product${added === 1 ? "" : "s"} added to your cart.${skipped.length ? ` Not added: ${skipped.join(" ")}` : ""}`;
  return { ok: true, cart, message };
}

export async function updateCartLineAction(lineId: unknown, quantity: unknown): Promise<CartActionResult> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, message: notShopper };
  const result = await repositories.cart.setQuantity(customerId, str(lineId, 200), int(quantity));
  if (!result.ok) return { ok: false, message: result.message ?? "Couldn't update the quantity." };
  refreshCart();
  return { ok: true, cart: result.value };
}

export async function applyCouponAction(code: unknown): Promise<CartActionResult> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, message: "Log in with an approved account to use a coupon." };
  const r = await repositories.cart.applyCoupon(customerId, typeof code === "string" ? code.slice(0, 40) : "");
  if (!r.ok) return { ok: false, message: r.message ?? "That coupon can't be used." };
  revalidatePath("/", "layout");
  return { ok: true, cart: r.value };
}

export async function removeCouponAction(): Promise<CartActionResult> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, message: "Log in with an approved account." };
  const r = await repositories.cart.removeCoupon(customerId);
  if (!r.ok) return { ok: false, message: r.message ?? "That couldn't be removed." };
  revalidatePath("/", "layout");
  return { ok: true, cart: r.value };
}

export async function removeCartLineAction(lineId: unknown): Promise<CartActionResult> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, message: notShopper };
  const result = await repositories.cart.remove(customerId, str(lineId, 200));
  if (!result.ok) return { ok: false, message: result.message ?? "Couldn't remove the item." };
  refreshCart();
  return { ok: true, cart: result.value };
}

function checkoutInput(raw: unknown): CheckoutInput {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    shippingAddressId: str(o.shippingAddressId),
    shippingMethodId: str(o.shippingMethodId) || undefined,
    billingAddressId: str(o.billingAddressId) || undefined,
    paymentMethod: str(o.paymentMethod, 40) as PaymentMethodId,
    requestedDeliveryDate: str(o.requestedDeliveryDate, 10) || undefined,
    customerNote: str(o.customerNote, 600) || undefined,
    idempotencyKey: str(o.idempotencyKey),
  };
}

/** Totals for the checkout page (DEMO calculation; the backend repeats it when the order is placed). */
export async function checkoutPreviewAction(raw: unknown): Promise<CheckoutActionResult<CheckoutPreview>> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, errors: {}, message: notShopper };
  const result = await repositories.orders.checkoutPreview(customerId, checkoutInput(raw));
  return result.ok ? result : { ok: false, errors: result.errors, message: result.message ?? "Some details need attention." };
}

/** Places the order (no payment is taken) and opens it in the customer's account. */
export async function placeOrderAction(raw: unknown): Promise<{ ok: false; errors: FieldErrors; message: string } | undefined> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, errors: {}, message: notShopper };
  const result = await repositories.orders.checkout(customerId, checkoutInput(raw));
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some details need attention." };
  refreshCart();
  revalidatePath("/account", "layout");
  revalidatePath("/admin", "layout");
  redirect(`/account/orders/${result.value.id}?placed=1` as Route);
}

/** "Order again": adds a past order's products (current prices, current availability) to the cart. */
export async function reorderAction(orderId: unknown): Promise<CartActionResult | undefined> {
  const customerId = await getShoppingCustomerId();
  if (!customerId) return { ok: false, message: notShopper };
  // Scoped to the shopper, so nobody can copy another customer's order.
  const order = await repositories.orders.getById(str(orderId), customerId);
  if (!order) return { ok: false, message: "Order not found." };
  const result = await repositories.cart.add(
    customerId,
    order.items.map((i) => ({ productId: i.productId, variationId: i.variationId, quantity: i.quantity })),
  );
  if (!result.ok) return { ok: false, message: result.message ?? "None of these products can be ordered right now." };
  refreshCart();
  const { added, skipped } = result.value;
  redirect(`/cart?reordered=${added}&skipped=${skipped.length}` as Route);
}
