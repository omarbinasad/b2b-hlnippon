import "server-only";

import type { Paginated } from "@/lib/types";
import type { DateBounds, SortDir } from "./repositories";

/* Shared helpers for mock repositories (search, date bounds, sort, paginate). */

const DEFAULT_PER_PAGE = 12;
const MAX_PER_PAGE = 48;

export function paginate<T>(all: T[], page = 1, perPage = DEFAULT_PER_PAGE): Paginated<T> {
  const size = Math.min(Math.max(1, perPage), MAX_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(all.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * size;
  return { items: all.slice(start, start + size), page: current, perPage: size, total: all.length, totalPages };
}

/** Case-insensitive "contains" across fields; an empty term matches everything. */
export function matches(search: string | undefined, ...fields: (string | undefined)[]) {
  const term = search?.trim().toLowerCase();
  return !term || fields.some((f) => f?.toLowerCase().includes(term));
}

/** Mock timestamps carry the store offset, so the first 10 chars are the local date. */
export const withinDates = (iso: string | undefined, { from, to }: DateBounds) =>
  (!from && !to) || (!!iso && (!from || iso.slice(0, 10) >= from) && (!to || iso.slice(0, 10) <= to));

export type SortKey = string | number | undefined;

/** Stable sort by a key; missing values always last. */
export function sortBy<T>(items: T[], key: (item: T) => SortKey, dir: SortDir = "asc"): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign;
  });
}

