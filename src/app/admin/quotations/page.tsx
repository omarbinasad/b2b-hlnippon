import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { QuotationStatusBadge, quotationStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { flatParams, oneOf, param } from "@/lib/list-params";
import type { QuotationStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Quotations" };

const PATH = "/admin/quotations";
const STATUSES = Object.keys(quotationStatus) as QuotationStatus[];

export default async function AdminQuotationsPage({ searchParams }: PageProps<"/admin/quotations">) {
  const sp = await searchParams;
  const result = await repositories.quotations.list({ status: oneOf(param(sp, "status"), STATUSES), search: param(sp, "q") || undefined, page: Number(param(sp, "page")) || 1, perPage: 20 });
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Quotations" description="Price requests from customers. Accepted quotes become orders." />
      <ListToolbar pathname={PATH} params={params} searchLabel="Search quotations" searchPlaceholder="Number or customer" filters={[{ name: "status", label: "Status", options: STATUSES.map((s) => ({ value: s, label: quotationStatus[s].label })), allLabel: "All" }]} total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Quotations">
            <thead><tr><th scope="col">Number</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Products</th><th scope="col">Requested</th></tr></thead>
            <tbody>
              {result.items.map((q) => (
                <tr key={q.id}>
                  <td><Link href={`/admin/quotations/${q.id}`} className="font-medium text-brand hover:underline">{q.number}</Link></td>
                  <td>{q.customerName}</td>
                  <td><QuotationStatusBadge status={q.status} /></td>
                  <td>{q.items.length}</td>
                  <td className="whitespace-nowrap">{formatDateTime(q.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="No quotations" description="Customers request them from their portal." />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
