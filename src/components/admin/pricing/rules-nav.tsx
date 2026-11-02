import Link from "next/link";
import { cx } from "@/lib/cx";

const items = [
  { key: "price", href: "/admin/pricing", label: "Pricing rules" },
  { key: "quantity", href: "/admin/pricing/quantity", label: "Quantity rules" },
  { key: "test", href: "/admin/pricing/test", label: "Test rules" },
] as const;

/** Keeps the two rule areas (and the test panel) clearly separated. */
export function RulesNav({ current }: { current: (typeof items)[number]["key"] }) {
  return (
    <nav aria-label="Rules" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
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
