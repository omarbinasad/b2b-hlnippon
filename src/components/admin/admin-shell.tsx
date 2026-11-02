import Link from "next/link";
import type { ReactNode } from "react";
import { NavLink } from "@/components/layout/nav-link";
import { Icon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { adminNav } from "@/config/site";
import { SidebarToggle } from "./sidebar-toggle";

/*
 * Admin frame. Large screens: dark green sidebar that collapses to an icon rail
 * (`lg:sidebar-collapsed:*` classes, driven by <html data-sidebar>). Phones: the
 * sidebar becomes a top bar with a horizontally scrollable navigation strip.
 */

const SIDEBAR_ID = "admin-sidebar";
const hideWhenCollapsed = "lg:sidebar-collapsed:sr-only";

export function AdminShell({ banner, children }: { banner?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside
        id={SIDEBAR_ID}
        className="flex flex-col bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:transition-[width] lg:sidebar-collapsed:w-[4.5rem]"
      >
        <div className="flex h-14 items-center gap-3 px-4 lg:h-20 lg:px-5 lg:sidebar-collapsed:justify-center lg:sidebar-collapsed:px-0">
          <Logo href="/admin" inverse size="sm" nameClassName={hideWhenCollapsed} markOnlyClassName="lg:sidebar-collapsed:w-10" />
          <span className="rounded-full bg-sidebar-active px-2 py-0.5 text-xs font-medium text-sidebar-active-foreground lg:sidebar-collapsed:hidden">
            Admin
          </span>
          <Link href="/" className="ml-auto text-sm font-medium text-sidebar-active-foreground underline-offset-4 hover:underline lg:hidden">
            Store
          </Link>
        </div>

        <nav aria-label="Admin" className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <ul className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
            {adminNav.map((item) => (
              <li key={item.href} className="shrink-0">
                <NavLink
                  href={item.href}
                  exact={item.href === "/admin"}
                  except={adminNav.filter((o) => o.href.startsWith(`${item.href}/`)).map((o) => o.href)}
                  title={item.label}
                  className="flex items-center gap-3 rounded-ui px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground lg:py-2.5 lg:sidebar-collapsed:justify-center"
                  activeClassName="bg-sidebar-active !text-sidebar-active-foreground"
                >
                  {item.icon && <Icon name={item.icon} className="size-5 shrink-0" />}
                  <span className={hideWhenCollapsed}>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden space-y-1 border-t border-sidebar-active px-3 py-3 lg:block">
          <Link
            href="/"
            title="Back to store"
            className="flex items-center gap-3 rounded-ui px-3 py-2.5 text-sm font-medium hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground lg:sidebar-collapsed:justify-center"
          >
            <Icon name="store" className="size-5 shrink-0" />
            <span className={hideWhenCollapsed}>Back to store</span>
          </Link>
          <SidebarToggle controls={SIDEBAR_ID} />
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        {banner && <div className="mb-5">{banner}</div>}
        {children}
      </main>
    </div>
  );
}
