/**
 * Payment method availability, validation and ordering — pure functions with only type
 * imports, so they run in the browser, the mock repository and `npm test`. The backend must
 * apply the same availability rules when it returns methods to checkout.
 *
 * AVAILABILITY:
 *   - Pay on delivery: available when enabled.
 *   - Bank transfer: available when enabled AND account name, bank name and account number are set.
 *   - Online payment: available only when enabled AND a provider is connected by the backend.
 *     The demo has no integration, so it is always "Not connected" and never available.
 * Selecting a method never marks an order paid.
 */
import type { BankAccountDetails, CheckoutPaymentMethod, FieldErrors, PaymentAvailability, PaymentMethodId, PaymentMethodInput, PaymentMethodSettings } from "@/lib/types";

export const PAYMENT_LIMITS = { title: 60, description: 160, instructions: 1000, bankText: 100 } as const;

export const paymentMethodKindLabel: Record<PaymentMethodId, string> = {
  pay_on_delivery: "Pay on delivery",
  bank_transfer: "Bank transfer",
  online: "Online payment",
};

const hasBankDetails = (b?: BankAccountDetails) => Boolean(b?.accountName.trim() && b.bankName.trim() && b.accountNumber.trim());

export function paymentAvailability(m: Pick<PaymentMethodSettings, "id" | "enabled" | "bank" | "online">): PaymentAvailability {
  const reasons: string[] = [];
  let configured = true;
  if (m.id === "bank_transfer" && !hasBankDetails(m.bank)) {
    configured = false;
    reasons.push("Bank account details are incomplete.");
  }
  if (m.id === "online" && m.online?.status !== "connected") {
    configured = false;
    reasons.push("Not connected — needs a payment provider integration on the backend.");
  }
  if (!m.enabled) reasons.unshift("Disabled.");
  return { configured, availableAtCheckout: m.enabled && configured, reasons };
}

/** Enabled, available methods in display order, with customer-facing fields only. */
export function checkoutMethods(methods: PaymentMethodSettings[]): CheckoutPaymentMethod[] {
  return [...methods]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .filter((m) => paymentAvailability(m).availableAtCheckout)
    .map((m) => ({ id: m.id, title: m.title, description: m.description, instructions: m.instructions, bank: m.id === "bank_transfer" ? m.bank : undefined }));
}

/** New sort orders for `ids` (must be a permutation of the current ids), or an error. */
export function reorderMethods(current: PaymentMethodId[], ids: PaymentMethodId[]): { ok: true; order: Record<PaymentMethodId, number> } | { ok: false; message: string } {
  const same = ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
  if (!same) return { ok: false, message: "The new order must list every payment method exactly once." };
  return { ok: true, order: Object.fromEntries(ids.map((id, i) => [id, (i + 1) * 10])) as Record<PaymentMethodId, number> };
}

/** Moves one method up or down in display order. */
export function moveMethod(ordered: PaymentMethodId[], id: PaymentMethodId, direction: "up" | "down"): PaymentMethodId[] {
  const i = ordered.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordered.length) return ordered;
  const next = [...ordered];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function validatePaymentMethod(id: PaymentMethodId, input: PaymentMethodInput): FieldErrors {
  const errors: FieldErrors = {};
  const title = input.title.trim();
  if (title.length < 2) errors.title = "Enter a title customers will see (at least 2 characters).";
  else if (title.length > PAYMENT_LIMITS.title) errors.title = `Keep it under ${PAYMENT_LIMITS.title} characters.`;
  if (input.description.length > PAYMENT_LIMITS.description) errors.description = `Keep it under ${PAYMENT_LIMITS.description} characters.`;
  if (input.instructions.length > PAYMENT_LIMITS.instructions) errors.instructions = `Keep it under ${PAYMENT_LIMITS.instructions} characters.`;
  if (id === "bank_transfer") {
    const b = input.bank ?? { accountName: "", bankName: "", accountNumber: "" };
    // Details are required to enable the method; an incomplete disabled method can still be saved.
    if (input.enabled) {
      if (!b.accountName.trim()) errors["bank.accountName"] = "Required to enable bank transfer.";
      if (!b.bankName.trim()) errors["bank.bankName"] = "Required to enable bank transfer.";
      if (!b.accountNumber.trim()) errors["bank.accountNumber"] = "Required to enable bank transfer.";
    }
    if (b.accountNumber.trim() && !/^[0-9][0-9 -]{4,28}[0-9]$/.test(b.accountNumber.trim())) errors["bank.accountNumber"] = "Use 6–30 digits (spaces and dashes allowed).";
    if (b.routingNumber?.trim() && !/^\d{9}$/.test(b.routingNumber.trim())) errors["bank.routingNumber"] = "Routing numbers have 9 digits.";
    for (const key of ["accountName", "bankName", "branchName"] as const) {
      if ((b[key] ?? "").length > PAYMENT_LIMITS.bankText) errors[`bank.${key}`] = "Too long.";
    }
  } else if (input.bank) {
    errors.bank = "Only bank transfer has account details.";
  }
  return errors;
}
