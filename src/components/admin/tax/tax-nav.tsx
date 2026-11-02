import Link from "next/link";
import { cx } from "@/lib/cx";

const items = [
  { key: "settings", href: "/admin/tax", label: "Settings & rates" },
  { key: "preview", href: "/admin/tax/preview", label: "Tax preview" },
] as const;

export function TaxNav({ current }: { current: (typeof items)[number]["key"] }) {
  return (
    <nav aria-label="Tax" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line">
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
export function TaxRules({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="rounded-ui border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-medium">How rates are matched and tax is calculated</summary>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
        <li>Each line uses its tax class: the variation&apos;s class if it overrides the product, otherwise the product&apos;s. Exempt and non-taxable products are never taxed.</li>
        <li>
          For that class, the enabled rate with the most specific location wins: <strong className="text-foreground">postcode &gt; city &gt; prefecture &gt; country</strong> (the country rate is the fallback). No match → untaxed.
        </li>
        <li>One rate per line — rates never stack. Only one enabled rate is allowed per class and location.</li>
      </ol>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
        <li>Discounts come off before tax. Line amounts are rounded half-up to the minor unit.</li>
        <li>
          Tax is calculated once per applied rate on the combined amount at that rate, rounded half-up to the minor unit. Prices that exclude tax get <em>amount × rate</em> added; prices that include tax have <em>amount × rate ÷ (100 + rate)</em> extracted.
        </li>
        <li>Shipping is taxed only when enabled, at the rate matched for the chosen shipping class, using the same included/excluded setting.</li>
        <li>New orders keep a snapshot of the settings and matched rates; editing rates never changes existing orders.</li>
      </ul>
    </details>
  );
}
