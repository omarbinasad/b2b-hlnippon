import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice } from "@/components/admin/demo-notice";
import { AccountStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { accountStatusLabels } from "@/lib/customers/status";
import { cx } from "@/lib/cx";
import { repositories } from "@/lib/data";
import type { CustomerSortField } from "@/lib/data/repositories";
import { accountStatuses, accountStatusOptions } from "@/lib/enums";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { flatParams, listHref, listState, oneOf, param } from "@/lib/list-params";
import { JP_PREFECTURES } from "@/lib/locations";

export const metadata: Metadata = { title: "Customers" };

const PATH = "/admin/customers";
const SORTS = ["company", "registered", "status", "group", "orders", "spend"] as const satisfies readonly CustomerSortField[];

export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "company");
  const [groups, counts] = await Promise.all([repositories.customers.listGroups(), repositories.customers.statusCounts()]);
  const orders = param(sp, "orders");
  const filters = {
    status: oneOf(param(sp, "status"), accountStatuses),
    groupId: oneOf(param(sp, "group"), groups.map((g) => g.id)),
    prefecture: oneOf(param(sp, "prefecture"), JP_PREFECTURES),
    hasOrders: orders === "yes" ? true : orders === "none" ? false : undefined,
  };
  const customers = await repositories.customers.list({ ...state, ...filters, perPage: 20 });
  const { notice, ...params } = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };
  const filtered = Object.values(filters).some((v) => v !== undefined) || state.search || param(sp, "from") || param(sp, "to");

  return (
    <>
      <PageHeader
        title="Customers"
        description="Business accounts, approval status, groups and order history."
        actions={
          <ButtonLink href="/admin/customers/new">
            <Icon name="plus" className="size-4" /> Add customer
          </ButtonLink>
        }
      />
      <ActionNotice notice={notice} />
      {counts.pending > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-ui border border-warning bg-warning-soft px-4 py-3 text-sm">
          <p>
            <strong>{counts.pending} registration request{counts.pending === 1 ? "" : "s"}</strong> waiting for approval.
          </p>
          <ButtonLink href="/admin/customers/requests" size="sm">Review requests</ButtonLink>
        </div>
      )}

      <nav aria-label="Filter by approval status" className="mb-4 flex flex-wrap gap-2">
        {accountStatuses.map((s) => {
          const active = filters.status === s;
          return (
            <Link
              key={s}
              href={listHref(PATH, params, { status: active ? undefined : s, page: undefined }) as `/admin/customers`}
              aria-current={active ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                active ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-surface-muted",
              )}
            >
              {accountStatusLabels[s]}
              <span className="font-semibold tabular-nums">{counts[s]}</span>
            </Link>
          );
        })}
      </nav>

      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search customers"
        searchPlaceholder="Business, contact, email, phone or legacy ID"
        filters={[
          { name: "status", label: "Approval", options: accountStatusOptions, allLabel: "All statuses" },
          { name: "group", label: "Group", options: groups.map((g) => ({ value: g.id, label: g.name })), allLabel: "All groups" },
          { name: "prefecture", label: "Prefecture", options: JP_PREFECTURES.map((d) => ({ value: d, label: d })), allLabel: "All prefectures" },
          { name: "orders", label: "Orders", options: [{ value: "yes", label: "Has orders" }, { value: "none", label: "No orders yet" }], allLabel: "Any" },
        ]}
        dates={{ fromLabel: "Registered from", toLabel: "Registered to" }}
        total={customers.total}
        page={customers.page}
        perPage={customers.perPage}
      />
      <div className="space-y-6">
        {customers.items.length ? (
          <Table caption="Customers">
            <thead>
              <tr>
                <SortHeader label="Customer" field="company" {...sorting} />
                <th scope="col">Contact</th>
                <th scope="col">Location</th>
                <SortHeader label="Group" field="group" {...sorting} />
                <SortHeader label="Approval" field="status" {...sorting} />
                <SortHeader label="Orders" field="orders" defaultDir="desc" className="text-right" {...sorting} />
                <SortHeader label="Total spend" field="spend" defaultDir="desc" className="text-right" {...sorting} />
                <SortHeader label="Registered" field="registered" defaultDir="desc" {...sorting} />
              </tr>
            </thead>
            <tbody>
              {customers.items.map((c) => {
                const place = c.addresses.find((a) => a.isDefault) ?? c.addresses[0];
                return (
                  <tr key={c.id}>
                    <td className="min-w-44">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-brand hover:underline">{c.companyName}</Link>
                      <span className="block text-xs text-muted">
                        {[c.businessType, c.legacyWooId && `legacy #${c.legacyWooId}`].filter(Boolean).join(" · ") || "Details incomplete"}
                      </span>
                    </td>
                    <td className="min-w-40">
                      {c.contactName ?? <span className="text-muted">—</span>}
                      <span className="block text-xs break-all text-muted">{c.phone ?? c.email}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      {place ? (
                        <>
                          {place.city}
                          <span className="block text-xs text-muted">{place.prefecture}</span>
                        </>
                      ) : (
                        <span className="text-muted">No address</span>
                      )}
                    </td>
                    <td>{c.groupName ?? <span className="text-muted">—</span>}</td>
                    <td><AccountStatusBadge status={c.status} /></td>
                    <td className="text-right tabular-nums">
                      {c.orderCount > 0 ? (
                        <Link
                          href={`/admin/orders?customer=${c.id}`}
                          className="font-medium text-brand hover:underline"
                          title="View this customer's orders (cancelled orders are listed there too, but not counted here)"
                          aria-label={`View ${formatNumber(c.orderCount)} orders of ${c.companyName}`}
                        >
                          {formatNumber(c.orderCount)}
                        </Link>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">{c.orderCount ? formatMoney(c.totalSpend) : "—"}</td>
                    <td className="whitespace-nowrap">{formatDate(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : filtered ? (
          <EmptyState
            title="No customers match these filters"
            description="Try another search term, status, group or prefecture."
            action={<ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink>}
          />
        ) : (
          <EmptyState title="No customers yet" action={<ButtonLink href="/admin/customers/new">Add customer</ButtonLink>} />
        )}
        <Pagination page={customers.page} totalPages={customers.totalPages} pathname={PATH} searchParams={params} />
        <p className="text-xs text-muted">Orders and total spend count non-cancelled orders, after refunds.</p>
        <DemoEditingNotice />
      </div>
    </>
  );
}
