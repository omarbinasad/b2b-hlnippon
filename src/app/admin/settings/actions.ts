"use server";

/*
 * Store settings mutation. DEMO: kept in server memory only. TODO(auth): the permission
 * ("settings.manage") is mocked — the backend must authorize the call.
 */
import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { FieldErrors, StoreSettingsInput } from "@/lib/types";

export type SettingsActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const opt = (v: unknown, max = 200) => str(v, max).trim() || undefined;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export async function updateStoreSettingsAction(raw: unknown): Promise<SettingsActionResult> {
  const a = await getAdminActor();
  if (!a.permissions.includes("settings.manage")) return { ok: false, errors: {}, message: "You don't have permission to change settings (mock permissions)." };
  const v = obj(raw);
  const addr = obj(v.address);
  const input: StoreSettingsInput = {
    storeName: str(v.storeName, 100),
    email: opt(v.email),
    phone: opt(v.phone, 40),
    address: {
      addressLine1: str(addr.addressLine1),
      addressLine2: opt(addr.addressLine2),
      area: opt(addr.area),
      city: str(addr.city, 100),
      prefecture: str(addr.prefecture, 50),
      postalCode: str(addr.postalCode, 10),
      country: "JP",
    },
    weightUnit: v.weightUnit === "g" ? "g" : "kg",
    dimensionUnit: v.dimensionUnit === "mm" ? "mm" : v.dimensionUnit === "m" ? "m" : "cm",
  };
  const result = await repositories.settings.updateStore(input, { id: a.id, name: a.name, role: a.role });
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
