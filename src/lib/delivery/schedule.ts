/** Pure delivery date rules, shared by the customer portal, admin previews and reminders. Tested; the backend must match. */
import type { DeliveryRoute, Weekday } from "../types/delivery.ts";

const WEEK: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const weekdayOf = (date: string): Weekday => WEEK[new Date(`${date}T00:00:00Z`).getUTCDay()];

export interface DeliveryDate {
  /** Delivery day, YYYY-MM-DD. */
  date: string;
  /** Last moment to order for it: the day before, at the route's cutoff, store time. */
  orderByDate: string;
  orderByTime: string;
}

type Schedule = Pick<DeliveryRoute, "deliveryDays" | "cutoffTime" | "active" | "excludedDates" | "extraDates">;

/**
 * The next delivery dates that can still be ordered for. `today` and `nowTime` are in store time.
 * Regular days and extra dates count; excluded dates (holidays) don't. An inactive schedule has none.
 */
export function nextDeliveryDates(schedule: Schedule, today: string, nowTime: string, count = 4): DeliveryDate[] {
  if (!schedule.active) return [];
  const excluded = new Set(schedule.excludedDates ?? []);
  const extra = new Set(schedule.extraDates ?? []);
  const out: DeliveryDate[] = [];
  for (let i = 0; i < 120 && out.length < count; i++) {
    const date = addDays(today, i);
    if (excluded.has(date) || !(schedule.deliveryDays.includes(weekdayOf(date)) || extra.has(date))) continue;
    const orderByDate = addDays(date, -1);
    if (orderByDate < today || (orderByDate === today && nowTime > schedule.cutoffTime)) continue;
    out.push({ date, orderByDate, orderByTime: schedule.cutoffTime });
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

/** The active route serving an address. An area can name a city or a region; the city wins as the more specific match. */
export function matchRoute<R extends Pick<DeliveryRoute, "areas" | "active">>(routes: R[], address: { prefecture: string; city: string }): R | undefined {
  const active = routes.filter((r) => r.active);
  const has = (r: R, v: string) => r.areas.some((a) => norm(a) === norm(v));
  return active.find((r) => has(r, address.city)) ?? active.find((r) => has(r, address.prefecture));
}
