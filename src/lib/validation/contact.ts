/**
 * Contact form validation shared by the form action and the mock repository (pure; tested in
 * tests/contact-form.test.ts). The backend must enforce the same rules and add rate limiting / bot protection.
 */
// Relative import (not the @/ alias) so the Node test runner can load this module.
import { isEmail, isPhone, phoneError } from "../customers/contact.ts";
import type { ContactMessageInput, ContactTopic, FieldErrors } from "@/lib/types";

export const CONTACT_TOPICS: Record<ContactTopic, string> = {
  general: "General question",
  products: "Products and prices",
  account: "Wholesale account",
  orders: "Orders and delivery",
  other: "Something else",
};

export const CONTACT_LIMITS = { name: 120, company: 200, email: 200, phone: 40, messageMin: 10, message: 2000 } as const;

export function validateContactMessage(input: ContactMessageInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  const message = input.message.trim();
  if (name.length < 2) errors.name = "Enter your name (at least 2 characters).";
  else if (name.length > CONTACT_LIMITS.name) errors.name = `Keep your name under ${CONTACT_LIMITS.name} characters.`;
  if ((input.company ?? "").length > CONTACT_LIMITS.company) errors.company = `Keep the company name under ${CONTACT_LIMITS.company} characters.`;
  if (!input.email.trim()) errors.email = "Enter your email address.";
  else if (!isEmail(input.email) || input.email.length > CONTACT_LIMITS.email) errors.email = "Enter a valid email address.";
  if (input.phone?.trim() && !isPhone(input.phone)) errors.phone = phoneError();
  if (!Object.hasOwn(CONTACT_TOPICS, input.topic)) errors.topic = "Choose a topic.";
  if (message.length < CONTACT_LIMITS.messageMin) errors.message = `Write your message (at least ${CONTACT_LIMITS.messageMin} characters).`;
  else if (message.length > CONTACT_LIMITS.message) errors.message = `Keep your message under ${CONTACT_LIMITS.message} characters.`;
  return errors;
}
