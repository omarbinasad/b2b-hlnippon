import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Can } from "@/components/admin/capabilities-context";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { BLOCK_KINDS, blockKindLabel } from "@/lib/content/blocks";
import { repositories } from "@/lib/data";
import type { ContentBlockSortField } from "@/lib/data/repositories";
import { formatDateTime } from "@/lib/format";
import { htmlToText } from "@/lib/html/sanitize";
import { flatParams, listState, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Reusable blocks" };

const SORTS = ["name", "updated", "usage"] as const satisfies readonly ContentBlockSortField[];
const KINDS = BLOCK_KINDS.map((k) => k.value);

export default async function BlocksPage({ searchParams }: PageProps<"/admin/blocks">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "name");
  const kind = oneOf(param(sp, "kind"), KINDS);
  const result = await repositories.blocks.list({ ...state, kind, perPage: 20 });
  const params = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: "/admin/blocks", params };
  return (
    <>
      <PageHeader
        title="Reusable blocks"
        description="Write an announcement, banner or call to action once and insert it into any page or post. Editing a block updates every page that uses it."
        actions={<Can cap="pages.create"><ButtonLink href="/admin/blocks/new"><Icon name="plus" className="size-4" /> Add block</ButtonLink></Can>}
      />
      <ListToolbar
        pathname="/admin/blocks"
        params={params}
        searchLabel="Search blocks"
        searchPlaceholder="Name or text"
        filters={[{ name: "kind", label: "Type", options: BLOCK_KINDS.map((k) => ({ value: k.value, label: k.label })), allLabel: "All types" }]}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
      />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Reusable blocks">
            <thead>
              <tr>
                <SortHeader label="Name" field="name" {...sorting} />
                <th scope="col">Type</th>
                <th scope="col">Preview</th>
                <SortHeader label="Used on" field="usage" defaultDir="desc" {...sorting} />
                <SortHeader label="Updated" field="updated" defaultDir="desc" {...sorting} />
              </tr>
            </thead>
            <tbody>
              {result.items.map((b) => (
                <tr key={b.id}>
                  <td className="min-w-48"><Link href={`/admin/blocks/${b.id}` as Route} className="font-medium text-brand hover:underline">{b.name}</Link></td>
                  <td><Badge tone="neutral">{blockKindLabel(b.kind)}</Badge></td>
                  <td className="max-w-80 text-sm text-muted"><span className="line-clamp-2">{htmlToText(b.bodyHtml)}</span></td>
                  <td className="text-sm whitespace-nowrap">{b.usedBy ? `${b.usedBy} ${b.usedBy === 1 ? "page or post" : "pages or posts"}` : <span className="text-muted">Not used</span>}</td>
                  <td className="text-sm whitespace-nowrap">{formatDateTime(b.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No blocks found" action={<Can cap="pages.create"><ButtonLink href="/admin/blocks/new"><Icon name="plus" className="size-4" /> Add block</ButtonLink></Can>} />
        )}
        <Pagination page={result.page} totalPages={result.totalPages} pathname="/admin/blocks" searchParams={params} />
      </div>
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
