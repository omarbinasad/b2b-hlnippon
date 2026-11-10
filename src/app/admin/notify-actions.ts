"use server";

/*
 * Delivery schedules, reminder campaigns and email settings. DEMO: server memory, and nothing is ever sent.
 * TODO(auth): mocked permission; the backend must authorize every call and run reminders as a scheduled job.
 */
import { revalidatePath } from "next/cache";
import { actorWith } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { sanitizeRichHtml } from "@/lib/html/sanitize";
import type { EmailTemplateKey, FieldErrors, Weekday } from "@/lib/types";

export type NotifyResult<T = { id: string }> = { ok: true; value: T } | { ok: false; errors: FieldErrors; message: string };

const denied = { ok: false as const, errors: {}, message: "You don't have permission to do that (mock permission)." };
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const strs = (v: unknown, max = 200) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((x) => x.slice(0, 100)) : []);
const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const fail = (r: { errors: FieldErrors; message?: string }) => ({ ok: false as const, errors: r.errors, message: r.message ?? "Some fields need attention." });

export async function saveRouteAction(id: string | null, raw: unknown): Promise<NotifyResult> {
  const by = await actorWith("delivery.manage");
  if (!by) return denied;
  const v = obj(raw);
  const r = await repositories.delivery.saveRoute(id, {
    name: str(v.name, 100),
    areas: strs(v.areas),
    deliveryDays: strs(v.deliveryDays).filter((d): d is Weekday => DAYS.includes(d as Weekday)),
    cutoffTime: str(v.cutoffTime, 5),
    excludedDates: strs(v.excludedDates),
    extraDates: strs(v.extraDates),
    active: v.active !== false,
  }, by);
  if (!r.ok) return fail(r);
  revalidatePath("/", "layout");
  return { ok: true, value: { id: r.value.id } };
}

export async function deleteRouteAction(id: string): Promise<NotifyResult> {
  const by = await actorWith("delivery.manage");
  if (!by) return denied;
  const r = await repositories.delivery.deleteRoute(String(id), by);
  if (!r.ok) return fail(r);
  revalidatePath("/", "layout");
  return { ok: true, value: { id: String(id) } };
}

export async function saveCampaignAction(id: string | null, raw: unknown): Promise<NotifyResult> {
  const by = await actorWith("reminders.manage");
  if (!by) return denied;
  const v = obj(raw);
  const r = await repositories.reminders.save(id, {
    name: str(v.name, 100),
    deliveryRouteId: str(v.deliveryRouteId, 100),
    leadDays: Number(v.leadDays),
    sendTime: str(v.sendTime, 5),
    enabled: v.enabled !== false,
    templateWithOrder: str(v.templateWithOrder, 40) as EmailTemplateKey,
    templateWithoutOrder: str(v.templateWithoutOrder, 40) as EmailTemplateKey,
  }, by);
  if (!r.ok) return fail(r);
  revalidatePath("/admin/reminders");
  return { ok: true, value: { id: r.value.id } };
}

export async function deleteCampaignAction(id: string): Promise<NotifyResult> {
  const by = await actorWith("reminders.manage");
  if (!by) return denied;
  await repositories.reminders.remove(String(id), by);
  revalidatePath("/admin/reminders");
  return { ok: true, value: { id: String(id) } };
}

export async function simulateCampaignAction(id: string): Promise<NotifyResult<{ created: number; skipped: number }>> {
  const by = await actorWith("reminders.manage");
  if (!by) return denied;
  const r = await repositories.reminders.simulate(String(id), by);
  if (!r.ok) return fail(r);
  revalidatePath("/admin/reminders");
  revalidatePath("/admin/emails/logs");
  return r;
}

export async function saveTemplateAction(key: string, raw: unknown): Promise<NotifyResult> {
  const by = await actorWith("emails.manage");
  if (!by) return denied;
  const v = obj(raw);
  const r = await repositories.emails.saveTemplate(str(key, 40) as EmailTemplateKey, { enabled: v.enabled === true, subject: str(v.subject, 300), bodyHtml: str(v.bodyHtml, 20000), attachInvoice: v.attachInvoice === true }, by);
  if (!r.ok) return fail(r);
  revalidatePath("/admin/emails", "layout");
  return { ok: true, value: { id: r.value.key } };
}

export async function resetTemplateAction(key: string): Promise<NotifyResult> {
  const by = await actorWith("emails.manage");
  if (!by) return denied;
  await repositories.emails.resetTemplate(str(key, 40) as EmailTemplateKey, by);
  revalidatePath("/admin/emails", "layout");
  return { ok: true, value: { id: String(key) } };
}

export async function previewTemplateAction(key: string, draft: { subject: string; bodyHtml: string }) {
  if (!(await actorWith("emails.view"))) return null;
  const p = await repositories.emails.preview(str(key, 40) as EmailTemplateKey, { subject: str(draft.subject, 300), bodyHtml: str(draft.bodyHtml, 20000) });
  return { ...p, safeHtml: sanitizeRichHtml(p.bodyHtml) };
}

export async function saveSenderAction(raw: unknown): Promise<NotifyResult> {
  const by = await actorWith("emails.manage");
  if (!by) return denied;
  const v = obj(raw);
  const r = await repositories.emails.saveSender({ senderName: str(v.senderName, 100), senderEmail: str(v.senderEmail).trim(), replyTo: str(v.replyTo).trim() || undefined, footer: str(v.footer, 500) || undefined }, by);
  if (!r.ok) return fail(r);
  revalidatePath("/admin/emails", "layout");
  return { ok: true, value: { id: "sender" } };
}

export async function retryEmailAction(id: string): Promise<NotifyResult> {
  const by = await actorWith("emails.manage");
  if (!by) return denied;
  const r = await repositories.emails.retry(String(id), by);
  if (!r.ok) return fail(r);
  revalidatePath("/admin/emails/logs");
  return { ok: true, value: { id: r.value.id } };
}
