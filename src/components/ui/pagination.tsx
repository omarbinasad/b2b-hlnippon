import type { Route } from "next";
import Link from "next/link";
import { cx } from "@/lib/cx";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Base path; existing query params (filters) are preserved. */
  pathname: string;
  searchParams?: Record<string, string | undefined>;
}

/** Page numbers to show: first, last, and a window around the current page, with gaps as "…". */
function pageWindow(page: number, total: number): (number | "gap")[] {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

/** Link-based pagination — works without client JavaScript. */
export function Pagination({ page, totalPages, pathname, searchParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) if (value && key !== "page") params.set(key, value);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return (qs ? `${pathname}?${qs}` : pathname) as Route;
  };

  // Colours are kept out of `shape` so the current page never gets two competing backgrounds
  // (cx only joins classes; with both bg-surface and bg-brand, CSS order decides — white on white).
  const shape = "inline-flex h-10 min-w-10 items-center justify-center rounded-ui border text-sm";
  const box = cx(shape, "border-line bg-surface px-3");

  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={box} rel="prev">Previous</Link>
      ) : (
        <span className={cx(box, "opacity-50")} aria-disabled>Previous</span>
      )}

      <ol className="hidden items-center gap-1 sm:flex">
        {pageWindow(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted">…</li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cx(shape, "px-2 tabular-nums", p === page ? "border-brand bg-brand font-semibold text-brand-contrast" : "border-line bg-surface hover:bg-surface-muted")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ol>
      <p className="text-sm text-muted sm:hidden">
        Page {page} of {totalPages}
      </p>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={box} rel="next">Next</Link>
      ) : (
        <span className={cx(box, "opacity-50")} aria-disabled>Next</span>
      )}
    </nav>
  );
}
