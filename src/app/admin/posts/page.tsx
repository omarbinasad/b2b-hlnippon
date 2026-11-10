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

export const metadata: Metadata = { title: "Posts" };

const SORTS = ["updated", "published", "title"] as const satisfies readonly ContentSortField[];

export default async function PostListPage({ searchParams }: PageProps<"/admin/posts">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "updated");
  const status = oneOf(param(sp, "status"), CONTENT_STATUSES);
  const category = param(sp, "category") || undefined;
  const [result, counts, categories] = await Promise.all([
    repositories.posts.adminList({ ...state, status, category, perPage: 20 }),
    repositories.posts.statusCounts(),
    repositories.posts.categories(),
  ]);
  return (
    <>
      <PageHeader
        title="Posts"
        description="Journal articles shown on the blog and homepage."
        actions={<div className="flex flex-wrap gap-2"><ButtonLink href="/admin/posts/categories" variant="secondary">Categories</ButtonLink><ButtonLink href="/admin/posts/tags" variant="secondary">Tags</ButtonLink><Can cap="posts.create"><ButtonLink href="/admin/posts/new"><Icon name="plus" className="size-4" /> Add post</ButtonLink></Can></div>}
      />
      <ContentList kind="post" result={result} counts={counts} params={flatParams(sp)} state={state} status={status} extraFilters={[{ name: "category", label: "Category", options: categories.map((c) => ({ value: c, label: c })), allLabel: "All categories" }]} />
      <div className="mt-6"><DemoEditingNotice /></div>
    </>
  );
}
