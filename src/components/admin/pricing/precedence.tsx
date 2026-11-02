/** The documented precedence, shown wherever rules are listed or tested. */
export function PricePrecedence({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="rounded-ui border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-medium">How the winning price rule is chosen</summary>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
        <li>
          Only <strong className="text-foreground">eligible</strong> rules count: enabled, within their dates, for an approved customer, matching the product, with a tier
          covering the quantity, and not producing a negative price.
        </li>
        <li><strong className="text-foreground">Customer-specific</strong> beats <strong className="text-foreground">customer group</strong>, which beats <strong className="text-foreground">all customers</strong>.</li>
        <li>Then the more specific target wins: <strong className="text-foreground">variation &gt; product &gt; category &gt; all products</strong>.</li>
        <li>Then the higher <strong className="text-foreground">priority</strong> number.</li>
        <li>Still tied? The older rule wins — shown as a <strong className="text-foreground">conflict</strong> so you can set priorities.</li>
      </ol>
      <p className="mt-3 text-muted">
        Exactly one rule applies to a line. Percentage and amount-off rules are calculated from the <strong className="text-foreground">regular price</strong>; a fixed-price rule uses its
        entered amount. The customer pays the <strong className="text-foreground">lower of the rule price and the active sale price</strong>; with no eligible rule,
        the sale price if there is one, otherwise the regular price. The two are compared, never combined — a B2B discount is never applied to a sale price.
      </p>
    </details>
  );
}

export function QuantityPrecedence() {
  return (
    <details className="rounded-ui border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-medium">How quantity limits are chosen</summary>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
        <li>The most specific enabled rule wins as a whole: <strong className="text-foreground">variation &gt; product &gt; category &gt; all products</strong>, then priority, then the older rule.</li>
        <li>An unset minimum means 1; an unset maximum means no limit. Without any rule: minimum 1, no maximum.</li>
        <li>
          Limits apply to <strong className="text-foreground">each order line</strong>. A category rule limits every product in it separately — never the combined category quantity.
        </li>
        <li>Pack multiples (“order in steps of 2”) stay a product setting and are not part of these rules.</li>
      </ul>
    </details>
  );
}
