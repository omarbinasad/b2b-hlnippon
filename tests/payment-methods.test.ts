/** Payment method availability, checkout list, ordering and validation. Demo values are fictional. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkoutMethods, moveMethod, paymentAvailability, reorderMethods, validatePaymentMethod } from "../src/lib/payments/methods.ts";
import type { PaymentMethodSettings } from "../src/lib/types/index.ts";

const T0 = "2026-10-04T00:00:00+09:00";
const bank = { accountName: "Demo Store (fictional)", bankName: "Example Bank (fictional)", accountNumber: "0001 2345 6789" };
const methods = (): PaymentMethodSettings[] => [
  { id: "pay_on_delivery", enabled: true, sortOrder: 20, title: "Pay on delivery", description: "", instructions: "", updatedAt: T0 },
  { id: "bank_transfer", enabled: true, sortOrder: 10, title: "Bank transfer", description: "", instructions: "Use your order number.", bank, updatedAt: T0 },
  { id: "online", enabled: true, sortOrder: 30, title: "Pay online", description: "", instructions: "", online: { status: "not_connected" }, updatedAt: T0 },
];

describe("availability", () => {
  it("never offers online payment while it is not connected, even when enabled", () => {
    const a = paymentAvailability(methods()[2]);
    assert.equal(a.availableAtCheckout, false);
    assert.equal(a.configured, false);
    assert.match(a.reasons.join(" "), /Not connected/);
  });

  it("requires complete bank details for bank transfer", () => {
    const m = { ...methods()[1], bank: { ...bank, accountNumber: " " } };
    assert.equal(paymentAvailability(m).availableAtCheckout, false);
    assert.equal(paymentAvailability(methods()[1]).availableAtCheckout, true);
  });

  it("hides disabled methods", () => {
    const a = paymentAvailability({ ...methods()[0], enabled: false });
    assert.equal(a.availableAtCheckout, false);
    assert.equal(a.configured, true);
    assert.equal(a.reasons[0], "Disabled.");
  });
});

describe("checkout list", () => {
  it("returns only enabled, available methods in display order with customer-facing fields", () => {
    const list = checkoutMethods(methods());
    assert.deepEqual(list.map((m) => m.id), ["bank_transfer", "pay_on_delivery"]);
    assert.deepEqual(list[0].bank, bank);
    assert.equal(list[1].bank, undefined);
    assert.equal("enabled" in list[0], false);
  });

  it("is empty when nothing is available", () => {
    assert.deepEqual(checkoutMethods(methods().map((m) => ({ ...m, enabled: false }))), []);
  });
});

describe("ordering", () => {
  it("moves a method up or down and ignores moves past the ends", () => {
    const ids = ["bank_transfer", "pay_on_delivery", "online"] as const;
    assert.deepEqual(moveMethod([...ids], "online", "up"), ["bank_transfer", "online", "pay_on_delivery"]);
    assert.deepEqual(moveMethod([...ids], "bank_transfer", "up"), [...ids]);
    assert.deepEqual(moveMethod([...ids], "online", "down"), [...ids]);
  });

  it("accepts only a full permutation", () => {
    const current = ["pay_on_delivery", "bank_transfer", "online"] as const;
    const ok = reorderMethods([...current], ["online", "pay_on_delivery", "bank_transfer"]);
    assert.ok(ok.ok && ok.order.online === 10 && ok.order.bank_transfer === 30);
    assert.equal(reorderMethods([...current], ["online", "online", "bank_transfer"]).ok, false);
    assert.equal(reorderMethods([...current], ["online", "bank_transfer"]).ok, false);
  });
});

describe("validation", () => {
  const input = { enabled: true, title: "Bank transfer", description: "", instructions: "", bank };
  it("requires bank details only when bank transfer is enabled", () => {
    const missing = validatePaymentMethod("bank_transfer", { ...input, bank: { accountName: "", bankName: "", accountNumber: "" } });
    assert.ok(missing["bank.accountName"] && missing["bank.bankName"] && missing["bank.accountNumber"]);
    assert.deepEqual(validatePaymentMethod("bank_transfer", { ...input, enabled: false, bank: { accountName: "", bankName: "", accountNumber: "" } }), {});
  });

  it("checks account and routing number formats and titles", () => {
    assert.ok(validatePaymentMethod("bank_transfer", { ...input, bank: { ...bank, accountNumber: "12ab" } })["bank.accountNumber"]);
    assert.ok(validatePaymentMethod("bank_transfer", { ...input, bank: { ...bank, routingNumber: "1234" } })["bank.routingNumber"]);
    assert.ok(validatePaymentMethod("pay_on_delivery", { ...input, bank: undefined, title: "x" }).title);
    assert.ok(validatePaymentMethod("pay_on_delivery", { ...input }).bank);
    assert.deepEqual(validatePaymentMethod("bank_transfer", input), {});
  });
});
