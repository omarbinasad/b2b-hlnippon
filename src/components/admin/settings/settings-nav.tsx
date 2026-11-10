"use client";

import Link from "next/link";
import { useCan } from "@/components/admin/capabilities-context";
import { capabilityForPath } from "@/lib/auth/capabilities";
import { cx } from "@/lib/cx";

const items = [
  { key: "general", href: "/admin/settings", label: "General" },
  { key: "company", href: "/admin/settings/company", label: "Company & Branding" },
  { key: "invoices", href: "/admin/settings/invoices", label: "Invoices" },
  { key: "setup", href: "/admin/setup", label: "Setup wizard" },
] as const;

export function SettingsNav({ current }: { current: (typeof items)[number]["key"] }) {
  const can = useCan();
  return (
    <nav aria-label="Settings" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.filter((i) => can(capabilityForPath(i.href) ?? "")).map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === current ? "page" : undefined}
          className={cx(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap",
            i.key === current ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
