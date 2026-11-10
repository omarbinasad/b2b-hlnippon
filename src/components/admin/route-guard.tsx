"use client";

import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { adminNav } from "@/config/site";
import { canOpen, writeCapabilityForPath } from "@/lib/auth/capabilities";
import { permissionLabel } from "@/lib/auth/permission-catalog";
import { ViewOnly } from "./capabilities-context";

/**
 * Shows "Access denied" in place of a screen the role can't open, and shows form pages it may only read as disabled. This
 * is how the interface behaves, not protection: the backend must refuse the data itself.
 */
export function RouteGuard({ capabilities, roleName, children }: { capabilities: string[]; roleName: string; children: ReactNode }) {
  const pathname = usePathname();
  if (!canOpen(capabilities, pathname)) {
    const home = adminNav.find((item) => canOpen(capabilities, item.href));
    return (
      <div className="mx-auto max-w-lg rounded-ui border border-line bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted">The {roleName} role doesn&apos;t have permission to open this page. Ask an administrator if you need it.</p>
        {home && <ButtonLink href={home.href as Route} variant="secondary" className="mt-4">Go to {home.label}</ButtonLink>}
      </div>
    );
  }
  const write = writeCapabilityForPath(pathname);
  if (write && !capabilities.includes(write)) {
    return (
      <ViewOnly>
        <div className="mb-4"><Notice title="View only">The {roleName} role can see this page but can&apos;t change it. That needs the &quot;{permissionLabel(write)}&quot; permission.</Notice></div>
        {children}
      </ViewOnly>
    );
  }
  return children;
}
