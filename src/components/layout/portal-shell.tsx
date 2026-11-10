import Link from "next/link";
import type { ReactNode } from "react";
import type { NavItem } from "@/config/site";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SectionNav } from "./section-nav";

interface PortalShellProps {
  area: string;
  home: "/account" | "/admin";
  nav: NavItem[];
  navLabel: string;
  /** Shown above the page content, e.g. a preview-mode notice. */
  banner?: ReactNode;
  userLabel: string;
  /** Icon links in the top bar, e.g. notifications and cart. */
  headerActions?: ReactNode;
  children: ReactNode;
}

/** Shared frame for the customer portal and admin: top bar + section navigation. */
export function PortalShell({ area, home, nav, navLabel, banner, userLabel, headerActions, children }: PortalShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo href={home} size="sm" />
          <span className="hidden rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted sm:inline">{area}</span>
          <div className="ml-auto flex items-center gap-1 text-sm sm:gap-2">
            <span className="mr-1 hidden max-w-48 truncate text-muted sm:inline">{userLabel}</span>
            {headerActions}
            <ThemeToggle />
            <Link href="/" className="ml-1 font-medium text-brand hover:underline">
              Store
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8 lg:py-8">
        <aside className="border-b border-line pb-3 lg:border-0 lg:pb-0">
          <SectionNav label={navLabel} items={nav} />
        </aside>
        <main id="main" className="min-w-0 pt-5 lg:pt-0">
          {banner && <div className="mb-5">{banner}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
