/** Contact form validation (src/lib/validation/contact.ts). Run with `npm test`. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContactMessageInput, ContactTopic } from "../src/lib/types/index.ts";
import { validateContactMessage } from "../src/lib/validation/contact.ts";

const valid: ContactMessageInput = { name: "Taro Yamada", email: "taro@example.com", topic: "general", message: "Do you deliver to Osaka?" };

test("accepts a complete message, with or without optional fields", () => {
  assert.deepEqual(validateContactMessage(valid), {});
  assert.deepEqual(validateContactMessage({ ...valid, company: "Sample Kitchen", phone: "090-1234-5678" }), {});
});

test("requires name, email, topic and a real message", () => {
  assert.ok(validateContactMessage({ ...valid, name: " " }).name);
  assert.ok(validateContactMessage({ ...valid, email: "" }).email);
  assert.ok(validateContactMessage({ ...valid, email: "not-an-email" }).email);
  assert.ok(validateContactMessage({ ...valid, topic: "nope" as ContactTopic }).topic);
  assert.ok(validateContactMessage({ ...valid, topic: "constructor" as ContactTopic }).topic);
  assert.ok(validateContactMessage({ ...valid, message: "short" }).message);
  assert.ok(validateContactMessage({ ...valid, message: "x".repeat(2001) }).message);
});

test("checks the optional phone only when given", () => {
  assert.ok(validateContactMessage({ ...valid, phone: "12" }).phone);
  assert.equal(validateContactMessage({ ...valid, phone: "  " }).phone, undefined);
});
