import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { NavLink } from "@/components/layout/nav-link";
import { Icon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { adminNav, adminNavGroups } from "@/config/site";
import type { AdminNotificationFeed } from "@/lib/types";
import { LogoutButton } from "@/components/layout/logout-button";
import { canOpen } from "@/lib/auth/capabilities";
import { CapabilitiesProvider } from "./capabilities-context";
import { NotificationBell } from "./notification-bell";
import { RouteGuard } from "./route-guard";
import { SidebarToggle } from "./sidebar-toggle";

/*
 * Admin frame. Large screens: dark green sidebar that collapses to an icon rail
 * (`lg:sidebar-collapsed:*` classes, driven by <html data-sidebar>). Phones: the
 * sidebar becomes a top bar with a horizontally scrollable navigation strip.
 */

const SIDEBAR_ID = "admin-sidebar";
const hideWhenCollapsed = "lg:sidebar-collapsed:sr-only";

/** Count on a sidebar item; a small corner badge when the sidebar is collapsed to icons. */
function NavBadge({ count, label, href }: { count?: number; label?: string; href?: Route }) {
  if (!count || !href) return null;
  return (
    <Link
      href={href}
      title={`${count} ${label}`}
      className="absolute top-1/2 right-2 grid h-5 min-w-5 -translate-y-1/2 place-items-center rounded-full bg-cta-from px-1.5 text-[0.6875rem] leading-none font-semibold text-white tabular-nums hover:opacity-90 lg:sidebar-collapsed:top-1 lg:sidebar-collapsed:right-1 lg:sidebar-collapsed:translate-y-0"
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only"> {label}</span>
    </Link>
  );
}

const NOTIFICATION_CAPABILITY: Record<AdminNotificationFeed["items"][number]["kind"], string[]> = {
  order: ["orders.view"],
  registration: ["customer_approval.view"],
  low_stock: ["inventory.view", "products.view"],
  contact: ["customers.view"],
};

/** Only what this role works with. A link it can't open is dropped, not the notification. */
function notificationsFor(feed: AdminNotificationFeed, capabilities: string[]): AdminNotificationFeed {
  const items = feed.items
    .filter((n) => NOTIFICATION_CAPABILITY[n.kind].some((c) => capabilities.includes(c)))
    .map((n) => (n.href && !canOpen(capabilities, n.href) ? { ...n, href: undefined } : n));
  return { ...feed, items, total: items.length, unread: items.filter((n) => !n.read).length };
}

export function AdminShell({ banner, notifications, capabilities, roleName, preview, children }: { banner?: ReactNode; notifications: AdminNotificationFeed; capabilities: string[]; roleName: string; preview: ReactNode; children: ReactNode }) {
  const allowed = (href: string) => canOpen(capabilities, href) && (href !== "/admin/settings/invoices" || !canOpen(capabilities, "/admin/settings"));
  const groups = adminNavGroups.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.href)) })).filter((g) => g.items.length);
  const feed = notificationsFor(notifications, capabilities);
  // Work waiting in each section (like WooCommerce's order count). Handling the work lowers it.
  const badges: Partial<Record<string, { count: number; label: string; href: Route }>> = {
    "/admin/orders": { count: notifications.openOrders, label: "open orders", href: "/admin/orders?status=open" },
    "/admin/customers/requests": { count: notifications.pendingRegistrations, label: "pending requests", href: "/admin/customers/requests?status=pending" },
  };

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
          {/* Phones: one scrolling strip, headings hidden. Large screens: labelled groups. */}
          <div className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:overflow-visible lg:pb-0">
            {groups.map((group) => (
              <div key={group.label} className="contents lg:mb-3 lg:block lg:last:mb-0">
                <p className={`${hideWhenCollapsed} hidden px-3 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-wider uppercase opacity-60 lg:block`}>{group.label}</p>
                <ul className="contents lg:flex lg:flex-col lg:gap-1">
                  {group.items.map((item) => (
                    <li key={item.href} className="relative shrink-0">
                <NavLink
                  href={item.href}
                  exact={item.href === "/admin"}
                  except={adminNav.filter((o) => o.href.startsWith(`${item.href}/`)).map((o) => o.href)}
                  title={item.label}
                  className="relative flex items-center gap-3 rounded-ui px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground lg:py-2.5 lg:sidebar-collapsed:justify-center"
                  activeClassName="bg-sidebar-active !text-sidebar-active-foreground"
                >
                  {item.icon && <Icon name={item.icon} className="size-5 shrink-0" />}
                  {/* A long label wraps instead of pushing its badge out of the sidebar. */}
                  <span className={`${hideWhenCollapsed} min-w-0 lg:leading-tight lg:whitespace-normal ${badges[item.href]?.count ? "pr-7" : ""}`}>{item.label}</span>
                    </NavLink>
                    <NavBadge {...badges[item.href]} />
              </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="z-20 flex h-14 items-center justify-end gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:sticky lg:top-0 lg:px-8">
          <div className="mr-auto min-w-0">{preview}</div>
          <LogoutButton className="text-sm text-muted hover:text-foreground" />
          <NotificationBell feed={feed} />
        </div>
        <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {banner && <div className="mb-5">{banner}</div>}
          <CapabilitiesProvider capabilities={capabilities}>
            <RouteGuard capabilities={capabilities} roleName={roleName}>{children}</RouteGuard>
          </CapabilitiesProvider>
        </main>
      </div>
    </div>
  );
}
