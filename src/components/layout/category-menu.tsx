"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import type { CategoryNode } from "@/lib/catalog/category-tree";
import { cx } from "@/lib/cx";

/** Top-level category with its menu icon (chosen on the server from the storefront config). */
export interface MenuCategory extends CategoryNode {
  icon: IconName;
}

/** Many subcategories (e.g. by country) are shown in two columns. */
const TWO_COLUMNS_FROM = 12;
/** Delay before another top-level row takes over on hover, so moving the mouse diagonally into the sub-panel does not switch it. */
const HOVER_DELAY = 120;

const href = (slug: string) => `/shop?category=${slug}` as Route;
const row = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium";

/** Nested category links (any depth) inside the sub-panel. */
function Branch({ nodes, nested = false }: { nodes: CategoryNode[]; nested?: boolean }) {
  return (
    <ul className={nested ? "mb-1 ml-3 border-l border-line pl-2" : undefined}>
      {nodes.map((c) => (
        <li key={c.slug} className="break-inside-avoid">
          <Link href={href(c.slug)} className={cx("block rounded-ui px-3 py-2 text-sm hover:bg-surface-muted hover:text-brand", nested && "py-1.5 text-muted")}>
            {c.name}
          </Link>
          {c.children.length > 0 && <Branch nodes={c.children} nested />}
        </li>
      ))}
    </ul>
  );
}

/**
 * "All categories" menu: a panel of top-level categories (icon, name, arrow) and, beside it,
 * the subcategories of the active one. A row becomes active on hover, keyboard focus or
 * click/tap; its sub-panel follows it in the tab order. Closes on Escape, outside click and
 * navigation. Long lists scroll inside the panel.
 */
export function CategoryMenu({ categories }: { categories: MenuCategory[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setActive(null);
  }

  const close = () => {
    setOpen(false);
    setActive(null);
  };
  /** Hover: switch immediately when nothing is open, otherwise after a short delay. */
  const hover = (slug: string | null) => {
    clearTimeout(timer.current);
    if (active === null) setActive(slug);
    else timer.current = setTimeout(() => setActive(slug), HOVER_DELAY);
  };
  const hold = () => clearTimeout(timer.current);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex h-9 items-center gap-2 rounded-ui bg-brand px-3 text-sm font-semibold text-brand-contrast hover:bg-brand-hover"
      >
        <Icon name="menu" className="size-4" />
        All categories
        <Icon name="chevronDown" className={cx("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {/* Positioned wrapper: sub-panels are placed against it, so the scrolling list never clips them. */}
      <div id={panelId} hidden={!open} className="absolute top-full left-0 z-40 mt-2" onMouseLeave={() => hover(null)}>
        <div className="w-72 overflow-hidden rounded-ui border border-line bg-surface shadow-lg">
          <ul className="max-h-[min(70vh,40rem)] overflow-y-auto overscroll-contain">
            <li className="border-b border-line">
              <Link href="/shop" onMouseEnter={() => hover(null)} onFocus={() => setActive(null)} className={cx(row, "text-brand hover:bg-surface-muted")}>
                <Icon name="store" className="size-5 shrink-0" />
                All products
                <Icon name="arrowRight" className="ml-auto size-4" />
              </Link>
            </li>
            {categories.map((c) => {
              const isActive = active === c.slug;
              const subId = `${panelId}-${c.slug}`;
              return (
                <li key={c.slug} className="border-b border-line last:border-b-0">
                  {c.children.length === 0 ? (
                    <Link href={href(c.slug)} onMouseEnter={() => hover(null)} onFocus={() => setActive(null)} className={cx(row, "hover:bg-surface-muted hover:text-brand")}>
                      <Icon name={c.icon} className="size-5 shrink-0 text-brand" />
                      {c.name}
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-expanded={isActive}
                        aria-controls={subId}
                        onMouseEnter={() => hover(c.slug)}
                        onFocus={() => setActive(c.slug)}
                        // Tap / click opens (never toggles off — touch also fires a hover first).
                        onClick={() => setActive(c.slug)}
                        className={cx(row, isActive ? "bg-brand-soft text-brand" : "hover:bg-surface-muted")}
                      >
                        <Icon name={c.icon} className="size-5 shrink-0 text-brand" />
                        {c.name}
                        <Icon name="chevronRight" className="ml-auto size-4 text-muted" />
                      </button>
                      {isActive && (
                        <div
                          id={subId}
                          onMouseEnter={hold}
                          className={cx(
                            "absolute top-0 left-full ml-1 max-h-[min(70vh,40rem)] overflow-y-auto overscroll-contain rounded-ui border border-line bg-surface p-2 shadow-lg",
                            c.children.length >= TWO_COLUMNS_FROM ? "w-[28rem]" : "w-64",
                          )}
                        >
                          <Link href={href(c.slug)} className="mb-1 flex items-center gap-1 rounded-ui px-3 py-2 text-sm font-semibold text-brand hover:bg-surface-muted">
                            All {c.name} <Icon name="arrowRight" className="size-4" />
                          </Link>
                          <div className={c.children.length >= TWO_COLUMNS_FROM ? "columns-2 gap-2" : undefined}>
                            <Branch nodes={c.children} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
