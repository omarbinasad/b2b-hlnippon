import { Can, WriteGuard } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GroupForm } from "@/components/admin/customer-groups/group-form";
import { AddMembers, RemoveMember } from "@/components/admin/customer-groups/members";
import { ActionNotice, DemoEditingNotice, MockPermissionNote } from "@/components/admin/demo-notice";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { CustomerSortField } from "@/lib/data/repositories";
import { formatMoney, formatNumber } from "@/lib/format";
import { flatParams, listState } from "@/lib/list-params";

const SORTS = ["company", "orders", "spend", "status"] as const satisfies readonly CustomerSortField[];

export async function generateMetadata({ params }: PageProps<"/admin/customer-groups/[id]">): Promise<Metadata> {
  const g = await repositories.customers.getGroup((await params).id);
  return { title: g ? `Group: ${g.name}` : "Group not found" };
}

export default async function GroupPage({ params, searchParams }: PageProps<"/admin/customer-groups/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [group, groups] = await Promise.all([repositories.customers.getGroup(id), repositories.customers.listGroups()]);
  if (!group) notFound();
  const state = listState(sp, SORTS, "company");
  const members = await repositories.customers.list({ ...state, groupId: id, perPage: 20 });
  const path = `/admin/customer-groups/${id}`;
  const { notice, ...listParams } = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: path, params: listParams };

  return (
    <>
      <Link href="/admin/customer-groups" className="text-sm text-muted hover:text-foreground">← All groups</Link>
      <PageHeader title={group.name} description={`${formatNumber(group.customerCount)} member${group.customerCount === 1 ? "" : "s"} · group ID ${group.id}`} />
      <ActionNotice notice={notice} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Card title="Members">
            <Can cap="customers.edit"><AddMembers groupId={group.id} groupNames={Object.fromEntries(groups.map((g) => [g.id, g.name]))} /></Can>
          </Card>
          <ListToolbar
            pathname={path}
            params={listParams}
            searchLabel="Search members"
            searchPlaceholder="Business, contact, email or phone"
            total={members.total}
            page={members.page}
            perPage={members.perPage}
          />
          {members.items.length ? (
            <Table caption={`Members of ${group.name}`}>
              <thead>
                <tr>
                  <SortHeader label="Customer" field="company" {...sorting} />
                  <SortHeader label="Approval" field="status" {...sorting} />
                  <SortHeader label="Orders" field="orders" defaultDir="desc" className="text-right" {...sorting} />
                  <SortHeader label="Total spend" field="spend" defaultDir="desc" className="text-right" {...sorting} />
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {members.items.map((c) => (
                  <tr key={c.id}>
                    <td className="min-w-44">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-brand hover:underline">{c.companyName}</Link>
                      <span className="block text-xs text-muted">{c.addresses[0]?.city ?? "No address"}</span>
                    </td>
                    <td><AccountStatusBadge status={c.status} /></td>
                    <td className="text-right tabular-nums">{formatNumber(c.orderCount)}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">{c.orderCount ? formatMoney(c.totalSpend) : "—"}</td>
                    <td className="text-right"><Can cap="customers.edit"><RemoveMember groupId={group.id} customerId={c.id} name={c.companyName} /></Can></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title={state.search ? "No members match this search" : "No members yet"} description="Search above to add customers to this group." />
          )}
          <Pagination page={members.page} totalPages={members.totalPages} pathname={path} searchParams={listParams} />
        </div>

        <div className="min-w-0 space-y-4">
          <Card title="Group details">
            <WriteGuard cap="customers.edit"><GroupForm group={group} /></WriteGuard>
          </Card>
          <Notice tone="info" title="Ready for pricing rules">
            Future price and quantity rules will target the group ID <code>{group.id}</code>. Renaming keeps the ID. Those rules are not built yet.
          </Notice>
          <MockPermissionNote permission="customers.edit" />
        </div>
      </div>
      <div className="mt-6">
        <DemoEditingNotice />
      </div>
    </>
  );
}
