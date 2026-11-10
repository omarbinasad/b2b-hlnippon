import "server-only";

import { company } from "@/config/runtime";
import { addDays, nextDeliveryDates } from "@/lib/delivery/schedule";
import { renderTemplate, validateTemplate } from "@/lib/email/render";
import { isEmail } from "@/lib/customers/contact";
import { formatCalendarDate } from "@/lib/format";
import { segmentRecipients } from "@/lib/reminders/segment";
import type { EmailLog, EmailSenderSettings, EmailTemplate, EmailTemplateKey, FieldErrors, ReminderCampaign } from "@/lib/types";
import { mockCustomers } from "./mock/customers";
import { mockOrders } from "./mock/orders";
import { mockDeliveryRoutes } from "./mock/pricing-delivery";
import { clone, invalid, now } from "./mock-store-helpers";
import { matches, paginate } from "./mock-utils";
import type { EmailRepository, ReminderRepository } from "./repositories";

const AT = "2026-01-01T00:00:00+09:00";
const COMMON = ["store_name", "customer_name", "company_name"];
const ORDER = [...COMMON, "order_number", "order_total", "order_status"];

const tpl = (key: EmailTemplateKey, name: string, trigger: string, subject: string, bodyHtml: string, placeholders: string[], extra: Partial<EmailTemplate> = {}): EmailTemplate => ({ key, name, trigger, audience: "customer", enabled: true, subject, bodyHtml, placeholders, supportsAttachment: false, attachInvoice: false, updatedAt: AT, ...extra });

const seedTemplates: EmailTemplate[] = [
  tpl("customer_registered", "Application received", "A business applies for an account", "We received your application", "<p>Hello {{customer_name}},</p><p>Thanks for applying to {{store_name}}. We'll review {{company_name}}'s application and let you know.</p>", COMMON),
  tpl("customer_approved", "Account approved", "Staff approve an application", "Your wholesale account is ready", "<p>Hello {{customer_name}},</p><p>{{company_name}} is approved. You can now see wholesale prices and order.</p>", COMMON),
  tpl("password_reset", "Password reset", "A customer asks to reset their password", "Reset your password", "<p>Hello {{customer_name}},</p><p>Use this link to choose a new password: {{reset_link}}</p><p>If you didn't ask for this, you can ignore this email.</p>", [...COMMON, "reset_link"]),
  tpl("order_confirmation", "Order confirmation", "An order is placed", "Order {{order_number}} received", "<p>Hello {{customer_name}},</p><p>Thanks for your order {{order_number}}. Total so far: {{order_total}}. Items priced by weight are adjusted when packed.</p>", ORDER),
  tpl("order_processing", "Order being prepared", "An order moves to Preparing", "We're preparing order {{order_number}}", "<p>Hello {{customer_name}},</p><p>We're now preparing order {{order_number}}.</p>", ORDER),
  tpl("order_status", "Order status changed", "An order changes status", "Order {{order_number}}: {{order_status}}", "<p>Hello {{customer_name}},</p><p>Order {{order_number}} is now: {{order_status}}.</p>", ORDER),
  tpl("delivery_notification", "Delivered", "An order is delivered", "Order {{order_number}} was delivered", "<p>Hello {{customer_name}},</p><p>Order {{order_number}} was delivered. Thank you.</p>", ORDER),
  tpl("invoice", "Invoice", "Staff issue an invoice", "Invoice {{invoice_number}} for order {{order_number}}", "<p>Hello {{customer_name}},</p><p>Your invoice {{invoice_number}} for order {{order_number}} is ready. Total: {{order_total}}.</p>", [...ORDER, "invoice_number"], { supportsAttachment: true, attachInvoice: true }),
  tpl("refund", "Refund", "Staff record a refund", "Refund for order {{order_number}}", "<p>Hello {{customer_name}},</p><p>We've recorded a refund of {{refund_amount}} for order {{order_number}}.</p>", [...ORDER, "refund_amount"]),
  tpl("reminder_with_order", "Reminder: order on its way", "Reminder campaign, customers with an order for that date", "Your delivery on {{delivery_date}}", "<p>Hello {{customer_name}},</p><p>We deliver to {{route_name}} on {{delivery_date}}. Order {{order_number}} is planned for it. Need to add anything? Order by {{order_cutoff}}.</p>", [...COMMON, "route_name", "delivery_date", "order_cutoff", "order_number"]),
  tpl("reminder_without_order", "Reminder: place your order", "Reminder campaign, customers without an order for that date", "Order by {{order_cutoff}} for {{delivery_date}}", "<p>Hello {{customer_name}},</p><p>We deliver to {{route_name}} on {{delivery_date}}. To be included, order by {{order_cutoff}}.</p>", [...COMMON, "route_name", "delivery_date", "order_cutoff"]),
];

const SAMPLE: Record<string, string> = { customer_name: "Sample Contact", company_name: "Sample Foods", order_number: "ORD-10001", order_total: "¥12,500", order_status: "Preparing", invoice_number: "INV-2026-0001", refund_amount: "¥1,000", reset_link: "https://example.com/reset-password", route_name: "Tokyo metro", delivery_date: "1 Dec 2026", order_cutoff: "30 Nov 2026, 16:00" };

/* DEMO STORE: templates, logs and campaigns in server memory. Nothing is ever sent. */
const store = globalThis as typeof globalThis & { __mockNotify?: { templates: EmailTemplate[]; logs: EmailLog[]; campaigns: ReminderCampaign[]; sender: EmailSenderSettings; simulated: Set<string> } };
store.__mockNotify ??= {
  templates: structuredClone(seedTemplates),
  logs: [
    { id: "log-sample-1", templateKey: "order_confirmation", to: "bounced@customer.example.com", subject: "Order ORD-10000 received", status: "failed", error: "Sample failure: mailbox not found", attempts: 2, at: "2026-09-30T09:00:00+09:00" },
    { id: "log-sample-2", templateKey: "customer_approved", to: "buyer2@customer.example.com", subject: "Your wholesale account is ready", status: "simulated", attempts: 1, at: "2026-09-29T15:00:00+09:00" },
  ],
  campaigns: [
    { id: "camp-tokyo", name: "Tokyo: day before delivery", deliveryRouteId: "route-tokyo", leadDays: 1, sendTime: "09:00", enabled: true, templateWithOrder: "reminder_with_order", templateWithoutOrder: "reminder_without_order", createdAt: AT, updatedAt: AT },
    { id: "camp-kansai", name: "Kansai: day before delivery", deliveryRouteId: "route-kansai", leadDays: 1, sendTime: "09:00", enabled: false, templateWithOrder: "reminder_with_order", templateWithoutOrder: "reminder_without_order", createdAt: AT, updatedAt: AT },
  ],
  sender: { senderName: "", senderEmail: "orders@example.com" },
  simulated: new Set(),
};
const db = store.__mockNotify;

const baseVars = () => ({ store_name: company().storeName });
const senderName = () => db.sender.senderName || company().documents.emailSenderName || company().storeName;

/** What the system would email. Records a row and sends nothing. Called from the order and customer mocks. */
export function logEmail(key: EmailTemplateKey, to: string | undefined, vars: Record<string, string>, campaignId?: string) {
  const t = db.templates.find((x) => x.key === key);
  if (!t?.enabled || !to) return;
  db.logs.unshift({ id: `log-${crypto.randomUUID().slice(0, 8)}`, templateKey: key, to, subject: renderTemplate(t.subject, { ...baseVars(), ...vars }), status: "simulated", attempts: 1, campaignId, at: now() });
}

export const mockEmailRepository: EmailRepository = {
  async templates() {
    return clone(db.templates);
  },
  async template(key) {
    const t = db.templates.find((x) => x.key === key);
    return t ? clone(t) : null;
  },
  async saveTemplate(key, input) {
    const t = db.templates.find((x) => x.key === key);
    if (!t) return { ok: false, errors: {} as FieldErrors, message: "That template doesn't exist." };
    const errors = validateTemplate(input, t.placeholders);
    if (Object.keys(errors).length) return invalid(errors);
    Object.assign(t, { enabled: input.enabled, subject: input.subject.trim(), bodyHtml: input.bodyHtml, attachInvoice: t.supportsAttachment && input.attachInvoice, updatedAt: now() });
    return { ok: true, value: clone(t) };
  },
  async resetTemplate(key) {
    const seed = seedTemplates.find((x) => x.key === key);
    const i = db.templates.findIndex((x) => x.key === key);
    if (seed && i >= 0) db.templates[i] = structuredClone(seed);
  },
  async preview(key, draft) {
    const t = db.templates.find((x) => x.key === key);
    const subject = draft?.subject ?? t?.subject ?? "";
    const body = draft?.bodyHtml ?? t?.bodyHtml ?? "";
    const vars = { ...SAMPLE, ...baseVars() };
    return { from: `${senderName()} <${db.sender.senderEmail}>`, subject: renderTemplate(subject, vars), bodyHtml: renderTemplate(body, vars, { html: true }), footer: db.sender.footer ?? company().documents.emailFooter };
  },
  async sender() {
    return { ...clone(db.sender), senderName: senderName(), footer: db.sender.footer ?? company().documents.emailFooter };
  },
  async saveSender(input) {
    const errors: FieldErrors = {};
    if (input.senderName.trim().length < 2) errors.senderName = "Enter a sender name.";
    if (!isEmail(input.senderEmail)) errors.senderEmail = "Enter a valid email address.";
    if (input.replyTo && !isEmail(input.replyTo)) errors.replyTo = "Enter a valid email address.";
    if (Object.keys(errors).length) return invalid(errors);
    db.sender = clone(input);
    return { ok: true, value: clone(db.sender) };
  },
  async logs({ search, status, templateKey, page, perPage } = {}) {
    const rows = db.logs.filter((l) => (!status || l.status === status) && (!templateKey || l.templateKey === templateKey) && matches(search, l.to, l.subject));
    return clone(paginate(rows, page, perPage));
  },
  async retry(id) {
    const l = db.logs.find((x) => x.id === id);
    if (!l) return { ok: false, errors: {} as FieldErrors, message: "That log row no longer exists." };
    if (l.status !== "failed") return { ok: false, errors: {} as FieldErrors, message: "Only failed emails can be retried." };
    l.attempts += 1;
    l.status = "simulated";
    l.error = undefined;
    l.at = now();
    return { ok: true, value: clone(l) };
  },
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: company().locale.timeZone }).format(new Date());
const nowTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: company().locale.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

function validateCampaign(i: { name: string; deliveryRouteId: string; leadDays: number; sendTime: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (i.name.trim().length < 2) errors.name = "Enter a campaign name.";
  if (!mockDeliveryRoutes.some((r) => r.id === i.deliveryRouteId)) errors.deliveryRouteId = "Choose a delivery schedule.";
  if (!Number.isInteger(i.leadDays) || i.leadDays < 0 || i.leadDays > 14) errors.leadDays = "Enter 0 to 14 days.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.sendTime)) errors.sendTime = "Use a time like 09:00.";
  return errors;
}

async function buildPreview(id: string) {
  const c = db.campaigns.find((x) => x.id === id);
  const route = c && mockDeliveryRoutes.find((r) => r.id === c.deliveryRouteId);
  if (!c || !route) return null;
  const next = nextDeliveryDates(route, today(), nowTime(), 1)[0];
  if (!next) return { campaign: clone(c), route: clone(route), next: null, sendOn: null, segments: { withOrder: [], withoutOrder: [], excluded: [] }, emails: null };
  const segments = segmentRecipients(mockCustomers, mockOrders, route.areas, next.date);
  const vars = (orderNumber?: string) => ({ route_name: route.name, delivery_date: formatCalendarDate(next.date), order_cutoff: `${formatCalendarDate(next.orderByDate)}, ${next.orderByTime}`, customer_name: "Sample Contact", company_name: "Sample Foods", order_number: orderNumber ?? "ORD-10001" });
  const render = async (key: EmailTemplateKey) => {
    const t = db.templates.find((x) => x.key === key);
    const v = { ...baseVars(), ...vars() };
    return { subject: renderTemplate(t?.subject ?? "", v), bodyHtml: renderTemplate(t?.bodyHtml ?? "", v, { html: true }) };
  };
  return { campaign: clone(c), route: clone(route), next, sendOn: addDays(next.date, -c.leadDays), segments, emails: { withOrder: await render(c.templateWithOrder), withoutOrder: await render(c.templateWithoutOrder) } };
}

export const mockReminderRepository: ReminderRepository = {
  async list({ search, page, perPage } = {}) {
    return clone(paginate(db.campaigns.filter((c) => matches(search, c.name)), page, perPage));
  },
  async getById(id) {
    const c = db.campaigns.find((x) => x.id === id);
    return c ? clone(c) : null;
  },
  async save(id, input) {
    const errors = validateCampaign(input);
    if (Object.keys(errors).length) return invalid(errors);
    const at = now();
    const existing = id ? db.campaigns.find((c) => c.id === id) : undefined;
    if (id && !existing) return { ok: false, errors: {} as FieldErrors, message: "That campaign no longer exists." };
    const next: ReminderCampaign = { ...(existing ?? { id: `camp-${crypto.randomUUID().slice(0, 8)}`, createdAt: at }), ...input, name: input.name.trim(), updatedAt: at };
    if (existing) Object.assign(existing, next);
    else db.campaigns.push(next);
    return { ok: true, value: clone(next) };
  },
  async remove(id) {
    const i = db.campaigns.findIndex((c) => c.id === id);
    if (i >= 0) db.campaigns.splice(i, 1);
  },
  preview: buildPreview,
  async simulate(id) {
    const p = await buildPreview(id);
    if (!p?.next) return { ok: false, errors: {} as FieldErrors, message: "This schedule has no upcoming delivery date." };
    let created = 0;
    let skipped = 0;
    const run = (list: typeof p.segments.withOrder, key: EmailTemplateKey) => {
      for (const r of list) {
        const mark = `${id}:${p.next!.date}:${r.customerId}`;
        // One reminder per customer, campaign and date, however often this runs.
        if (db.simulated.has(mark)) {
          skipped += 1;
          continue;
        }
        db.simulated.add(mark);
        logEmail(key, r.email, { route_name: p.route.name, delivery_date: formatCalendarDate(p.next!.date), order_cutoff: `${formatCalendarDate(p.next!.orderByDate)}, ${p.next!.orderByTime}`, customer_name: r.name, company_name: r.name, order_number: r.orderNumbers[0] ?? "" }, id);
        created += 1;
      }
    };
    run(p.segments.withOrder, p.campaign.templateWithOrder);
    run(p.segments.withoutOrder, p.campaign.templateWithoutOrder);
    return { ok: true, value: { created, skipped } };
  },
  async history(id, { page, perPage } = {}) {
    return clone(paginate(db.logs.filter((l) => l.campaignId === id), page, perPage));
  },
};
