"use server";

/*
 * Payment method SETTINGS mutations. DEMO: kept in server memory only. Nothing here
 * processes a payment, stores card data or gateway secrets, or marks an order paid.
 * TODO(auth): "payments.manage" is mocked — the backend must authorize every call.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { moveMethod } from "@/lib/payments/methods";
import type { FieldErrors, PaymentMethodId, PaymentMethodInput } from "@/lib/types";

export type PaymentActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const IDS: PaymentMethodId[] = ["pay_on_delivery", "bank_transfer", "online"];
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const methodId = (v: unknown): PaymentMethodId | null => (IDS.includes(v as PaymentMethodId) ? (v as PaymentMethodId) : null);

async function actor() {
  const a = await getAdminActor();
  return a.permissions.includes("payments.manage") ? { id: a.id, name: a.name, role: a.role } : null;
}

function refresh() {
  revalidatePath("/admin/payments", "layout");
}

export async function savePaymentMethodAction(id: string, raw: unknown): Promise<PaymentActionResult> {
  const by = await actor();
  if (!by) return { ok: false, errors: {}, message: "You don't have permission to manage payment settings (mock permissions)." };
  const methodIdValue = methodId(id);
  if (!methodIdValue) return { ok: false, errors: {}, message: "Unknown payment method." };
  const v = obj(raw);
  const b = obj(v.bank);
  const input: PaymentMethodInput = {
    enabled: v.enabled === true,
    title: str(v.title, 100),
    description: str(v.description, 300),
    instructions: str(v.instructions, 1200),
    bank:
      methodIdValue === "bank_transfer"
        ? {
            accountName: str(b.accountName, 150),
            bankName: str(b.bankName, 150),
            accountNumber: str(b.accountNumber, 40),
            branchName: str(b.branchName, 150) || undefined,
            routingNumber: str(b.routingNumber, 20) || undefined,
          }
        : undefined,
  };
  const result = await repositories.payments.updateMethod(methodIdValue, input, by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  refresh();
  redirect("/admin/payments?notice=saved" as Route);
}

/** List actions (form posts): enable/disable and move up/down. */
export async function paymentListAction(formData: FormData) {
  const by = await actor();
  const id = methodId(formData.get("id"));
  const op = String(formData.get("op") ?? "");
  let ok = false;
  if (by && id) {
    if (op === "up" || op === "down") {
      const current = (await repositories.payments.listMethods()).map((m) => m.id);
      ok = (await repositories.payments.reorderMethods(moveMethod(current, id, op), by)).ok;
    } else if (op === "enable" || op === "disable") {
      const m = await repositories.payments.getMethod(id);
      if (m) {
        const result = await repositories.payments.updateMethod(id, { enabled: op === "enable", title: m.title, description: m.description, instructions: m.instructions, bank: m.bank }, by);
        ok = result.ok;
        if (!result.ok) {
          refresh();
          redirect(`/admin/payments?notice=payment-incomplete&method=${id}` as Route);
        }
      }
    }
  }
  refresh();
  redirect(`/admin/payments?notice=${ok ? "saved" : "error"}` as Route);
}
