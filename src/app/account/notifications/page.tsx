import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { notificationKinds, options } from "@/lib/enums";
import { formatDateTime, humanize } from "@/lib/format";
import { flatParams, listState, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Notifications" };

const PATH = "/account/notifications";

export default async function NotificationsPage({ searchParams }: PageProps<"/account/notifications">) {
  const sp = await searchParams;
  const state = listState(sp, ["date"] as const, "date");
  const notifications = await repositories.customers.listNotifications(await getPortalCustomerId(), {
    ...state,
    kind: oneOf(param(sp, "kind"), notificationKinds),
    unreadOnly: param(sp, "show") === "unread",
  });
  const params = flatParams(sp);

  return (
    <>
      <PageHeader title="Notifications" description="Order updates, delivery notices and reminders." />
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search notifications"
        searchPlaceholder="Title or message"
        filters={[
          { name: "kind", label: "Type", options: options(notificationKinds), allLabel: "All types" },
          { name: "show", label: "Show", options: [{ value: "unread", label: "Unread only" }], allLabel: "Read and unread" },
        ]}
        total={notifications.total}
        page={notifications.page}
        perPage={notifications.perPage}
      />
      {notifications.items.length ? (
        <ul className="divide-y divide-line rounded-ui border border-line bg-surface">
          {notifications.items.map((n) => (
            <li key={n.id} className="flex gap-3 p-4">
              <span
                aria-hidden
                className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  <Badge>{humanize(n.kind)}</Badge>
                  {!n.readAt && <span className="sr-only">(unread)</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No notifications found" description="Try a different search or filter." />
      )}
      <Pagination page={notifications.page} totalPages={notifications.totalPages} pathname={PATH} searchParams={params} />
    </>
  );
}
