import type { Route } from "next";
import Link from "next/link";
import type { SortDir } from "@/lib/data/repositories";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/format";
import { listHref } from "@/lib/list-params";
import { Button, buttonClasses } from "./button";
import { DateRangeFields } from "./date-picker";
import { Field, Input, Select } from "./field";
import { Icon } from "./icons";

/*
 * Server-rendered listing controls. The toolbar is a plain GET form and sort
 * headers are links, so search/filter/sort work without client JavaScript and
 * the state lives in the URL (shareable, back-button friendly).
 */

export interface FilterField {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  /** Label of the "no filter" option. */
  allLabel?: string;
}

interface ListToolbarProps {
  pathname: string;
  /** Current URL params (flat). */
  params: Record<string, string>;
  searchLabel: string;
  searchPlaceholder?: string;
  filters?: FilterField[];
  /** Adds from/to date inputs (`from`, `to` params). */
  dates?: { fromLabel: string; toLabel: string };
  total: number;
  page: number;
  perPage: number;
}

const FILTER_KEYS = ["q", "from", "to"];

export function ListToolbar({ pathname, params, searchLabel, searchPlaceholder, filters = [], dates, total, page, perPage }: ListToolbarProps) {
  const id = pathname.replaceAll("/", "-");
  const active = [...FILTER_KEYS, ...filters.map((f) => f.name)].filter((k) => params[k]).length;
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(total, page * perPage);

  return (
    <div className="mb-4">
      {/* Keyed by the URL params so fields reset after navigation (e.g. "Clear"). */}
      <form key={JSON.stringify(params)} role="search" action={pathname} className="rounded-ui border border-line bg-surface p-3 sm:p-4">
        {/* Wrapping row: fields share one line when there is room and wrap on narrow screens. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-full flex-[2_1_16rem] sm:min-w-64">
            <Field id={`${id}-q`} label={searchLabel}>
              <Input id={`${id}-q`} name="q" type="search" defaultValue={params.q} placeholder={searchPlaceholder} />
            </Field>
          </div>
          {filters.map((f) => (
            <div key={f.name} className="min-w-0 flex-[1_1_9rem]">
              <Field id={`${id}-${f.name}`} label={f.label}>
                <Select id={`${id}-${f.name}`} name={f.name} defaultValue={params[f.name] ?? ""}>
                  <option value="">{f.allLabel ?? "All"}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          ))}
          {dates && (
            <DateRangeFields
              idPrefix={id}
              fromLabel={dates.fromLabel}
              toLabel={dates.toLabel}
              defaultFrom={params.from}
              defaultTo={params.to}
              className="min-w-0 flex-[1_1_10rem]"
            />
          )}
          {/* Keep the current sort when filters change; page resets to 1. */}
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          {params.dir && <input type="hidden" name="dir" value={params.dir} />}
          <div className="ml-auto flex items-center gap-2">
            {active > 0 && (
              <Link href={pathname as Route} className={buttonClasses({ variant: "ghost", size: "md" })}>
                Clear ({active})
              </Link>
            )}
            <Button type="submit">Apply</Button>
          </div>
        </div>
      </form>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {total === 0 ? "No results" : `Showing ${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)}`}
      </p>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  field: string;
  /** Current sort field and explicit direction from the URL. */
  sort: string;
  dir?: SortDir;
  /** Direction used when this column is first selected (and when no `dir` is in the URL). */
  defaultDir?: SortDir;
  pathname: string;
  params: Record<string, string>;
  className?: string;
}

/** Column header that sorts the listing; announces the sort state via aria-sort. */
export function SortHeader({ label, field, sort, dir, defaultDir = "asc", pathname, params, className }: SortHeaderProps) {
  const isActive = sort === field;
  const current = isActive ? (dir ?? defaultDir) : undefined;
  const next = isActive ? (current === "asc" ? "desc" : "asc") : defaultDir;
  const href = listHref(pathname, params, { sort: field, dir: next, page: undefined }) as Route;

  return (
    <th scope="col" aria-sort={current === "asc" ? "ascending" : current === "desc" ? "descending" : undefined} className={className}>
      <Link href={href} className={cx("inline-flex items-center gap-1 hover:text-foreground", isActive && "text-foreground")}>
        {label}
        <span className="sr-only">, sort {next === "asc" ? "ascending" : "descending"}</span>
        <Icon
          name={current === "desc" ? "arrowDown" : "arrowUp"}
          className={cx("size-3.5", isActive ? "opacity-100" : "opacity-30")}
        />
      </Link>
    </th>
  );
}
