import type { Metadata } from "next";
import Link from "next/link";
import { QuotationStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { flatParams, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: PageProps<"/account/quotations">) {
  const sp = await searchParams;
  const result = await repositories.quotations.list({ customerId: await getPortalCustomerId(), page: Number(param(sp, "page")) || 1, perPage: 15 });
  return (
    <>
      <PageHeader title="Quotations" description="Ask for prices on larger or regular orders." actions={<ButtonLink href="/account/quotations/new"><Icon name="plus" className="size-4" /> Request a quotation</ButtonLink>} />
      {result.items.length ? (
        <Table caption="Your quotations">
          <thead><tr><th scope="col">Number</th><th scope="col">Status</th><th scope="col">Products</th><th scope="col">Requested</th></tr></thead>
          <tbody>
            {result.items.map((q) => (
              <tr key={q.id}>
                <td><Link href={`/account/quotations/${q.id}`} className="font-medium text-brand hover:underline">{q.number}</Link></td>
                <td><QuotationStatusBadge status={q.status} /></td>
                <td>{q.items.length}</td>
                <td className="whitespace-nowrap">{formatDateTime(q.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <EmptyState title="No quotations yet" description="Request one to get a price on specific products and quantities." />}
      <div className="mt-6"><Pagination page={result.page} totalPages={result.totalPages} pathname="/account/quotations" searchParams={flatParams(sp)} /></div>
    </>
  );
}
