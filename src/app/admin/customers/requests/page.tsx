import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { RequestActions } from "@/components/admin/customers/request-actions";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { CustomerSortField } from "@/lib/data/repositories";
import { formatDateTime } from "@/lib/format";
import { flatParams, listState, oneOf, param } from "@/lib/list-params";
import { prefectureLabel } from "@/lib/locations";
import { DOCUMENT_KINDS } from "@/lib/validation/documents";

export const metadata: Metadata = { title: "Registration requests" };

const PATH = "/admin/customers/requests";
const SORTS = ["registered", "company"] as const satisfies readonly CustomerSortField[];
const STATUSES = ["pending", "rejected"] as const;

/** Wholesale account applications (from the registration form or added by staff) waiting for a decision. */
export default async function RegistrationRequestsPage({ searchParams }: PageProps<"/admin/customers/requests">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "registered");
  const status = oneOf(param(sp, "status"), STATUSES) ?? "pending";
  const [requests, counts] = await Promise.all([
    repositories.customers.list({ ...state, dir: state.dir ?? (state.sort === "registered" ? "desc" : "asc"), status, perPage: 20 }),
    repositories.customers.statusCounts(),
  ]);
  const params = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };

  return (
    <>
      <Link href="/admin/customers" className="text-sm text-muted hover:text-foreground">← All customers</Link>
      <PageHeader
        title="Registration requests"
        description={`Applications for a wholesale account. ${counts.pending} waiting for a decision. Approve to let the business see prices and order; decline with a reason.`}
      />
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search requests"
        searchPlaceholder="Business, contact, email or phone"
        filters={[{ name: "status", label: "Show", options: [{ value: "rejected", label: `Declined (${counts.rejected})` }], allLabel: `Waiting for a decision (${counts.pending})` }]}
        dates={{ fromLabel: "Applied from", toLabel: "Applied to" }}
        total={requests.total}
        page={requests.page}
        perPage={requests.perPage}
      />
      <div className="space-y-6">
        {requests.items.length ? (
          <Table caption="Registration requests">
            <thead>
              <tr>
                <SortHeader label="Business" field="company" {...sorting} />
                <th scope="col">Contact</th>
                <th scope="col">Location</th>
                <th scope="col">Documents</th>
                <SortHeader label="Applied" field="registered" defaultDir="desc" {...sorting} />
                <th scope="col" className="text-right">Decision</th>
              </tr>
            </thead>
            <tbody>
              {requests.items.map((c) => {
                const place = c.addresses.find((a) => a.isDefault) ?? c.addresses[0];
                const reason = c.statusHistory.findLast((e) => e.to === "rejected")?.reason;
                return (
                  <tr key={c.id} className="align-top">
                    <td className="min-w-44">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-brand hover:underline">{c.companyName}</Link>
                      <span className="block text-xs text-muted">{c.businessType ?? "Business type not given"}</span>
                      {status === "rejected" && reason && <span className="block text-xs text-danger">Declined: {reason}</span>}
                    </td>
                    <td className="min-w-44">
                      {c.contactName ?? <span className="text-muted">—</span>}
                      {c.email && <a href={`mailto:${c.email}`} className="block text-xs break-all text-brand hover:underline">{c.email}</a>}
                      {c.phone && <span className="block text-xs text-muted">{c.phone}</span>}
                    </td>
                    <td className="min-w-36">
                      {place ? (
                        <>
                          {place.city}
                          <span className="block text-xs text-muted">{prefectureLabel(place.prefecture)} · 〒{place.postalCode}</span>
                        </>
                      ) : (
                        <span className="text-muted">No address</span>
                      )}
                    </td>
                    <td className="min-w-40">
                      {c.documents?.length ? (
                        <ul className="space-y-0.5 text-xs">
                          {c.documents.map((d) => (
                            <li key={d.id}>
                              <a href={`/admin/customers/${c.id}/documents/${d.id}`} target="_blank" rel="noopener" className="text-brand hover:underline">
                                {DOCUMENT_KINDS[d.kind]}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted">None uploaded</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(c.createdAt)}</td>
                    <td className="min-w-52 text-right">
                      <RequestActions customerId={c.id} companyName={c.companyName} status={c.status} />
                      <Link href={`/admin/customers/${c.id}`} className="mt-1 inline-block text-xs text-muted hover:text-foreground hover:underline">View full details</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : status === "pending" && !state.search ? (
          <EmptyState title="No requests waiting" description="New applications from the registration form appear here." />
        ) : (
          <EmptyState title="No requests match" action={<ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink>} />
        )}
        <Pagination page={requests.page} totalPages={requests.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
