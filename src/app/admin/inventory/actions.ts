"use server";

/*
 * Stock adjustments. DEMO: in server memory. TODO(auth): mocked permission. The backend owns real inventory
 * transactions and must protect against two people adjusting at once.
 */
import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { StockChange } from "@/lib/orders/stock";
import type { FieldErrors } from "@/lib/types";

export type InventoryActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

export async function adjustStockAction(productId: string, variationId: string | undefined, raw: { quantity?: unknown; delta?: unknown; status?: unknown; note?: unknown }): Promise<InventoryActionResult> {
  const a = await getAdminActor();
  if (!a.permissions.includes("inventory.edit")) return { ok: false, errors: {}, message: "You don't have permission to change stock (mock permission)." };
  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 200) : "";
  if (note.length < 3) return { ok: false, errors: { note: "Say why, e.g. stock count or damaged goods." }, message: "Say why the stock changed." };
  const change: StockChange = raw.quantity !== undefined ? { quantity: Number(raw.quantity) } : raw.delta !== undefined ? { delta: Number(raw.delta) } : { status: raw.status === "out_of_stock" ? "out_of_stock" : "in_stock" };
  const r = await repositories.products.setStock(String(productId), variationId ? String(variationId) : undefined, change, { source: "inventory_adjust", byName: a.name, note });
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "The stock could not be changed." };
  revalidatePath("/", "layout");
  return { ok: true };
}
