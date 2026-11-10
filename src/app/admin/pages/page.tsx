import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { CONTENT_STATUSES, ContentList } from "@/components/admin/content/content-list";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import type { ContentSortField } from "@/lib/data/repositories";
import { flatParams, listState, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Pages" };

const SORTS = ["updated", "published", "title"] as const satisfies readonly ContentSortField[];

export default async function PageListPage({ searchParams }: PageProps<"/admin/pages">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "updated");
  const status = oneOf(param(sp, "status"), CONTENT_STATUSES);
  const [result, counts] = await Promise.all([repositories.pages.adminList({ ...state, status, perPage: 20 }), repositories.pages.statusCounts()]);
  return (
    <>
      <PageHeader
        title="Pages"
        description="Website pages such as policies and guides, at their own address."
        actions={<Can cap="pages.create"><ButtonLink href="/admin/pages/new"><Icon name="plus" className="size-4" /> Add page</ButtonLink></Can>}
      />
      <ContentList kind="page" result={result} counts={counts} params={flatParams(sp)} state={state} status={status} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
