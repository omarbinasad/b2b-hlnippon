"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/** One item of the phone menu. It's the current page when the address starts with `match`, unless it starts with `exclude`. */
export function BottomNavLink({ href, icon, label, match, exclude }: { href: Route; icon: IconName; label: string; match: string; exclude?: string }) {
  const path = usePathname();
  const within = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  const current = within(match) && !(exclude && within(exclude));
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cx("flex h-15 flex-col items-center justify-center gap-1 text-xs font-medium", current ? "text-brand" : "text-muted hover:text-foreground")}
    >
      <Icon name={icon} className="size-6" />
      {label}
    </Link>
  );
}
