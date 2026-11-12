"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/** A phone-menu item is the current page when the address starts with `match`, unless it starts with `exclude`. */
export function isCurrentPath(path: string, match: string, exclude?: string) {
  const within = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  return within(match) && !(exclude && within(exclude));
}

/** Text colour of a phone-menu item; the colour change runs with the sliding highlight. */
export const bottomNavItem = (current: boolean) =>
  cx("relative z-10 flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium transition-colors duration-300", current ? "text-brand" : "text-muted hover:text-foreground");

/** One item of the phone menu. */
export function BottomNavLink({ href, icon, label, match, exclude }: { href: Route; icon: IconName; label: string; match: string; exclude?: string }) {
  const current = isCurrentPath(usePathname(), match, exclude);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={bottomNavItem(current)}>
      <Icon name={icon} className={cx("size-6 transition-transform duration-300", current && "-translate-y-px scale-110")} />
      {label}
    </Link>
  );
}

/** Where the highlight last was, so a menu mounted by another layout can slide from there. */
let lastIndex = -1;

/**
 * The highlight behind the current phone-menu item. It slides to the new item and fades its colour in when the page
 * changes, and hides when no item matches. `items` are the menu's items in order, as `match`/`exclude` pairs.
 * The store and the customer portal each have their own menu, so moving between them mounts a new one: it remembers
 * the last position (in this browser tab only) and slides from there.
 */
export function BottomNavIndicator({ items }: { items: { match: string; exclude?: string }[] }) {
  const path = usePathname();
  const index = items.findIndex((i) => isCurrentPath(path, i.match, i.exclude));
  const shown = index >= 0;
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const from = lastIndex;
    lastIndex = index;
    const el = ref.current;
    if (!el || from < 0 || index < 0 || from === index || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Only on mount (a menu from another layout): later moves use the CSS transition.
    if (el.dataset.mounted) return;
    el.animate([{ translate: `${from * 100}% 0` }, { translate: `${index * 100}% 0` }], { duration: 500, easing: "cubic-bezier(0.34,1.4,0.5,1)" });
  }, [index]);
  useEffect(() => {
    const el = ref.current;
    if (el) el.dataset.mounted = "1";
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full transition-[translate,background-color,opacity,scale] duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none",
        shown ? "scale-100 bg-brand-soft opacity-100" : "scale-75 bg-transparent opacity-0",
      )}
      style={{ width: `calc((100% - 0.75rem) / ${items.length})`, translate: `${Math.max(index, 0) * 100}% 0` }}
    />
  );
}
