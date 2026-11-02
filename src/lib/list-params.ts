/**
 * Reading listing state (search, filters, sort, dates, page) from URL search
 * params. Every value is validated against an allow-list, so a tampered URL can
 * only ever produce a supported query.
 */
import type { SortDir } from "@/lib/data/repositories";
import { isISODate } from "@/lib/date-range";

export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a param, trimmed; undefined when empty. */
export function param(sp: SearchParams, key: string) {
  const raw = sp[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value.slice(0, 100) : undefined;
}

export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function boolParam(sp: SearchParams, key: string) {
  const v = param(sp, key);
  return v === "yes" ? true : v === "no" ? false : undefined;
}

export interface ListState<S extends string> {
  search?: string;
  page: number;
  sort: S;
  /** Undefined = the repository's default direction for this field. */
  dir?: SortDir;
  from?: string;
  to?: string;
}

/** Common listing params: `q`, `page`, `sort`, `dir`, `from`, `to`. */
export function listState<S extends string>(sp: SearchParams, sortFields: readonly S[], defaultSort: S): ListState<S> {
  const from = param(sp, "from");
  const to = param(sp, "to");
  const validFrom = isISODate(from) ? from : undefined;
  const validTo = isISODate(to) ? to : undefined;
  return {
    search: param(sp, "q"),
    page: Math.max(1, Number(param(sp, "page")) || 1),
    sort: oneOf(param(sp, "sort"), sortFields) ?? defaultSort,
    dir: oneOf(param(sp, "dir"), ["asc", "desc"] as const),
    // Swap reversed bounds instead of returning nothing.
    from: validFrom && validTo && validFrom > validTo ? validTo : validFrom,
    to: validFrom && validTo && validFrom > validTo ? validFrom : validTo,
  };
}

/** Current params as plain strings (first values only), for building links. */
export function flatParams(sp: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(sp)) {
    const v = param(sp, key);
    if (v) out[key] = v;
  }
  return out;
}

/** Link to the same listing with some params changed (undefined removes a param). */
export function listHref(pathname: string, current: Record<string, string>, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...changes })) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
