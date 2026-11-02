import type { NavItem } from "@/config/site";
import { NavLink } from "./nav-link";

/**
 * Area navigation for the portal and admin: a horizontally scrollable strip
 * on small screens, a vertical sidebar list from `lg` up.
 */
export function SectionNav({ label, items }: { label: string; items: NavItem[] }) {
  const root = items[0]?.href;
  return (
    <nav aria-label={label}>
      <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <NavLink
              href={item.href}
              exact={item.href === root}
              className="block rounded-ui px-3 py-2 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
              activeClassName="bg-brand-soft !text-brand"
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
