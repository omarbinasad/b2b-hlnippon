"use server";

/* Staff side of quotations. DEMO: server memory. TODO(auth): mocked permission; the backend must authorize. */
import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { FieldErrors } from "@/lib/types";

export type QuotationActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

async function actor() {
  const a = await getAdminActor();
  return a.permissions.includes("quotations.edit") ? { id: a.id, name: a.name, role: a.role } : null;
}
const denied: QuotationActionResult = { ok: false, errors: {}, message: "You don't have permission to manage quotations (mock permission)." };

export async function sendQuoteAction(id: string, raw: { prices?: unknown; validUntil?: unknown; staffNote?: unknown }): Promise<QuotationActionResult> {
  const by = await actor();
  if (!by) return denied;
  const prices: Record<string, number> = {};
  for (const [k, v] of Object.entries((raw.prices && typeof raw.prices === "object" ? raw.prices : {}) as Record<string, unknown>)) prices[k.slice(0, 100)] = v === "" ? Number.NaN : Number(v);
  const r = await repositories.quotations.sendQuote(String(id), { prices, validUntil: String(raw.validUntil ?? "").slice(0, 10), staffNote: typeof raw.staffNote === "string" ? raw.staffNote.slice(0, 1000) : undefined }, by);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  revalidatePath("/admin/quotations");
  return { ok: true };
}

export async function declineQuoteAction(id: string, reason: string): Promise<QuotationActionResult> {
  const by = await actor();
  if (!by) return denied;
  const r = await repositories.quotations.decline(String(id), String(reason).slice(0, 500), by);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.message ?? "Some fields need attention." };
  revalidatePath("/admin/quotations");
  return { ok: true };
}
