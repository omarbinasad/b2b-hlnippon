/**
 * Calendar-date range helpers ("YYYY-MM-DD", inclusive). Pure functions shared by
 * the server (parsing/validating URL params) and client controls (presets), so
 * both always agree. All arithmetic is done in UTC to avoid DST/time-zone drift.
 */
import type { DateRange } from "@/lib/types";

export const MAX_RANGE_DAYS = 366;

export const rangePresets = [
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_90", label: "Last 90 days" },
  { id: "this_year", label: "Year to date" },
] as const;
export type RangePreset = (typeof rangePresets)[number]["id"] | "custom";

export const compareModes = [
  { id: "previous", label: "Previous period" },
  { id: "year", label: "Same period last year" },
  { id: "custom", label: "Custom range" },
  { id: "none", label: "No comparison" },
] as const;
export type CompareMode = (typeof compareModes)[number]["id"];

const DAY_MS = 86_400_000;
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromMs(toMs(value)) === value;
}

export const addDays = (date: string, days: number) => fromMs(toMs(date) + days * DAY_MS);
/** Number of days in the range, inclusive. */
export const rangeLength = ({ from, to }: DateRange) => Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1;

const startOfMonth = (date: string) => `${date.slice(0, 7)}-01`;
function endOfMonth(date: string) {
  const d = new Date(toMs(date));
  return fromMs(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}
function addMonths(date: string, months: number) {
  const d = new Date(toMs(date));
  return fromMs(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

/** Today's calendar date in the given IANA time zone. */
export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function presetRange(preset: Exclude<RangePreset, "custom">, today: string): DateRange {
  switch (preset) {
    case "last_7":
      return { from: addDays(today, -6), to: today };
    case "last_30":
      return { from: addDays(today, -29), to: today };
    case "last_90":
      return { from: addDays(today, -89), to: today };
    case "this_month":
      return { from: startOfMonth(today), to: today };
    case "last_month": {
      const from = addMonths(today, -1);
      return { from, to: endOfMonth(from) };
    }
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

export function detectPreset(range: DateRange, today: string): RangePreset {
  const match = rangePresets.find(({ id }) => {
    const p = presetRange(id, today);
    return p.from === range.from && p.to === range.to;
  });
  return match?.id ?? "custom";
}

/** Whole calendar months compare to the same number of preceding months; other ranges shift back by their length. */
export function previousPeriod(range: DateRange): DateRange {
  const isWholeMonths = range.from === startOfMonth(range.from) && range.to === endOfMonth(range.to);
  if (isWholeMonths) {
    const months =
      (Number(range.to.slice(0, 4)) - Number(range.from.slice(0, 4))) * 12 +
      Number(range.to.slice(5, 7)) - Number(range.from.slice(5, 7)) + 1;
    const from = addMonths(range.from, -months);
    return { from, to: endOfMonth(addMonths(range.from, -1)) };
  }
  const length = rangeLength(range);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

function minusYear(date: string) {
  const year = Number(date.slice(0, 4)) - 1;
  return date.slice(5) === "02-29" ? `${year}-02-28` : `${year}${date.slice(4)}`;
}
export const sameRangeLastYear = ({ from, to }: DateRange): DateRange => ({ from: minusYear(from), to: minusYear(to) });

export function compareRange(mode: CompareMode, range: DateRange, custom?: DateRange): DateRange | undefined {
  if (mode === "previous") return previousPeriod(range);
  if (mode === "year") return sameRangeLastYear(range);
  if (mode === "custom") return custom;
  return undefined;
}

/** Validates a from/to pair: ordered, not in the future, at most MAX_RANGE_DAYS long. */
export function validRange(from: unknown, to: unknown, today: string): DateRange | undefined {
  if (!isISODate(from) || !isISODate(to) || from > to || to > today) return undefined;
  const range = { from, to };
  return rangeLength(range) <= MAX_RANGE_DAYS ? range : undefined;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export interface DashboardParams {
  range: DateRange;
  preset: RangePreset;
  compareMode: CompareMode;
  compare?: DateRange;
}

/** Reads `from`, `to`, `compare`, `cfrom`, `cto` from the URL; invalid values fall back to defaults. */
export function parseDashboardParams(params: Params, today: string): DashboardParams {
  const range = validRange(one(params.from), one(params.to), today) ?? presetRange("last_month", today);
  const requested = one(params.compare);
  let compareMode: CompareMode = compareModes.some((m) => m.id === requested) ? (requested as CompareMode) : "previous";
  const custom = validRange(one(params.cfrom), one(params.cto), today);
  if (compareMode === "custom" && !custom) compareMode = "previous";
  return { range, preset: detectPreset(range, today), compareMode, compare: compareRange(compareMode, range, custom) };
}

export function dashboardSearch({ range, compareMode, compare }: Omit<DashboardParams, "preset">) {
  const params = new URLSearchParams({ from: range.from, to: range.to, compare: compareMode });
  if (compareMode === "custom" && compare) {
    params.set("cfrom", compare.from);
    params.set("cto", compare.to);
  }
  return params.toString();
}
