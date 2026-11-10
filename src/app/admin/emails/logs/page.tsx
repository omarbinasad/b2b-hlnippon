import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import { RetryButton } from "@/components/admin/notify/forms";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { flatParams, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Email logs" };

const PATH = "/admin/emails/logs";

export default async function EmailLogsPage({ searchParams }: PageProps<"/admin/emails/logs">) {
  const sp = await searchParams;
  const [result, templates] = await Promise.all([
    repositories.emails.logs({ search: param(sp, "q") || undefined, status: oneOf(param(sp, "status"), ["simulated", "failed"] as const), page: Number(param(sp, "page")) || 1, perPage: 25 }),
    repositories.emails.templates(),
  ]);
  const nameOf = (key: string) => templates.find((t) => t.key === key)?.name ?? key;
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Email logs" description="What would have been sent since this demo server started." />
      <div className="mb-4"><Notice>Simulated: nothing left this server. The failed rows are samples showing how a failure and retry look.</Notice></div>
      <ListToolbar pathname={PATH} params={params} searchLabel="Search logs" searchPlaceholder="Recipient or subject" filters={[{ name: "status", label: "Status", options: [{ value: "simulated", label: "Simulated" }, { value: "failed", label: "Failed" }], allLabel: "All" }]} total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Email logs">
            <thead><tr><th scope="col">Recipient</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">When</th><th scope="col" className="text-right">Action</th></tr></thead>
            <tbody>
              {result.items.map((l) => (
                <tr key={l.id}>
                  <td className="break-all">{l.to}</td>
                  <td className="min-w-48">{l.subject}<span className="block text-xs text-muted">{nameOf(l.templateKey)}</span></td>
                  <td><Badge tone={l.status === "failed" ? "danger" : "info"}>{l.status === "failed" ? "Failed" : "Simulated"}</Badge>{l.error && <span className="block text-xs text-danger">{l.error}</span>}</td>
                  <td className="tabular-nums">{l.attempts}</td>
                  <td className="whitespace-nowrap">{formatDateTime(l.at)}</td>
                  <td className="text-right">{l.status === "failed" && <Can cap="emails.manage"><RetryButton id={l.id} /></Can>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="Nothing logged yet" />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
      </div>
    </>
  );
}
