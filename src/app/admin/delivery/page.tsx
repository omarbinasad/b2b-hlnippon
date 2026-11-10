import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { boolParam, flatParams, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Delivery schedules" };

const PATH = "/admin/delivery";
const DAY: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export default async function DeliverySchedulesPage({ searchParams }: PageProps<"/admin/delivery">) {
  const sp = await searchParams;
  const result = await repositories.delivery.listRoutes({ search: param(sp, "q") || undefined, active: boolParam(sp, "active"), page: Number(param(sp, "page")) || 1, perPage: 20 });
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Delivery schedules" description="Which days each area gets deliveries, and the order cut-off. Shipping charges are managed under Shipping." actions={<Can cap="delivery.manage"><ButtonLink href="/admin/delivery/new"><Icon name="plus" className="size-4" /> Add schedule</ButtonLink></Can>} />
      <ListToolbar pathname={PATH} params={params} searchLabel="Search schedules" searchPlaceholder="Name or area" filters={[{ name: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }], allLabel: "All" }]} total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Delivery schedules">
            <thead><tr><th scope="col">Schedule</th><th scope="col">Areas</th><th scope="col">Days</th><th scope="col">Cut-off</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {result.items.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap"><Link href={`/admin/delivery/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link></td>
                  <td className="min-w-48 text-sm">{r.areas.join(", ")}</td>
                  <td className="text-sm whitespace-nowrap">{r.deliveryDays.map((d) => DAY[d]).join(", ")}</td>
                  <td className="whitespace-nowrap">{r.cutoffTime}</td>
                  <td><Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="No schedules found" />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
