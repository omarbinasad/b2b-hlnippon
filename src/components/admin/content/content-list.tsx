import { Can } from "@/components/admin/capabilities-context";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader, type FilterField } from "@/components/ui/list-controls";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { effectiveStatus, isLive } from "@/lib/content/rules";
import type { ContentSortField } from "@/lib/data/repositories";
import { formatDateTime } from "@/lib/format";
import type { BlogPost, ContentPage, ContentStatus, Paginated } from "@/lib/types";
import { ContentRowActions } from "./row-actions";

export const CONTENT_STATUSES = ["published", "draft", "scheduled", "trash"] as const satisfies readonly ContentStatus[];
const LABELS: Record<ContentStatus, string> = { published: "Published", draft: "Draft", scheduled: "Scheduled", trash: "Trash" };
const TONES = { published: "success", draft: "neutral", scheduled: "info", trash: "danger" } as const;

/** The list shared by Pages and Posts: search, status filter, sort and row actions. All filtering is on the server. */
export function ContentList({
  kind,
  result,
  counts,
  params,
  state,
  status,
  extraFilters = [],
}: {
  kind: "page" | "post";
  result: Paginated<ContentPage | BlogPost>;
  counts: Record<ContentStatus, number>;
  params: Record<string, string>;
  state: { sort: ContentSortField; dir?: "asc" | "desc"; search?: string };
  status?: ContentStatus;
  extraFilters?: FilterField[];
}) {
  const path = kind === "page" ? "/admin/pages" : "/admin/posts";
  const noun = kind === "page" ? "pages" : "posts";
  const sorting = { sort: state.sort, dir: state.dir, pathname: path, params };
  const total = counts.published + counts.draft + counts.scheduled;
  return (
    <>
      <ListToolbar
        pathname={path}
        params={params}
        searchLabel={`Search ${noun}`}
        searchPlaceholder="Title, address or excerpt"
        filters={[{ name: "status", label: "Status", options: CONTENT_STATUSES.map((s) => ({ value: s, label: `${LABELS[s]} (${counts[s]})` })), allLabel: `All (${total})` }, ...extraFilters]}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
      />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption={kind === "page" ? "Pages" : "Posts"}>
            <thead>
              <tr>
                <SortHeader label="Title" field="title" {...sorting} />
                <th scope="col">Status</th>
                {kind === "post" && <th scope="col">Categories</th>}
                {kind === "page" && <th scope="col">Visible to</th>}
                <SortHeader label="Published" field="published" defaultDir="desc" {...sorting} />
                <SortHeader label="Updated" field="updated" defaultDir="desc" {...sorting} />
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => {
                const s = effectiveStatus(item);
                const publicPath = kind === "page" ? `/${item.slug}` : `/blog/${item.slug}`;
                return (
                  <tr key={item.id}>
                    <td className="min-w-56">
                      {s === "trash" ? <span className="font-medium">{item.title}</span> : <Link href={`${path}/${item.id}` as Route} className="font-medium text-brand hover:underline">{item.title}</Link>}
                      <span className="block text-xs break-all text-muted">{publicPath}</span>
                    </td>
                    <td><Badge tone={TONES[s]}>{LABELS[s]}</Badge></td>
                    {kind === "post" && <td className="text-sm">{(item as BlogPost).categories.join(", ") || <span className="text-muted">None</span>}</td>}
                    {kind === "page" && <td className="text-sm whitespace-nowrap">{(item as ContentPage).visibility === "customers" ? "Approved customers" : "Everyone"}</td>}
                    <td className="text-sm whitespace-nowrap">{item.publishedAt && s !== "draft" ? formatDateTime(item.publishedAt) : <span className="text-muted">—</span>}</td>
                    <td className="text-sm whitespace-nowrap">{formatDateTime(item.updatedAt)}</td>
                    <td className="text-right">
                      <ContentRowActions kind={kind} id={item.id} title={item.title} trashed={s === "trash"} viewHref={isLive(item) ? publicPath : undefined} editHref={`${path}/${item.id}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title={status === "trash" ? "The trash is empty" : `No ${noun} found`}
            action={status === "trash" ? undefined : <Can cap={kind === "page" ? "pages.create" : "posts.create"}><ButtonLink href={`${path}/new` as Route}><Icon name="plus" className="size-4" /> Add {kind}</ButtonLink></Can>}
          />
        )}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={path} searchParams={params} />
      </div>
    </>
  );
}
