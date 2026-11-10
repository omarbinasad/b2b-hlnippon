"use client";

import type { Route } from "next";
import Link from "next/link";
import { createContext, useContext, useMemo, type ComponentProps, type ReactNode } from "react";
import { capabilityForPath } from "@/lib/auth/capabilities";

/*
 * The current role's capabilities, for hiding and disabling controls. This decides what the screen shows, nothing more:
 * every server action checks again, and the backend must check every call.
 */
const CapabilitiesContext = createContext<ReadonlySet<string>>(new Set());
const ViewOnlyContext = createContext(false);

export function CapabilitiesProvider({ capabilities, children }: { capabilities: string[]; children: ReactNode }) {
  const set = useMemo(() => new Set(capabilities), [capabilities]);
  return <CapabilitiesContext.Provider value={set}>{children}</CapabilitiesContext.Provider>;
}

/** `can("orders.view")`. Outside the admin nothing is allowed. */
export function useCan() {
  const set = useContext(CapabilitiesContext);
  return (capability: string) => set.has(capability);
}

/** True inside a page this role can read but not change. For controls a disabled fieldset can't reach, such as the rich editor. */
export const useViewOnly = () => useContext(ViewOnlyContext);

/** Shows its children only to a role with the capability. Works from Server Components: wrap the button, keep the page server-rendered. */
export function Can({ cap, children, fallback = null }: { cap: string; children: ReactNode; fallback?: ReactNode }) {
  return useCan()(cap) ? children : fallback;
}

/** A link to another module: plain text for a role that couldn't open it, so nobody is sent to Access denied. */
export function AllowedLink({ href, children, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const can = useCan();
  const needed = capabilityForPath(href);
  return !needed || can(needed) ? <Link href={href as Route} {...props}>{children}</Link> : <span>{children}</span>;
}

/** Shows its children as read-only to a role without the capability. For forms on a page that's otherwise open to them. */
export function WriteGuard({ cap, children }: { cap: string; children: ReactNode }) {
  return useCan()(cap) ? children : <ViewOnly>{children}</ViewOnly>;
}

/** Disables every control inside: inputs, buttons and the custom Select. Links and scrolling keep working. */
export function ViewOnly({ children }: { children: ReactNode }) {
  return (
    <ViewOnlyContext.Provider value>
      <fieldset disabled className="contents">{children}</fieldset>
    </ViewOnlyContext.Provider>
  );
}
