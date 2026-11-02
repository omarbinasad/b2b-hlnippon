import Link from "next/link";
import { cx } from "@/lib/cx";

const items = [
  { key: "zones", href: "/admin/shipping", label: "Shipping zones" },
  { key: "preview", href: "/admin/shipping/preview", label: "Rate preview" },
  { key: "routes", href: "/admin/delivery", label: "Delivery routes" },
] as const;

export function ShippingNav({ current }: { current: (typeof items)[number]["key"] }) {
  return (
    <nav aria-label="Shipping" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line">
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

/** The documented matching and calculation rules. */
export function ShippingRules({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="rounded-ui border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-medium">How zones and rates are chosen</summary>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
        <li>A zone listing the address&apos;s <strong className="text-foreground">exact postcode</strong> wins.</li>
        <li>Otherwise a zone listing its <strong className="text-foreground">city</strong> (in that prefecture).</li>
        <li>Otherwise a zone listing its <strong className="text-foreground">prefecture</strong>.</li>
        <li>Otherwise the <strong className="text-foreground">fallback zone</strong>. A postcode, city or prefecture can be in one zone only, so each address gets exactly one zone.</li>
      </ol>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
        <li>Weight = each line&apos;s unit weight × quantity; a variation&apos;s own weight replaces the product&apos;s. Subtotal = items after line discounts, before tax.</li>
        <li>Tiers apply from their “from” value up to the next tier. Shipping-class adjustments add a fixed amount per order or per unit.</li>
        <li>The suggested method is the cheapest available delivery method in the zone. Local pickup is offered alongside, never chosen automatically.</li>
        <li>Orders keep the shipping amount they were saved with; changing rates never changes past orders.</li>
      </ul>
    </details>
  );
}
