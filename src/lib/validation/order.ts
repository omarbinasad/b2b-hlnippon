/**
 * Order input validation shared by the admin forms and the mock repository.
 * The backend must enforce the same rules (plus stock, pricing and permissions).
 */
// Relative import (not the @/ alias) so the Node test runner can load this module.
import { isEmail, isPhone, isPostcode, phoneError, postcodeError } from "../customers/contact.ts";
import { amountRule, applyLineChange, isValidAmount, isValidPercent, lineAmounts, toGrams } from "../orders/calc.ts";
import type { AdjustItemInput, CreateOrderInput, FieldErrors, OrderAddressInput, OrderEdit, OrderItem, PaymentMethod } from "@/lib/types";

export const ORDER_LIMITS = { maxQuantity: 10_000, note: 1000, reason: 300, lines: 100 } as const;

const PAYMENT_METHODS: PaymentMethod[] = ["cash_on_delivery", "bank_transfer", "mobile_wallet", "invoice"];

/** Walk-in deliveries may have no phone; registered customers' addresses need one. */
export function checkAddress(errors: FieldErrors, prefix: string, a: OrderAddressInput, phoneRequired = true) {
  const required: [keyof OrderAddressInput, string][] = [
    ["recipientName", "Recipient name"],
    ...(phoneRequired ? ([["phone", "Phone"]] as [keyof OrderAddressInput, string][]) : []),
    ["prefecture", "Prefecture"],
    ["city", "City"],
    ["postalCode", "Postcode"],
    ["addressLine1", "Street address"],
  ];
  for (const [key, label] of required) {
    if (!String(a[key] ?? "").trim()) errors[`${prefix}.${key}`] = `${label} is required.`;
  }
  if (a.postalCode && !isPostcode(a.postalCode)) errors[`${prefix}.postalCode`] = postcodeError();
}

export function validateCreateOrder(input: CreateOrderInput): FieldErrors {
  const errors: FieldErrors = {};
  const w = input.walkIn;
  if (w) {
    // Walk-in: no account. Only a name is required; email and phone are optional but must be valid if given.
    const name = w.name.trim();
    if (name.length < 2) errors["walkIn.name"] = "Enter the buyer's name (at least 2 characters).";
    else if (name.length > 200) errors["walkIn.name"] = "Keep the name under 200 characters.";
    if ((w.companyName ?? "").length > 200) errors["walkIn.companyName"] = "Keep the company name under 200 characters.";
    if (w.email?.trim() && !isEmail(w.email)) errors["walkIn.email"] = "Enter a valid email address, or leave it empty.";
    if (w.phone?.trim() && !isPhone(w.phone)) errors["walkIn.phone"] = phoneError();
    if (input.customerId) errors.customerId = "Choose either a registered customer or a walk-in buyer.";
  } else if (!input.customerId) errors.customerId = "Choose a customer, or switch to a walk-in order.";
  const fulfilment = input.fulfilment ?? "delivery";
  if (fulfilment !== "delivery" && fulfilment !== "pickup") errors.fulfilment = "Choose delivery or store pickup.";
  else if (fulfilment === "pickup" && !w) errors.fulfilment = "Store pickup is only for walk-in orders.";
  if (fulfilment === "delivery") {
    if (!input.shippingAddress) errors["shippingAddress.addressLine1"] = "Enter the delivery address.";
    else checkAddress(errors, "shippingAddress", input.shippingAddress, !w);
    if (!input.billingAddress) errors["billingAddress.addressLine1"] = "Enter the billing address.";
    else checkAddress(errors, "billingAddress", input.billingAddress, !w);
  }
  if (input.items.length === 0) errors.items = "Add at least one product.";
  if (input.items.length > ORDER_LIMITS.lines) errors.items = `An order can have at most ${ORDER_LIMITS.lines} lines.`;
  input.items.forEach((item, i) => {
    const p = `items.${i}.`;
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > ORDER_LIMITS.maxQuantity)
      errors[`${p}quantity`] = `Enter a whole number from 1 to ${ORDER_LIMITS.maxQuantity}.`;
    if (!isValidAmount(item.unitPrice)) errors[`${p}unitPrice`] = `Enter a valid price (0 or more, ${amountRule()}).`;
    if (!isValidAmount(item.discount)) errors[`${p}discount`] = `Enter a valid discount (0 or more, ${amountRule()}).`;
    else if (!errors[`${p}quantity`] && !errors[`${p}unitPrice`] && item.discount > item.unitPrice * item.quantity)
      errors[`${p}discount`] = "The discount can't exceed the line amount.";
  });
  if (!input.shipping.label.trim()) errors["shipping.label"] = "Describe the delivery (e.g. route name).";
  if (!isValidAmount(input.shipping.amount)) errors["shipping.amount"] = `Enter a valid amount (0 or more, ${amountRule()}).`;
  if (input.shipping.mode !== "suggested" && input.shipping.mode !== "manual") errors["shipping.mode"] = "Choose the suggested or an agreed charge.";
  const reason = input.shipping.reason?.trim() ?? "";
  if (input.shipping.mode === "manual" && reason.length < 5) errors["shipping.reason"] = "Explain the agreed charge (at least 5 characters).";
  if (reason.length > ORDER_LIMITS.reason) errors["shipping.reason"] = `Keep it under ${ORDER_LIMITS.reason} characters.`;
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) errors.paymentMethod = "Choose a payment method.";
  if ((input.customerNote ?? "").length > ORDER_LIMITS.note) errors.customerNote = `Keep notes under ${ORDER_LIMITS.note} characters.`;
  if ((input.adminNote ?? "").length > ORDER_LIMITS.note) errors.adminNote = `Keep notes under ${ORDER_LIMITS.note} characters.`;
  if (input.requestedDeliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.requestedDeliveryDate)) errors.requestedDeliveryDate = "Choose a valid date.";
  return errors;
}

/** Reason kept in the order's audit history (required for every admin edit except the delivery date). */
export function checkReason(errors: FieldErrors, reason: string | undefined, key = "reason") {
  const r = (reason ?? "").trim();
  if (r.length < 5) errors[key] = "Explain the change (at least 5 characters) — it is kept in the audit history.";
  else if (r.length > ORDER_LIMITS.reason) errors[key] = `Keep the reason under ${ORDER_LIMITS.reason} characters.`;
}

const validQuantity = (q: number) => Number.isInteger(q) && q >= 1 && q <= ORDER_LIMITS.maxQuantity;

/** Validates an item adjustment (quantity, agreed price, packed weight) against the current item. */
export function validateAdjustment(input: AdjustItemInput, item: Pick<OrderItem, "unitPrice" | "fulfilledWeight" | "orderedWeight" | "quantity" | "discount" | "pricedByWeight">): FieldErrors {
  const errors: FieldErrors = {};
  checkReason(errors, input.reason);
  if (input.quantity !== undefined && !validQuantity(input.quantity)) errors.quantity = `Enter a whole number from 1 to ${ORDER_LIMITS.maxQuantity}.`;
  if (input.unitPrice !== undefined && !isValidAmount(input.unitPrice)) errors.unitPrice = `Enter a valid price (0 or more, ${amountRule()}).`;
  if (input.fulfilledWeight !== undefined && !(Number.isFinite(input.fulfilledWeight.value) && input.fulfilledWeight.value > 0))
    errors.fulfilledWeight = "Enter a weight greater than 0.";

  const quantityChanged = input.quantity !== undefined && !errors.quantity && input.quantity !== item.quantity;
  const priceChanged = input.unitPrice !== undefined && !errors.unitPrice && input.unitPrice !== item.unitPrice;
  const currentWeight = item.fulfilledWeight ?? item.orderedWeight;
  const weightChanged = input.fulfilledWeight !== undefined && !errors.fulfilledWeight && toGrams(input.fulfilledWeight) !== toGrams(currentWeight);
  if (!errors.quantity && !errors.unitPrice && !errors.fulfilledWeight && !quantityChanged && !priceChanged && !weightChanged)
    errors.unitPrice = "Change the quantity, unit price and/or packed weight.";
  if ((priceChanged || quantityChanged) && !errors.unitPrice && !errors.quantity) {
    const line = lineAmounts(applyLineChange(item, { quantity: input.quantity, unitPrice: input.unitPrice, fulfilledWeight: input.fulfilledWeight }));
    if (item.discount > line.subtotal) errors[priceChanged ? "unitPrice" : "quantity"] = "The line discount would exceed the new line amount.";
  }
  return errors;
}

/** Validates a new order line (product availability and quantity rules are checked by the repository). */
export function validateAddLine(input: Extract<OrderEdit, { kind: "add" }>): FieldErrors {
  const errors: FieldErrors = {};
  checkReason(errors, input.reason);
  if (!input.productId) errors.productId = "Choose a product.";
  if (!validQuantity(input.quantity)) errors.quantity = `Enter a whole number from 1 to ${ORDER_LIMITS.maxQuantity}.`;
  if (!isValidAmount(input.unitPrice)) errors.unitPrice = `Enter a valid price (0 or more, ${amountRule()}).`;
  if (!isValidAmount(input.discount)) errors.discount = `Enter a valid discount (0 or more, ${amountRule()}).`;
  else if (!errors.quantity && !errors.unitPrice && input.discount > input.unitPrice * input.quantity) errors.discount = "The discount can't exceed the line amount.";
  return errors;
}

/** Validates an order discount (null = remove). */
export function validateOrderDiscount(input: Extract<OrderEdit, { kind: "discount" }>): FieldErrors {
  const errors: FieldErrors = {};
  checkReason(errors, input.reason);
  const d = input.discount;
  if (!d) return errors;
  if (d.type !== "fixed" && d.type !== "percent") errors.type = "Choose a fixed amount or a percentage.";
  else if (d.type === "fixed" && !(isValidAmount(d.value) && d.value > 0)) errors.value = `Enter an amount greater than 0 (${amountRule()}).`;
  else if (d.type === "percent" && !(isValidPercent(d.value) && d.value > 0)) errors.value = "Enter a percentage above 0 and at most 100 (up to 2 decimals).";
  return errors;
}

/** YYYY-MM-DD that is a real calendar date. */
export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
