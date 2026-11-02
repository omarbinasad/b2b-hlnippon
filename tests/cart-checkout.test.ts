/** Cart line rules, checkout input checks and the online application. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartLineId, checkCartLine, checkDeliveryDate, mergeCartLines, orderPaymentMethod, type CartLineCheck } from "../src/lib/orders/cart.ts";
import { validateRegistration } from "../src/lib/validation/registration.ts";
import type { RegistrationInput } from "../src/lib/types/index.ts";

describe("cart lines", () => {
  it("merges the same product option and keeps different options apart", () => {
    const merged = mergeCartLines(
      [{ productId: "p-1", quantity: 2 }, { productId: "p-2", variationId: "v-1", quantity: 1 }],
      [{ productId: "p-1", quantity: 3 }, { productId: "p-2", variationId: "v-2", quantity: 4 }],
    );
    assert.deepEqual(merged, [
      { productId: "p-1", quantity: 5 },
      { productId: "p-2", variationId: "v-1", quantity: 1 },
      { productId: "p-2", variationId: "v-2", quantity: 4 },
    ]);
    assert.equal(cartLineId("p-1"), "p-1:");
    assert.equal(cartLineId("p-2", "v-1"), "p-2:v-1");
  });

  it("does not change the lines it was given", () => {
    const current = [{ productId: "p-1", quantity: 2 }];
    mergeCartLines(current, [{ productId: "p-1", quantity: 1 }]);
    assert.equal(current[0].quantity, 2);
  });

  const ok: CartLineCheck = { quantity: 6, min: 2, max: 20, step: 2, stock: { status: "in_stock", quantity: 50 }, stockMode: "quantity", backorders: "no", priced: true };

  it("accepts a line within quantity rules and stock", () => {
    assert.equal(checkCartLine(ok), undefined);
  });
  it("enforces minimum, maximum and pack multiples", () => {
    assert.equal(checkCartLine({ ...ok, quantity: 1 }), "Minimum 2 per order.");
    assert.equal(checkCartLine({ ...ok, quantity: 22 }), "Maximum 20 per order.");
    assert.equal(checkCartLine({ ...ok, quantity: 7 }), "Order in multiples of 2.");
    assert.equal(checkCartLine({ ...ok, quantity: 2.5 }), "Enter a whole number of at least 1.");
  });
  it("blocks out-of-stock and over-stock lines unless backorders are allowed", () => {
    assert.equal(checkCartLine({ ...ok, stock: { status: "out_of_stock", quantity: 0 } }), "Out of stock.");
    assert.equal(checkCartLine({ ...ok, stock: { status: "low_stock", quantity: 4 } }), "Only 4 in stock.");
    assert.equal(checkCartLine({ ...ok, stock: { status: "out_of_stock", quantity: 0 }, backorders: "allow" }), undefined);
    // Status-managed stock has no count to compare with.
    assert.equal(checkCartLine({ ...ok, stockMode: "status", stock: { status: "in_stock" } }), undefined);
  });
  it("blocks unpriced and unavailable products first", () => {
    assert.match(checkCartLine({ ...ok, priced: false })!, /no price/);
    assert.equal(checkCartLine({ ...ok, unavailable: "This option is disabled." }), "This option is disabled.");
  });
});

describe("checkout inputs", () => {
  it("accepts an empty or near delivery date, rejects past, malformed and far dates", () => {
    assert.equal(checkDeliveryDate(undefined, "2026-10-28"), undefined);
    assert.equal(checkDeliveryDate("2026-10-28", "2026-10-28"), undefined);
    assert.equal(checkDeliveryDate("2026-10-27", "2026-10-28"), "Choose today or a later date.");
    assert.equal(checkDeliveryDate("28/10/2026", "2026-10-28"), "Choose a valid date.");
    assert.equal(checkDeliveryDate("2027-03-01", "2026-10-28"), "Choose a date within the next three months.");
  });
  it("maps only offline checkout methods to order payment methods", () => {
    assert.equal(orderPaymentMethod.pay_on_delivery, "cash_on_delivery");
    assert.equal(orderPaymentMethod.bank_transfer, "bank_transfer");
    assert.equal(orderPaymentMethod.online, undefined);
  });
});

describe("online application", () => {
  const valid: RegistrationInput = {
    companyName: "Sample Kitchen",
    businessType: "Restaurant",
    contactName: "Taro Yamada",
    email: "taro@example.com",
    phone: "090-1234-5678",
    address: { prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "160-0023", addressLine1: "1-2-3 Nishi-Shinjuku" },
    acceptTerms: true,
  };
  it("accepts a complete application", () => {
    assert.deepEqual(validateRegistration(valid), {});
  });
  it("requires business, contact, email, phone, address and confirmation", () => {
    const e = validateRegistration({ ...valid, companyName: "", businessType: "Bank", contactName: "", email: "x", phone: "123", address: { prefecture: "Dhaka", city: "", postalCode: "1212", addressLine1: "" }, acceptTerms: false });
    for (const key of ["companyName", "businessType", "contactName", "email", "phone", "address.prefecture", "address.city", "address.postalCode", "address.addressLine1", "acceptTerms"]) {
      assert.ok(e[key], `expected an error for ${key}`);
    }
  });
});
