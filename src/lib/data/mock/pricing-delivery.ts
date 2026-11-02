import type { DeliveryRoute, Reminder } from "@/lib/types";

export const mockDeliveryRoutes: DeliveryRoute[] = [
  {
    id: "route-tokyo",
    name: "Tokyo metro",
    areas: ["Tokyo", "Saitama", "Kanagawa", "Chiba"],
    deliveryDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    cutoffTime: "16:00",
    shippingFee: 0,
    active: true,
  },
  {
    id: "route-kansai",
    name: "Kansai",
    areas: ["Osaka", "Kyoto", "Hyogo", "Nara"],
    deliveryDays: ["tue", "thu", "sat"],
    cutoffTime: "14:00",
    shippingFee: 440,
    freeShippingThreshold: 31250,
    active: true,
  },
  {
    id: "route-courier",
    name: "Nationwide courier",
    areas: ["Aichi", "Fukuoka", "Hokkaido", "Miyagi", "Hiroshima", "Shizuoka", "Niigata", "Okayama"],
    deliveryDays: ["mon", "wed", "fri"],
    cutoffTime: "12:00",
    shippingFee: 750,
    freeShippingThreshold: 50000,
    active: true,
  },
];

export const mockReminders: Reminder[] = [
  {
    id: "rem-001",
    type: "order_cutoff",
    channel: "sms",
    deliveryRouteId: "route-tokyo",
    schedule: "Mon–Sat at 10:00",
    message: "Order before 16:00 today for next-day delivery.",
    active: true,
    lastSentAt: "2026-09-30T10:00:00+09:00",
  },
  {
    id: "rem-002",
    type: "reorder",
    channel: "email",
    customerId: "cus-002",
    schedule: "Every 2 weeks on Sunday",
    message: "Time to restock your regular items?",
    active: true,
  },
  {
    id: "rem-003",
    type: "payment_due",
    channel: "email",
    schedule: "3 days before invoice due date",
    message: "Your invoice is due soon.",
    active: false,
  },
];
