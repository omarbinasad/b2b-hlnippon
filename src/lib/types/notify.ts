import type { ID, ISODateString } from "./common";

export type EmailTemplateKey =
  | "customer_registered"
  | "customer_approved"
  | "password_reset"
  | "order_confirmation"
  | "order_processing"
  | "order_status"
  | "delivery_notification"
  | "invoice"
  | "refund"
  | "reminder_with_order"
  | "reminder_without_order";

export interface EmailTemplate {
  key: EmailTemplateKey;
  name: string;
  /** When it would go out. */
  trigger: string;
  audience: "customer" | "staff";
  enabled: boolean;
  subject: string;
  /** Simple HTML with `{{placeholders}}`. */
  bodyHtml: string;
  placeholders: string[];
  /** Can carry the invoice PDF once the backend generates it. */
  supportsAttachment: boolean;
  attachInvoice: boolean;
  updatedAt: ISODateString;
}

export type EmailTemplateInput = Pick<EmailTemplate, "enabled" | "subject" | "bodyHtml" | "attachInvoice">;

export interface EmailSenderSettings {
  senderName: string;
  senderEmail: string;
  replyTo?: string;
  footer?: string;
}

/**
 * A record of an email the system would send. "simulated" means nothing left the server; "failed" shows how a failure
 * looks. The backend adds "queued", "sent" and "bounced".
 */
export type EmailLogStatus = "simulated" | "failed";

export interface EmailLog {
  id: ID;
  templateKey: EmailTemplateKey;
  to: string;
  subject: string;
  status: EmailLogStatus;
  error?: string;
  attempts: number;
  /** Set when this row comes from a reminder campaign. */
  campaignId?: ID;
  at: ISODateString;
}

export interface ReminderCampaign {
  id: ID;
  name: string;
  deliveryRouteId: ID;
  /** Days before the delivery date. */
  leadDays: number;
  /** HH:mm in store time. */
  sendTime: string;
  enabled: boolean;
  /** Group A: customers with an order for that date. */
  templateWithOrder: EmailTemplateKey;
  /** Group B: customers without one. */
  templateWithoutOrder: EmailTemplateKey;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ReminderCampaignInput = Pick<ReminderCampaign, "name" | "deliveryRouteId" | "leadDays" | "sendTime" | "enabled" | "templateWithOrder" | "templateWithoutOrder">;
