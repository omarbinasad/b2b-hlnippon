import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { flatParams, param } from "@/lib/list-params";
import type { InvoiceKind } from "@/lib/types";

export const metadata: Metadata = { title: "Invoices" };

const PATH = "/account/invoices";
const KIND: Record<InvoiceKind, string> = { invoice: "Invoice", revision: "Revised invoice", credit_note: "Credit note" };

export default async function InvoicesPage({ searchParams }: PageProps<"/account/invoices">) {
  const sp = await searchParams;
  const result = await repositories.orders.listInvoices({ customerId: await getPortalCustomerId(), search: param(sp, "q") || undefined, page: Number(param(sp, "page")) || 1, perPage: 20 });
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Invoices" description="Invoices, revised invoices and credit notes for your orders." />
      <div className="mb-4"><Notice>You can view and print each document. Downloadable PDF files arrive with the backend.</Notice></div>
      <ListToolbar pathname={PATH} params={params} searchLabel="Search invoices" searchPlaceholder="Invoice or order number" total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Your invoices">
            <thead><tr><th scope="col">Number</th><th scope="col">Type</th><th scope="col">Order</th><th scope="col">Issued</th><th scope="col" className="text-right">Total</th><th scope="col" className="text-right">PDF</th></tr></thead>
            <tbody>
              {result.items.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/account/orders/${i.orderId}/invoice`} className="font-medium text-brand hover:underline">{i.number}</Link>{i.replaces && <span className="block text-xs text-muted">Replaces {i.replaces}</span>}</td>
                  <td><Badge tone={i.kind === "credit_note" ? "warning" : i.kind === "revision" ? "info" : "neutral"}>{KIND[i.kind]}</Badge></td>
                  <td><Link href={`/account/orders/${i.orderId}`} className="text-brand hover:underline">{i.orderNumber}</Link></td>
                  <td className="whitespace-nowrap">{formatDateTime(i.issuedAt)}</td>
                  <td className="text-right whitespace-nowrap">{formatMoney(i.total)}</td>
                  <td className="text-right"><span className="text-xs text-muted" title="The backend generates PDF files">Not available yet</span></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="No invoices yet" description="Documents appear here once we issue them." />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
      </div>
    </>
  );
}
