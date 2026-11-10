import type { ID, ISODateString } from "./common";

export type AdminNotificationKind = "order" | "registration" | "low_stock" | "contact";

/** Something staff should look at. Derived from current data, so it disappears once the work is done. */
export interface AdminNotification {
  id: ID;
  kind: AdminNotificationKind;
  title: string;
  detail?: string;
  /** Where to act on it; absent when there is no screen for it yet. */
  href?: string;
  at: ISODateString;
  read: boolean;
}

export interface AdminNotificationFeed {
  /** Newest first, at most the requested number. */
  items: AdminNotification[];
  /** All notifications, including those past the limit. */
  total: number;
  /** Bell count. */
  unread: number;
  /** Sidebar badge: orders in progress (not yet delivered or cancelled). Reading a notification does not change it. */
  openOrders: number;
  /** Sidebar badge: registrations still pending; approved, rejected and suspended ones are not counted. */
  pendingRegistrations: number;
}
