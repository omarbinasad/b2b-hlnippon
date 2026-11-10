import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, matchRoute, nextDeliveryDates, weekdayOf } from "../src/lib/delivery/schedule.ts";
import type { DeliveryRoute } from "../src/lib/types/delivery.ts";

const route = (p: Partial<DeliveryRoute> = {}) => ({ deliveryDays: ["tue", "fri"], cutoffTime: "16:00", active: true, ...p }) as Pick<DeliveryRoute, "deliveryDays" | "cutoffTime" | "active" | "excludedDates" | "extraDates">;
// 2026-11-02 is a Monday.
describe("delivery dates", () => {
  it("knows the weekday", () => {
    assert.equal(weekdayOf("2026-11-02"), "mon");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });
  it("lists regular days in order", () => {
    assert.deepEqual(nextDeliveryDates(route(), "2026-11-02", "10:00", 3).map((d) => d.date), ["2026-11-03", "2026-11-06", "2026-11-10"]);
  });
  it("skips a day whose cutoff has passed", () => {
    assert.equal(nextDeliveryDates(route(), "2026-11-02", "16:01", 1)[0].date, "2026-11-06");
    assert.equal(nextDeliveryDates(route(), "2026-11-02", "16:00", 1)[0].date, "2026-11-03");
  });
  it("the cutoff is the day before delivery", () => {
    const d = nextDeliveryDates(route(), "2026-11-02", "10:00", 1)[0];
    assert.deepEqual([d.orderByDate, d.orderByTime], ["2026-11-02", "16:00"]);
  });
  it("skips holidays and adds extra dates", () => {
    const dates = nextDeliveryDates(route({ excludedDates: ["2026-11-03"], extraDates: ["2026-11-05"] }), "2026-11-02", "10:00", 2).map((d) => d.date);
    assert.deepEqual(dates, ["2026-11-05", "2026-11-06"]);
  });
  it("an inactive schedule has no dates", () => {
    assert.deepEqual(nextDeliveryDates(route({ active: false }), "2026-11-02", "10:00"), []);
  });
});
describe("route matching", () => {
  const routes = [
    { id: "a", areas: ["Tokyo"], active: true },
    { id: "b", areas: ["Shinjuku-ku"], active: true },
    { id: "c", areas: ["Osaka"], active: false },
  ];
  it("prefers the city, then the region", () => {
    assert.equal(matchRoute(routes, { prefecture: "Tokyo", city: "Shinjuku-ku" })?.id, "b");
    assert.equal(matchRoute(routes, { prefecture: "Tokyo", city: "Minato-ku" })?.id, "a");
  });
  it("ignores inactive routes", () => {
    assert.equal(matchRoute(routes, { prefecture: "Osaka", city: "Kita-ku" }), undefined);
  });
});
