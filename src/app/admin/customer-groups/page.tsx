import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice } from "@/components/admin/demo-notice";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { GroupSortField } from "@/lib/data/repositories";
import { flatParams, listState } from "@/lib/list-params";

export const metadata: Metadata = { title: "Customer groups" };

const PATH = "/admin/customer-groups";
const SORTS = ["name", "customers"] as const satisfies readonly GroupSortField[];

export default async function CustomerGroupsPage({ searchParams }: PageProps<"/admin/customer-groups">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "name");
  const groups = await repositories.customers.listGroupSummaries({ ...state, perPage: 20 });
  const { notice, ...params } = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };

  return (
    <>
      <PageHeader
        title="Customer groups"
        description="Group customers by type. Future price and quantity rules will target these groups."
        actions={
          <ButtonLink href="/admin/customer-groups/new">
            <Icon name="plus" className="size-4" /> New group
          </ButtonLink>
        }
      />
      <ActionNotice notice={notice} />
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search groups"
        searchPlaceholder="Name, description or ID"
        total={groups.total}
        page={groups.page}
        perPage={groups.perPage}
      />
      <div className="space-y-6">
        {groups.items.length ? (
          <Table caption="Customer groups">
            <thead>
              <tr>
                <SortHeader label="Group" field="name" {...sorting} />
                <th scope="col">Description</th>
                <th scope="col">Group ID</th>
                <SortHeader label="Members" field="customers" defaultDir="desc" className="text-right" {...sorting} />
              </tr>
            </thead>
            <tbody>
              {groups.items.map((g) => (
                <tr key={g.id}>
                  <td className="font-medium">
                    <Link href={`/admin/customer-groups/${g.id}`} className="text-brand hover:underline">{g.name}</Link>
                  </td>
                  <td className="min-w-48 text-muted">{g.description ?? "—"}</td>
                  <td><code className="text-xs">{g.id}</code></td>
                  <td className="text-right tabular-nums">
                    <Link href={`/admin/customers?group=${g.id}`} className="hover:underline" aria-label={`${g.customerCount} members of ${g.name}`}>{g.customerCount}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No groups match this search" action={<ButtonLink href="/admin/customer-groups/new" variant="secondary">New group</ButtonLink>} />
        )}
        <Pagination page={groups.page} totalPages={groups.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}
