import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { flatParams, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Reminder campaigns" };

const PATH = "/admin/reminders";

export default async function RemindersPage({ searchParams }: PageProps<"/admin/reminders">) {
  const sp = await searchParams;
  const [result, routes] = await Promise.all([repositories.reminders.list({ search: param(sp, "q") || undefined, page: Number(param(sp, "page")) || 1, perPage: 20 }), repositories.delivery.listRoutes({ perPage: 100 })]);
  const routeName = (id: string) => routes.items.find((r) => r.id === id)?.name ?? "Schedule removed";
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Reminder campaigns" description="Remind customers in an area before its delivery day: one message if they have an order, another if they don't." actions={<Can cap="reminders.manage"><ButtonLink href="/admin/reminders/new"><Icon name="plus" className="size-4" /> Add campaign</ButtonLink></Can>} />
      <div className="mb-4"><Notice>Preview only. This demo never sends email; the backend runs reminders as a scheduled job.</Notice></div>
      <ListToolbar pathname={PATH} params={params} searchLabel="Search campaigns" searchPlaceholder="Campaign name" total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Reminder campaigns">
            <thead><tr><th scope="col">Campaign</th><th scope="col">Schedule</th><th scope="col">Sends</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id}>
                  <td className="min-w-48"><Link href={`/admin/reminders/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link></td>
                  <td>{routeName(c.deliveryRouteId)}</td>
                  <td className="whitespace-nowrap">{c.leadDays} day{c.leadDays === 1 ? "" : "s"} before, {c.sendTime}</td>
                  <td><Badge tone={c.enabled ? "success" : "neutral"}>{c.enabled ? "On" : "Off"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="No campaigns" />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
