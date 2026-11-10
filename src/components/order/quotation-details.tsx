import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { formatCalendarDate, formatDateTime, formatMoney } from "@/lib/format";
import { sumMoney } from "@/lib/orders/calc";
import type { Quotation } from "@/lib/types";
import { quotationStatus } from "@/components/ui/badge";

/** Quotation lines, notes and history, shared by the customer and staff pages. */
export function QuotationDetails({ quotation: q }: { quotation: Quotation }) {
  const priced = q.items.every((i) => i.quotedUnitPrice !== undefined);
  return (
    <div className="space-y-6">
      <Table caption="Products">
        <thead><tr><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col" className="text-right">Unit price</th><th scope="col" className="text-right">Line total</th></tr></thead>
        <tbody>
          {q.items.map((i) => (
            <tr key={i.id}>
              <td className="min-w-52"><span className="font-medium">{i.name}</span>{i.optionLabel && <span className="block text-xs text-muted">{i.optionLabel}</span>}<span className="block text-xs text-muted">{i.sku}</span></td>
              <td>{i.quantity}</td>
              <td className="text-right whitespace-nowrap">{i.quotedUnitPrice !== undefined ? formatMoney(i.quotedUnitPrice) : <span className="text-muted">—</span>}</td>
              <td className="text-right whitespace-nowrap">{i.quotedUnitPrice !== undefined ? formatMoney(i.quotedUnitPrice * i.quantity) : <span className="text-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
        {priced && (
          <tfoot><tr><th scope="row" colSpan={3} className="text-right">Items total (excludes tax and delivery)</th><td className="text-right font-semibold whitespace-nowrap">{formatMoney(sumMoney(q.items.map((i) => (i.quotedUnitPrice ?? 0) * i.quantity)))}</td></tr></tfoot>
        )}
      </Table>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Notes">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted">From the customer</dt><dd className="whitespace-pre-line">{q.customerNote ?? "None"}</dd></div>
            <div><dt className="text-muted">From our team</dt><dd className="whitespace-pre-line">{q.staffNote ?? "None"}</dd></div>
            {q.validUntil && <div><dt className="text-muted">Valid until</dt><dd>{formatCalendarDate(q.validUntil)}</dd></div>}
          </dl>
        </Card>
        <Card title="History">
          <ol className="space-y-2 text-sm">
            {q.history.map((h) => <li key={h.id}><span className="font-medium">{quotationStatus[h.status].label}</span> <span className="text-xs text-muted">{formatDateTime(h.at)} · {h.byName}</span>{h.note && <span className="block text-xs text-muted">{h.note}</span>}</li>)}
          </ol>
        </Card>
      </div>
    </div>
  );
}
