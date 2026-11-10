import "server-only";

import { isOpenOrder } from "@/lib/orders/status";
import { CONTACT_TOPICS } from "@/lib/validation/contact";
import type { AdminNotification } from "@/lib/types";
import { mockContactMessages } from "./mock-contact";
import { mockProducts } from "./mock/catalog";
import { mockCustomers } from "./mock/customers";
import { mockOrders } from "./mock/orders";
import type { AdminNotificationRepository } from "./repositories";

/*
 * DEMO: notifications are derived from the current orders, applications, stock and contact messages, so handling the
 * work removes them. Read marks live in server memory and are shared by everyone. The backend stores them per staff user.
 */
const state = globalThis as typeof globalThis & { __mockAdminNotificationsRead?: Set<string> };
state.__mockAdminNotificationsRead ??= new Set();
const readIds = state.__mockAdminNotificationsRead;

const DEFAULT_LIMIT = 30;

function all(): Omit<AdminNotification, "read">[] {
  return [
    ...mockOrders
      .filter((o) => o.status === "received")
      .map((o) => ({ id: `order-${o.id}`, kind: "order" as const, title: `New order ${o.number}`, detail: o.customerName, href: `/admin/orders/${o.id}`, at: o.placedAt })),
    ...mockCustomers
      .filter((c) => c.status === "pending")
      .map((c) => ({ id: `registration-${c.id}`, kind: "registration" as const, title: "New registration request", detail: c.companyName, href: "/admin/customers/requests?status=pending", at: c.createdAt })),
    ...mockProducts
      .filter((p) => p.status === "published" && (p.stock.status === "low_stock" || p.stock.status === "out_of_stock"))
      .map((p) => ({
        id: `stock-${p.id}-${p.stock.status}`,
        kind: "low_stock" as const,
        title: p.stock.status === "out_of_stock" ? "Out of stock" : "Low stock",
        detail: p.stock.quantity !== undefined ? `${p.name}: ${p.stock.quantity} left` : p.name,
        href: `/admin/products/${p.id}/edit`,
        at: p.updatedAt,
      })),
    ...mockContactMessages.map((m) => ({
      id: `contact-${m.id}`,
      kind: "contact" as const,
      title: `Contact message: ${CONTACT_TOPICS[m.topic]}`,
      detail: `${m.name}${m.company ? ` (${m.company})` : ""} · ${m.email}: ${m.message.slice(0, 120)}`,
      at: m.receivedAt,
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export const mockAdminNotificationRepository: AdminNotificationRepository = {
  async feed({ limit = DEFAULT_LIMIT } = {}) {
    const items = all();
    return {
      items: items.slice(0, limit).map((n) => ({ ...n, read: readIds.has(n.id) })),
      total: items.length,
      unread: items.filter((n) => !readIds.has(n.id)).length,
      openOrders: mockOrders.filter(isOpenOrder).length,
      pendingRegistrations: items.filter((n) => n.kind === "registration").length,
    };
  },
  async markRead(id) {
    readIds.add(id);
  },
  async markAllRead() {
    for (const n of all()) readIds.add(n.id);
  },
};
