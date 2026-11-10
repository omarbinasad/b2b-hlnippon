import type { Route } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import type { ResolvedMenuItem } from "@/lib/types";
import { NavLink } from "./nav-link";

const href = (item: ResolvedMenuItem) => item.href as Route;

/** Desktop header links. A parent opens its dropdown on hover and on keyboard focus. */
export function HeaderMenu({ items }: { items: ResolvedMenuItem[] }) {
  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => (
        <li key={item.id} className="group relative">
          <NavLink href={href(item)} className="inline-flex items-center gap-1 rounded-ui px-3 py-2 text-sm font-medium whitespace-nowrap text-muted hover:text-foreground" activeClassName="!text-brand">
            {item.label}
            {item.children.length > 0 && <Icon name="chevronDown" className="size-3.5" />}
          </NavLink>
          {item.children.length > 0 && <Dropdown items={item.children} />}
        </li>
      ))}
    </ul>
  );
}

function Dropdown({ items, nested = false }: { items: ResolvedMenuItem[]; nested?: boolean }) {
  return (
    <ul className={`absolute z-40 hidden min-w-52 rounded-ui border border-line bg-surface p-1 shadow-lg group-hover:block group-focus-within:block ${nested ? "top-0 left-full" : "top-full left-0"}`}>
      {items.map((child) => (
        <li key={child.id} className="group/sub relative">
          <Link href={href(child)} className="flex items-center justify-between gap-2 rounded-ui px-3 py-2 text-sm hover:bg-surface-muted">
            {child.label}
            {child.children.length > 0 && <Icon name="chevronRight" className="size-3.5" />}
          </Link>
          {child.children.length > 0 && (
            <ul className="absolute top-0 left-full z-40 hidden min-w-52 rounded-ui border border-line bg-surface p-1 shadow-lg group-hover/sub:block group-focus-within/sub:block">
              {child.children.map((c) => <li key={c.id}><Link href={href(c)} className="block rounded-ui px-3 py-2 text-sm hover:bg-surface-muted">{c.label}</Link></li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Mobile menu: nested levels are indented and always open. */
export function MobileMenuLinks({ items, level = 0 }: { items: ResolvedMenuItem[]; level?: number }) {
  return (
    <>
      {items.map((item) => (
        <li key={item.id}>
          <NavLink href={href(item)} className="block rounded-ui px-3 py-2 text-sm font-medium hover:bg-surface-muted" activeClassName="text-brand">
            {item.label}
          </NavLink>
          {item.children.length > 0 && <ul className={level < 2 ? "ml-3 border-l border-line pl-1" : undefined}><MobileMenuLinks items={item.children} level={level + 1} /></ul>}
        </li>
      ))}
    </>
  );
}
