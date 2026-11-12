import { formatMoney } from "@/lib/format";
import { moneySummary } from "@/lib/orders/money-summary";
import type { Order } from "@/lib/types";

/**
 * Every money figure of an order, labelled so none is mistaken for another (rules in src/lib/orders/money-summary.ts).
 * Staff see everything; customers see what they owe, paid and are owed back.
 */
export function MoneySummary({ order, staff = false }: { order: Order; staff?: boolean }) {
  const s = moneySummary(order);
  const changed = s.change !== 0;
  const rows: { label: string; value: string; strong?: boolean; tone?: "danger" | "success"; hint?: string; show: boolean }[] = [
    { label: "Order total when placed", value: formatMoney(s.original), show: changed },
    { label: changed ? "Order total now" : "Order total", value: formatMoney(s.current), hint: changed ? `${s.change > 0 ? "+" : "−"}${formatMoney(Math.abs(s.change))} from changes after the order was placed` : undefined, show: true },
    { label: "Refunds recorded", value: `−${formatMoney(s.refundedRecorded)}`, hint: staff ? "Noted on the order. No money moved in this demo." : undefined, show: s.refundedRecorded > 0 },
    { label: "Refunds processed", value: `−${formatMoney(s.refundedProcessed)}`, hint: staff ? "Confirmed by the payment provider." : undefined, show: s.refundedProcessed > 0 },
    { label: "Owed for this order", value: formatMoney(s.owed), show: s.refundedRecorded + s.refundedProcessed > 0 },
    { label: "Received", value: formatMoney(s.received), hint: s.collected ? undefined : "No payment recorded yet.", show: true },
    { label: "Outstanding", value: formatMoney(s.outstanding), strong: true, tone: s.outstanding > 0 ? "danger" : undefined, show: true },
    { label: "Overpaid", value: formatMoney(s.overpaid), show: s.overpaid > 0 },
    { label: "Refund due", value: formatMoney(s.refundDue), strong: true, tone: "success", hint: staff ? "Paid above the current total and not yet refunded." : "We owe you this amount.", show: s.refundDue > 0 },
    { label: "Invoice total", value: s.invoiceTotal !== undefined ? formatMoney(s.invoiceTotal) : "", hint: staff ? "The latest invoice or revision." : undefined, show: staff && s.invoiceTotal !== undefined },
    { label: "Credit notes", value: `−${formatMoney(s.creditNotes)}`, hint: "Credit on paper: it lowers what's owed but doesn't return money.", show: s.creditNotes > 0 },
  ];
  return (
    <section aria-label="Money summary" className="rounded-ui border border-line p-3">
      <h3 className="text-sm font-medium">Money summary</h3>
      <dl className="mt-2 space-y-1.5 text-sm">
        {rows.filter((r) => r.show).map((r) => (
          <div key={r.label}>
            <div className="flex justify-between gap-4">
              <dt className={r.strong ? "font-medium" : "text-muted"}>{r.label}</dt>
              <dd className={`tabular-nums ${r.strong ? "font-semibold" : ""} ${r.tone === "danger" ? "text-danger" : r.tone === "success" ? "text-success" : ""}`}>{r.value}</dd>
            </div>
            {r.hint && <p className="text-xs text-muted">{r.hint}</p>}
          </div>
        ))}
      </dl>
    </section>
  );
}
