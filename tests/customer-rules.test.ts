/** Customer approval workflow and contact-format rules. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJpPhone, isEmail, isPostcode } from "../src/lib/customers/contact.ts";
import { checkStatusChange, statusActions } from "../src/lib/customers/status.ts";

describe("approval workflow", () => {
  it("allows only the defined transitions", () => {
    assert.deepEqual(statusActions("pending").map((a) => a.to), ["approved", "rejected"]);
    assert.deepEqual(statusActions("approved").map((a) => a.to), ["suspended"]);
    assert.deepEqual(statusActions("suspended").map((a) => a.to), ["approved"]);
    assert.deepEqual(statusActions("rejected").map((a) => a.to), ["approved", "pending"]);
    assert.ok(checkStatusChange("approved", "pending").status);
    assert.ok(checkStatusChange("pending", "suspended").status);
  });

  it("requires a reason to reject or suspend", () => {
    assert.ok(checkStatusChange("pending", "rejected").reason);
    assert.ok(checkStatusChange("approved", "suspended", "late").reason);
    assert.deepEqual(checkStatusChange("approved", "suspended", "Overdue invoices"), {});
  });

  it("makes the reason optional for approval and reactivation, but limits its length", () => {
    assert.deepEqual(checkStatusChange("pending", "approved"), {});
    assert.deepEqual(checkStatusChange("suspended", "approved", ""), {});
    assert.ok(checkStatusChange("pending", "approved", "x".repeat(301)).reason);
  });
});

describe("contact formats", () => {
  it("accepts Japanese phone numbers in common formats", () => {
    for (const p of ["03-1234-5678", "090-1234-5678", "09012345678", "+81 90-1234-5678", "050-1234-5678", "06 (1234) 5678", "011-123-4567"]) assert.ok(isJpPhone(p), p);
  });

  it("rejects malformed phone numbers", () => {
    for (const p of ["12345", "0312345678901", "+1 555 123 4567", "090-1234-567a", "+880 1712-345678", ""]) assert.ok(!isJpPhone(p), p);
  });

  it("checks postcode and email format only", () => {
    assert.ok(isPostcode("160-0023"));
    assert.ok(isPostcode(" 1600023 "));
    assert.ok(!isPostcode("1212"));
    assert.ok(!isPostcode("160-00a3"));
    assert.ok(!isPostcode("16-00023"));
    assert.ok(isEmail("buyer@customer.example.com"));
    assert.ok(!isEmail("buyer@"));
  });
});
