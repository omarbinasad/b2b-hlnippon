"use server";

/*
 * Customer portal mutations. DEMO: the customer comes from the mock session, not a login. TODO(auth): the backend must
 * take the customer from the authenticated session and never from the request.
 */
import { revalidatePath } from "next/cache";
import { getPortalCustomerId } from "@/lib/auth/session";
import { isEmail, isPhone, phoneError } from "@/lib/customers/contact";
import { repositories } from "@/lib/data";
import type { Actor, AddressInput, FieldErrors, OrderableProduct, ProductPick } from "@/lib/types";
import { validateNewPassword } from "@/lib/validation/password";
import { storeCountry } from "@/lib/locations";

export type PortalResult<T = unknown> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const refresh = () => revalidatePath("/account", "layout");

function fromSave<T>(r: { ok: true; value: T } | { ok: false; errors: FieldErrors; message?: string }): PortalResult<T> {
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  refresh();
  return r;
}

async function me(): Promise<{ id: string; actor: Actor }> {
  const id = await getPortalCustomerId();
  const c = await repositories.customers.getById(id);
  return { id, actor: { id, name: c?.contactName ?? c?.companyName ?? "Customer", role: "customer" } };
}

function line(raw: unknown) {
  const v = obj(raw);
  return { productId: str(v.productId, 100), variationId: str(v.variationId, 100) || undefined, quantity: Number(v.quantity) };
}

// --- Profile ----------------------------------------------------------------------------

export async function updateProfileAction(raw: unknown): Promise<PortalResult> {
  const { id, actor } = await me();
  const v = obj(raw);
  const input = { companyName: str(v.companyName, 120).trim(), contactName: str(v.contactName, 120).trim(), email: str(v.email).trim(), phone: str(v.phone, 40).trim(), remindersOptOut: v.remindersOptOut === true };
  const errors: FieldErrors = {};
  if (input.companyName.length < 2) errors.companyName = "Enter your business name.";
  if (input.contactName.length < 2) errors.contactName = "Enter a contact name.";
  if (!isEmail(input.email)) errors.email = "Enter a valid email address.";
  if (!isPhone(input.phone)) errors.phone = phoneError();
  if (Object.keys(errors).length) return { ok: false, errors, message: "Some fields need attention." };
  return fromSave(await repositories.customers.updateProfile(id, input, actor));
}

/** DEMO: checks the form only. No password exists or is stored. */
export async function changePasswordAction(raw: unknown): Promise<PortalResult> {
  const v = obj(raw);
  const errors: FieldErrors = validateNewPassword(str(v.password), str(v.confirm));
  if (!str(v.current)) errors.current = "Enter your current password.";
  if (Object.keys(errors).length) return { ok: false, errors, message: "Some fields need attention." };
  return { ok: true, value: null };
}

// --- Addresses --------------------------------------------------------------------------

export async function saveOwnAddressAction(input: AddressInput): Promise<PortalResult> {
  const { id, actor } = await me();
  const v = obj(input);
  const clean: AddressInput = {
    id: str(v.id, 100) || undefined,
    type: v.type === "billing" ? "billing" : "shipping",
    label: str(v.label, 100),
    recipientName: str(v.recipientName, 120),
    companyName: str(v.companyName, 120),
    country: str(v.country, 2) || storeCountry(),
    prefecture: str(v.prefecture, 60),
    city: str(v.city, 100),
    area: str(v.area, 100),
    postalCode: str(v.postalCode, 12),
    addressLine1: str(v.addressLine1),
    addressLine2: str(v.addressLine2),
    phone: str(v.phone, 40),
    isDefault: v.isDefault === true,
  };
  return fromSave(await repositories.customers.saveAddress(id, clean, actor));
}

export async function deleteOwnAddressAction(addressId: string): Promise<PortalResult> {
  const { id, actor } = await me();
  return fromSave(await repositories.customers.deleteAddress(id, str(addressId, 100), actor));
}

export async function lookupOwnPostcodeAction(postcode: string) {
  return repositories.locations.lookupPostcode(str(postcode, 12));
}

// --- Product picking for lists and quotations ---------------------------------------------

export async function searchProductsAction(term: string): Promise<ProductPick[]> {
  return repositories.products.search(str(term, 100), { limit: 10 });
}

export async function productOptionsAction(productId: string): Promise<OrderableProduct | null> {
  return repositories.orders.orderableProduct(str(productId, 100), await getPortalCustomerId());
}

// --- Saved lists -----------------------------------------------------------------------

export async function createListAction(name: string): Promise<PortalResult<{ id: string }>> {
  const { id } = await me();
  return fromSave(await repositories.savedLists.create(id, str(name, 100)));
}

export async function createListFromOrderAction(orderId: string): Promise<PortalResult<{ id: string }>> {
  const { id } = await me();
  return fromSave(await repositories.savedLists.createFromOrder(id, str(orderId, 100)));
}

export async function renameListAction(listId: string, name: string): Promise<PortalResult> {
  const { id } = await me();
  return fromSave(await repositories.savedLists.rename(id, str(listId, 100), str(name, 100)));
}

export async function deleteListAction(listId: string): Promise<PortalResult> {
  const { id } = await me();
  await repositories.savedLists.remove(id, str(listId, 100));
  refresh();
  return { ok: true, value: null };
}

export async function addListItemAction(listId: string, raw: unknown): Promise<PortalResult> {
  const { id } = await me();
  return fromSave(await repositories.savedLists.addItem(id, str(listId, 100), line(raw)));
}

export async function setListQuantityAction(listId: string, itemId: string, quantity: number): Promise<PortalResult> {
  const { id } = await me();
  return fromSave(await repositories.savedLists.setQuantity(id, str(listId, 100), str(itemId, 100), Number(quantity)));
}

export async function removeListItemAction(listId: string, itemId: string): Promise<PortalResult> {
  const { id } = await me();
  return fromSave(await repositories.savedLists.removeItem(id, str(listId, 100), str(itemId, 100)));
}

export async function addListToCartAction(listId: string): Promise<PortalResult<{ added: number; skipped: string[] }>> {
  const { id } = await me();
  const r = await repositories.savedLists.addToCart(id, str(listId, 100));
  if (r.ok) revalidatePath("/", "layout");
  return r.ok ? r : { ok: false, errors: r.errors, message: r.message ?? "The list couldn't be added." };
}

// --- Quotations ------------------------------------------------------------------------

export async function requestQuotationAction(raw: unknown): Promise<PortalResult<{ id: string }>> {
  const { id } = await me();
  const v = obj(raw);
  return fromSave(await repositories.quotations.request(id, { items: (Array.isArray(v.items) ? v.items : []).slice(0, 100).map(line), customerNote: str(v.customerNote, 1100) }));
}

export async function respondQuotationAction(quotationId: string, answer: "accept" | "reject", paymentMethod?: string): Promise<PortalResult> {
  const { id, actor } = await me();
  const method = (["pay_on_delivery", "bank_transfer", "online"] as const).find((m) => m === paymentMethod);
  const r = await repositories.quotations.respond(id, str(quotationId, 100), answer === "accept" ? "accept" : "reject", actor, method);
  if (r.ok) revalidatePath("/", "layout");
  return r.ok ? r : { ok: false, errors: r.errors, message: r.message ?? "That couldn't be saved." };
}
