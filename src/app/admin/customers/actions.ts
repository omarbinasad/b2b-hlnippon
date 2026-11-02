"use server";

/*
 * Admin customer mutations and lookups. DEMO: the mock repository keeps changes
 * in server memory only; no email/SMS is sent. TODO(auth): permissions come from
 * the mock session — the backend must authenticate and authorize every call.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { accountStatuses } from "@/lib/enums";
import type { AccountStatus, AddressInput, CustomerDetailsInput, FieldErrors, PostcodeLookup } from "@/lib/types";

export type CustomerActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const opt = (v: unknown, max = 300) => str(v, max).trim() || undefined;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

async function actorWith(permission: string) {
  const actor = await getAdminActor();
  return actor.permissions.includes(permission) ? { id: actor.id, name: actor.name, role: actor.role } : null;
}

const denied: CustomerActionResult = { ok: false, errors: {}, message: "You don't have permission to do this (mock permissions)." };
const failed = (r: { errors: FieldErrors; message?: string }, fallback: string): CustomerActionResult => ({
  ok: false,
  errors: r.errors,
  message: r.message ?? Object.values(r.errors)[0] ?? fallback,
});

function refresh(id?: string) {
  revalidatePath("/admin/customers");
  if (id) revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customer-groups", "layout");
  revalidatePath("/admin/orders", "layout");
  revalidatePath("/account", "layout");
}

// --- Create / edit -------------------------------------------------------------------

export async function createCustomerAction(raw: unknown): Promise<CustomerActionResult> {
  const actor = await actorWith("customers.manage");
  if (!actor) return denied;
  const v = obj(raw);
  const status = v.status === "approved" ? "approved" : "pending";
  if (status === "approved" && !(await actorWith("customers.approve"))) return denied;
  const result = await repositories.customers.create(
    {
      companyName: str(v.companyName, 200),
      contactName: opt(v.contactName),
      phone: opt(v.phone, 40),
      email: opt(v.email),
      status,
      groupId: opt(v.groupId, 100),
    },
    actor,
  );
  if (!result.ok) return failed(result, "The customer could not be added.");
  refresh(result.value.id);
  redirect(`/admin/customers/${result.value.id}?notice=customer-created` as Route);
}

export async function updateCustomerAction(id: string, raw: unknown): Promise<CustomerActionResult> {
  const actor = await actorWith("customers.manage");
  if (!actor) return denied;
  const v = obj(raw);
  const input: CustomerDetailsInput = {
    companyName: str(v.companyName, 200),
    contactName: opt(v.contactName),
    phone: opt(v.phone, 40),
    email: opt(v.email),
    businessType: opt(v.businessType),
    tradeLicenseNumber: opt(v.tradeLicenseNumber),
    vatRegistrationNumber: opt(v.vatRegistrationNumber, 40),
    groupId: opt(v.groupId, 100),
    deliveryRouteId: opt(v.deliveryRouteId, 100),
    internalNote: opt(v.internalNote, 1000),
  };
  const customerId = str(id, 100);
  const result = await repositories.customers.update(customerId, input, actor);
  if (!result.ok) return failed(result, "The customer could not be saved.");
  refresh(customerId);
  redirect(`/admin/customers/${customerId}?notice=saved` as Route);
}

// --- Approval workflow -----------------------------------------------------------------

export async function setCustomerStatusAction(id: string, status: string, reason?: string): Promise<CustomerActionResult> {
  const actor = await actorWith("customers.approve");
  if (!actor) return denied;
  if (!accountStatuses.includes(status as AccountStatus)) return { ok: false, errors: {}, message: "Unknown status." };
  const customerId = str(id, 100);
  const result = await repositories.customers.setStatus(customerId, status as AccountStatus, opt(reason), actor);
  if (!result.ok) return failed(result, "The status could not be changed.");
  refresh(customerId);
  return { ok: true };
}

// --- Addresses ---------------------------------------------------------------------------

export async function saveAddressAction(id: string, raw: unknown): Promise<CustomerActionResult> {
  const actor = await actorWith("customers.manage");
  if (!actor) return denied;
  const v = obj(raw);
  const input: AddressInput = {
    id: opt(v.id, 100),
    type: v.type === "billing" ? "billing" : "shipping",
    label: str(v.label, 200),
    recipientName: str(v.recipientName, 200),
    companyName: opt(v.companyName),
    country: "JP",
    prefecture: str(v.prefecture, 50),
    city: str(v.city, 100),
    area: opt(v.area),
    postalCode: str(v.postalCode, 10),
    addressLine1: str(v.addressLine1),
    addressLine2: opt(v.addressLine2),
    phone: str(v.phone, 40),
    isDefault: v.isDefault === true,
  };
  const customerId = str(id, 100);
  const result = await repositories.customers.saveAddress(customerId, input, actor);
  if (!result.ok) return failed(result, "The address could not be saved.");
  refresh(customerId);
  return { ok: true };
}

export async function deleteAddressAction(id: string, addressId: string): Promise<CustomerActionResult> {
  const actor = await actorWith("customers.manage");
  if (!actor) return denied;
  const customerId = str(id, 100);
  const result = await repositories.customers.deleteAddress(customerId, str(addressId, 100), actor);
  if (!result.ok) return failed(result, "The address could not be deleted.");
  refresh(customerId);
  return { ok: true };
}

/** MOCK lookup against a small sample dataset. */
export async function lookupPostcodeAction(postalCode: string): Promise<PostcodeLookup> {
  return repositories.locations.lookupPostcode(str(postalCode, 10));
}
