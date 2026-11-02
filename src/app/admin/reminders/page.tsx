import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PlannedFeatures } from "@/components/ui/feedback";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { ReminderSortField } from "@/lib/data/repositories";
import { activeOptions, options, reminderChannels, reminderTypes } from "@/lib/enums";
import { formatDateTime, humanize } from "@/lib/format";
import { boolParam, flatParams, listState, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Reminders" };

const PATH = "/admin/reminders";
const SORTS = ["type", "lastSent"] as const satisfies readonly ReminderSortField[];

export default async function RemindersPage({ searchParams }: PageProps<"/admin/reminders">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "type");
  const reminders = await repositories.delivery.listReminders({
    ...state,
    type: oneOf(param(sp, "type"), reminderTypes),
    channel: oneOf(param(sp, "channel"), reminderChannels),
    active: boolParam(sp, "active"),
    perPage: 20,
  });
  const params = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };

  return (
    <>
      <PageHeader title="Reminders" description="Automated reorder, cutoff and payment reminders sent to customers." />
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search reminders"
        searchPlaceholder="Message or schedule"
        filters={[
          { name: "type", label: "Type", options: options(reminderTypes), allLabel: "All types" },
          { name: "channel", label: "Channel", options: options(reminderChannels), allLabel: "All channels" },
          { name: "active", label: "Status", options: activeOptions, allLabel: "Active and paused" },
        ]}
        total={reminders.total}
        page={reminders.page}
        perPage={reminders.perPage}
      />
      <div className="space-y-6">
        {reminders.items.length ? (
          <Table caption="Reminders">
            <thead>
              <tr>
                <SortHeader label="Type" field="type" {...sorting} />
                <th scope="col">Audience</th>
                <th scope="col">Schedule</th>
                <th scope="col">Status</th>
                <SortHeader label="Last sent" field="lastSent" defaultDir="desc" {...sorting} />
              </tr>
            </thead>
            <tbody>
              {reminders.items.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">
                    {humanize(r.type)}
                    <span className="block text-xs font-normal text-muted">{r.message}</span>
                  </td>
                  <td>{r.customerId ? "One customer" : r.deliveryRouteId ? "Delivery route" : "All customers"}</td>
                  <td>{r.schedule} · {humanize(r.channel)}</td>
                  <td><Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Paused"}</Badge></td>
                  <td className="whitespace-nowrap">{r.lastSentAt ? formatDateTime(r.lastSentAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No reminders match these filters" />
        )}
        <Pagination page={reminders.page} totalPages={reminders.totalPages} pathname={PATH} searchParams={params} />
        <PlannedFeatures items={["Create and edit reminders", "Message templates and previews", "Sending handled by the backend scheduler", "Send log"]} />
      </div>
    </>
  );
}
