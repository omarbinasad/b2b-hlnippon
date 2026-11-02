import type { ID, ISODateString, Money } from "./common";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DeliveryRoute {
  id: ID;
  name: string;
  /** Prefectures, cities or areas served by this route. */
  areas: string[];
  deliveryDays: Weekday[];
  /** Order cutoff in store local time, "HH:mm", on the day before delivery. */
  cutoffTime: string;
  shippingFee: Money;
  /** LEGACY: shipping charges now come from shipping zones (src/lib/shipping). Orders at or above this subtotal shipped free. */
  freeShippingThreshold?: Money;
  active: boolean;
}

export type ReminderType = "reorder" | "order_cutoff" | "payment_due";
export type ReminderChannel = "email" | "sms" | "whatsapp";

export interface Reminder {
  id: ID;
  type: ReminderType;
  channel: ReminderChannel;
  /** Targets one customer, a whole delivery route, or everyone when both are omitted. */
  customerId?: ID;
  deliveryRouteId?: ID;
  /** Human-readable schedule until a scheduling format is agreed with the backend. */
  schedule: string;
  message: string;
  active: boolean;
  lastSentAt?: ISODateString;
}
