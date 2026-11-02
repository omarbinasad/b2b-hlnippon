/**
 * Customer, address and group validation shared by the admin forms and the mock
 * repository. The backend must enforce the same rules (plus uniqueness and permissions).
 */
import { isJpPhone, isEmail, isPostcode } from "@/lib/customers/contact";
import { checkStatusChange } from "@/lib/customers/status";
import { JP_PREFECTURES } from "@/lib/locations";
import type { AddressInput, CustomerDetailsInput, CustomerGroupInput, CustomerQuickInput, FieldErrors } from "@/lib/types";

export const CUSTOMER_LIMITS = { name: 120, text: 200, note: 1000 } as const;

function contact(errors: FieldErrors, input: { companyName: string; contactName?: string; phone?: string; email?: string }) {
  const name = input.companyName.trim();
  if (name.length < 2) errors.companyName = "Enter the business name (at least 2 characters).";
  else if (name.length > CUSTOMER_LIMITS.name) errors.companyName = `Keep it under ${CUSTOMER_LIMITS.name} characters.`;
  if ((input.contactName ?? "").length > CUSTOMER_LIMITS.text) errors.contactName = "Too long.";
  const phone = input.phone?.trim();
  const email = input.email?.trim();
  if (!phone && !email) errors.phone = "Enter a phone number or an email address.";
  if (phone && !isJpPhone(phone)) errors.phone = "Use a Japanese phone number, e.g. 03-1234-5678 or 090-1234-5678.";
  if (email && (!isEmail(email) || email.length > CUSTOMER_LIMITS.text)) errors.email = "Enter a valid email address.";
}

export function validateQuickCustomer(input: CustomerQuickInput): FieldErrors {
  const errors: FieldErrors = {};
  contact(errors, input);
  if (input.status !== "pending" && input.status !== "approved") errors.status = "Choose Pending or Approved.";
  return errors;
}

export function validateCustomerDetails(input: CustomerDetailsInput): FieldErrors {
  const errors: FieldErrors = {};
  contact(errors, input);
  for (const key of ["businessType", "tradeLicenseNumber", "vatRegistrationNumber"] as const) {
    if ((input[key] ?? "").length > CUSTOMER_LIMITS.text) errors[key] = "Too long.";
  }
  if (input.vatRegistrationNumber && !/^[\d-]{9,15}$/.test(input.vatRegistrationNumber.trim()))
    errors.vatRegistrationNumber = "Use digits only (BIN is usually 9 or 13 digits).";
  if ((input.internalNote ?? "").length > CUSTOMER_LIMITS.note) errors.internalNote = `Keep notes under ${CUSTOMER_LIMITS.note} characters.`;
  return errors;
}

export function validateAddress(input: AddressInput): FieldErrors {
  const errors: FieldErrors = {};
  const required: [keyof AddressInput, string][] = [
    ["label", "Label"],
    ["recipientName", "Recipient name"],
    ["phone", "Phone"],
    ["prefecture", "Prefecture"],
    ["city", "City"],
    ["postalCode", "Postcode"],
    ["addressLine1", "Street address"],
  ];
  for (const [key, label] of required) if (!String(input[key] ?? "").trim()) errors[key] = `${label} is required.`;
  if (input.type !== "shipping" && input.type !== "billing") errors.type = "Choose delivery or billing.";
  if (input.prefecture && !JP_PREFECTURES.includes(input.prefecture as (typeof JP_PREFECTURES)[number])) errors.prefecture = "Choose a prefecture.";
  if (input.postalCode && !isPostcode(input.postalCode)) errors.postalCode = "Use a 7-digit postcode, e.g. 160-0023.";
  if (input.phone && !errors.phone && !isJpPhone(input.phone)) errors.phone = "Use a Japanese phone number.";
  for (const key of ["label", "recipientName", "companyName", "city", "area", "addressLine1", "addressLine2"] as const) {
    if (!errors[key] && (input[key] ?? "").length > CUSTOMER_LIMITS.text) errors[key] = "Too long.";
  }
  return errors;
}

export const validateStatusChange = checkStatusChange;

export function validateGroup(input: CustomerGroupInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "Enter a group name (at least 2 characters).";
  else if (name.length > 60) errors.name = "Keep it under 60 characters.";
  if ((input.description ?? "").length > 300) errors.description = "Keep it under 300 characters.";
  return errors;
}
