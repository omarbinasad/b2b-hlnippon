import "server-only";

import { checkoutMethods, paymentAvailability, reorderMethods, validatePaymentMethod } from "@/lib/payments/methods";
import type { PaymentMethodSettings } from "@/lib/types";
import { mockPayments } from "./mock/payments";
import type { PaymentMethodListItem, PaymentSettingsRepository } from "./repositories";

/*
 * DEMO STORE for payment method settings (globalThis, server memory). No payment is ever
 * processed and no order is marked paid. A real backend persists these settings, keeps any
 * provider credentials server-side, and reports the online connection state.
 */

const clone = <T>(v: T): T => structuredClone(v);
const sorted = () => [...mockPayments.methods].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
const withAvailability = (m: PaymentMethodSettings): PaymentMethodListItem => ({ ...clone(m), availability: paymentAvailability(m) });

export const mockPaymentSettingsRepository: PaymentSettingsRepository = {
  async listMethods() {
    return sorted().map(withAvailability);
  },

  async getMethod(id) {
    const m = mockPayments.methods.find((x) => x.id === id);
    return m ? withAvailability(m) : null;
  },

  async updateMethod(id, input) {
    const i = mockPayments.methods.findIndex((m) => m.id === id);
    if (i < 0) return { ok: false, errors: {}, message: "Payment method not found." };
    const errors = validatePaymentMethod(id, input);
    if (Object.keys(errors).length) return { ok: false, errors, message: "Some fields need attention." };
    const current = mockPayments.methods[i];
    const opt = (v?: string) => v?.trim() || undefined;
    mockPayments.methods[i] = {
      ...current,
      enabled: input.enabled,
      title: input.title.trim(),
      description: input.description.trim(),
      instructions: input.instructions.trim(),
      // The online connection state is never editable here — only a backend integration can change it.
      bank:
        id === "bank_transfer" && input.bank
          ? {
              accountName: input.bank.accountName.trim(),
              bankName: input.bank.bankName.trim(),
              accountNumber: input.bank.accountNumber.trim(),
              branchName: opt(input.bank.branchName),
              routingNumber: opt(input.bank.routingNumber),
            }
          : current.bank,
      updatedAt: new Date().toISOString(),
    };
    return { ok: true, value: clone(mockPayments.methods[i]) };
  },

  async reorderMethods(ids) {
    const result = reorderMethods(mockPayments.methods.map((m) => m.id), ids);
    if (!result.ok) return { ok: false, errors: {}, message: result.message };
    for (const m of mockPayments.methods) m.sortOrder = result.order[m.id];
    return { ok: true, value: sorted().map(withAvailability) };
  },

  async checkoutMethods() {
    return clone(checkoutMethods(mockPayments.methods));
  },
};
