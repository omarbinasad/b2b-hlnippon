import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PriceRange } from "@/components/shop/price-range";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import type { CategoryNode } from "@/lib/catalog/category-tree";
import { cx } from "@/lib/cx";
import { stockOptions } from "@/lib/enums";
import type { BrandFacet, Money, StockStatus } from "@/lib/types";

/** Current shop filters, parsed and validated from the URL by the shop page. */
export interface ShopFilters {
  q?: string;
  category?: string;
  brands: string[];
  stock?: StockStatus;
  min?: number;
  max?: number;
  order: string;
}

export type PriceAccess = "approved" | "pending" | "guest" | "admin";
export type ShopHref = (change: Partial<ShopFilters>) => Route;
export interface SidebarCategory extends CategoryNode {
  icon: IconName;
}

/** Brands shown before "Show more". */
const BRANDS_VISIBLE = 8;

const contains = (node: CategoryNode, slug?: string): boolean => !!slug && (node.slug === slug || node.children.some((c) => contains(c, slug)));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-ui border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Check / radio look for filter links (state is also exposed via aria-current). */
function Mark({ on, round = false }: { on: boolean; round?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-4 shrink-0 place-items-center border",
        round ? "rounded-full" : "rounded",
        on ? "border-brand bg-brand text-brand-contrast" : "border-line bg-surface",
      )}
    >
      {on && (round ? <span className="size-1.5 rounded-full bg-brand-contrast" /> : <Icon name="check" className="size-3" />)}
    </span>
  );
}

const linkRow = "flex items-center gap-2 rounded-ui px-2 py-1.5 text-sm hover:bg-surface-muted";

function CategoryBranch({ nodes, active, href }: { nodes: CategoryNode[]; active?: string; href: ShopHref }) {
  return (
    <ul className="ml-3 border-l border-line pl-2">
      {nodes.map((c) => (
        <li key={c.slug}>
          <Link
            href={href({ category: c.slug })}
            aria-current={c.slug === active ? "true" : undefined}
            className={cx(linkRow, c.slug === active ? "font-semibold text-brand" : "text-muted hover:text-foreground")}
          >
            {c.name}
          </Link>
          {c.children.length > 0 && <CategoryBranch nodes={c.children} active={active} href={href} />}
        </li>
      ))}
    </ul>
  );
}

function Categories({ tree, active, href }: { tree: SidebarCategory[]; active?: string; href: ShopHref }) {
  return (
    <ul className="space-y-0.5">
      <li>
        <Link href={href({ category: undefined })} aria-current={!active ? "true" : undefined} className={cx(linkRow, !active && "font-semibold text-brand")}>
          <Icon name="store" className="size-4 shrink-0 text-brand" />
          All products
        </Link>
      </li>
      {tree.map((c) => {
        const isActive = c.slug === active;
        const label = (
          <>
            <Icon name={c.icon} className="size-4 shrink-0 text-brand" />
            <span className={cx("min-w-0 flex-1", isActive && "font-semibold text-brand")}>{c.name}</span>
          </>
        );
        return (
          <li key={c.slug}>
            {c.children.length === 0 ? (
              <Link href={href({ category: c.slug })} aria-current={isActive ? "true" : undefined} className={linkRow}>
                {label}
              </Link>
            ) : (
              // Opened automatically when the active category is inside this branch.
              <details className="group/cat" open={contains(c, active) || undefined}>
                <summary className={cx(linkRow, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
                  {label}
                  <Icon name="chevronDown" className="size-4 text-muted transition-transform group-open/cat:rotate-180" />
                </summary>
                <Link
                  href={href({ category: c.slug })}
                  aria-current={isActive ? "true" : undefined}
                  className={cx(linkRow, "ml-3 font-medium", isActive ? "text-brand" : "text-muted hover:text-foreground")}
                >
                  All {c.name}
                </Link>
                <CategoryBranch nodes={c.children} active={active} href={href} />
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Brands({ brands, selected, href }: { brands: BrandFacet[]; selected: string[]; href: ShopHref }) {
  if (brands.length === 0) return <p className="text-sm text-muted">No brands yet.</p>;
  const toggle = (slug: string) => (selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  const row = (b: BrandFacet) => {
    const on = selected.includes(b.slug);
    return (
      <li key={b.slug}>
        <Link href={href({ brands: toggle(b.slug) })} aria-current={on ? "true" : undefined} className={linkRow}>
          <Mark on={on} />
          <span className="min-w-0 flex-1 truncate">{b.name}</span>
          <span className="text-xs text-muted tabular-nums">{b.productCount}</span>
        </Link>
      </li>
    );
  };
  const first = brands.slice(0, BRANDS_VISIBLE);
  const rest = brands.slice(BRANDS_VISIBLE);
  return (
    <>
      <ul className="space-y-0.5">{first.map(row)}</ul>
      {rest.length > 0 && (
        <details className="group/brands" open={rest.some((b) => selected.includes(b.slug)) || undefined}>
          <summary className="mt-1 cursor-pointer list-none px-2 py-1 text-sm font-medium text-brand [&::-webkit-details-marker]:hidden">
            <span className="group-open/brands:hidden">Show {rest.length} more</span>
            <span className="hidden group-open/brands:inline">Show fewer</span>
          </summary>
          <ul className="space-y-0.5">{rest.map(row)}</ul>
        </details>
      )}
      {selected.length > 0 && (
        <Link href={href({ brands: [] })} className="mt-2 inline-block px-2 text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
          Clear brands
        </Link>
      )}
    </>
  );
}

function Stock({ value, href }: { value?: StockStatus; href: ShopHref }) {
  const options = [{ value: undefined, label: "Any availability" }, ...stockOptions.map((o) => ({ value: o.value as StockStatus, label: o.label }))];
  return (
    <ul className="space-y-0.5">
      {options.map((o) => (
        <li key={o.label}>
          <Link href={href({ stock: o.value })} aria-current={o.value === value ? "true" : undefined} className={linkRow}>
            <Mark on={o.value === value} round />
            {o.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const PRICE_NOTE: Record<Exclude<PriceAccess, "approved">, string> = {
  guest: "Log in with an approved business account to filter by your wholesale price.",
  pending: "Price filtering is available once your business account is approved.",
  admin: "Admin preview: price filtering uses an approved customer's own prices.",
};

/** Customer price filter (slider in a GET form). Never rendered as usable for guests. */
function Price({ access, filters, bounds, href }: { access: PriceAccess; filters: ShopFilters; bounds?: { min: Money; max: Money } | null; href: ShopHref }) {
  if (access !== "approved" && access !== "admin") {
    return (
      <p className="flex gap-2 text-sm text-muted">
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        <span>
          {PRICE_NOTE[access]}
          {access === "guest" && (
            <>
              {" "}
              <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">Log in</Link>
            </>
          )}
        </span>
      </p>
    );
  }
  if (!bounds) return <p className="text-sm text-muted">No prices are available for your account yet.</p>;
  const keep = { q: filters.q, category: filters.category, brand: filters.brands.join(",") || undefined, stock: filters.stock, order: filters.order === "name" ? undefined : filters.order };
  return (
    <form action="/shop" className="space-y-3">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {/* Keyed so the handles follow the URL after Apply, Clear or removing the filter chip. */}
      <PriceRange key={`${filters.min}-${filters.max}`} bounds={bounds} min={filters.min} max={filters.max} />
      <p className="text-xs text-muted">{access === "admin" ? "Standard wholesale price per unit (staff view). Products without a price are not included." : "Your price per unit. Products without a price for your account are not included."}</p>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">Apply</Button>
        {(filters.min !== undefined || filters.max !== undefined) && (
          <Link href={href({ min: undefined, max: undefined })} className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">Clear</Link>
        )}
      </div>
    </form>
  );
}

/** Left filter bar of the shop page: price, availability, categories and brands. */
export function FilterSidebar(props: {
  tree: SidebarCategory[];
  brands: BrandFacet[];
  filters: ShopFilters;
  priceAccess: PriceAccess;
  href: ShopHref;
  /** The approved customer's price range, for the price slider. */
  priceBounds?: { min: Money; max: Money } | null;
}) {
  const { tree, brands, filters, priceAccess, href, priceBounds } = props;
  return (
    <div className="space-y-4">
      <Section title="Price">
        <Price access={priceAccess} filters={filters} bounds={priceBounds} href={href} />
      </Section>
      <Section title="Availability">
        <Stock value={filters.stock} href={href} />
      </Section>
      <Section title="Categories">
        <Categories tree={tree} active={filters.category} href={href} />
      </Section>
      <Section title="Brands">
        <Brands brands={brands} selected={filters.brands} href={href} />
      </Section>
    </div>
  );
}
